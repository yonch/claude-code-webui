import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "./App";

// Mock fetch globally
global.fetch = vi.fn();

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful fetch response
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: () => Promise.resolve({ done: true, value: undefined }),
        }),
      },
    });
  });
  it("renders the title", () => {
    render(<App />);
    expect(screen.getByText("Claude Code Web UI")).toBeInTheDocument();
  });

  it("renders textarea and send button", () => {
    render(<App />);
    expect(
      screen.getByPlaceholderText(
        "Type your message... (Shift+Enter for new line)",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("disables send button when input is empty", () => {
    render(<App />);
    const sendButton = screen.getByRole("button", { name: "Send" });
    expect(sendButton).toBeDisabled();
  });

  it("enables send button when textarea has text", () => {
    render(<App />);
    const textarea = screen.getByPlaceholderText(
      "Type your message... (Shift+Enter for new line)",
    );
    const sendButton = screen.getByRole("button", { name: "Send" });

    fireEvent.change(textarea, { target: { value: "Hello" } });
    expect(sendButton).not.toBeDisabled();
  });

  it("adds user message when form is submitted", async () => {
    render(<App />);
    const textarea = screen.getByPlaceholderText(
      "Type your message... (Shift+Enter for new line)",
    );
    const form = textarea.closest("form")!;

    fireEvent.change(textarea, { target: { value: "Test message" } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("You")).toBeInTheDocument();
      expect(screen.getByText("Test message")).toBeInTheDocument();
    });
  });

  it("sends requests without sessionId initially", async () => {
    render(<App />);
    const textarea = screen.getByPlaceholderText(
      "Type your message... (Shift+Enter for new line)",
    );
    const form = textarea.closest("form")!;

    fireEvent.change(textarea, { target: { value: "First message" } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8080/api/chat",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringMatching(
            /"message":"First message".*"requestId":"[a-f0-9-]{36}"/,
          ),
        }),
      );
    });
  });
});
