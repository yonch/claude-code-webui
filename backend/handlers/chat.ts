import { Context } from "hono";
import type { ChatRequest, StreamResponse } from "../../shared/types.ts";
import { logger } from "../utils/logger.ts";
import {
  type Session,
  type SessionManager,
  type SessionSubscriber,
} from "../services/sessionManager.ts";

/**
 * Handles POST /api/chat requests with streaming responses
 * @param c - Hono context object with config variables
 * @param sessionManager - SessionManager instance
 * @returns Response with streaming NDJSON
 */
export async function handleChatRequest(
  c: Context,
  sessionManager: SessionManager,
) {
  const chatRequest: ChatRequest = await c.req.json();

  logger.chat.debug(
    "Received chat request {*}",
    chatRequest as unknown as Record<string, unknown>,
  );

  // Get or create a session (will load history if needed)
  const session = await sessionManager.getOrCreateSession(
    chatRequest.sessionId || null,
    chatRequest.workingDirectory,
  );

  if (chatRequest.sessionId && session.historyLoaded) {
    logger.chat.debug("Using session with loaded history");
  } else if (chatRequest.sessionId) {
    logger.chat.debug("Resuming session (no history on disk)");
  } else {
    logger.chat.debug("Created new session");
  }

  const stream = new ReadableStream({
    start(controller) {
      const subscriberId = chatRequest.requestId;
      let isClosed = false;

      // Create subscriber object
      const subscriber: SessionSubscriber = {
        id: subscriberId,
        send: (event: StreamResponse) => {
          if (isClosed) return;

          // Send all events directly to frontend (they're already StreamResponse)
          const data = JSON.stringify(event) + "\n";
          controller.enqueue(new TextEncoder().encode(data));
        },
        close: () => {
          if (!isClosed) {
            isClosed = true;
            // Send done event before closing
            const doneResponse: StreamResponse = { type: "done" };
            controller.enqueue(
              new TextEncoder().encode(JSON.stringify(doneResponse) + "\n"),
            );
            controller.close();
          }
        },
      };

      try {
        // Subscribe to session (with optional resume from messageId)
        session.subscribe(subscriber, chatRequest.resumeFromMessageId);

        // If a message is provided, enqueue it
        if (chatRequest.message) {
          session.queueMessage(
            chatRequest.message,
            chatRequest.allowedTools,
            chatRequest.workingDirectory,
            chatRequest.permissionMode,
          );
        }
      } catch (error) {
        logger.chat.error("Error setting up session subscription: {error}", {
          error,
        });
        const errorResponse: StreamResponse = {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
        controller.enqueue(
          new TextEncoder().encode(JSON.stringify(errorResponse) + "\n"),
        );
        controller.close();
      }

      // Handle stream cancellation
      (controller as any).signal?.addEventListener("abort", () => {
        session.unsubscribe(subscriberId);
        subscriber.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
