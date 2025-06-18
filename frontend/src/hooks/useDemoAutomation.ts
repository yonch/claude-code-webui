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

  // Chat state
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
  } = useChatState();

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
          setInput(text.slice(0, currentIndex + 1));
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
    [typingSpeed, setInput],
  );

  // Process stream data
  const processStreamData = useCallback(
    (step: MockScenarioStep) => {
      console.log("processStreamData called with step:", step);

      if (step.type === "permission_error") {
        console.log("Processing permission error");
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
      console.log("Processing SDK message:", sdkMessage.type, sdkMessage);

      switch (sdkMessage.type) {
        case "system": {
          console.log("Processing system message");
          if (sdkMessage.session_id) {
            setCurrentSessionId(sdkMessage.session_id);
          }

          if (!currentAssistantMessage) {
            const systemMessage: AllMessage = {
              ...sdkMessage,
              timestamp: Date.now(),
            };
            console.log("Adding system message:", systemMessage);
            addMessage(systemMessage);
            setHasShownInitMessage(true);
            setHasReceivedInit(true);
          }
          break;
        }

        case "assistant": {
          console.log("Processing assistant message");
          if (sdkMessage.session_id) {
            setCurrentSessionId(sdkMessage.session_id);
          }

          const assistantMsg = sdkMessage as Extract<
            SDKMessage,
            { type: "assistant" }
          >;

          // Process the assistant message content
          console.log(
            "Assistant message content:",
            assistantMsg.message.content,
          );
          for (const contentItem of assistantMsg.message.content) {
            if (contentItem.type === "text") {
              const textContent = (contentItem as { text: string }).text;
              console.log("Processing text content:", textContent);
              const assistantMessage: ChatMessage = {
                type: "chat",
                role: "assistant",
                content: textContent,
                timestamp: Date.now(),
              };

              if (currentAssistantMessage) {
                console.log("Updating last message");
                updateLastMessage(textContent);
              } else {
                console.log("Adding new assistant message:", assistantMessage);
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
    },
    [
      addMessage,
      currentAssistantMessage,
      setCurrentSessionId,
      setHasShownInitMessage,
      setHasReceivedInit,
      setCurrentAssistantMessage,
      updateLastMessage,
      showPermissionDialog,
    ],
  );

  // Execute next demo step
  const executeNextStep = useCallback(() => {
    console.log("executeNextStep called:", {
      currentStep,
      scenario: scenario.length,
      isPaused,
      isCompleted,
    });
    if (
      isPaused ||
      isCompleted ||
      currentStep === 0 ||
      currentStep > scenario.length
    ) {
      console.log("executeNextStep early return");
      return;
    }

    // Convert step number to array index (step 1 = index 0)
    const stepIndex = currentStep - 1;
    const step = scenario[stepIndex];
    console.log("Executing step:", stepIndex, step);

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
        resetRequestState();
        onDemoComplete?.();
      }
    }, step.delay);
  }, [
    currentStep,
    scenario,
    isPaused,
    isCompleted,
    processStreamData,
    resetRequestState,
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
    console.log("Auto-start effect:", {
      autoStart,
      currentStep,
      isCompleted,
      isPaused,
      scenarioKey,
    });
    if (autoStart && currentStep === 0 && !isCompleted && !isPaused) {
      // First, simulate typing the input
      const inputText = DEMO_SCENARIOS[scenarioKey].inputText;
      console.log("Starting demo with input:", inputText);

      // Start typing after a short delay
      const typingTimer = setTimeout(() => {
        typeText(inputText, () => {
          console.log("Typing completed, adding user message");
          // Add the user message to chat
          const userMessage: ChatMessage = {
            type: "chat",
            role: "user",
            content: inputText,
            timestamp: Date.now(),
          };
          addMessage(userMessage);

          // After typing is complete, wait a bit then start the demo
          setTimeout(() => {
            console.log("Starting demo execution");
            startRequest();
            generateRequestId();
            // Clear the input for clean demo UI
            setInput("");
            setCurrentInput("");
            // Move to step 1 to begin scenario execution
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
    startRequest,
    generateRequestId,
    scenarioKey,
    typeText,
    addMessage,
    setInput,
  ]);

  // Demo control functions
  const resetDemo = useCallback(() => {
    setCurrentStep(0);
    setIsCompleted(false);
    setIsPaused(false);
    setCurrentInput("");
    setIsTyping(false);
    setInput("");

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

    resetRequestState();
  }, [setInput, resetRequestState]);

  const startDemo = useCallback(() => {
    if (isCompleted) {
      // Reset demo if completed
      resetDemo();
    }
    setIsPaused(false);
    if (currentStep === 0) {
      startRequest();
      generateRequestId();
    }
  }, [isCompleted, currentStep, startRequest, generateRequestId, resetDemo]);

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
