import { useCallback } from "react";
import { getAbortUrl } from "../../config/api";

export function useAbortController() {
  // Helper function to perform abort request (using sessionId)
  const performAbortRequest = useCallback(async (sessionId: string) => {
    await fetch(getAbortUrl(sessionId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  }, []);

  const abortRequest = useCallback(
    async (
      sessionId: string | null,
      isLoading: boolean,
      onAbortComplete: () => void,
    ) => {
      if (!sessionId || !isLoading) return;

      try {
        await performAbortRequest(sessionId);
      } catch (error) {
        console.error("Failed to abort request:", error);
      } finally {
        // Clean up state after successful abort or error
        onAbortComplete();
      }
    },
    [performAbortRequest],
  );

  const createAbortHandler = useCallback(
    (sessionId: string) => async () => {
      try {
        await performAbortRequest(sessionId);
      } catch (error) {
        console.error("Failed to abort request:", error);
      }
    },
    [performAbortRequest],
  );

  return {
    abortRequest,
    createAbortHandler,
  };
}
