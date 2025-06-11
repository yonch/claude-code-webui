import { useCallback } from "react";
import type {
  AllMessage,
  ChatMessage,
  SystemMessage,
  ToolMessage,
  StreamResponse,
  ClaudeAssistantMessage,
  ClaudeResultMessage,
} from "../types";

interface StreamingContext {
  currentAssistantMessage: ChatMessage | null;
  setCurrentAssistantMessage: (msg: ChatMessage | null) => void;
  addMessage: (msg: AllMessage) => void;
  updateLastMessage: (content: string) => void;
}

// Type guard functions
type ClaudeSystemData = {
  type: "system";
  subtype?: string;
  model?: string;
  session_id?: string;
  tools?: unknown[];
  message?: unknown;
};

function isClaudeSystemMessage(data: unknown): data is ClaudeSystemData {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === "system"
  );
}

function isClaudeAssistantMessage(
  data: unknown,
): data is ClaudeAssistantMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === "assistant" &&
    "message" in data &&
    typeof data.message === "object" &&
    data.message !== null &&
    "content" in data.message
  );
}

function isClaudeResultMessage(data: unknown): data is ClaudeResultMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === "result" &&
    "subtype" in data &&
    "cost_usd" in data &&
    "duration_ms" in data
  );
}

export function useClaudeStreaming() {
  const createSystemMessage = useCallback(
    (claudeData: ClaudeSystemData): SystemMessage => {
      let systemContent = "";
      if (claudeData.subtype === "init") {
        systemContent = `🔧 Claude Code initialized\nModel: ${claudeData.model || "Unknown"}\nSession: ${claudeData.session_id?.substring(0, 8) || "Unknown"}\nTools: ${claudeData.tools?.length || 0} available`;
      } else {
        systemContent = `System: ${claudeData.message || JSON.stringify(claudeData)}`;
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
    (claudeData: ClaudeResultMessage): SystemMessage => {
      const resultContent = `✅ Task ${claudeData.subtype}\nDuration: ${claudeData.duration_ms}ms\nCost: $${claudeData.cost_usd?.toFixed(4) || "0.0000"}\nTokens: ${claudeData.usage?.input_tokens || 0} in, ${claudeData.usage?.output_tokens || 0} out`;

      return {
        type: "system",
        content: resultContent,
        timestamp: Date.now(),
      };
    },
    [],
  );

  const handleSystemMessage = useCallback(
    (claudeData: ClaudeSystemData, context: StreamingContext) => {
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
    (claudeData: ClaudeAssistantMessage, context: StreamingContext) => {
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
    (claudeData: ClaudeResultMessage, context: StreamingContext) => {
      const resultMessage = createResultMessage(claudeData);
      context.addMessage(resultMessage);
      context.setCurrentAssistantMessage(null);
    },
    [createResultMessage],
  );

  const processClaudeData = useCallback(
    (claudeData: unknown, context: StreamingContext) => {
      if (
        typeof claudeData !== "object" ||
        claudeData === null ||
        !("type" in claudeData)
      ) {
        console.warn("Invalid Claude data:", claudeData);
        return;
      }

      switch (claudeData.type) {
        case "system":
          if (isClaudeSystemMessage(claudeData)) {
            handleSystemMessage(claudeData, context);
          } else {
            console.warn("Invalid system message:", claudeData);
          }
          break;
        case "assistant":
          if (isClaudeAssistantMessage(claudeData)) {
            handleAssistantMessage(claudeData, context);
          } else {
            console.warn("Invalid assistant message:", claudeData);
          }
          break;
        case "result":
          if (isClaudeResultMessage(claudeData)) {
            handleResultMessage(claudeData, context);
          } else {
            console.warn("Invalid result message:", claudeData);
          }
          break;
        default:
          console.log("Unknown Claude message type:", claudeData.type);
      }
    },
    [handleSystemMessage, handleAssistantMessage, handleResultMessage],
  );

  const processStreamLine = useCallback(
    (line: string, context: StreamingContext) => {
      try {
        const data: StreamResponse = JSON.parse(line);

        if (data.type === "claude_json" && data.data) {
          try {
            const claudeData = JSON.parse(data.data);
            processClaudeData(claudeData, context);
          } catch (parseError) {
            console.error("Failed to parse Claude JSON:", parseError);
          }
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
