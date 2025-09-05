import { Context } from "hono";
import { logger } from "../utils/logger.ts";
import type { SessionManager } from "../services/sessionManager.ts";

/**
 * Handles POST /api/abort/:requestId requests
 * Aborts an ongoing chat request by session ID
 * @param c - Hono context object with config variables
 * @param sessionManager - SessionManager instance
 * @returns JSON response indicating success or failure
 */
export function handleAbortRequest(c: Context, sessionManager: SessionManager) {
  const requestId = c.req.param("requestId");

  if (!requestId) {
    return c.json({ error: "Request ID is required" }, 400);
  }

  logger.api.debug(`Abort attempt for request: ${requestId}`);

  // The requestId is actually the sessionId in the new architecture
  // since we want to abort the session's current execution
  const session = sessionManager.getSession(requestId);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const result = session.abort();

  if (result.aborted) {
    logger.api.debug(`Aborted session: ${requestId}`);
    return c.json({
      success: true,
      message: "Session aborted",
      clearedQueueSize: result.clearedQueueSize,
    });
  } else {
    return c.json({ error: "Session not currently processing" }, 404);
  }
}
