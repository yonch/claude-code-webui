import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useClaudeStreaming } from "./useClaudeStreaming";
import type { SDKMessage } from "../types";

describe("useClaudeStreaming", () => {
  it("extracts session_id from system messages", () => {
    const { result } = renderHook(() => useClaudeStreaming());
    const onSessionId = vi.fn();

    const mockContext = {
      currentAssistantMessage: null,
      setCurrentAssistantMessage: vi.fn(),
      addMessage: vi.fn(),
      updateLastMessage: vi.fn(),
      onSessionId,
    };

    const systemMessage: SDKMessage = {
      type: "system",
      subtype: "init",
      apiKeySource: "user" as const,
      cwd: "/test",
      session_id: "test-session-123",
      tools: ["Bash"],
      mcp_servers: [],
      model: "claude-3-sonnet",
      permissionMode: "default" as const,
    };

    const streamLine = JSON.stringify({
      type: "claude_json",
      data: systemMessage,
    });

    result.current.processStreamLine(streamLine, mockContext);

    expect(onSessionId).toHaveBeenCalledWith("test-session-123");
    expect(mockContext.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "system",
        content: expect.stringContaining("test-ses"), // Session ID is truncated to 8 chars
      }),
    );
  });

  it("extracts session_id from assistant messages", () => {
    const { result } = renderHook(() => useClaudeStreaming());
    const onSessionId = vi.fn();

    const mockContext = {
      currentAssistantMessage: null,
      setCurrentAssistantMessage: vi.fn(),
      addMessage: vi.fn(),
      updateLastMessage: vi.fn(),
      onSessionId,
    };

    const assistantMessage: SDKMessage = {
      type: "assistant",
      message: {
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "Hello world" }],
        model: "claude-3-sonnet",
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 5 },
      },
      parent_tool_use_id: null,
      session_id: "test-session-456",
    };

    const streamLine = JSON.stringify({
      type: "claude_json",
      data: assistantMessage,
    });

    result.current.processStreamLine(streamLine, mockContext);

    expect(onSessionId).toHaveBeenCalledWith("test-session-456");
  });

  it("extracts session_id from result messages", () => {
    const { result } = renderHook(() => useClaudeStreaming());
    const onSessionId = vi.fn();

    const mockContext = {
      currentAssistantMessage: null,
      setCurrentAssistantMessage: vi.fn(),
      addMessage: vi.fn(),
      updateLastMessage: vi.fn(),
      onSessionId,
    };

    const resultMessage: SDKMessage = {
      type: "result",
      subtype: "success",
      duration_ms: 1000,
      duration_api_ms: 800,
      is_error: false,
      num_turns: 1,
      result: "Task completed",
      session_id: "test-session-789",
      total_cost_usd: 0.001,
      usage: { input_tokens: 10, output_tokens: 5 },
    };

    const streamLine = JSON.stringify({
      type: "claude_json",
      data: resultMessage,
    });

    result.current.processStreamLine(streamLine, mockContext);

    expect(onSessionId).toHaveBeenCalledWith("test-session-789");
  });

  it("handles missing onSessionId callback gracefully", () => {
    const { result } = renderHook(() => useClaudeStreaming());

    const mockContext = {
      currentAssistantMessage: null,
      setCurrentAssistantMessage: vi.fn(),
      addMessage: vi.fn(),
      updateLastMessage: vi.fn(),
      // onSessionId is missing
    };

    const systemMessage: SDKMessage = {
      type: "system",
      subtype: "init",
      apiKeySource: "user" as const,
      cwd: "/test",
      session_id: "test-session-123",
      tools: ["Bash"],
      mcp_servers: [],
      model: "claude-3-sonnet",
      permissionMode: "default" as const,
    };

    const streamLine = JSON.stringify({
      type: "claude_json",
      data: systemMessage,
    });

    // Should not throw when onSessionId is missing
    expect(() => {
      result.current.processStreamLine(streamLine, mockContext);
    }).not.toThrow();
  });
});