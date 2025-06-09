import { ChatRequest, StreamResponse } from "../shared/types.ts";

const PORT = 8080;

async function* executeClaudeCommand(message: string): AsyncGenerator<StreamResponse> {
	try {
		console.log("Executing command: claude", ["--output-format", "stream-json", "--verbose", "-p", message]);
		
		const command = new Deno.Command("claude", {
			args: ["--output-format", "stream-json", "--verbose", "-p", message],
			stdout: "piped",
			stderr: "piped",
			cwd: "../", // Set working directory to project root
		});

		const process = command.spawn();
		const reader = process.stdout.getReader();
		const decoder = new TextDecoder();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					console.log("stdout reading completed");
					break;
				}

				const chunk = decoder.decode(value);
				console.log("Raw chunk:", JSON.stringify(chunk));
				const lines = chunk.split('\n').filter(line => line.trim());
				console.log("Lines:", lines);

				for (const line of lines) {
					try {
						const jsonData = JSON.parse(line);
						console.log("Parsed JSON:", jsonData);
						yield { type: "claude_json", data: jsonData };
					} catch (e) {
						console.log("Non-JSON line:", line);
						if (line.trim()) {
							yield { type: "claude_json", data: { type: "raw", content: line } };
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}

		const status = await process.status;
		console.log("Process status:", status);
		
		if (!status.success) {
			const errorReader = process.stderr.getReader();
			const errorChunks = [];
			while (true) {
				const { done, value } = await errorReader.read();
				if (done) break;
				errorChunks.push(value);
			}
			const errorText = decoder.decode(new Uint8Array(errorChunks.reduce((acc, chunk) => [...acc, ...chunk], [])));
			console.log("stderr:", errorText);
			yield { type: "error", error: errorText || `Command failed with exit code ${status.code}` };
		}

		yield { type: "done" };
	} catch (error) {
		console.error("Command execution error:", error);
		yield { type: "error", error: `Failed to execute claude command: ${error.message}` };
	}
}

async function handler(req: Request): Promise<Response> {
	const url = new URL(req.url);
	console.log(`${req.method} ${url.pathname}`);
	
	// CORS headers
	const corsHeaders = {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
	};

	if (req.method === "OPTIONS") {
		console.log("Handling CORS preflight");
		return new Response(null, { headers: corsHeaders });
	}

	if (url.pathname === "/api/chat" && req.method === "POST") {
		console.log("Processing chat request");
		const chatRequest: ChatRequest = await req.json();
		console.log("Message:", chatRequest.message);
		
		const stream = new ReadableStream({
			async start(controller) {
				try {
					console.log("Starting claude command execution...");
					for await (const chunk of executeClaudeCommand(chatRequest.message)) {
						console.log("Sending chunk:", chunk);
						const data = JSON.stringify(chunk) + "\n";
						controller.enqueue(new TextEncoder().encode(data));
					}
					console.log("Command execution completed");
					controller.close();
				} catch (error) {
					console.error("Stream error:", error);
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

	console.log("404 Not Found for:", url.pathname);
	return new Response("Not Found", { status: 404, headers: corsHeaders });
}

if (import.meta.main) {
	console.log(`🚀 Server starting on http://localhost:${PORT}`);
	Deno.serve({ port: PORT }, handler);
}
