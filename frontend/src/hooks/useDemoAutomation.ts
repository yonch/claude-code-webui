import { useState, useEffect, useCallback, useRef } from "react";
import type { AllMessage, ChatMessage } from "../types";
import { useChatState } from "./chat/useChatState";
import { usePermissions } from "./chat/usePermissions";
import {
  scenarioToStream,
  type MockScenarioStep,
  DEMO_SCENARIOS,
} from "../utils/mockResponseGenerator";
import type { SDKMessage } from "../types";

export interface DemoAutomationHook {
  currentStep: number;
  isCompleted: boolean;
  currentInput: string;
  isTyping: boolean;
  startDemo: () => void;
  pauseDemo: () => void;
  resetDemo: () => void;
  resumeDemo: () => void;
  isPaused: boolean;
}

interface DemoAutomationOptions {
  autoStart?: boolean;
  typingSpeed?: number; // characters per second
  scenarioKey?: keyof typeof DEMO_SCENARIOS;
  onStepComplete?: (step: number) => void;
  onDemoComplete?: () => void;
  addMessage?: (message: AllMessage | ChatMessage) => void;
  setInput?: (input: string) => void;
  startRequest?: () => void;
  resetRequestState?: () => void;
  generateRequestId?: () => string;
}

const DEFAULT_TYPING_SPEED = 30; // characters per second
const REALISTIC_TYPING_VARIANCE = 0.15; // 15% variance in typing speed (reduced for smoother effect)

