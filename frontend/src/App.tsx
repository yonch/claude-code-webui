import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatRequest, AllMessage, ChatMessage } from "./types";
import {
  isChatMessage,
  isSystemMessage,
  isToolMessage,
  isToolResultMessage,
} from "./types";
import { useTheme } from "./hooks/useTheme";
import { useClaudeStreaming } from "./hooks/useClaudeStreaming";
import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";
import { StopIcon } from "@heroicons/react/24/solid";
import {
  ChatMessageComponent,
  SystemMessageComponent,
  ToolMessageComponent,
  ToolResultMessageComponent,
  LoadingComponent,
} from "./components/MessageComponents";
import { PermissionDialog } from "./components/PermissionDialog";

function App() {
  const [messages, setMessages] = useState<AllMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [hasShownInitMessage, setHasShownInitMessage] = useState(false);
  const [, setHasReceivedInit] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { processStreamLine } = useClaudeStreaming();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [currentAssistantMessage, setCurrentAssistantMessage] =
    useState<ChatMessage | null>(null);

  // Permission management state
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [permissionDialog, setPermissionDialog] = useState<{
    isOpen: boolean;
    toolName: string;
    command: string;
    toolUseId: string;
  }>({
    isOpen: false,
    toolName: "",
    command: "",
    toolUseId: "",
  });

  // Constants
  const NEAR_BOTTOM_THRESHOLD_PX = 100;

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

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const computedStyle = getComputedStyle(textarea);
      const maxHeight = parseInt(computedStyle.maxHeight, 10) || 200;
      const scrollHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${scrollHeight}px`;
    }
  }, [input]);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    if (messagesEndRef.current && messagesEndRef.current.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Check if user is near bottom of messages
  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight < NEAR_BOTTOM_THRESHOLD_PX;
  };

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-scroll during streaming (only if user is near bottom)
  useEffect(() => {
    if (currentAssistantMessage && isNearBottom()) {
      scrollToBottom();
    }
  }, [currentAssistantMessage]);

  // Handle permission errors
  const handlePermissionError = useCallback(
    async (toolName: string, command: string, toolUseId: string) => {
      // Auto-abort the current request
      if (currentRequestId && isLoading) {
        try {
          await fetch(`http://localhost:8080/api/abort/${currentRequestId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Failed to abort request:", error);
        }

        setIsLoading(false);
        setCurrentRequestId(null);
        setCurrentAssistantMessage(null);
      }

      // Show permission dialog
      setPermissionDialog({
        isOpen: true,
        toolName,
        command,
        toolUseId,
      });
    },
    [currentRequestId, isLoading],
  );

  const sendMessage = useCallback(
    async (messageContent?: string, tools?: string[]) => {
      const content = messageContent || input.trim();
      if (!content || isLoading) return;

      // Generate unique request ID for this request
      const requestId = crypto.randomUUID();
      setCurrentRequestId(requestId);

      const userMessage: ChatMessage = {
        type: "chat",
        role: "user",
        content: content,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      if (!messageContent) setInput(""); // Only clear input if it's from the input field
      setIsLoading(true);
      setCurrentAssistantMessage(null);

      try {
        const response = await fetch("http://localhost:8080/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            requestId,
            ...(currentSessionId ? { sessionId: currentSessionId } : {}),
            allowedTools: tools || allowedTools,
          } as ChatRequest),
        });

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Reset init state for new request
        setHasReceivedInit(false);

        // Local state for this streaming session
        let localHasReceivedInit = false;

        const streamingContext = {
          currentAssistantMessage: null,
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
          onSessionId: (sessionId: string) => {
            setCurrentSessionId(sessionId);
          },
          shouldShowInitMessage: () => !hasShownInitMessage,
          onInitMessageShown: () => {
            setHasShownInitMessage(true);
          },
          get hasReceivedInit() {
            return localHasReceivedInit;
          },
          setHasReceivedInit: (received: boolean) => {
            localHasReceivedInit = received;
            setHasReceivedInit(received);
          },
          onPermissionError: handlePermissionError,
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
        setCurrentRequestId(null);
      }
    },
    [
      input,
      isLoading,
      currentSessionId,
      allowedTools,
      hasShownInitMessage,
      processStreamLine,
      handlePermissionError,
    ],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Permission dialog handlers
  const handlePermissionAllow = useCallback(() => {
    const pattern = `${permissionDialog.toolName}(${permissionDialog.command}:*)`;
    // Add to allowed tools temporarily (for this request only)
    setAllowedTools((prev) => [...prev, pattern]);

    // Close dialog and send continue message
    setPermissionDialog((prev) => ({ ...prev, isOpen: false }));

    // Send a continue message with current session
    if (currentSessionId) {
      sendMessage("continue", [pattern]);
    }
  }, [permissionDialog, currentSessionId, sendMessage]);

  const handlePermissionAllowPermanent = useCallback(() => {
    const pattern = `${permissionDialog.toolName}(${permissionDialog.command}:*)`;
    // Add to allowed tools permanently (for entire session)
    setAllowedTools((prev) => [...prev, pattern]);

    // Close dialog and send continue message
    setPermissionDialog((prev) => ({ ...prev, isOpen: false }));

    // Send a continue message with current session
    if (currentSessionId) {
      sendMessage("continue", [pattern]);
    }
  }, [permissionDialog, currentSessionId, sendMessage]);

  const handlePermissionDeny = useCallback(
    (feedback?: string) => {
      // Close dialog
      setPermissionDialog((prev) => ({ ...prev, isOpen: false }));

      // Send feedback message if provided
      if (feedback && currentSessionId) {
        sendMessage(feedback);
      }
    },
    [currentSessionId, sendMessage],
  );

  const handlePermissionDialogClose = useCallback(() => {
    setPermissionDialog((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Abort current request
  const abortRequest = useCallback(async () => {
    if (!currentRequestId || !isLoading) return;

    try {
      await fetch(`http://localhost:8080/api/abort/${currentRequestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Clean up state after successful abort
      setIsLoading(false);
      setCurrentRequestId(null);
      setCurrentAssistantMessage(null);
    } catch (error) {
      console.error("Failed to abort request:", error);
      // Still clean up on error
      setIsLoading(false);
      setCurrentRequestId(null);
      setCurrentAssistantMessage(null);
    }
  }, [currentRequestId, isLoading]);

  // Handle global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // ESC key to abort (configurable in future)
      if (e.key === "Escape" && isLoading && currentRequestId) {
        e.preventDefault();
        abortRequest();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isLoading, currentRequestId, abortRequest]);

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
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto bg-white/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 p-6 mb-6 rounded-2xl shadow-sm backdrop-blur-sm flex flex-col"
        >
          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-center text-slate-500 dark:text-slate-400">
              <div>
                <div className="text-6xl mb-6 opacity-60">
                  <span role="img" aria-label="chat icon">
                    💬
                  </span>
                </div>
                <p className="text-lg font-medium">
                  Start a conversation with Claude
                </p>
                <p className="text-sm mt-2 opacity-80">
                  Type your message below to begin
                </p>
              </div>
            </div>
          )}
          {messages.length > 0 && (
            <>
              {/* Spacer div to push messages to the bottom */}
              <div className="flex-1" aria-hidden="true"></div>
              {messages.map((message, index) => {
                if (isSystemMessage(message)) {
                  return (
                    <SystemMessageComponent key={index} message={message} />
                  );
                } else if (isToolMessage(message)) {
                  return <ToolMessageComponent key={index} message={message} />;
                } else if (isToolResultMessage(message)) {
                  return (
                    <ToolResultMessageComponent key={index} message={message} />
                  );
                } else {
                  return <ChatMessageComponent key={index} message={message} />;
                }
              })}
              {isLoading && <LoadingComponent />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="flex-shrink-0">
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isLoading && currentRequestId
                  ? "Processing... (Press ESC to stop)"
                  : "Type your message... (Shift+Enter for new line)"
              }
              rows={1}
              className="w-full px-4 py-3 pr-32 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm shadow-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 resize-none overflow-hidden min-h-[48px] max-h-[200px]"
              disabled={isLoading}
            />
            <div className="absolute right-2 bottom-3 flex gap-2">
              {isLoading && currentRequestId && (
                <button
                  type="button"
                  onClick={abortRequest}
                  className="p-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                  title="Stop (ESC)"
                >
                  <StopIcon className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 text-sm"
              >
                {isLoading ? "..." : "Send"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Permission Dialog */}
      <PermissionDialog
        isOpen={permissionDialog.isOpen}
        toolName={permissionDialog.toolName}
        command={permissionDialog.command}
        onAllow={handlePermissionAllow}
        onAllowPermanent={handlePermissionAllowPermanent}
        onDeny={handlePermissionDeny}
        onClose={handlePermissionDialogClose}
      />
    </div>
  );
}

export default App;
