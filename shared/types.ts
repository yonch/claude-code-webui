export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
	timestamp: number;
}

export interface StreamResponse {
	type: "message" | "error" | "done";
	data?: string;
	error?: string;
}

export interface ChatRequest {
	message: string;
}