export interface StreamResponse {
  type: "claude_json" | "error" | "done" | "aborted" | "user_message";
  messageId?: string; // Unique ID for message ordering and resume
  data?: unknown; // SDKMessage object for claude_json type, or user message data for user_message type
  error?: string;
}

export interface ChatRequest {
  message?: string; // Optional - when not provided, just subscribes to session updates
  sessionId?: string;
  requestId: string;
  resumeFromMessageId?: string; // Optional - replay events from this messageId onwards
  allowedTools?: string[];
  workingDirectory?: string;
  permissionMode?: "default" | "plan" | "acceptEdits";
}

export interface AbortRequest {
  requestId: string;
}

export interface ProjectInfo {
  path: string;
  encodedName: string;
}

export interface ProjectsResponse {
  projects: ProjectInfo[];
}

// Conversation history types
export interface ConversationSummary {
  sessionId: string;
  startTime: string;
  lastTime: string;
  messageCount: number;
  lastMessagePreview: string;
}

export interface HistoryListResponse {
  conversations: ConversationSummary[];
}

// Conversation history types
// Note: messages are typed as unknown[] to avoid frontend/backend dependency issues
// Frontend should cast to TimestampedSDKMessage[] (defined in frontend/src/types.ts)
export interface ConversationHistory {
  sessionId: string;
  messages: unknown[]; // TimestampedSDKMessage[] in practice, but avoiding frontend type dependency
  metadata: {
    startTime: string;
    endTime: string;
    messageCount: number;
  };
}
