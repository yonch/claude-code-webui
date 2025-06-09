import { ChatRequest, StreamResponse } from "../shared/types.ts";

const PORT = 8080;

async function* executeClaudeCommand(
  message: string,
): AsyncGenerator<StreamResponse> {
  try {
    console.log("Executing claude command");

    const command = new Deno.Command("claude", {
      args: ["--output-format", "stream-json", "--verbose", "-p", message],
      stdout: "piped",
      stderr: "piped",
      cwd: "../", // Set working directory to project root
    });

    const process = command.spawn();
    const reader = process.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Process any remaining data in buffer
          if (buffer.trim()) {
            try {
              const jsonData = JSON.parse(buffer.trim());
              yield { type: "claude_json", data: jsonData };
            } catch (e) {
              yield {
                type: "claude_json",
                data: { type: "raw", content: buffer.trim() },
              };
            }
          }
          break;
        }

        const chunk = decoder.decode(value);
        buffer += chunk;

        // Split by newlines and process complete lines
        const lines = buffer.split("\n");
        // Keep the last (potentially incomplete) line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              const jsonData = JSON.parse(line.trim());
              yield { type: "claude_json", data: jsonData };
            } catch (e) {
              yield {
                type: "claude_json",
                data: { type: "raw", content: line },
              };
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const status = await process.status;

    if (!status.success) {
      const errorReader = process.stderr.getReader();
      const errorChunks = [];
      while (true) {
        const { done, value } = await errorReader.read();
        if (done) break;
        errorChunks.push(value);
      }
      const errorText = decoder.decode(
        new Uint8Array(
          errorChunks.reduce((acc, chunk) => [...acc, ...chunk], []),
        ),
      );
      console.error("Claude command failed:", errorText);
      yield {
        type: "error",
        error: errorText || `Command failed with exit code ${status.code}`,
      };
    }

    yield { type: "done" };
  } catch (error) {
    console.error("Command execution error:", error);
    yield {
      type: "error",
      error: `Failed to execute claude command: ${error.message}`,
    };
  }
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
          for await (const chunk of executeClaudeCommand(chatRequest.message)) {
            const data = JSON.stringify(chunk) + "\n";
            controller.enqueue(new TextEncoder().encode(data));
          }
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          const errorResponse: StreamResponse = {
            type: "error",
            error: String(error),
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
