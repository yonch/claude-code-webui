import { useCallback } from "react";
import { getAbortUrl } from "../../config/api";

export function useAbortController() {
  const abortRequest = useCallback(
    async (
      requestId: string | null,
      isLoading: boolean,
      onAbortComplete: () => void,
    ) => {
      if (!requestId || !isLoading) return;

      try {
        await fetch(getAbortUrl(requestId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        // Clean up state after successful abort
        onAbortComplete();
      } catch (error) {
        console.error("Failed to abort request:", error);
        // Still clean up on error
        onAbortComplete();
      }
    },
    [],
  );

  const createAbortHandler = useCallback(
    (requestId: string) => async () => {
      try {
        await fetch(getAbortUrl(requestId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Failed to abort request:", error);
      }
    },
    [],
  );

  return {
    abortRequest,
    createAbortHandler,
  };
}
