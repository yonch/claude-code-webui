export interface StreamResponse {
  type: "claude_json" | "error" | "done";
  data?: string; // Raw JSON string content
  error?: string;
}

export interface ChatRequest {
  message: string;
}
