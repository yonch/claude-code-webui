/**
 * Session Manager Service
 *
 * Manages Claude sessions, message queues, and streaming subscribers.
 * Provides decoupled message enqueuing and real-time session updates.
 */

import {
  query,
  AbortError,
  type PermissionMode,
} from "@anthropic-ai/claude-code";
import { logger } from "../utils/logger.ts";
import type { StreamResponse } from "../../shared/types.ts";
import { loadConversation } from "../history/conversationLoader.ts";
import { encodeProjectName } from "../history/pathUtils.ts";
import type { RawHistoryLine } from "../history/parser.ts";

export interface QueuedMessage {
  messageId: string;
  content: string;
  timestamp: number;
  allowedTools?: string[];
  workingDirectory?: string;
  permissionMode?: PermissionMode;
}

export interface SessionExecution {
  messageId: string;
  abortController: AbortController;
}

export class Session {
  claudeSessionId: string | null = null; // Claude SDK session ID (null until first response)
  subscribers = new Set<SessionSubscriber>();
  messageQueue: QueuedMessage[] = [];
  messageHistory: StreamResponse[] = []; // History of all events for replay
  currentExecution: SessionExecution | null = null;
  isProcessing: boolean = false;
  historyLoaded: boolean = false; // Track if history has been loaded from disk
  workingDirectory: string | null = null; // Working directory for this session
  lastActivityTime: number = Date.now(); // Track last activity for idle timeout
  cleanupTimer: ReturnType<typeof setTimeout> | null = null; // Timer for delayed cleanup
  private manager: SessionManager;

  constructor(manager: SessionManager) {
    this.manager = manager;
  }

  subscribe(subscriber: SessionSubscriber, resumeFromMessageId?: string): void {
    // If no resumeFromMessageId provided, replay entire history
    // If resumeFromMessageId provided, replay from that point
    if (this.messageHistory.length > 0) {
      let foundStartPoint = !resumeFromMessageId; // Start immediately if no resume point
      for (const event of this.messageHistory) {
        // Start sending events after we find the resumeFromMessageId (or immediately if none)
        if (foundStartPoint) {
          try {
            subscriber.send(event);
          } catch (error) {
            logger.app.error(
              `Error replaying event to subscriber ${subscriber.id}: {error}`,
              { error },
            );
            return; // Don't add subscriber if replay fails
          }
        }
        if (resumeFromMessageId && event.messageId === resumeFromMessageId) {
          foundStartPoint = true;
        }
      }
    }

    this.subscribers.add(subscriber);

    logger.app.debug(
      `Subscriber ${subscriber.id} added to session${
        resumeFromMessageId ? ` (resumed from ${resumeFromMessageId})` : ""
      }`,
    );
  }

  unsubscribe(subscriberId: string): void {
    const subscriber = Array.from(this.subscribers).find(
      (s) => s.id === subscriberId,
    );
    if (subscriber) {
      this.subscribers.delete(subscriber);
      logger.app.debug(`Subscriber ${subscriberId} removed from session`);
    }

    // Schedule cleanup if session is empty and idle
    if (
      this.subscribers.size === 0 &&
      !this.isProcessing &&
      this.messageQueue.length === 0
    ) {
      this.manager.scheduleCleanup(this);
    }
  }

  queueMessage(
    content: string,
    allowedTools?: string[],
    workingDirectory?: string,
    permissionMode?: PermissionMode,
  ): string {
    const messageId = crypto.randomUUID();

    // Update last activity time
    this.lastActivityTime = Date.now();

    // Cancel any pending cleanup since we have new activity
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    const queuedMessage: QueuedMessage = {
      messageId,
      content,
      timestamp: Date.now(),
      allowedTools,
      workingDirectory,
      permissionMode,
    };

    this.messageQueue.push(queuedMessage);

    logger.app.debug(`Message queued: ${messageId}`);

    // Process queue if not processing
    if (!this.isProcessing) {
      this.manager.processQueue(this);
    }

    return messageId;
  }

  abort(): { aborted: boolean; clearedQueueSize: number } {
    let aborted = false;
    const clearedQueueSize = this.messageQueue.length;

    // Abort current execution
    if (this.currentExecution) {
      this.currentExecution.abortController.abort();
      this.currentExecution = null;
      aborted = true;
    }

    // Clear message queue
    this.messageQueue = [];

    // Update status
    this.isProcessing = false;

    // Broadcast abort event
    this.manager.broadcast(this, {
      type: "aborted",
      messageId: crypto.randomUUID(),
    });

    logger.app.debug(
      `Session aborted, cleared ${clearedQueueSize} queued messages`,
    );

    return { aborted, clearedQueueSize };
  }
}

export interface SessionSubscriber {
  id: string;
  send: (event: StreamResponse) => void;
  close: () => void;
}

