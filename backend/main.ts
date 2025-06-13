import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/deno";
import { parseArgs } from "@std/cli/parse-args";
import { query } from "npm:@anthropic-ai/claude-code";
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
    // Use import.meta.dirname to access embedded VERSION file
    const version = await Deno.readTextFile(import.meta.dirname + "/VERSION");
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

    // Use the Claude Code SDK with system claude command
    const abortController = new AbortController();

    // For compiled binaries, use system claude command to avoid bundled cli.js issues
    let claudePath: string;
    try {
      const whichResult = await new Deno.Command("which", {
        args: ["claude"],
        stdout: "piped",
      }).output();
      claudePath = new TextDecoder().decode(whichResult.stdout).trim();
    } catch {
      claudePath = "claude"; // fallback
    }

    for await (
      const sdkMessage of query({
        prompt: processedMessage,
        options: {
          abortController,
          pathToClaudeCodeExecutable: claudePath,
        },
      })
    ) {
      yield {
        type: "claude_json",
        data: JSON.stringify(sdkMessage),
      };
    }

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

// Static file serving - use import.meta.dirname to access embedded dist directory
app.use("/*", serveStatic({ root: import.meta.dirname + "/dist" }));

if (import.meta.main) {
  console.log(`🚀 Server starting on http://localhost:${PORT}`);
  Deno.serve({ port: PORT }, app.fetch);
}
