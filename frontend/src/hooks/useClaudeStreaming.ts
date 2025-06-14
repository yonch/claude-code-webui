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
      let systemContent = "";
      if (claudeData.subtype === "init") {
        systemContent = `🔧 Claude Code initialized\nModel: ${claudeData.model || "Unknown"}\nSession: ${claudeData.session_id?.substring(0, 8) || "Unknown"}\nTools: ${claudeData.tools?.length || 0} available`;
      } else {
        systemContent = `System: ${JSON.stringify(claudeData)}`;
      }

      return {
        type: "system",
        content: systemContent,
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
      const resultContent = `✅ Task ${claudeData.subtype}\nDuration: ${claudeData.duration_ms}ms\nCost: $${claudeData.total_cost_usd?.toFixed(4) || "0.0000"}\nTokens: ${claudeData.usage?.input_tokens || 0} in, ${claudeData.usage?.output_tokens || 0} out`;

      return {
        type: "system",
        content: resultContent,
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
      const systemMessage = createSystemMessage(claudeData);
      context.addMessage(systemMessage);
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
            content: `❌ Error: ${data.error}`,
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
