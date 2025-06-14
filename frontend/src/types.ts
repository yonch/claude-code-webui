export interface ChatMessage {
  type: "chat";
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export type SystemMessage = {
  type: "system";
  content: string;
  timestamp: number;
};

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
  return message.type === "system";
}

export function isToolMessage(message: AllMessage): message is ToolMessage {
  return message.type === "tool";
}

// Re-export shared types
export type { StreamResponse, ChatRequest } from "../../shared/types";

// Import SDK types
export type { SDKMessage } from "@anthropic-ai/claude-code";
