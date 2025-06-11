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

export interface StreamResponse {
  type: "claude_json" | "raw" | "error" | "done";
  data?: string; // Raw JSON string or raw text content
  error?: string;
}

export interface ChatRequest {
  message: string;
}

// Claude command JSON types
export interface ClaudeSystemMessage {
  type: "system";
  subtype: "init";
  cwd: string;
  session_id: string;
  tools: string[];
  mcp_servers: unknown[];
  model: string;
  permissionMode: string;
  apiKeySource: string;
}

export interface ClaudeAssistantMessage {
  type: "assistant";
  message: {
    id: string;
    type: "message";
    role: "assistant";
    model: string;
    content: Array<{
      type: "text" | "tool_use";
      text?: string;
      id?: string;
      name?: string;
      input?: {
        description?: string;
        command?: string;
        [key: string]: unknown;
      };
    }>;
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: {
      input_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      output_tokens: number;
      service_tier: string;
    };
  };
  parent_tool_use_id: string | null;
  session_id: string;
}

export interface ClaudeUserMessage {
  type: "user";
  message: {
    role: "user";
    content: Array<{
      tool_use_id: string;
      type: "tool_result";
      content: string;
      is_error: boolean;
    }>;
  };
  parent_tool_use_id: string | null;
  session_id: string;
}

export interface ClaudeResultMessage {
  type: "result";
  subtype: "success" | "error";
  cost_usd: number;
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result: string;
  session_id: string;
  total_cost: number;
  usage: {
    input_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens: number;
    server_tool_use: {
      web_search_requests: number;
    };
  };
}