export class SessionManager {
  private sessions = new Map<string, Session>(); // Keyed by Claude session ID once available
  private pendingSessions = new Set<Session>(); // Sessions without Claude ID yet
  private cliPath: string;
  private readonly IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

  constructor(cliPath: string) {
    this.cliPath = cliPath;
  }

  /**
   * Convert history line to StreamResponse format
   */
  private convertHistoryToStreamResponse(
    historyLine: RawHistoryLine,
  ): StreamResponse {
    // Convert RawHistoryLine to StreamResponse format
    // RawHistoryLine is already in Claude SDK format, so we wrap it as claude_json
    return {
      type: "claude_json",
      messageId: crypto.randomUUID(),
      data: historyLine,
    };
  }

  /**
   * Load conversation history from disk into session
   */
  private async loadHistoryIntoSession(session: Session): Promise<void> {
    if (
      !session.claudeSessionId ||
      !session.workingDirectory ||
      session.historyLoaded
    ) {
      return;
    }

    try {
      // Encode the working directory to get the project name
      const encodedProjectName = encodeProjectName(session.workingDirectory);

      // Load the conversation history
      const conversationHistory = await loadConversation(
        encodedProjectName,
        session.claudeSessionId,
      );

      if (conversationHistory && conversationHistory.messages.length > 0) {
        // Convert history messages to StreamResponse format
        const historyEvents: StreamResponse[] = [];

        for (const message of conversationHistory.messages) {
          // The messages are already in the correct format (RawHistoryLine)
          historyEvents.push(
            this.convertHistoryToStreamResponse(message as RawHistoryLine),
          );
        }

        // Prepend history to messageHistory (before any new messages)
        session.messageHistory = [...historyEvents, ...session.messageHistory];
        session.historyLoaded = true;

        logger.app.debug(
          `Loaded ${historyEvents.length} history events for session ${session.claudeSessionId}`,
        );
      }
    } catch (error) {
      // Log error but don't fail - session can continue without history
      logger.app.error(
        `Failed to load history for session ${session.claudeSessionId}: {error}`,
        { error },
      );
    }
  }

  /**
   * Create a new session
   */
  newSession(): Session {
    const session = new Session(this);
    this.pendingSessions.add(session);
    return session;
  }

  /**
   * Get an existing session by Claude session ID
   */
  getSession(sessionId: string): Session | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get or create a session, loading history if needed
   */
  async getOrCreateSession(
    sessionId: string | null,
    workingDirectory?: string,
  ): Promise<Session> {
    if (sessionId) {
      // Try to get existing session from memory
      const existingSession = this.getSession(sessionId);
      if (existingSession) {
        return existingSession;
      }

      // Session ID provided but not in memory - create a new session that will resume from this ID
      const session = this.newSession();
      session.claudeSessionId = sessionId;
      session.workingDirectory = workingDirectory || null;
      this.registerSession(session, sessionId);

      // Load history from disk
      await this.loadHistoryIntoSession(session);

      return session;
    } else {
      // No session ID provided, create new session
      const session = this.newSession();
      session.workingDirectory = workingDirectory || null;
      return session;
    }
  }

  /**
   * Register a session with its Claude ID (called when first response arrives or when resuming)
   */
  registerSession(session: Session, claudeSessionId: string): void {
    session.claudeSessionId = claudeSessionId;
    this.sessions.set(claudeSessionId, session);
    this.pendingSessions.delete(session);
    logger.app.debug("Registered session with Claude ID {claudeSessionId}", {
      claudeSessionId,
    });
  }

  /**
   * Schedule session cleanup after idle timeout
   */
  scheduleCleanup(session: Session): void {
    // Cancel any existing cleanup timer
    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
    }

    const timeSinceLastActivity = Date.now() - session.lastActivityTime;
    const timeUntilCleanup = Math.max(
      0,
      this.IDLE_TIMEOUT_MS - timeSinceLastActivity,
    );

    logger.app.debug(
      `Scheduling cleanup for session ${session.claudeSessionId} in ${Math.round(timeUntilCleanup / 1000)} seconds`,
    );

