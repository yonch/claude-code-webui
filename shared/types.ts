export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
	timestamp: number;
}

export interface StreamResponse {
	type: "claude_json" | "error" | "done";
	data?: any; // Raw claude JSON data
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
	mcp_servers: any[];
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
			type: "text";
			text: string;
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