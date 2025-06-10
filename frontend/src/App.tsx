import { useState, useRef, useEffect } from "react";
import type {
  ChatRequest,
  StreamResponse,
  AllMessage,
  ChatMessage,
  SystemMessage,
  ToolMessage,
} from "./types";
import { useTheme } from "./hooks/useTheme";
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

      let currentAssistantMessage: ChatMessage | null = null;

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

                if (claudeData.type === "system") {
                  // Add system message separately
                  let systemContent = "";
                  if (claudeData.subtype === "init") {
                    systemContent = `🔧 Claude Code initialized\nModel: ${claudeData.model || "Unknown"}\nSession: ${claudeData.session_id?.substring(0, 8) || "Unknown"}\nTools: ${claudeData.tools?.length || 0} available`;
                  } else {
                    systemContent = `System: ${claudeData.message || JSON.stringify(claudeData)}`;
                  }

                  const systemMessage: SystemMessage = {
                    type: "system",
                    content: systemContent,
                    timestamp: Date.now(),
                  };
                  setMessages((prev) => [...prev, systemMessage]);
                } else if (
                  claudeData.type === "assistant" &&
                  claudeData.message?.content
                ) {
                  // Handle assistant messages
                  for (const contentItem of claudeData.message.content) {
                    if (contentItem.type === "text") {
                      // Create or update assistant message for text responses
                      if (!currentAssistantMessage) {
                        currentAssistantMessage = {
                          role: "assistant",
                          content: "",
                          timestamp: Date.now(),
                        };
                        setMessages((prev) => [
                          ...prev,
                          currentAssistantMessage!,
                        ]);
                      }
                      currentAssistantMessage.content += contentItem.text;
                      setMessages((prev) =>
                        prev.map((msg, index) =>
                          index === prev.length - 1 &&
                          msg.type !== "system" &&
                          msg.type !== "tool"
                            ? {
                                ...msg,
                                content: currentAssistantMessage!.content,
                              }
                            : msg,
                        ),
                      );
                    } else if (contentItem.type === "tool_use") {
                      // Add tool message separately
                      let toolContent = `🔧 Using tool: ${contentItem.name}`;
                      if (contentItem.input?.description) {
                        toolContent += `\n${contentItem.input.description}`;
                      }
                      if (contentItem.input?.command) {
                        toolContent += `\n$ ${contentItem.input.command}`;
                      }

                      const toolMessage: ToolMessage = {
                        type: "tool",
                        content: toolContent,
                        timestamp: Date.now(),
                      };
                      setMessages((prev) => [...prev, toolMessage]);
                    }
                  }
                } else if (
                  claudeData.type === "user" &&
                  claudeData.message?.content
                ) {
                  // Handle tool results
                  for (const contentItem of claudeData.message.content) {
                    if (contentItem.type === "tool_result") {
                      let resultContent = "";
                      if (contentItem.is_error) {
                        resultContent = `❌ Error: ${contentItem.content}`;
                      } else {
                        resultContent = contentItem.content;
                      }

                      const toolResultMessage: ToolMessage = {
                        type: "tool",
                        content: resultContent,
                        timestamp: Date.now(),
                      };
                      setMessages((prev) => [...prev, toolResultMessage]);
                    }
                  }
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
              assistantContent += `\nError: ${data.error}\n`;
              setMessages((prev) =>
                prev.map((msg, index) =>
                  index === prev.length - 1
                    ? { ...msg, content: assistantContent }
                    : msg,
                ),
              );
            } else if (data.type === "done") {
              break;
            }
          } catch {
            assistantContent += `Parse error: ${line}\n`;
            setMessages((prev) =>
              prev.map((msg, index) =>
                index === prev.length - 1
                  ? { ...msg, content: assistantContent }
                  : msg,
              ),
            );
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
          {messages.map((message, index) => {
            if (message.type === "system") {
              return <SystemMessageComponent key={index} message={message} />;
            } else if (message.type === "tool") {
              return <ToolMessageComponent key={index} message={message} />;
            } else {
              return <ChatMessageComponent key={index} message={message} />;
            }
          })}
          {isLoading && <LoadingComponent />}
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
