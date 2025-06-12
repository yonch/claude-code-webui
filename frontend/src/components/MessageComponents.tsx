import type { ChatMessage, SystemMessage, ToolMessage } from "../types";

interface ChatMessageComponentProps {
  message: ChatMessage;
}

export function ChatMessageComponent({ message }: ChatMessageComponentProps) {
  return (
    <div className={`mb-4 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[70%] sm:max-w-[85%] rounded-lg px-4 py-3 ${
        message.role === "user"
          ? "bg-blue-600 text-white"
          : "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
      }`}>
        <div className={`text-xs font-semibold mb-2 opacity-90 ${
          message.role === "user" ? "text-blue-100" : "text-slate-600 dark:text-slate-400"
        }`}>
          {message.role === "user" ? "You" : "Assistant"}
        </div>
        <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
          {message.content}
        </pre>
      </div>
    </div>
  );
}

interface SystemMessageComponentProps {
  message: SystemMessage;
}

export function SystemMessageComponent({
  message,
}: SystemMessageComponentProps) {
  return (
    <div className="mb-3 p-3 rounded-lg bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
      <div className="text-blue-800 dark:text-blue-300 text-xs font-medium mb-1 flex items-center gap-2">
        <div className="w-4 h-4 bg-blue-400 dark:bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
          ⚙
        </div>
        System
      </div>
      <pre className="whitespace-pre-wrap text-blue-700 dark:text-blue-300 text-xs font-mono leading-relaxed">
        {message.content}
      </pre>
    </div>
  );
}

interface ToolMessageComponentProps {
  message: ToolMessage;
}

export function ToolMessageComponent({ message }: ToolMessageComponentProps) {
  return (
    <div className="mb-4 flex justify-start">
      <div className="max-w-[70%] sm:max-w-[85%] rounded-lg px-4 py-3 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-100">
        <div className="text-xs font-semibold mb-2 opacity-90 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <div className="w-4 h-4 bg-emerald-500 dark:bg-emerald-600 rounded-full flex items-center justify-center text-white text-xs">
            🔧
          </div>
          Tool
        </div>
        <pre className="whitespace-pre-wrap text-xs font-mono leading-relaxed">
          {message.content}
        </pre>
      </div>
    </div>
  );
}

export function LoadingComponent() {
  return (
    <div className="mb-4 flex justify-start">
      <div className="max-w-[70%] sm:max-w-[85%] rounded-lg px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100">
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
      </div>
    </div>
  );
}
