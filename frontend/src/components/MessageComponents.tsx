import type { ChatMessage, SystemMessage, ToolMessage } from "../types";

interface ChatMessageComponentProps {
  message: ChatMessage;
}

export function ChatMessageComponent({ message }: ChatMessageComponentProps) {
  return (
    <div
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
    <div className="mb-3 p-3 rounded-lg bg-orange-50/80 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
      <div className="text-orange-800 dark:text-orange-300 text-xs font-medium mb-1 flex items-center gap-2">
        <div className="w-4 h-4 bg-orange-400 dark:bg-orange-500 rounded-full flex items-center justify-center text-white text-xs">
          🔧
        </div>
        Tool
      </div>
      <pre className="whitespace-pre-wrap text-orange-700 dark:text-orange-300 text-xs font-mono leading-relaxed">
        {message.content}
      </pre>
    </div>
  );
}

export function LoadingComponent() {
  return (
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
  );
}