    session.cleanupTimer = setTimeout(() => {
      // Check if session is still idle
      if (
        session.subscribers.size === 0 &&
        !session.isProcessing &&
        session.messageQueue.length === 0
      ) {
        const idleTime = Date.now() - session.lastActivityTime;
        if (idleTime >= this.IDLE_TIMEOUT_MS) {
          this.cleanupSession(session);
        } else {
          // Reschedule if not idle long enough
          this.scheduleCleanup(session);
        }
      }
    }, timeUntilCleanup);
  }

  /**
   * Clean up an empty session
   */
  cleanupSession(session: Session): void {
    // Cancel cleanup timer if exists
    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
      session.cleanupTimer = null;
    }

    if (session.claudeSessionId) {
      this.sessions.delete(session.claudeSessionId);
      logger.app.debug(
        `Session ${session.claudeSessionId} cleaned up after ${Math.round(
          (Date.now() - session.lastActivityTime) / 1000,
        )} seconds of inactivity`,
      );
    } else {
      this.pendingSessions.delete(session);
      logger.app.debug(`Pending session cleaned up`);
    }
  }

  /**
   * Broadcast event to all session subscribers and store in history
   */
  broadcast(session: Session, event: StreamResponse): void {
    // Update last activity time for any broadcast
    session.lastActivityTime = Date.now();

    // Store event in history for replay
    session.messageHistory.push(event);

    session.subscribers.forEach((subscriber) => {
      try {
        subscriber.send(event);
      } catch (error) {
        logger.app.error(
          `Error sending to subscriber ${subscriber.id}: {error}`,
          { error },
        );
        // Remove failed subscriber
        session.subscribers.delete(subscriber);
      }
    });
  }

  /**
   * Process the next message in the queue
   */
  async processQueue(session: Session): Promise<void> {
    if (session.isProcessing || session.messageQueue.length === 0) {
      return;
    }

    const queuedMessage = session.messageQueue.shift()!;

    // Update session status
    session.isProcessing = true;
    session.currentExecution = {
      messageId: queuedMessage.messageId,
      abortController: new AbortController(),
    };

    // Broadcast user message
    this.broadcast(session, {
      type: "user_message",
      messageId: queuedMessage.messageId,
      data: {
        message: queuedMessage.content,
        timestamp: queuedMessage.timestamp,
      },
    });

    try {
      await this.executeMessage(session, queuedMessage);
    } catch (error) {
      logger.app.error(
        `Error processing message ${queuedMessage.messageId}: {error}`,
        { error },
      );

      if (error instanceof AbortError) {
        // Abort was handled in abort(), don't send error
        return;
      }

      this.broadcast(session, {
        type: "error",
        messageId: crypto.randomUUID(),
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      // Reset session state
      if (session.currentExecution?.messageId === queuedMessage.messageId) {
        session.currentExecution = null;
        session.isProcessing = false;

        // Broadcast done state to all subscribers
        this.broadcast(session, {
          type: "done",
          messageId: crypto.randomUUID(),
        });

        // Process next message in queue if any
        if (session.messageQueue.length > 0) {
          setImmediate(() => this.processQueue(session));
        } else if (session.subscribers.size === 0) {
          // Schedule cleanup if no subscribers and no more messages
          this.scheduleCleanup(session);
        }
      }
    }
  }

  /**
   * Execute a Claude command for a message
   */
  private async executeMessage(
    session: Session,
    message: QueuedMessage,
  ): Promise<void> {
    if (!session.currentExecution) return;

    const { abortController } = session.currentExecution;

    // Process commands that start with '/'
    let processedMessage = message.content;
    if (message.content.startsWith("/")) {
      processedMessage = message.content.substring(1);
    }

    const cliPath = this.cliPath;

    for await (const sdkMessage of query({
      prompt: processedMessage,
      options: {
        abortController,
        executable: "node" as const,
        executableArgs: [],
        pathToClaudeCodeExecutable: cliPath,
        ...(session.claudeSessionId ? { resume: session.claudeSessionId } : {}),
        ...(message.allowedTools ? { allowedTools: message.allowedTools } : {}),
        ...(message.workingDirectory ? { cwd: message.workingDirectory } : {}),
        ...(message.permissionMode
          ? { permissionMode: message.permissionMode }
          : {}),
      },
    })) {
      // Check if we've been aborted
      if (abortController.signal.aborted) {
        throw new AbortError("Execution aborted");
      }

      logger.app.debug("Claude SDK Message: {sdkMessage}", { sdkMessage });

      // Extract Claude session ID from first SDK response if we don't have it yet
      if (!session.claudeSessionId && (sdkMessage as any).session_id) {
        const claudeSessionId = (sdkMessage as any).session_id;
        this.registerSession(session, claudeSessionId);
      } else if (session.claudeSessionId && (sdkMessage as any).session_id) {
        // Check if Claude SDK returned a different session ID when resuming
        const returnedSessionId = (sdkMessage as any).session_id;
        if (returnedSessionId !== session.claudeSessionId) {
          logger.app.debug(
            "Claude SDK returned new session ID when resuming. Re-indexing from {original} to {new}",
            { original: session.claudeSessionId, new: returnedSessionId },
          );
          // Re-index the session with the new ID
          this.sessions.delete(session.claudeSessionId);
          this.registerSession(session, returnedSessionId);
        }
      }

      this.broadcast(session, {
        type: "claude_json",
        messageId: crypto.randomUUID(),
        data: sdkMessage,
      });
    }
  }
}

// Singleton instance will be created when app starts
export let sessionManager: SessionManager;

export function initializeSessionManager(cliPath: string): void {
  sessionManager = new SessionManager(cliPath);
}
