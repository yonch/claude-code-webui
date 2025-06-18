import type { SDKMessage } from "@anthropic-ai/claude-code";

export interface MockStreamResponse {
  type: "claude_json" | "done" | "error";
  data?: SDKMessage;
  error?: string;
}

export interface MockScenarioStep {
  type: "system" | "assistant" | "result" | "permission_error";
  delay: number; // delay in milliseconds before this step
  data: SDKMessage | { toolName: string; pattern: string; toolUseId: string };
}

// Generate realistic Claude system messages
export function createSystemMessage(
  sessionId: string,
): Extract<SDKMessage, { type: "system" }> {
  return {
    type: "system",
    subtype: "init",
    apiKeySource: "user",
    cwd: "/Users/demo/claude-code-webui",
    session_id: sessionId,
    tools: ["Read", "Write", "Edit", "Bash"],
    mcp_servers: [],
    model: "claude-3-5-sonnet-20241022",
    permissionMode: "default",
  };
}

// Generate realistic Claude assistant messages
export function createAssistantMessage(
  content: string,
  sessionId: string,
): Extract<SDKMessage, { type: "assistant" }> {
  return {
    type: "assistant",
    message: {
      id: "msg_" + crypto.randomUUID(),
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: content }],
      model: "claude-3-5-sonnet-20241022",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 25, output_tokens: 45 },
    },
    parent_tool_use_id: null,
    session_id: sessionId,
  };
}

// Generate realistic Claude result messages
export function createResultMessage(
  sessionId: string,
  inputTokens: number = 45,
  outputTokens: number = 120,
): Extract<SDKMessage, { type: "result" }> {
  return {
    type: "result",
    subtype: "success",
    session_id: sessionId,
    duration_ms: 1200,
    duration_api_ms: 800,
    is_error: false,
    num_turns: 1,
    result: "Success",
    total_cost_usd: (inputTokens * 0.003 + outputTokens * 0.015) / 1000,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
  };
}

// Generate realistic tool use assistant messages
export function createToolUseMessage(
  toolName: string,
  toolInput: Record<string, unknown>,
  sessionId: string,
  toolUseId: string = crypto.randomUUID(),
): Extract<SDKMessage, { type: "assistant" }> {
  return {
    type: "assistant",
    message: {
      id: "msg_" + crypto.randomUUID(),
      type: "message",
      role: "assistant",
      content: [
        {
          type: "text",
          text: `I'll help you with that. Let me ${toolName === "Read" ? "read the file" : "use the " + toolName + " tool"}.`,
        },
        {
          type: "tool_use",
          id: toolUseId,
          name: toolName,
          input: toolInput,
        },
      ],
      model: "claude-3-5-sonnet-20241022",
      stop_reason: "tool_use",
      stop_sequence: null,
      usage: { input_tokens: 45, output_tokens: 28 },
    },
    parent_tool_use_id: null,
    session_id: sessionId,
  };
}

// Generate streaming responses for demo
export function* generateMockStream(
  steps: MockScenarioStep[],
): Generator<MockStreamResponse, void, unknown> {
  for (const step of steps) {
    if (step.type === "permission_error") {
      // This would trigger permission dialog in real app
      const errorData = step.data as { toolName: string; pattern: string; toolUseId: string };
      yield {
        type: "error",
        error: `Permission required for tool: ${errorData.toolName}`,
      };
      continue;
    }

    yield {
      type: "claude_json",
      data: step.data as SDKMessage,
    };
  }

  yield { type: "done" };
}

// Predefined demo scenarios
export const DEMO_SCENARIOS = {
  basic: {
    sessionId: "demo-session-basic",
    steps: [
      {
        type: "system" as const,
        delay: 500,
        data: createSystemMessage("demo-session-basic"),
      },
      {
        type: "assistant" as const,
        delay: 1000,
        data: createAssistantMessage(
          "Hello! I'm Claude, your AI assistant. I can help you with coding, file operations, and much more. What would you like to work on today?",
          "demo-session-basic",
        ),
      },
      {
        type: "result" as const,
        delay: 500,
        data: createResultMessage("demo-session-basic", 25, 45),
      },
    ],
  },
  fileOperations: {
    sessionId: "demo-session-files",
    steps: [
      {
        type: "system" as const,
        delay: 500,
        data: createSystemMessage("demo-session-files"),
      },
      {
        type: "assistant" as const,
        delay: 1200,
        data: createToolUseMessage(
          "Read",
          { file_path: "/Users/demo/project/src/App.tsx" },
          "demo-session-files",
          "read-app-tsx",
        ),
      },
      {
        type: "permission_error" as const,
        delay: 800,
        data: { toolName: "Read", pattern: "Read", toolUseId: "read-app-tsx" },
      },
    ],
  },
} as const;

// Helper to convert scenario to stream responses
export function scenarioToStream(scenarioKey: keyof typeof DEMO_SCENARIOS): MockScenarioStep[] {
  return [...DEMO_SCENARIOS[scenarioKey].steps];
}