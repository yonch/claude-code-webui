import type { ChatRequest, StreamResponse } from "../shared/types.ts";

const PORT = 8080;

async function* executeClaudeCommand(
  message: string,
): AsyncGenerator<StreamResponse> {
  try {
    const command = new Deno.Command("claude", {
      args: ["--output-format", "stream-json", "--verbose", "-p", message],
      stdout: "piped",
      cwd: "../",
    });

    const process = command.spawn();
    const reader = process.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value);
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line

        for (const line of lines) {
          if (line.trim()) {
            yield { type: "claude_json", data: line.trim() };
          }
        }
      }

      // Handle remaining buffer
      if (buffer.trim()) {
        yield { type: "claude_json", data: buffer.trim() };
      }
    } finally {
      reader.releaseLock();
    }

    await process.status;
    yield { type: "done" };
  } catch (error) {
    yield {
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

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
          for await (const chunk of executeClaudeCommand(chatRequest.message)) {
            const data = JSON.stringify(chunk) + "\n";
            controller.enqueue(new TextEncoder().encode(data));
          }
          controller.close();
        } catch (error) {
          const errorResponse: StreamResponse = {
            type: "error",
            error: error instanceof Error ? error.message : String(error),
          };
          controller.enqueue(
            new TextEncoder().encode(JSON.stringify(errorResponse) + "\n"),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  return new Response("Not Found", { status: 404, headers: corsHeaders });
}

if (import.meta.main) {
  console.log(`🚀 Server starting on http://localhost:${PORT}`);
  Deno.serve({ port: PORT }, handler);
}