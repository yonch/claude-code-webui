import { useState } from "react";
import {
  XMarkIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface PermissionDialogProps {
  isOpen: boolean;
  toolName: string;
  command: string;
  onAllow: () => void;
  onAllowPermanent: () => void;
  onDeny: (feedback?: string) => void;
  onClose: () => void;
}

export function PermissionDialog({
  isOpen,
  toolName,
  command,
  onAllow,
  onAllowPermanent,
  onDeny,
  onClose,
}: PermissionDialogProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");

  if (!isOpen) return null;

  const toolPattern = `${toolName}(${command}:*)`;

  const handleDeny = () => {
    setShowFeedback(true);
  };

  const handleSubmitFeedback = () => {
    onDeny(feedback.trim() || undefined);
    setFeedback("");
    setShowFeedback(false);
  };

  const handleCancel = () => {
    setFeedback("");
    setShowFeedback(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Permission Required
            </h2>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!showFeedback ? (
            <>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Claude wants to use the{" "}
                <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-sm">
                  {toolPattern}
                </span>{" "}
                tool.
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Do you want to proceed?
              </p>

              {/* Action buttons */}
              <div className="space-y-3">
                <button
                  onClick={onAllow}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
                >
                  Yes
                </button>
                <button
                  onClick={onAllowPermanent}
                  className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
                >
                  Yes, and don't ask again for {toolName}
                </button>
                <button
                  onClick={handleDeny}
                  className="w-full px-4 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg font-medium transition-colors"
                >
                  No, and tell Claude what to do differently
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Please provide alternative instructions for Claude:
              </p>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g., 'Please use a different approach that doesn't require shell access'"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
                autoFocus
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleSubmitFeedback}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Send Feedback
                </button>
                <button
                  onClick={() => setShowFeedback(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg font-medium transition-colors"
                >
                  Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
