import React, { useState } from "react";
import type { ChatMessage, SystemMessage, ToolMessage } from "../types";
import { TimestampComponent } from "./TimestampComponent";

interface BubbleContainerProps {
  alignment: "left" | "right" | "center";
  colorScheme: string;
  children: React.ReactNode;
}

function BubbleContainer({
  alignment,
  colorScheme,
  children,
}: BubbleContainerProps) {
  const justifyClass =
    alignment === "right"
      ? "justify-end"
      : alignment === "center"
        ? "justify-center"
        : "justify-start";

  return (
    <div className={`mb-4 flex ${justifyClass}`}>
      <div
        className={`max-w-[85%] sm:max-w-[70%] rounded-lg px-4 py-3 ${colorScheme}`}
      >
        {children}
      </div>
    </div>
  );
}

interface ChatMessageComponentProps {
  message: ChatMessage;
}

export function ChatMessageComponent({ message }: ChatMessageComponentProps) {
  const isUser = message.role === "user";
  const colorScheme = isUser
    ? "bg-blue-600 text-white"
    : "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100";

  return (
    <BubbleContainer
      alignment={isUser ? "right" : "left"}
      colorScheme={colorScheme}
    >
      <div className="mb-2">
        <div
          className={`text-xs font-semibold opacity-90 ${
            isUser ? "text-blue-100" : "text-slate-600 dark:text-slate-400"
          }`}
        >
          {isUser ? "You" : "Assistant"}
        </div>
        <TimestampComponent
          timestamp={message.timestamp}
          className={`text-xs opacity-70 ${
            isUser ? "text-blue-200" : "text-slate-500 dark:text-slate-500"
          }`}
        />
      </div>
      <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
        {message.content}
      </pre>
    </BubbleContainer>
  );
}

interface SystemMessageComponentProps {
  message: SystemMessage;
}

export function SystemMessageComponent({
  message,
}: SystemMessageComponentProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Generate details based on message type and subtype
  const getDetails = () => {
    if (message.type === "system" && message.subtype === "init") {
      return [
        `Model: ${message.model}`,
        `Session: ${message.session_id.substring(0, 8)}`,
        `Tools: ${message.tools.length} available`,
        `CWD: ${message.cwd}`,
        `Permission Mode: ${message.permissionMode}`,
        `API Key Source: ${message.apiKeySource}`,
      ].join("\n");
    } else if (message.type === "result") {
      const details = [
        `Duration: ${message.duration_ms}ms`,
        `Cost: $${message.total_cost_usd.toFixed(4)}`,
        `Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`,
      ];
      if ("result" in message) {
        details.unshift(`Result: ${message.result}`);
      }
      return details.join("\n");
    } else if (message.type === "error") {
      return message.message;
    }
    return JSON.stringify(message, null, 2);
  };

  // Get label based on message type
  const getLabel = () => {
    if (message.type === "system") return "System";
    if (message.type === "result") return "Result";
    if (message.type === "error") return "Error";
    return "Message";
  };

  const details = getDetails();
  const hasDetails = details.trim().length > 0;

  return (
    <div className="mb-3 p-3 rounded-lg bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
      <div
        className={`text-blue-800 dark:text-blue-300 text-xs font-medium mb-1 flex items-center gap-2 ${hasDetails ? "cursor-pointer hover:text-blue-600 dark:hover:text-blue-200" : ""}`}
        role={hasDetails ? "button" : undefined}
        tabIndex={hasDetails ? 0 : undefined}
        aria-expanded={hasDetails ? isExpanded : undefined}
        onClick={hasDetails ? () => setIsExpanded(!isExpanded) : undefined}
        onKeyDown={
          hasDetails
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsExpanded(!isExpanded);
                }
              }
            : undefined
        }
      >
        <div className="w-4 h-4 bg-blue-400 dark:bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
          ⚙
        </div>
        <span>{getLabel()}</span>
        <span className="text-blue-600 dark:text-blue-400">
          ({message.subtype})
        </span>
        {hasDetails && (
          <span className="ml-1 text-blue-600 dark:text-blue-400">
            {isExpanded ? "▼" : "▶"}
          </span>
        )}
      </div>
      {hasDetails && isExpanded && (
        <pre className="whitespace-pre-wrap text-blue-700 dark:text-blue-300 text-xs font-mono leading-relaxed mt-2 pl-6 border-l-2 border-blue-200 dark:border-blue-700">
          {details}
        </pre>
      )}
    </div>
  );
}

interface ToolMessageComponentProps {
  message: ToolMessage;
}

export function ToolMessageComponent({ message }: ToolMessageComponentProps) {
  return (
    <BubbleContainer
      alignment="left"
      colorScheme="bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-100"
    >
      <div className="text-xs font-semibold mb-2 opacity-90 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
        <div className="w-4 h-4 bg-emerald-500 dark:bg-emerald-600 rounded-full flex items-center justify-center text-white text-xs">
          🔧
        </div>
        Tool
      </div>
      <pre className="whitespace-pre-wrap text-xs font-mono leading-relaxed">
        {message.content}
      </pre>
    </BubbleContainer>
  );
}

export function LoadingComponent() {
  return (
    <BubbleContainer
      alignment="left"
      colorScheme="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
    >
      <div className="text-xs font-semibold mb-2 opacity-90 text-slate-600 dark:text-slate-400">
        Assistant
      </div>
      <div className="flex items-center gap-2 text-sm">
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
    </BubbleContainer>
  );
}
