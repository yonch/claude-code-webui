import type {
  SDKSystemMessage,
  SDKResultMessage,
} from "@anthropic-ai/claude-code";

// Chat message for user/assistant interactions (not part of SDKMessage)
export interface ChatMessage {
  type: "chat";
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// System message extending SDK types with timestamp
export type SystemMessage = (SDKSystemMessage | SDKResultMessage) & {
  timestamp: number;
};

// Tool message for tool usage display
export type ToolMessage = {
  type: "tool";
  content: string;
  timestamp: number;
};

export type AllMessage = ChatMessage | SystemMessage | ToolMessage;

// Type guard functions
export function isChatMessage(message: AllMessage): message is ChatMessage {
  return message.type === "chat";
}

export function isSystemMessage(message: AllMessage): message is SystemMessage {
  return message.type === "system" || message.type === "result";
}

export function isToolMessage(message: AllMessage): message is ToolMessage {
  return message.type === "tool";
}

// Re-export shared types
export type { StreamResponse, ChatRequest } from "../../shared/types";

// Re-export SDK types
export type {
  SDKMessage,
  SDKSystemMessage,
  SDKResultMessage,
  SDKAssistantMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-code";
