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
  private manager: SessionManager;

  constructor(manager: SessionManager) {
    this.manager = manager;
  }

  subscribe(subscriber: SessionSubscriber, resumeFromMessageId?: string): void {
    // Replay messages if resumeFromMessageId is provided
    if (resumeFromMessageId && this.messageHistory.length > 0) {
      let foundStartPoint = false;
      for (const event of this.messageHistory) {
        // Start sending events after we find the resumeFromMessageId
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
        if (event.messageId === resumeFromMessageId) {
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

    // Request cleanup if session is empty
    if (
      this.subscribers.size === 0 &&
      !this.isProcessing &&
      this.messageQueue.length === 0
    ) {
      this.manager.cleanupSession(this);
    }
  }

  queueMessage(
    content: string,
    allowedTools?: string[],
    workingDirectory?: string,
    permissionMode?: PermissionMode,
  ): string {
    const messageId = crypto.randomUUID();

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

  constructor(cliPath: string) {
    this.cliPath = cliPath;
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
   * Clean up an empty session
   */
  cleanupSession(session: Session): void {
    if (session.claudeSessionId) {
      this.sessions.delete(session.claudeSessionId);
      logger.app.debug(`Session ${session.claudeSessionId} cleaned up`);
    } else {
      this.pendingSessions.delete(session);
      logger.app.debug(`Pending session cleaned up`);
    }
  }

  /**
   * Broadcast event to all session subscribers and store in history
   */
  broadcast(session: Session, event: StreamResponse): void {
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
