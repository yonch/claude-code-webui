import { useState } from "react";
import type { ChatMessage, ChatRequest, StreamResponse } from "@shared/types";
import "./App.css";

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:8080/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: input.trim() } as ChatRequest),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data: StreamResponse = JSON.parse(line);

            if (data.type === "claude_json" && data.data) {
              try {
                const claudeData = JSON.parse(data.data);

                if (
                  claudeData.type === "assistant" &&
                  claudeData.message?.content
                ) {
                  // Extract text from assistant message
                  for (const contentItem of claudeData.message.content) {
                    if (contentItem.type === "text") {
                      assistantContent += contentItem.text;
                      setMessages((prev) =>
                        prev.map((msg, index) =>
                          index === prev.length - 1
                            ? { ...msg, content: assistantContent }
                            : msg,
                        ),
                      );
                    }
                  }
                } else if (claudeData.type === "result" && claudeData.result) {
                  // Final result - could show cost info etc.
                  console.log("Claude execution completed:", claudeData);
                } else if (claudeData.type === "system") {
                  // System initialization - could show model info etc.
                  console.log("Claude system init:", claudeData);
                }
              } catch {
                // If JSON parsing fails, treat as raw text
                assistantContent += data.data + "\n";
                setMessages((prev) =>
                  prev.map((msg, index) =>
                    index === prev.length - 1
                      ? { ...msg, content: assistantContent }
                      : msg,
                  ),
                );
              }
            } else if (data.type === "raw" && data.data) {
              // Raw non-JSON content
              assistantContent += data.data + "\n";
              setMessages((prev) =>
                prev.map((msg, index) =>
                  index === prev.length - 1
                    ? { ...msg, content: assistantContent }
                    : msg,
                ),
              );
            } else if (data.type === "error") {
              console.error("Stream error:", data.error);
            } else if (data.type === "done") {
              break;
            }
          } catch (e) {
            console.error("Failed to parse JSON:", e);
          }
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error: Failed to get response",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  return (
    <div
      className="chat-container"
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ color: "#1a1a1a", margin: "0 0 20px 0", flexShrink: 0 }}>
        Claude Code Web UI
      </h1>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          border: "1px solid #ddd",
          padding: "15px",
          marginBottom: "20px",
          backgroundColor: "#ffffff",
          borderRadius: "8px",
        }}
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === "user" ? "message-user" : "message-assistant"
            }
            style={{
              marginBottom: "15px",
              padding: "15px",
              borderRadius: "8px",
            }}
          >
            <strong style={{ color: "#1a1a1a", fontSize: "14px" }}>
              {message.role === "user" ? "You" : "Assistant"}:
            </strong>
            <pre
              className="message-content"
              style={{
                whiteSpace: "pre-wrap",
                margin: "8px 0 0 0",
                fontFamily: "inherit",
              }}
            >
              {message.content}
            </pre>
          </div>
        ))}
        {isLoading && (
          <div className="thinking-indicator" style={{ padding: "15px" }}>
            Thinking...
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", gap: "10px", flexShrink: 0 }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: "12px",
            fontSize: "16px",
            border: "1px solid #ddd",
            borderRadius: "6px",
            color: "#1a1a1a",
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          style={{
            padding: "12px 24px",
            fontSize: "16px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default App;
