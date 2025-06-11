import { useState, useRef, useEffect } from "react";
import type { ChatRequest, AllMessage, ChatMessage } from "./types";
import { isChatMessage, isSystemMessage, isToolMessage } from "./types";
import { useTheme } from "./hooks/useTheme";
import { useClaudeStreaming } from "./hooks/useClaudeStreaming";
import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";
import {
  ChatMessageComponent,
  SystemMessageComponent,
  ToolMessageComponent,
  LoadingComponent,
} from "./components/MessageComponents";

function App() {
  const [messages, setMessages] = useState<AllMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { processStreamLine } = useClaudeStreaming();
  const inputRef = useRef<HTMLInputElement>(null);

  const [currentAssistantMessage, setCurrentAssistantMessage] =
    useState<ChatMessage | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      type: "chat",
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input.trim() } as ChatRequest),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const streamingContext = {
        currentAssistantMessage,
        setCurrentAssistantMessage,
        addMessage: (msg: AllMessage) => {
          setMessages((prev) => [...prev, msg]);
        },
        updateLastMessage: (content: string) => {
          setMessages((prev) =>
            prev.map((msg, index) =>
              index === prev.length - 1 && isChatMessage(msg)
                ? { ...msg, content }
                : msg,
            ),
          );
        },
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          processStreamLine(line, streamingContext);
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) => [
        ...prev,
        {
          type: "chat",
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
          {messages.map((message, index) => {
            if (isSystemMessage(message)) {
              return <SystemMessageComponent key={index} message={message} />;
            } else if (isToolMessage(message)) {
              return <ToolMessageComponent key={index} message={message} />;
            } else {
              return <ChatMessageComponent key={index} message={message} />;
            }
          })}
          {isLoading && <LoadingComponent />}
        </div>

        {/* Input */}
        <div className="flex-shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm shadow-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
