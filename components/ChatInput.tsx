"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Mic, MicOff, Sparkles, Loader2 } from "lucide-react";

interface ChatInputProps {
  value?: string;
  onChange?: (val: string) => void;
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isListening: boolean;
  isTranscribing?: boolean;
  onToggleListening: () => void;
  isSpeaking: boolean;
  showStarterPills?: boolean;
  micError?: string | null;
}

const SUGGESTION_CHIPS = [
  { icon: "🙏", label: "Pray for peace", prompt: "Could you pray with me for inner peace and stillness?" },
  { icon: "📖", label: "Explain this verse", prompt: "Can you help explain the scripture verse you shared?" },
  { icon: "💬", label: "Help me with anxiety", prompt: "I am feeling anxious and overwhelmed right now. Can we talk through it?" },
  { icon: "🌱", label: "Give practical steps", prompt: "What practical, faith-rooted steps can I take today to handle this?" },
  { icon: "•••", label: "More", prompt: "What other scripture or guidance can you share for my heart today?" },
];

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSendMessage,
  isLoading,
  isListening,
  isTranscribing = false,
  onToggleListening,
  isSpeaking,
  micError,
}) => {
  const [internalInput, setInternalInput] = useState("");
  const isControlled = value !== undefined;
  const input = isControlled ? value : internalInput;
  const setInput = (val: string) => {
    if (isControlled) {
      onChange?.(val);
    } else {
      setInternalInput(val);
    }
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectChip = (chipPrompt: string) => {
    onSendMessage(chipPrompt);
  };

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  return (
    <div className="w-full pt-2 pb-1">
      {/* Elevated Composer Card */}
      <div className="rounded-[20px] border border-[#ECE8E2] bg-white p-3 sm:p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.06)] transition-all focus-within:border-[#77B500] focus-within:ring-2 focus-within:ring-[#77B500]/15">
        {/* Input Row */}
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening
                  ? isTranscribing
                    ? "Listening... transcribing in background... click mic when done"
                    : "Listening... speak now, click mic when done..."
                  : isTranscribing
                    ? "Transcribing your words..."
                    : "Share what's on your heart or ask a question..."
              }
              disabled={isLoading}
              className="w-full resize-none bg-transparent px-2 py-1 text-sm sm:text-base text-[#2F2F2F] placeholder:text-[#9CA3AF] focus:outline-none min-h-[38px] max-h-32 leading-relaxed font-normal"
            />

            {/* Speaking / Listening State indicator pill */}
            <div className="flex items-center gap-2 px-2 pt-0.5">
              {isSpeaking ? (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F2F4F7] px-2.5 py-0.5 text-[11px] font-medium text-[#4B5563]">
                  <MicOff className="h-3 w-3 text-[#6B7280]" />
                  <span>Pastor speaking</span>
                </div>
              ) : isListening ? (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 animate-pulse">
                  <Mic className="h-3 w-3 text-rose-500" />
                  <span>Listening... click mic to stop</span>
                </div>
              ) : isTranscribing ? (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                  <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
                  <span>Transcribing speech...</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right Action buttons: Mic & Send */}
          <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
            <button
              type="button"
              onClick={onToggleListening}
              disabled={isSpeaking || (!isListening && isTranscribing)}
              title={
                isSpeaking
                  ? "Turn-taking active: Pastor Mike is speaking"
                  : isListening
                    ? "Stop listening"
                    : "Speak your message"
              }
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition cursor-pointer active:scale-95 ${
                isListening
                  ? "border-rose-400 bg-rose-500 text-white shadow-xs"
                  : isSpeaking
                    ? "border-[#ECE8E2] bg-[#F8F5EE] text-[#9CA3AF] opacity-50 cursor-not-allowed"
                    : "border-[#ECE8E2] bg-white text-[#6B7280] hover:border-[#77B500] hover:text-[#77B500]"
              }`}
            >
              {isListening ? (
                <Mic className="h-4 w-4 animate-pulse text-white" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              title="Send message"
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-[#77B500] text-white shadow-xs transition hover:bg-[#689E00] disabled:opacity-40 disabled:hover:bg-[#77B500] disabled:cursor-not-allowed cursor-pointer active:scale-95"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar sm:flex-wrap">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => handleSelectChip(chip.prompt)}
            disabled={isLoading}
            className="flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full border border-[#ECE8E2] bg-[#F8F6F2] hover:bg-[#EFECE5] px-3.5 py-1.5 text-[11px] sm:text-xs font-medium text-[#4B5563] shadow-xs transition cursor-pointer active:scale-[0.98]"
          >
            <span>{chip.icon}</span>
            <span>{chip.label}</span>
          </button>
        ))}
      </div>

      {micError && (
        <div className="mt-1 px-1 text-[11px] font-medium text-rose-600">
          {micError}
        </div>
      )}
    </div>
  );
};
