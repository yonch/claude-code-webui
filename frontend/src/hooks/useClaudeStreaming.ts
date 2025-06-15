import { useCallback } from "react";
import type {
  AllMessage,
  ChatMessage,
  SystemMessage,
  ToolMessage,
  StreamResponse,
  SDKMessage,
} from "../types";

interface StreamingContext {
  currentAssistantMessage: ChatMessage | null;
  setCurrentAssistantMessage: (msg: ChatMessage | null) => void;
  addMessage: (msg: AllMessage) => void;
  updateLastMessage: (content: string) => void;
  onSessionId?: (sessionId: string) => void;
  shouldShowInitMessage?: () => boolean;
  onInitMessageShown?: () => void;
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

export function useClaudeStreaming() {
  const createSystemMessage = useCallback(
    (claudeData: Extract<SDKMessage, { type: "system" }>): SystemMessage => {
      let summary = "";
      let details = "";

      if (claudeData.subtype === "init") {
        summary = "init";
        const detailsArray = [
          `Model: ${claudeData.model || "Unknown"}`,
          `Session: ${claudeData.session_id?.substring(0, 8) || "Unknown"}`,
          `Tools: ${claudeData.tools?.length || 0} available`,
        ];

        // Add CWD if available in the data
        if (claudeData.cwd) {
          detailsArray.push(`CWD: ${claudeData.cwd}`);
        }

        details = detailsArray.join("\n");
      } else {
        summary = claudeData.subtype || "system";
        details = JSON.stringify(claudeData, null, 2);
      }

      return {
        type: "system",
        summary,
        details,
        timestamp: Date.now(),
      };
    },
    [],
  );

  const createToolMessage = useCallback(
    (contentItem: {
      name?: string;
      input?: { description?: string; command?: string };
    }): ToolMessage => {
      let toolContent = `🔧 Using tool: ${contentItem.name}`;
      if (contentItem.input?.description) {
        toolContent += `\n${contentItem.input.description}`;
      }
      if (contentItem.input?.command) {
        toolContent += `\n$ ${contentItem.input.command}`;
      }

      return {
        type: "tool",
        content: toolContent,
        timestamp: Date.now(),
      };
    },
    [],
  );

  const createResultMessage = useCallback(
    (claudeData: Extract<SDKMessage, { type: "result" }>): SystemMessage => {
      const summary = claudeData.subtype || "result";
      const details = [
        `Duration: ${claudeData.duration_ms}ms`,
        `Cost: $${claudeData.total_cost_usd?.toFixed(4) || "0.0000"}`,
        `Tokens: ${claudeData.usage?.input_tokens || 0} in, ${claudeData.usage?.output_tokens || 0} out`,
      ].join("\n");

      return {
        type: "system",
        summary,
        details,
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
        name?: string;
        input?: { description?: string; command?: string };
      },
      context: StreamingContext,
    ) => {
      const toolMessage = createToolMessage(contentItem);
      context.addMessage(toolMessage);
    },
    [createToolMessage],
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

  const processClaudeData = useCallback(
    (claudeData: SDKMessage, context: StreamingContext) => {
      // Extract session_id from any message and notify context
      if (claudeData.session_id && context.onSessionId) {
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
          // Handle user messages if needed
          console.log("User message:", claudeData);
          break;
        default:
          console.log("Unknown Claude message type:", claudeData);
      }
    },
    [handleSystemMessage, handleAssistantMessage, handleResultMessage],
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
            type: "system",
            summary: "error",
            details: data.error || "Unknown error",
            timestamp: Date.now(),
          };
          context.addMessage(errorMessage);
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
