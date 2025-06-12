import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/deno";
import { parseArgs } from "@std/cli/parse-args";
import type { ChatRequest, StreamResponse } from "../shared/types.ts";

const args = parseArgs(Deno.args, {
  boolean: ["help", "version"],
  string: ["port"],
  alias: {
    "help": "h",
    "version": "v",
    "port": "p",
  },
  default: {
    port: "8080",
  },
});

if (args.help) {
  console.log("Claude Code Web UI Backend Server");
  console.log("");
  console.log("Usage: deno run main.ts [options]");
  console.log("");
  console.log("Options:");
  console.log("  -p, --port <number>   Port to listen on (default: 8080)");
  console.log("  -h, --help           Show this help message");
  console.log("  -v, --version        Show version information");
  Deno.exit(0);
}

if (args.version) {
  try {
    const version = await Deno.readTextFile("./VERSION");
    console.log(`Claude Code Web UI Backend ${version.trim()}`);
  } catch (error) {
    console.error(
      `Error reading VERSION file: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    Deno.exit(1);
  }
  Deno.exit(0);
}

const PORT = parseInt(args.port as string, 10);

if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  console.error("Error: Port must be a valid number between 1 and 65535");
  Deno.exit(1);
}

async function checkClaudeAvailability(): Promise<void> {
  try {
    const command = new Deno.Command("claude", {
      args: ["--version"],
      stdout: "piped",
      stderr: "piped",
    });

    const process = command.spawn();
    const status = await process.status;

    if (!status.success) {
      console.error("Error: Claude CLI is installed but not working properly");
      console.error("Please check your Claude CLI installation");
      Deno.exit(1);
    }
  } catch (error) {
    console.error("Error: Claude CLI is not available");
    console.error("Please install Claude CLI first:");
    console.error("  npm install -g @anthropic-ai/claude-cli");
    console.error("Or visit: https://github.com/anthropics/claude-cli");
    console.error("");
    console.error(
      `Details: ${error instanceof Error ? error.message : String(error)}`,
    );
    Deno.exit(1);
  }
}

const app = new Hono();

async function* executeClaudeCommand(
  message: string,
): AsyncGenerator<StreamResponse> {
  try {
    // Process commands that start with '/'
    let processedMessage = message;
    if (message.startsWith("/")) {
      // Remove the '/' and send just the command
      processedMessage = message.substring(1);
    }

    const command = new Deno.Command("claude", {
      args: [
        "--output-format",
        "stream-json",
        "--verbose",
        "-p",
        processedMessage,
      ],
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
            console.log(
              `[${new Date().toISOString()}] Claude JSON:`,
              line.trim(),
            );
            yield { type: "claude_json", data: line.trim() };
          }
        }
      }

      // Handle remaining buffer
      if (buffer.trim()) {
        console.log(
          `[${new Date().toISOString()}] Claude JSON (final):`,
          buffer.trim(),
        );
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

// CORS middleware
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

// API routes
app.post("/api/chat", async (c) => {
  const chatRequest: ChatRequest = await c.req.json();

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
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});

// Static file serving
app.use("/*", serveStatic({ root: "../frontend/dist" }));

if (import.meta.main) {
  console.log("Checking Claude CLI availability...");
  await checkClaudeAvailability();
  console.log("✅ Claude CLI is available");
  console.log(`🚀 Server starting on http://localhost:${PORT}`);
  Deno.serve({ port: PORT }, app.fetch);
}
