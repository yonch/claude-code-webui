import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/deno";
import { query } from "npm:@anthropic-ai/claude-code@1.0.24";
import type { ChatRequest, StreamResponse } from "../shared/types.ts";
import {
  isDebugMode,
  parseCliArgs,
  showHelp,
  showVersion,
  validatePort,
} from "./args.ts";

const args = parseCliArgs();

if (args.help) {
  showHelp();
  Deno.exit(0);
}

if (args.version) {
  await showVersion();
  Deno.exit(0);
}

const PORT = validatePort(args.port);

// Debug mode enabled via CLI flag or environment variable
const DEBUG_MODE = isDebugMode(args);

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
      // Debug logging of raw SDK messages
      if (DEBUG_MODE) {
        console.debug("[DEBUG] Claude SDK Message:");
        console.debug(JSON.stringify(sdkMessage, null, 2));
        console.debug("---");
      }

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
