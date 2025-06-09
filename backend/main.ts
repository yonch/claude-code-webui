import { ChatRequest, StreamResponse } from "../shared/types.ts";

const PORT = 8080;

function createMockClaudeResponse(message: string): AsyncGenerator<StreamResponse> {
	return (async function* () {
		yield { type: "message", data: `Processing: ${message}` };
		await new Promise(resolve => setTimeout(resolve, 1000));
		
		yield { type: "message", data: "Thinking..." };
		await new Promise(resolve => setTimeout(resolve, 1000));
		
		yield { type: "message", data: `Response to: ${message}` };
		await new Promise(resolve => setTimeout(resolve, 1000));
		
		yield { type: "done" };
	})();
}

async function handler(req: Request): Promise<Response> {
	const url = new URL(req.url);
	
	// CORS headers
	const corsHeaders = {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
	};

	if (req.method === "OPTIONS") {
		return new Response(null, { headers: corsHeaders });
	}

	if (url.pathname === "/api/chat" && req.method === "POST") {
		const chatRequest: ChatRequest = await req.json();
		
		const stream = new ReadableStream({
			async start(controller) {
				try {
					for await (const chunk of createMockClaudeResponse(chatRequest.message)) {
						const data = JSON.stringify(chunk) + "\n";
						controller.enqueue(new TextEncoder().encode(data));
					}
					controller.close();
				} catch (error) {
					const errorResponse: StreamResponse = { type: "error", error: String(error) };
					controller.enqueue(new TextEncoder().encode(JSON.stringify(errorResponse) + "\n"));
					controller.close();
				}
			},
		});

		return new Response(stream, {
			headers: {
				...corsHeaders,
				"Content-Type": "application/x-ndjson",
				"Cache-Control": "no-cache",
				"Connection": "keep-alive",
			},
		});
	}

	return new Response("Not Found", { status: 404, headers: corsHeaders });
}

if (import.meta.main) {
	console.log(`🚀 Server starting on http://localhost:${PORT}`);
	Deno.serve({ port: PORT }, handler);
}
