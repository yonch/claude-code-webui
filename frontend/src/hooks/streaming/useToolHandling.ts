import { useCallback } from "react";
import { extractToolInfo, generateToolPatterns } from "../../utils/toolUtils";
import type { StreamingContext } from "./useMessageProcessor";
import type { ToolResultMessage } from "../../types";

interface ToolCache {
  name: string;
  input: Record<string, unknown>;
}

// Helper function to detect tool use errors that should be displayed as regular results
function isToolUseError(content: string): boolean {
  return content.includes("tool_use_error");
}

export function useToolHandling() {
  // Store tool_use information for later matching with tool_result
  const toolUseCache = useCallback(() => {
    const cache = new Map<string, ToolCache>();
    return {
      set: (id: string, name: string, input: Record<string, unknown>) =>
        cache.set(id, { name, input }),
      get: (id: string) => cache.get(id),
      clear: () => cache.clear(),
    };
  }, [])();

  const handlePermissionError = useCallback(
    (
      contentItem: { tool_use_id?: string; content: string },
      context: StreamingContext,
    ) => {
      // Immediately abort the current request
      if (context.onAbortRequest) {
        context.onAbortRequest();
      }

      // Get cached tool_use information
      const toolUseId = contentItem.tool_use_id || "";
      const cachedToolInfo = toolUseCache.get(toolUseId);

      // Extract tool information for permission handling
      const { toolName, commands } = extractToolInfo(
        cachedToolInfo?.name,
        cachedToolInfo?.input,
      );

      // Compute patterns based on tool type
      const patterns = generateToolPatterns(toolName, commands);

      // Notify parent component about permission error
      if (context.onPermissionError) {
        context.onPermissionError(toolName, patterns, toolUseId);
      }
    },
    [toolUseCache],
  );

  const processToolResult = useCallback(
    (
      contentItem: {
        tool_use_id?: string;
        content: string;
        is_error?: boolean;
      },
      context: StreamingContext,
      createToolResultMessage: (
        toolName: string,
        content: string,
      ) => ToolResultMessage,
    ) => {
      const content =
        typeof contentItem.content === "string"
          ? contentItem.content
          : JSON.stringify(contentItem.content);

      // Check for permission errors - but skip tool use errors which should be displayed as regular results
      if (contentItem.is_error && !isToolUseError(content)) {
        handlePermissionError(contentItem, context);
        return;
      }

      // Get cached tool_use information to determine tool name
      const toolUseId = contentItem.tool_use_id || "";
      const cachedToolInfo = toolUseCache.get(toolUseId);
      const toolName = cachedToolInfo?.name || "Tool";

      // Don't show tool_result for TodoWrite since we already show TodoMessage from tool_use
      if (toolName === "TodoWrite") {
        return;
      }

      // This is a regular tool result - create a ToolResultMessage
      const toolResultMessage = createToolResultMessage(toolName, content);
      context.addMessage(toolResultMessage);
    },
    [handlePermissionError, toolUseCache],
  );

  return {
    toolUseCache,
    processToolResult,
  };
}
