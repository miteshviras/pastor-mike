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

const STARTER_PROMPTS = [
  "I am feeling anxious about work and overwhelmed.",
  "Help me pray for my family and loved ones.",
  "I'm walking through grief and need comforting scripture.",
  "I need guidance and peace for an important decision.",
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
  showStarterPills = false,
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

  const handleSelectPrompt = (prompt: string) => {
    onSendMessage(prompt);
  };

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  return (
    <div className="sticky bottom-0 z-20 border-t border-border/60 bg-background/95 px-3 py-2.5 sm:px-4 sm:py-3 pb-[calc(0.6rem+env(safe-area-inset-bottom,0px))] backdrop-blur-md">
      <div className="mx-auto max-w-3xl">
        {/* Starter suggestion pills — horizontally scrollable on mobile to preserve screen height */}
        {showStarterPills && (
          <div className="mb-2.5">
            <div className="flex items-center gap-1.5 mb-1.5 text-xs font-medium text-[#c3c3cc]">
              <Sparkles className="h-3 w-3 text-[#9cb4e8] shrink-0" />
              <span className="text-[11px] sm:text-xs">
                How can Pastor Mike help support you today?
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:flex-wrap">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSelectPrompt(prompt)}
                  disabled={isLoading}
                  className="whitespace-nowrap shrink-0 rounded-full border border-[#9cb4e8]/25 bg-[#9cb4e8]/10 px-3.5 py-2 text-xs text-[#ededf3] transition hover:bg-[#9cb4e8]/20 disabled:opacity-50 cursor-pointer touch-manipulation active:scale-[0.98]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input box */}
        <div className="flex items-end gap-1.5 sm:gap-2 rounded-input border border-border bg-card p-1.5 sm:p-2 focus-within:border-[#5266eb] focus-within:ring-2 focus-within:ring-[#5266eb]/15">
          {/* Microphone Voice Button */}
          <button
            type="button"
            onClick={onToggleListening}
            disabled={isSpeaking || (!isListening && isTranscribing)}
            title={
              isSpeaking
                ? "Turn-taking active: Pastor Mike is speaking"
                : isListening
                  ? isTranscribing
                    ? "Listening... (Transcribing in background) Click to stop"
                    : "Listening... Click to stop"
                  : isTranscribing
                    ? "Transcribing your speech..."
                    : "Speak your message"
            }
            className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full transition cursor-pointer touch-manipulation active:scale-95 ${
              isListening
                ? "bg-rose-500 text-white animate-pulse"
                : isTranscribing
                  ? "bg-amber-500/20 text-amber-500"
                  : isSpeaking
                    ? "bg-muted text-muted-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-card-foreground"
            }`}
          >
            {isListening ? (
              <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : isTranscribing ? (
              <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
            ) : isSpeaking ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </button>

          {/* Text Area */}
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
                  : "Share your thoughts or prayer request..."
            }
            disabled={isLoading}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-base sm:text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-hidden max-h-32"
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            title="Send message"
            className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-[#5266eb] text-white transition hover:bg-[#3f52c9] disabled:opacity-30 disabled:hover:bg-[#5266eb] cursor-pointer touch-manipulation active:scale-95"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        {micError && (
          <div className="mt-1.5 px-1 text-[11px] text-rose-400">
            {micError}
          </div>
        )}

        <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] sm:text-[11px] text-[#c3c3cc]/70">
          <span>Private & stored locally in SQLite</span>
          <span className="hidden sm:inline">
            Press Enter to send • Shift+Enter for newline
          </span>
        </div>
      </div>
    </div>
  );
};
