import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "./App";

// Mock fetch globally
global.fetch = vi.fn();

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful fetch response
    (global.fetch as any).mockResolvedValue({
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

  it("renders input field and send button", () => {
    render(<App />);
    expect(
      screen.getByPlaceholderText("Type your message..."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("disables send button when input is empty", () => {
    render(<App />);
    const sendButton = screen.getByRole("button", { name: "Send" });
    expect(sendButton).toBeDisabled();
  });

  it("enables send button when input has text", () => {
    render(<App />);
    const input = screen.getByPlaceholderText("Type your message...");
    const sendButton = screen.getByRole("button", { name: "Send" });

    fireEvent.change(input, { target: { value: "Hello" } });
    expect(sendButton).not.toBeDisabled();
  });

  it("adds user message when form is submitted", async () => {
    render(<App />);
    const input = screen.getByPlaceholderText("Type your message...");
    const form = input.closest("form")!;

    fireEvent.change(input, { target: { value: "Test message" } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("You")).toBeInTheDocument();
      expect(screen.getByText("Test message")).toBeInTheDocument();
    });
  });
});
