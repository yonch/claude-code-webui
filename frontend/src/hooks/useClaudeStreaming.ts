import { useCallback } from "react";
import type {
  AllMessage,
  ChatMessage,
  SystemMessage,
  ToolMessage,
  ToolResultMessage,
  StreamResponse,
  SDKMessage,
  AbortMessage,
} from "../types";

interface StreamingContext {
  currentAssistantMessage: ChatMessage | null;
  setCurrentAssistantMessage: (msg: ChatMessage | null) => void;
  addMessage: (msg: AllMessage) => void;
  updateLastMessage: (content: string) => void;
  onSessionId?: (sessionId: string) => void;
  shouldShowInitMessage?: () => boolean;
  onInitMessageShown?: () => void;
  hasReceivedInit?: boolean;
  setHasReceivedInit?: (received: boolean) => void;
  onPermissionError?: (
    toolName: string,
    pattern: string,
    toolUseId: string,
  ) => void;
  onAbortRequest?: () => void;
}

// Type guard functions for SDKMessage
function isSystemMessage(
  data: SDKMessage,
): data is Extract<SDKMessage, { type: "system" }> {
  return data.type === "system";
}

function isAssistantMessage(
  data: SDKMessage,
): data is Extract<SDKMessage, { type: "assistant" }> {
  return data.type === "assistant";
}

function isResultMessage(
  data: SDKMessage,
): data is Extract<SDKMessage, { type: "result" }> {
  return data.type === "result";
}

function isUserMessage(
  data: SDKMessage,
): data is Extract<SDKMessage, { type: "user" }> {
  return data.type === "user";
}

// Extract tool name and command from tool_use_id and previous context
function extractToolInfo(
  _toolUseId: string,
  toolName?: string,
  input?: Record<string, unknown>,
): { toolName: string; command: string } {
  // Default tool name if not provided
  const extractedToolName = toolName || "Unknown";

  // Extract command from input for pattern matching
  let command = "";

  // For Bash tool, parse command details
  if (
    extractedToolName === "Bash" &&
    input?.command &&
    typeof input.command === "string"
  ) {
    const cmdParts = input.command.split(/\s+/);
    // Find the first option (starts with -)
    const optionIndex = cmdParts.findIndex((part) => part.startsWith("-"));

    if (optionIndex > 0) {
      // Take everything before the first option
      command = cmdParts.slice(0, optionIndex).join(" ");
    } else {
      // No options found, take the first part(s)
      // Handle common patterns like "cargo run", "git log", etc.
      if (
        cmdParts.length >= 2 &&
        ["cargo", "git", "npm", "yarn", "docker"].includes(cmdParts[0])
      ) {
        command = cmdParts.slice(0, 2).join(" ");
      } else {
        command = cmdParts[0] || "";
      }
    }
  } else {
    // For all non-Bash tools (Write, Edit, Read, etc.), use wildcard
    command = "*";
  }

  // Ensure command is never empty for non-Bash tools
  if (extractedToolName !== "Bash" && (!command || command === "")) {
    command = "*";
  }

  return { toolName: extractedToolName, command };
}

// Check if tool_result contains permission error
function isPermissionError(content: string): boolean {
  return (
    content.includes("requested permissions") ||
    content.includes("haven't granted it yet") ||
    content.includes("permission denied")
  );
}

