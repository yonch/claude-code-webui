import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import type { AllMessage, ChatMessage } from "../types";
import { useTheme } from "../hooks/useTheme";
import { useChatState } from "../hooks/chat/useChatState";
import { usePermissions } from "../hooks/chat/usePermissions";
import { ThemeToggle } from "./chat/ThemeToggle";
import { ChatInput } from "./chat/ChatInput";
import { ChatMessages } from "./chat/ChatMessages";
import { PermissionDialog } from "./PermissionDialog";
import {
  scenarioToStream,
  type MockScenarioStep,
} from "../utils/mockResponseGenerator";
import type { SDKMessage } from "../types";

export function DemoPage() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [demoStep, setDemoStep] = useState(0);
  const [isDemo] = useState(true);
  const [demoCompleted, setDemoCompleted] = useState(false);

  // Check for control parameter
  const searchParams = new URLSearchParams(location.search);
  const showControls = searchParams.get("control") === "true";

  const {
    messages,
    input,
    isLoading,
    currentRequestId,
    currentAssistantMessage,
    setInput,
    setCurrentSessionId,
    setHasShownInitMessage,
    setHasReceivedInit,
    setCurrentAssistantMessage,
    addMessage,
    updateLastMessage,
    generateRequestId,
    resetRequestState,
    startRequest,
  } = useChatState();

  const {
    permissionDialog,
    showPermissionDialog,
    closePermissionDialog,
    allowToolPermanent,
  } = usePermissions();

  // Demo state
  const demoWorkingDirectory = "/Users/demo/claude-code-webui";

  // Process mock stream data
  const processStreamData = useCallback((step: MockScenarioStep) => {
    if (step.type === "permission_error") {
      const errorData = step.data as { toolName: string; pattern: string; toolUseId: string };
      showPermissionDialog(errorData.toolName, errorData.pattern, errorData.toolUseId);
      return;
    }

    const sdkMessage = step.data as SDKMessage;

    switch (sdkMessage.type) {
      case "system": {
        if (sdkMessage.session_id) {
          setCurrentSessionId(sdkMessage.session_id);
        }
        
        if (!currentAssistantMessage) {
          const systemMessage: AllMessage = {
            ...sdkMessage,
            timestamp: Date.now(),
          };
          addMessage(systemMessage);
          setHasShownInitMessage(true);
          setHasReceivedInit(true);
        }
        break;
      }

      case "assistant": {
        if (sdkMessage.session_id) {
          setCurrentSessionId(sdkMessage.session_id);
        }

        const assistantMsg = sdkMessage as Extract<SDKMessage, { type: "assistant" }>;
        
        // Process the assistant message content
        for (const contentItem of assistantMsg.message.content) {
          if (contentItem.type === "text") {
            const textContent = (contentItem as { text: string }).text;
            const assistantMessage: ChatMessage = {
              type: "chat",
              role: "assistant",
              content: textContent,
              timestamp: Date.now(),
            };
            
            if (currentAssistantMessage) {
              updateLastMessage(textContent);
            } else {
              setCurrentAssistantMessage(assistantMessage);
              addMessage(assistantMessage);
            }
          } else if (contentItem.type === "tool_use") {
            const toolUse = contentItem as {
              type: "tool_use";
              id: string;
              name: string;
              input: Record<string, unknown>;
            };
            
            const toolMessage: AllMessage = {
              type: "tool",
              content: `${toolUse.name}(${JSON.stringify(toolUse.input, null, 2)})`,
              timestamp: Date.now(),
            };
            addMessage(toolMessage);
          }
        }
        
        setCurrentAssistantMessage(null);
        break;
      }

      case "result": {
        if (sdkMessage.session_id) {
          setCurrentSessionId(sdkMessage.session_id);
        }

        const resultMessage: AllMessage = {
          timestamp: Date.now(),
          ...(sdkMessage as Extract<SDKMessage, { type: "result" }>),
        };
        addMessage(resultMessage);
        break;
      }
    }
  }, [addMessage, currentAssistantMessage, setCurrentSessionId, setHasShownInitMessage, setHasReceivedInit, setCurrentAssistantMessage, updateLastMessage, showPermissionDialog]);

  // Run demo scenario
  useEffect(() => {
    if (!isDemo || demoCompleted) return;

    const scenario = scenarioToStream("basic");
    
    if (demoStep >= scenario.length) {
      setDemoCompleted(true);
      resetRequestState();
      return;
    }

    const currentStep = scenario[demoStep];
    const timer = setTimeout(() => {
      processStreamData(currentStep);
      setDemoStep(prev => prev + 1);
    }, currentStep.delay);

    return () => clearTimeout(timer);
  }, [demoStep, isDemo, demoCompleted, processStreamData, resetRequestState]);

  // Start demo on mount
  useEffect(() => {
    if (isDemo && demoStep === 0) {
      startRequest();
      generateRequestId();
    }
  }, [demoStep, generateRequestId, isDemo, startRequest]);

  // Permission dialog handlers (for demo)
  const handlePermissionAllow = () => {
    if (!permissionDialog) return;
    
    closePermissionDialog();
    
    // In demo, continue with next steps after permission is granted
    const scenario = scenarioToStream("fileOperations");
    const remainingSteps = scenario.slice(demoStep);
    
    // Continue processing steps after permission
    remainingSteps.forEach((step, index) => {
      if (step.type !== "permission_error") {
        setTimeout(() => {
          processStreamData(step);
        }, (index + 1) * 1000);
      }
    });
  };

  const handlePermissionAllowPermanent = () => {
    if (!permissionDialog) return;
    
    const pattern = permissionDialog.pattern;
    allowToolPermanent(pattern);
    closePermissionDialog();
    
    // Continue demo as above
    handlePermissionAllow();
  };

  const handlePermissionDeny = () => {
    closePermissionDialog();
    // In demo, we could show an error or skip to next scenario
  };

  // Fake send message for demo (input is controlled by automation)
  const handleSendMessage = () => {
    // In demo mode, this does nothing - messages are automated
    if (isDemo) return;
  };

  return (
    <div 
      className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300"
      data-demo-active={isDemo}
      data-demo-completed={demoCompleted}
      data-demo-step={demoStep}
    >
      <div className="max-w-6xl mx-auto p-6 h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-shrink-0">
          <div>
            <h1 className="text-slate-800 dark:text-slate-100 text-3xl font-bold tracking-tight">
              Claude Code Web UI
              {isDemo && (
                <span className="ml-3 text-lg font-normal text-slate-600 dark:text-slate-400">
                  (Demo)
                </span>
              )}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm font-mono mt-1">
              {demoWorkingDirectory}
            </p>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>

        {/* Demo Controls (only shown with ?control=true) */}
        {showControls && (
          <div className="mb-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Demo Controls - Step: {demoStep} | Completed: {demoCompleted ? "Yes" : "No"}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="px-3 py-1 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
                >
                  Reset Demo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <ChatMessages messages={messages} isLoading={isLoading} />

        {/* Input */}
        <ChatInput
          input={input}
          isLoading={isLoading}
          currentRequestId={currentRequestId}
          onInputChange={setInput}
          onSubmit={handleSendMessage}
          onAbort={() => {}} // No-op in demo
        />
      </div>

      {/* Permission Dialog */}
      {permissionDialog && (
        <PermissionDialog
          isOpen={permissionDialog.isOpen}
          toolName={permissionDialog.toolName}
          pattern={permissionDialog.pattern}
          onAllow={handlePermissionAllow}
          onAllowPermanent={handlePermissionAllowPermanent}
          onDeny={handlePermissionDeny}
          onClose={closePermissionDialog}
        />
      )}
    </div>
  );
}