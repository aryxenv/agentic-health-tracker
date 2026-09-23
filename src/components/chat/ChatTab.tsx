import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  RotateCw,
  Send,
  Square,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { saveLogEntries, sendChatMessageStream } from "../../services/api";
import {
  getSelectedModel,
  getStoredChatMessages,
  saveSelectedModel,
  saveStoredChatMessages,
} from "../../services/storage";
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL_ID,
  type AgenticStep,
  type ChatMessage,
  type DraftEntry,
  type ModelId,
  type ModelOption,
  type UserProfile,
} from "../../types/health";
import { DraftCard } from "./DraftCard";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ModelSelector, ProviderIcon } from "./ModelSelector";

interface ChatTabProps {
  userProfile: UserProfile;
  onEntrySaved: () => void;
  onHasMessagesChange?: (hasMessages: boolean) => void;
}

export const ChatTab: React.FC<ChatTabProps> = ({
  userProfile,
  onEntrySaved,
  onHasMessagesChange,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    getStoredChatMessages(),
  );
  const [selectedModel, setSelectedModel] = useState<ModelId>(
    () => getSelectedModel() as ModelId,
  );

  const handleModelChange = (modelId: ModelId) => {
    setSelectedModel(modelId);
    saveSelectedModel(modelId);
  };

  const getNextModel = (currentId: string): ModelId => {
    const currentIndex = AVAILABLE_MODELS.findIndex((m) => m.id === currentId);
    if (currentIndex === -1) return AVAILABLE_MODELS[0].id;
    const nextIndex = (currentIndex + 1) % AVAILABLE_MODELS.length;
    return AVAILABLE_MODELS[nextIndex].id;
  };

  useEffect(() => {
    const handleModelUpdated = (e: any) => {
      if (e.detail && e.detail !== selectedModel) {
        setSelectedModel(e.detail as ModelId);
      }
    };
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "health_tracker_selected_model" && e.newValue) {
        setSelectedModel(e.newValue as ModelId);
      }
    };
    window.addEventListener("health_tracker_model_updated", handleModelUpdated);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener(
        "health_tracker_model_updated",
        handleModelUpdated,
      );
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [selectedModel]);

  useEffect(() => {
    saveStoredChatMessages(messages);
  }, [messages]);

  useEffect(() => {
    const hasUserSentMessage = messages.some((m) => m.sender === "user");
    onHasMessagesChange?.(hasUserSentMessage);
  }, [messages, onHasMessagesChange]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const streamingTextRef = useRef("");
  const [liveSteps, setLiveSteps] = useState<AgenticStep[]>([]);
  const [expandedStepMsgIds, setExpandedStepMsgIds] = useState<Set<string>>(
    new Set(),
  );
  const messagesFeedRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fallback auto-resize for browsers not yet supporting CSS field-sizing
  useEffect(() => {
    const el = textareaRef.current;
    if (
      el &&
      typeof CSS !== "undefined" &&
      !CSS.supports?.("field-sizing", "content")
    ) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [input]);

  // Abort any ongoing stream on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, liveSteps, streamingText]);

  // Enable scrolling anywhere in the viewport (including outside margins on desktop)
  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      const feed = messagesFeedRef.current;
      if (!feed) return;

      // Ignore if interaction is within an open modal or dialog
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[role="dialog"]') || target?.closest?.(".z-50")) {
        return;
      }

      // If wheel event occurs outside the feed container, scroll the feed
      if (!feed.contains(target)) {
        const delta =
          e.deltaMode === 1
            ? e.deltaY * 24
            : e.deltaMode === 2
              ? e.deltaY * window.innerHeight
              : e.deltaY;
        feed.scrollTop += delta;
      }
    };

    window.addEventListener("wheel", handleGlobalWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleGlobalWheel);
    };
  }, []);

  const toggleStepAccordion = (id: string) => {
    setExpandedStepMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      // Desktop detection: physical mouse/trackpad fine pointer
      const isDesktop =
        typeof window !== "undefined" &&
        window.matchMedia("(pointer: fine)").matches;

      if (isDesktop) {
        if (!e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
        // If Shift+Enter, allow default newline insertion
      }
      // On mobile devices, Enter key creates a newline; user taps Send button to submit
    }
  };

  const executeChat = async (history: ChatMessage[], modelToUse: ModelId) => {
    setLoading(true);
    setLiveSteps([]);
    setStreamingText("");
    streamingTextRef.current = "";

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const conversationHistory = history.map((m) => ({
        role: m.sender === "user" ? "user" : "health_agent",
        content: m.text,
      }));

      const res = await sendChatMessageStream(
        conversationHistory,
        userProfile,
        (step) => {
          setLiveSteps((prev) => [...prev, step]);
        },
        (delta) => {
          streamingTextRef.current += delta;
          setStreamingText((prev) => prev + delta);
        },
        controller.signal,
        modelToUse,
        () => {
          streamingTextRef.current = "";
          setStreamingText("");
        },
      );

      if (res.activeModel && res.activeModel !== selectedModel) {
        handleModelChange(res.activeModel);
      }

      const agentMsgId = `agent_${Date.now()}`;
      const finalText = res.reply || streamingTextRef.current;
      const healthAgentMessage: ChatMessage = {
        id: agentMsgId,
        sender: "health_agent",
        text: finalText,
        timestamp: new Date().toISOString(),
        needsClarification: res.needs_clarification,
        draftEntries:
          res.draft_entries && res.draft_entries.length > 0
            ? res.draft_entries
            : undefined,
        agenticSteps: res.steps && res.steps.length > 0 ? res.steps : liveSteps,
        isConfirmed: false,
      };

      setMessages((prev) => [...prev, healthAgentMessage]);
    } catch (err: any) {
      if (
        err.name === "AbortError" ||
        err.message?.toLowerCase().includes("abort")
      ) {
        const partial = streamingTextRef.current.trim();
        setMessages((prev) => [
          ...prev,
          {
            id: `aborted_${Date.now()}`,
            sender: "health_agent",
            text: partial
              ? `${partial} [Stopped]`
              : "Response stopped by user.",
            timestamp: new Date().toISOString(),
            agenticSteps: liveSteps.length > 0 ? liveSteps : undefined,
          },
        ]);
      } else {
        console.error("Chat error with Health Agent:", err);
        const errMsg = err.message || "API connection failed.";
        const isRateLimit =
          err?.status === 429 ||
          err?.statusCode === 429 ||
          errMsg.includes("429") ||
          errMsg.toLowerCase().includes("rate limit") ||
          errMsg.toLowerCase().includes("tokens per day") ||
          errMsg.includes("TPD");

        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            sender: "health_agent",
            text: `Telemetry error: ${errMsg}`,
            timestamp: new Date().toISOString(),
            isRateLimit,
            failedModel: modelToUse,
          },
        ]);
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
      setLiveSteps([]);
      setStreamingText("");
      streamingTextRef.current = "";
    }
  };

  const handleSend = async (customText?: string) => {
    const textToSend = (customText !== undefined ? customText : input).trim();
    if (!textToSend || loading) return;

    const userMsgId = `user_${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    if (!customText) {
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }

    await executeChat(nextMessages, selectedModel);
  };

  const handleRetryRateLimit = async (
    errorMsgId: string,
    failedModelId?: string,
  ) => {
    if (loading) return;

    const nextModel = getNextModel(failedModelId || selectedModel);
    handleModelChange(nextModel);

    // Remove the error message from history to retry cleanly
    const cleaned = messages.filter((m) => m.id !== errorMsgId);
    setMessages(cleaned);

    await executeChat(cleaned, nextModel);
  };

  const handleConfirmDraft = async (
    messageId: string,
    entries: DraftEntry[],
  ) => {
    try {
      await saveLogEntries(entries);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, isConfirmed: true, draftEntries: entries }
            : m,
        ),
      );
      onEntrySaved();
    } catch (err: any) {
      alert(`Logging failure: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 min-h-0 max-w-2xl mx-auto w-full flex flex-col p-4 sm:p-5 pb-3 sm:pb-3.5 overflow-hidden">
      {/* Messages Feed */}
      <div
        ref={messagesFeedRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-1 no-scrollbar"
      >
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          const hasSteps = msg.agenticSteps && msg.agenticSteps.length > 0;
          const isStepsExpanded = expandedStepMsgIds.has(msg.id);

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[90%] sm:max-w-[85%] rounded-panel p-3 text-[0.95rem] leading-[1.6] transition-colors duration-300 ${
                  isUser
                    ? "border border-[rgba(255,255,255,0.6)] text-white bg-transparent"
                    : "border border-quarter-light text-white bg-transparent"
                }`}
              >
                {!isUser && (
                  <div className="text-[0.76rem] text-white/50 mb-1">
                    <span className="uppercase tracking-wider">
                      HEALTH AGENT
                    </span>
                  </div>
                )}
                {isUser ? (
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                ) : (
                  <MarkdownRenderer content={msg.text} />
                )}

                {/* Inspectable Agentic Deliberation Steps */}
                {hasSteps && (
                  <div className="mt-2.5 border-t border-[rgba(255,255,255,0.15)] pt-2">
                    <button
                      type="button"
                      onClick={() => toggleStepAccordion(msg.id)}
                      className="flex items-center space-x-1 text-[0.76rem] text-white/50 hover:text-white transition-colors duration-300"
                    >
                      {isStepsExpanded ? (
                        <ChevronDown className="w-3 h-3 text-white/70" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-white/70" />
                      )}
                      <span className="tracking-wide">
                        {msg.agenticSteps!.length}{" "}
                        {msg.agenticSteps!.length === 1 ? "Step" : "Steps"}
                      </span>
                    </button>

                    {isStepsExpanded && (
                      <div className="mt-2 space-y-1.5 pl-2 border-l border-[rgba(255,255,255,0.2)] text-[0.76rem] text-white/70">
                        {msg.agenticSteps!.map((st) => (
                          <div key={st.id} className="py-0.5">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-white/40 uppercase text-[0.68rem] tracking-wider font-medium">
                                [
                                {st.type === "tool_call"
                                  ? "Tool"
                                  : st.type === "tool_result"
                                    ? "Result"
                                    : "Thought"}
                                ]
                              </span>
                              <span className="text-white/90">{st.title}</span>
                            </div>
                            {st.thought && (
                              <p className="text-white/50 pl-2 mt-0.5 text-[0.72rem] italic">
                                {st.thought}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Rate Limit Alert & Auto-Switch Try Again */}
                {msg.isRateLimit && (
                  <div className="mt-2.5 pt-2.5 border-t border-[rgba(255,255,255,0.15)]">
                    <div className="flex items-center space-x-1.5 text-[0.855rem] text-amber-400 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span>
                        Rate limit reached for{" "}
                        {AVAILABLE_MODELS.find((m) => m.id === msg.failedModel)?.name ||
                          msg.failedModel ||
                          "model"}
                      </span>
                    </div>
                    <p className="text-[0.76rem] text-white/50 mt-1 leading-snug">
                      Provider capacity reached. Retry immediately with another model with full context preserved.
                    </p>
                    {(() => {
                      const nextModelId = getNextModel(
                        msg.failedModel || selectedModel,
                      );
                      const nextModelOpt =
                        AVAILABLE_MODELS.find((m) => m.id === nextModelId) ||
                        AVAILABLE_MODELS[0];
                      return (
                        <button
                          type="button"
                          onClick={() =>
                            handleRetryRateLimit(msg.id, msg.failedModel)
                          }
                          disabled={loading}
                          className="mt-2.5 inline-flex items-center space-x-2 px-3 py-1.5 rounded-[5px] border border-[rgba(255,255,255,0.5)] hover:border-white text-white text-[0.855rem] font-normal transition-colors duration-300 cursor-pointer disabled:opacity-20 group bg-transparent hover:bg-white/5"
                        >
                          <RotateCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-300 text-white" />
                          <span>Try Again with {nextModelOpt.name}</span>
                          <span className="w-5 h-5 flex items-center justify-center">
                            <ProviderIcon provider={nextModelOpt.provider} />
                          </span>
                        </button>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Confirmation Card if draft entries exist */}
              {msg.draftEntries && msg.draftEntries.length > 0 && (
                <div className="w-full max-w-[95%] sm:max-w-[90%]">
                  <DraftCard
                    draftEntries={msg.draftEntries}
                    isConfirmed={msg.isConfirmed}
                    onConfirm={(entries) => handleConfirmDraft(msg.id, entries)}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Real-time Agentic Loop Live Telemetry Stream */}
        {loading && (
          <div className="flex flex-col items-start w-full">
            <div className="max-w-[90%] sm:max-w-[85%] rounded-panel p-3 text-[0.95rem] leading-[1.6] border border-quarter-light bg-transparent space-y-2">
              <div className="text-[0.76rem] text-white/50">
                <span className="uppercase tracking-wider">HEALTH AGENT</span>
              </div>

              {/* Streaming Output */}
              {streamingText ? (
                <div>
                  <MarkdownRenderer content={streamingText} />
                  <span className="inline-block w-1.5 h-3.5 bg-white/70 ml-1 animate-pulse align-middle" />
                </div>
              ) : null}

              {/* Real-time Agentic Loop Steps Telemetry */}
              <div
                className={
                  streamingText
                    ? "pt-2 border-t border-[rgba(255,255,255,0.15)]"
                    : ""
                }
              >
                <div className="flex items-center space-x-2 text-[0.76rem] text-white/70">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span className="tracking-wide">
                    {liveSteps.length > 0
                      ? liveSteps[liveSteps.length - 1].title
                      : "Health Agent deliberating with tools & specialists..."}
                  </span>
                </div>
                {liveSteps.length > 0 && (
                  <div className="pl-4 space-y-1 text-[0.76rem] text-white/50 border-l border-[rgba(255,255,255,0.15)] mt-1.5">
                    {liveSteps.slice(-3).map((st) => (
                      <div
                        key={st.id}
                        className="flex items-center space-x-1.5"
                      >
                        <span className="text-white/30 uppercase text-[0.68rem]">
                          [
                          {st.type === "tool_call"
                            ? "Tool"
                            : st.type === "tool_result"
                              ? "Result"
                              : "Thought"}
                          ]
                        </span>
                        <span className="text-white/70 truncate">
                          {st.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="!mt-0 h-0" />
      </div>

      {/* Input area */}
      <div className="shrink-0 pt-3">
        {/* Text Area Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-end border border-[rgba(255,255,255,0.5)] hover:border-white focus-within:border-white rounded-panel transition-colors duration-300 bg-transparent"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Log food or exercise (e.g. '1 bowl oatmeal')..."
            disabled={loading}
            style={{ fieldSizing: "content" } as React.CSSProperties}
            className="auto-expand w-full bg-transparent pl-3 pr-20 py-2.5 text-[0.95rem] text-white placeholder-white/30 focus:outline-none resize-none min-h-[44px] max-h-[160px] overflow-y-auto leading-[1.5] block no-scrollbar"
          />
          <div className="absolute right-2 bottom-2 flex items-center space-x-1">
            <ModelSelector
              selectedModelId={selectedModel}
              onSelectModel={handleModelChange}
              disabled={loading}
            />

            {loading ? (
              <button
                type="button"
                onClick={handleStop}
                aria-label="Stop response"
                title="Stop response"
                className="w-7 h-7 text-white opacity-80 hover:opacity-100 transition-opacity duration-300 flex items-center justify-center cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current text-white" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Send telemetry"
                className="w-7 h-7 text-white opacity-50 hover:opacity-100 disabled:opacity-20 transition-opacity duration-300 cursor-pointer flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
