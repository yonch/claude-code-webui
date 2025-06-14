export interface StreamResponse {
  type: "claude_json" | "error" | "done";
  data?: unknown; // SDKMessage object for claude_json type
  error?: string;
}

export interface ChatRequest {
  message: string;
}
