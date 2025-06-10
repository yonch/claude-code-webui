import { useState } from "react";
import type { ChatMessage, ChatRequest, StreamResponse } from "@shared/types";

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
    <div className="max-w-4xl mx-auto p-5 h-screen flex flex-col">
      <h1 className="text-gray-900 mb-5 flex-shrink-0 text-2xl font-bold">
        Claude Code Web UI
      </h1>

      <div className="flex-1 overflow-y-auto border border-gray-300 p-4 mb-5 bg-white rounded-lg">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`mb-4 p-4 rounded-lg ${
              message.role === "user"
                ? "bg-blue-50 border-l-4 border-blue-500"
                : "bg-gray-50 border-l-4 border-green-500"
            }`}
          >
            <div className="text-gray-900 text-sm font-semibold mb-2">
              {message.role === "user" ? "You" : "Assistant"}:
            </div>
            <pre className="whitespace-pre-wrap text-gray-900 text-sm font-mono">
              {message.content}
            </pre>
          </div>
        ))}
        {isLoading && (
          <div className="p-4 text-gray-600 italic">Thinking...</div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
          className="flex-1 px-3 py-2 text-base border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-6 py-2 text-base bg-blue-600 text-white border-none rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default App;