export function useDemoAutomation(
  options: DemoAutomationOptions = {},
): DemoAutomationHook {
  const {
    autoStart = true,
    typingSpeed = DEFAULT_TYPING_SPEED,
    scenarioKey = "basic",
    onStepComplete,
    onDemoComplete,
    addMessage: externalAddMessage,
    setInput: externalSetInput,
    startRequest: externalStartRequest,
    resetRequestState: externalResetRequestState,
    generateRequestId: externalGenerateRequestId,
  } = options;

  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentInput, setCurrentInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Refs for cleanup
  const stepTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Chat state (fallback if not provided externally)
  const chatState = useChatState();
  const {
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
    currentAssistantMessage,
  } = chatState;

  // Use external functions if provided, otherwise use internal ones
  const finalAddMessage = externalAddMessage || addMessage;
  const finalSetInput = externalSetInput || setInput;
  const finalStartRequest = externalStartRequest || startRequest;
  const finalResetRequestState = externalResetRequestState || resetRequestState;
  const finalGenerateRequestId = externalGenerateRequestId || generateRequestId;

  // Permissions
  const { showPermissionDialog } = usePermissions();

  // Get current scenario
  const scenario = scenarioToStream(scenarioKey);

  // Typing animation with realistic variance
  const typeText = useCallback(
    (text: string, onComplete?: () => void) => {
      if (!text) {
        onComplete?.();
        return;
      }

      setIsTyping(true);
      setCurrentInput("");
      let currentIndex = 0;

      const typeNextCharacter = () => {
        if (currentIndex < text.length) {
          setCurrentInput(text.slice(0, currentIndex + 1));
          finalSetInput(text.slice(0, currentIndex + 1));
          currentIndex++;

          // Calculate realistic delay with variance
          const baseDelay = 1000 / typingSpeed;
          const variance = baseDelay * REALISTIC_TYPING_VARIANCE;
          const randomVariance = (Math.random() - 0.5) * 2 * variance;
          const delay = Math.max(50, baseDelay + randomVariance);

          // Add occasional longer pauses for more realistic typing
          const shouldPause = Math.random() < 0.02; // 2% chance of pause (reduced)
          const pauseDelay = shouldPause ? Math.random() * 200 + 100 : 0;

          typingIntervalRef.current = setTimeout(
            typeNextCharacter,
            delay + pauseDelay,
          );
        } else {
          setIsTyping(false);
          onComplete?.();
        }
      };

      typeNextCharacter();
    },
    [typingSpeed, finalSetInput],
  );

  // Process stream data
  const processStreamData = useCallback(
    (step: MockScenarioStep) => {
      if (step.type === "permission_error") {
        const errorData = step.data as {
          toolName: string;
          pattern: string;
          toolUseId: string;
        };
        showPermissionDialog(
          errorData.toolName,
          errorData.pattern,
          errorData.toolUseId,
        );
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
            finalAddMessage(systemMessage);
            setHasShownInitMessage(true);
            setHasReceivedInit(true);
          }
          break;
        }

        case "assistant": {
          if (sdkMessage.session_id) {
            setCurrentSessionId(sdkMessage.session_id);
          }

          const assistantMsg = sdkMessage as Extract<
            SDKMessage,
            { type: "assistant" }
          >;

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
                finalAddMessage(assistantMessage);
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
              finalAddMessage(toolMessage);
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
          finalAddMessage(resultMessage);
          break;
        }
      }
    },
    [
      currentAssistantMessage,
      setCurrentSessionId,
      setHasShownInitMessage,
      setHasReceivedInit,
      setCurrentAssistantMessage,
      updateLastMessage,
      showPermissionDialog,
      finalAddMessage,
    ],
  );

  // Execute next demo step
  const executeNextStep = useCallback(() => {
    if (
      isPaused ||
      isCompleted ||
      currentStep === 0 ||
      currentStep > scenario.length
    ) {
      return;
    }

    // Convert step number to array index (step 1 = index 0)
    const stepIndex = currentStep - 1;
    const step = scenario[stepIndex];

    // Clear any existing timeouts
    if (stepTimeoutRef.current) {
      clearTimeout(stepTimeoutRef.current);
    }

    stepTimeoutRef.current = setTimeout(() => {
      processStreamData(step);

      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);

      onStepComplete?.(nextStep);

      if (nextStep > scenario.length) {
        setIsCompleted(true);
        finalResetRequestState();
        onDemoComplete?.();
      }
    }, step.delay);
  }, [
    currentStep,
    scenario,
    isPaused,
    isCompleted,
    processStreamData,
    finalResetRequestState,
    onStepComplete,
    onDemoComplete,
  ]);

  // Demo execution effect
  useEffect(() => {
    if (
      !isCompleted &&
      !isPaused &&
      currentStep > 0 &&
      currentStep <= scenario.length
    ) {
      executeNextStep();
    }

    return () => {
      if (stepTimeoutRef.current) {
        clearTimeout(stepTimeoutRef.current);
      }
    };
  }, [currentStep, isPaused, isCompleted, executeNextStep, scenario.length]);

  // Auto-start effect with typing animation
  useEffect(() => {
    if (autoStart && currentStep === 0 && !isCompleted && !isPaused) {
      // First, simulate typing the input
      const inputText = DEMO_SCENARIOS[scenarioKey].inputText;

      // Start typing after a short delay
      const typingTimer = setTimeout(() => {
        typeText(inputText, () => {
          // Add the user message to chat
          const userMessage: ChatMessage = {
            type: "chat",
            role: "user",
            content: inputText,
            timestamp: Date.now(),
          };
          finalAddMessage(userMessage);

          // After typing is complete, immediately clear input and start demo (like real chat)
          finalSetInput("");
          setCurrentInput("");
          finalStartRequest();
          finalGenerateRequestId();
          
          // Start demo execution after a short delay
          setTimeout(() => {
            setCurrentStep(1);
          }, 1000);
        });
      }, 1000);

      return () => clearTimeout(typingTimer);
    }
  }, [
    autoStart,
    currentStep,
    isCompleted,
    isPaused,
    scenarioKey,
    typeText,
    finalAddMessage,
    finalSetInput,
    finalStartRequest,
    finalGenerateRequestId,
  ]);

  // Demo control functions
  const resetDemo = useCallback(() => {
    setCurrentStep(0);
    setIsCompleted(false);
    setIsPaused(false);
    setCurrentInput("");
    setIsTyping(false);
    finalSetInput("");

    // Clear all timeouts
    if (stepTimeoutRef.current) {
      clearTimeout(stepTimeoutRef.current);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (typingIntervalRef.current) {
      clearTimeout(typingIntervalRef.current);
    }

    finalResetRequestState();
  }, [finalSetInput, finalResetRequestState]);

  const startDemo = useCallback(() => {
    if (isCompleted) {
      // Reset demo if completed
      resetDemo();
    }
    setIsPaused(false);
    if (currentStep === 0) {
      finalStartRequest();
      finalGenerateRequestId();
    }
  }, [isCompleted, currentStep, finalStartRequest, finalGenerateRequestId, resetDemo]);

  const pauseDemo = useCallback(() => {
    setIsPaused(true);
    if (stepTimeoutRef.current) {
      clearTimeout(stepTimeoutRef.current);
    }
    if (typingIntervalRef.current) {
      clearTimeout(typingIntervalRef.current);
    }
    setIsTyping(false);
  }, []);

  const resumeDemo = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const stepTimeout = stepTimeoutRef.current;
      const typingTimeout = typingTimeoutRef.current;
      const typingInterval = typingIntervalRef.current;

      if (stepTimeout) {
        clearTimeout(stepTimeout);
      }
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      if (typingInterval) {
        clearTimeout(typingInterval);
      }
    };
  }, []);

  // Auto-permission handling for demo
  useEffect(() => {
    if (scenarioKey === "fileOperations") {
      // Auto-allow permissions after a short delay for demo purposes
      const timer = setTimeout(() => {
        // This would be handled by the permission dialog in the component
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [scenarioKey]);

  return {
    currentStep,
    isCompleted,
    currentInput,
    isTyping,
    startDemo,
    pauseDemo,
    resetDemo,
    resumeDemo,
    isPaused,
  };
}

// Helper function to simulate user input with typing animation
export function useTypingAnimation(
  text: string,
  speed: number = DEFAULT_TYPING_SPEED,
) {
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTyping = useCallback(() => {
    setIsTyping(true);
    setDisplayText("");
    let index = 0;

    const typeCharacter = () => {
      if (index < text.length) {
        setDisplayText(text.slice(0, index + 1));
        index++;

        const delay = 1000 / speed + (Math.random() - 0.5) * 100;
        intervalRef.current = setTimeout(typeCharacter, delay);
      } else {
        setIsTyping(false);
      }
    };

    typeCharacter();
  }, [text, speed]);

  const stopTyping = useCallback(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
    }
    setIsTyping(false);
    setDisplayText(text);
  }, [text]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, []);

  return {
    displayText,
    isTyping,
    startTyping,
    stopTyping,
  };
}
