import { useState, useEffect } from "react";
import {
  XMarkIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface PermissionDialogProps {
  isOpen: boolean;
  toolName: string;
  pattern: string;
  onAllow: () => void;
  onAllowPermanent: () => void;
  onDeny: () => void;
  onClose: () => void;
  autoClickButton?: "allow" | "allowPermanent" | null;
}

export function PermissionDialog({
  isOpen,
  toolName,
  pattern,
  onAllow,
  onAllowPermanent,
  onDeny,
  onClose,
  autoClickButton = null,
}: PermissionDialogProps) {
  const [activeButton, setActiveButton] = useState<string | null>(null);

  // Handle auto-click effect with focus sequence animation
  useEffect(() => {
    if (autoClickButton) {
      // Direct focus on the target button (no sequence for cleaner UX)
      setActiveButton(autoClickButton);

      // Remove effect after animation completes
      const timer = setTimeout(() => {
        setActiveButton(null);
      }, 700); // Single button focus duration

      return () => clearTimeout(timer);
    }
  }, [autoClickButton]);

  if (!isOpen) return null;

  const handleDeny = () => {
    onDeny();
  };

  const getButtonClasses = (buttonType: string, baseClasses: string) => {
    const isActive = activeButton === buttonType;

    if (!isActive) {
      return `${baseClasses} transition-all duration-300`;
    }

    // Maintain original button color when active
    if (buttonType === "allowPermanent") {
      // Green button (Allow Permanent) - enhance green color
      return `${baseClasses} !bg-green-700 dark:!bg-green-600 shadow-lg shadow-green-500/50 ring-2 ring-green-400 dark:ring-green-300 transition-all duration-300`;
    } else if (buttonType === "allow") {
      // Blue button (Yes) - enhance blue color
      return `${baseClasses} !bg-blue-700 dark:!bg-blue-600 shadow-lg shadow-blue-500/50 ring-2 ring-blue-400 dark:ring-blue-300 transition-all duration-300`;
    } else {
      // Default for deny button
      return `${baseClasses} !bg-slate-400 dark:!bg-slate-500 shadow-lg shadow-slate-500/50 ring-2 ring-slate-400 dark:ring-slate-300 transition-all duration-300`;
    }
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
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-slate-600 dark:text-slate-300 mb-4">
            Claude wants to use the{" "}
            <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-sm">
              {pattern}
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
              className={getButtonClasses(
                "allow",
                "w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm hover:shadow-md",
              )}
            >
              Yes
            </button>
            <button
              onClick={onAllowPermanent}
              className={getButtonClasses(
                "allowPermanent",
                "w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-sm hover:shadow-md",
              )}
            >
              Yes, and don't ask again for {toolName}
            </button>
            <button
              onClick={handleDeny}
              className={getButtonClasses(
                "deny",
                "w-full px-4 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg font-medium",
              )}
            >
              No
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
