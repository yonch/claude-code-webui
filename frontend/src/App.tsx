import { useState, useRef, useEffect } from "react";
import type { ChatMessage, ChatRequest, StreamResponse } from "@shared/types";
import { useTheme } from "./hooks/useTheme";
import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto focus on the input field when component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Re-focus input after sending a message
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-6xl mx-auto p-6 h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-shrink-0">
          <h1 className="text-slate-800 dark:text-slate-100 text-3xl font-bold tracking-tight">
            Claude Code Web UI
          </h1>
          <button
            onClick={toggleTheme}
            className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200 backdrop-blur-sm shadow-sm hover:shadow-md"
            aria-label="Toggle theme"
          >
            {theme === "light" ? (
              <SunIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            ) : (
              <MoonIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            )}
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto bg-white/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 p-6 mb-6 rounded-2xl shadow-sm backdrop-blur-sm">
          {messages.length === 0 && (
            <div className="text-center text-slate-500 dark:text-slate-400 mt-12">
              <div className="text-6xl mb-6 opacity-60">💬</div>
              <p className="text-lg font-medium">
                Start a conversation with Claude
              </p>
              <p className="text-sm mt-2 opacity-80">
                Type your message below to begin
              </p>
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-6 p-6 rounded-2xl ${
                message.role === "user"
                  ? "bg-indigo-50/80 dark:bg-indigo-900/20 border-l-4 border-indigo-400 dark:border-indigo-500"
                  : "bg-slate-50/80 dark:bg-slate-700/40 border-l-4 border-emerald-400 dark:border-emerald-500"
              }`}
            >
              <div className="text-slate-800 dark:text-slate-200 text-sm font-semibold mb-4 flex items-center gap-3">
                {message.role === "user" ? (
                  <>
                    <div className="w-7 h-7 bg-indigo-400 dark:bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      U
                    </div>
                    You
                  </>
                ) : (
                  <>
                    <div className="w-7 h-7 bg-emerald-400 dark:bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      AI
                    </div>
                    Assistant
                  </>
                )}
              </div>
              <pre className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 text-sm font-mono leading-relaxed">
                {message.content}
              </pre>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-3 p-6 text-slate-600 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-700/40 rounded-2xl border-l-4 border-amber-400 dark:border-amber-500">
              <div className="w-7 h-7 bg-amber-400 dark:bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                AI
              </div>
              <div className="flex items-center gap-1">
                <span>Thinking</span>
                <div className="flex gap-1">
                  <div
                    className="w-1 h-1 bg-current rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  ></div>
                  <div
                    className="w-1 h-1 bg-current rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  ></div>
                  <div
                    className="w-1 h-1 bg-current rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex gap-4 flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 px-5 py-4 text-base border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 placeholder-slate-500 dark:placeholder-slate-400 transition-all duration-200 backdrop-blur-sm shadow-sm"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-8 py-4 text-base bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white border-none rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm hover:shadow-md"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
