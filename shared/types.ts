export interface StreamResponse {
	type: "claude_json" | "raw" | "error" | "done";
	data?: string; // Raw JSON string or raw text content
	error?: string;
}

export interface ChatRequest {
	message: string;
}