export function useClaudeStreaming() {
  // Store tool_use information for later matching with tool_result
  const toolUseCache = useCallback(() => {
    const cache = new Map<
      string,
      { name: string; input: Record<string, unknown> }
    >();
    return {
      set: (id: string, name: string, input: Record<string, unknown>) =>
        cache.set(id, { name, input }),
      get: (id: string) => cache.get(id),
      clear: () => cache.clear(),
    };
  }, [])();
  const createSystemMessage = useCallback(
    (claudeData: Extract<SDKMessage, { type: "system" }>): SystemMessage => {
      return {
        ...claudeData,
        timestamp: Date.now(),
      };
    },
    [],
  );

  const createToolMessage = useCallback(
    (contentItem: {
      name?: string;
      input?: Record<string, unknown>;
    }): ToolMessage => {
      const toolName = contentItem.name || "Unknown";

      // Format arguments for display
      let argsDisplay = "";
      if (contentItem.input) {
        const input = contentItem.input;
        // Special handling for common tool arguments
        if (input.path) {
          argsDisplay = `(${input.path})`;
        } else if (input.file_path) {
          argsDisplay = `(${input.file_path})`;
        } else if (input.command) {
          argsDisplay = `(${input.command})`;
        } else if (input.pattern) {
          argsDisplay = `(${input.pattern})`;
        } else if (input.url) {
          argsDisplay = `(${input.url})`;
        } else {
          // For other tools, show key arguments
          const keys = Object.keys(input);
          if (keys.length > 0) {
            const firstKey = keys[0];
            const value = input[firstKey];
            if (typeof value === "string" && value.length < 50) {
              argsDisplay = `(${value})`;
            } else {
              argsDisplay = `(${keys.length} ${keys.length === 1 ? "arg" : "args"})`;
            }
          }
        }
      }

      return {
        type: "tool",
        content: `${toolName}${argsDisplay}`,
        timestamp: Date.now(),
      };
    },
    [],
  );

  const createResultMessage = useCallback(
    (claudeData: Extract<SDKMessage, { type: "result" }>): SystemMessage => {
      return {
        ...claudeData,
        timestamp: Date.now(),
      };
    },
    [],
  );

  const createToolResultMessage = useCallback(
    (toolName: string, content: string): ToolResultMessage => {
      // Generate a summary from the content
      let summary = "";

      // Try to extract meaningful summary from common tool results
      if (content.includes("\n")) {
        const lines = content.split("\n").filter((line) => line.trim());
        if (lines.length > 0) {
          summary = `${lines.length} ${lines.length === 1 ? "line" : "lines"}`;
        }
      } else if (content.includes("Found")) {
        const match = content.match(/Found (\d+)/);
        if (match) {
          summary = `Found ${match[1]}`;
        }
      } else if (content.includes("files")) {
        const match = content.match(/(\d+)\s+files?/);
        if (match) {
          summary = `${match[1]} files`;
        }
      } else if (content.length < 50) {
        summary = content.trim();
      } else {
        summary = `${content.length} chars`;
      }

      return {
        type: "tool_result",
        toolName,
        content,
        summary,
        timestamp: Date.now(),
      };
    },
    [],
  );

  const handleSystemMessage = useCallback(
    (
      claudeData: Extract<SDKMessage, { type: "system" }>,
      context: StreamingContext,
    ) => {
      // Check if this is an init message and if we should show it
      if (claudeData.subtype === "init") {
        // Mark that we've received init
        context.setHasReceivedInit?.(true);

        const shouldShow = context.shouldShowInitMessage?.() ?? true;
        if (shouldShow) {
          const systemMessage = createSystemMessage(claudeData);
          context.addMessage(systemMessage);
          context.onInitMessageShown?.();
        }
      } else {
        // Always show non-init system messages
        const systemMessage = createSystemMessage(claudeData);
        context.addMessage(systemMessage);
      }
    },
    [createSystemMessage],
  );

  const handleAssistantTextMessage = useCallback(
    (contentItem: { text?: string }, context: StreamingContext) => {
      let messageToUpdate = context.currentAssistantMessage;

      if (!messageToUpdate) {
        messageToUpdate = {
          type: "chat",
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        };
        context.setCurrentAssistantMessage(messageToUpdate);
        context.addMessage(messageToUpdate);
      }

      const updatedContent =
        (messageToUpdate.content || "") + (contentItem.text || "");

      // Update the current assistant message state
      const updatedMessage = {
        ...messageToUpdate,
        content: updatedContent,
      };
      context.setCurrentAssistantMessage(updatedMessage);
      context.updateLastMessage(updatedContent);
    },
    [],
  );

  const handleToolUseMessage = useCallback(
    (
      contentItem: {
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      },
      context: StreamingContext,
    ) => {
      // Cache tool_use information for later permission error handling
      if (contentItem.id && contentItem.name) {
        toolUseCache.set(
          contentItem.id,
          contentItem.name,
          contentItem.input || {},
        );
      }

      const toolMessage = createToolMessage(contentItem);
      context.addMessage(toolMessage);
    },
    [createToolMessage, toolUseCache],
  );

  const handleAssistantMessage = useCallback(
    (
      claudeData: Extract<SDKMessage, { type: "assistant" }>,
      context: StreamingContext,
    ) => {
      for (const contentItem of claudeData.message.content) {
        if (contentItem.type === "text") {
          handleAssistantTextMessage(contentItem, context);
        } else if (contentItem.type === "tool_use") {
          handleToolUseMessage(contentItem, context);
        }
      }
    },
    [handleAssistantTextMessage, handleToolUseMessage],
  );

  const handleResultMessage = useCallback(
    (
      claudeData: Extract<SDKMessage, { type: "result" }>,
      context: StreamingContext,
    ) => {
      const resultMessage = createResultMessage(claudeData);
      context.addMessage(resultMessage);
      context.setCurrentAssistantMessage(null);
    },
    [createResultMessage],
  );

  const handleUserMessage = useCallback(
    (
      claudeData: Extract<SDKMessage, { type: "user" }>,
      context: StreamingContext,
    ) => {
      // Check if this user message contains tool_result content
      const messageContent = claudeData.message.content;

      if (Array.isArray(messageContent)) {
        for (const contentItem of messageContent) {
          if (contentItem.type === "tool_result") {
            const content =
              typeof contentItem.content === "string"
                ? contentItem.content
                : JSON.stringify(contentItem.content);

            // Check for permission errors
            if (contentItem.is_error && isPermissionError(content)) {
              // Immediately abort the current request
              if (context.onAbortRequest) {
                context.onAbortRequest();
              }

              // Get cached tool_use information
              const toolUseId = contentItem.tool_use_id || "";
              const cachedToolInfo = toolUseCache.get(toolUseId);

              // Extract tool information for permission handling
              const { toolName, command } = extractToolInfo(
                toolUseId,
                cachedToolInfo?.name,
                cachedToolInfo?.input,
              );

              // Compute pattern based on tool type
              const pattern =
                toolName === "Bash" && command !== "*"
                  ? `${toolName}(${command}:*)`
                  : `${toolName}(*)`;

              // Notify parent component about permission error
              if (context.onPermissionError) {
                context.onPermissionError(toolName, pattern, toolUseId);
              }

              // Don't add the error message to the chat - we'll handle it with the dialog
              return;
            }

            // This is a regular tool result - create a ToolResultMessage
            const toolName = "Tool result";
            const toolResultMessage = createToolResultMessage(
              toolName,
              content,
            );
            context.addMessage(toolResultMessage);
          }
        }
      }
      // Note: We don't display regular user messages from the SDK as they represent Claude's internal tool results
    },
    [createToolResultMessage, toolUseCache],
  );

  const processClaudeData = useCallback(
    (claudeData: SDKMessage, context: StreamingContext) => {
      // Update sessionId only for the first assistant message after init
      if (
        claudeData.type === "assistant" &&
        context.hasReceivedInit &&
        claudeData.session_id &&
        context.onSessionId
      ) {
        context.onSessionId(claudeData.session_id);
      }

      switch (claudeData.type) {
        case "system":
          if (isSystemMessage(claudeData)) {
            handleSystemMessage(claudeData, context);
          } else {
            console.warn("Invalid system message:", claudeData);
          }
          break;
        case "assistant":
          if (isAssistantMessage(claudeData)) {
            handleAssistantMessage(claudeData, context);
          } else {
            console.warn("Invalid assistant message:", claudeData);
          }
          break;
        case "result":
          if (isResultMessage(claudeData)) {
            handleResultMessage(claudeData, context);
          } else {
            console.warn("Invalid result message:", claudeData);
          }
          break;
        case "user":
          if (isUserMessage(claudeData)) {
            handleUserMessage(claudeData, context);
          } else {
            console.warn("Invalid user message:", claudeData);
          }
          break;
        default:
          console.log("Unknown Claude message type:", claudeData);
      }
    },
    [
      handleSystemMessage,
      handleAssistantMessage,
      handleResultMessage,
      handleUserMessage,
    ],
  );

  const processStreamLine = useCallback(
    (line: string, context: StreamingContext) => {
      try {
        const data: StreamResponse = JSON.parse(line);

        if (data.type === "claude_json" && data.data) {
          // data.data is already an SDKMessage object, no need to parse
          const claudeData = data.data as SDKMessage;
          processClaudeData(claudeData, context);
        } else if (data.type === "error") {
          const errorMessage: SystemMessage = {
            type: "error",
            subtype: "stream_error",
            message: data.error || "Unknown error",
            timestamp: Date.now(),
          };
          context.addMessage(errorMessage);
        } else if (data.type === "aborted") {
          const abortedMessage: AbortMessage = {
            type: "system",
            subtype: "abort",
            message: "Operation was aborted by user",
            timestamp: Date.now(),
          };
          context.addMessage(abortedMessage);
          context.setCurrentAssistantMessage(null);
        }
      } catch (parseError) {
        console.error("Failed to parse stream line:", parseError);
      }
    },
    [processClaudeData],
  );

  return {
    processStreamLine,
  };
}
