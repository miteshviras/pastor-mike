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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
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
        <div className="rounded-2xl border border-border bg-card p-2 sm:p-2.5 transition-all duration-200 focus-within:border-[#5266eb] focus-within:ring-2 focus-within:ring-[#5266eb]/15 shadow-sm">
          {/* Text Area - full width so multiline text flows naturally without awkward indentation */}
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
            className="w-full resize-none bg-transparent px-2.5 pt-1 pb-1 text-base sm:text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none min-h-[36px] max-h-36 leading-relaxed"
          />

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-between pt-1 gap-2">
            {/* Left: Microphone Voice Button & Speech Status */}
            <div className="flex items-center gap-2">
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
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 sm:px-3 text-xs font-medium transition cursor-pointer touch-manipulation active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5266eb] ${
                  isListening
                    ? "bg-rose-500 text-white shadow-sm shadow-rose-500/30 animate-pulse"
                    : isTranscribing
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : isSpeaking
                        ? "bg-muted text-muted-foreground opacity-60 cursor-not-allowed"
                        : "text-muted-foreground hover:bg-accent hover:text-card-foreground border border-border/40"
                }`}
              >
                {isListening ? (
                  <>
                    <Mic className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-white" />
                    <span className="text-[11px] sm:text-xs font-medium">
                      {isTranscribing ? "Transcribing..." : "Listening..."}
                    </span>
                  </>
                ) : isTranscribing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 animate-spin text-amber-400" />
                    <span className="text-[11px] sm:text-xs">Transcribing...</span>
                  </>
                ) : isSpeaking ? (
                  <>
                    <MicOff className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                    <span className="hidden sm:inline text-[11px] sm:text-xs">Pastor speaking</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                    <span className="hidden sm:inline text-[11px] sm:text-xs">Speak</span>
                  </>
                )}
              </button>

              {isListening && (
                <span className="hidden sm:inline text-[11px] text-muted-foreground">
                  Click mic when done
                </span>
              )}
            </div>

            {/* Right: Send Button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              title="Send message"
              className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-[#5266eb] text-white shadow-sm shadow-[#5266eb]/30 transition hover:bg-[#3f52c9] disabled:opacity-30 disabled:hover:bg-[#5266eb] disabled:cursor-not-allowed cursor-pointer touch-manipulation active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5266eb]"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
            </button>
          </div>
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
