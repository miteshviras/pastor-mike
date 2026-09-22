"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Mic, MicOff, Sparkles } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isListening: boolean;
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
  onSendMessage,
  isLoading,
  isListening,
  onToggleListening,
  isSpeaking,
  showStarterPills = false,
  micError,
}) => {
  const [input, setInput] = useState("");
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
    <div className="sticky bottom-0 z-20 border-t border-stone-200/80 bg-[#faf8f5]/95 px-3 py-2.5 sm:px-4 sm:py-3 pb-[calc(0.6rem+env(safe-area-inset-bottom,0px))] backdrop-blur-md dark:border-stone-800/80 dark:bg-[#141312]/95">
      <div className="mx-auto max-w-3xl">
        {/* Starter suggestion pills — horizontally scrollable on mobile to preserve screen height */}
        {showStarterPills && (
          <div className="mb-2.5">
            <div className="flex items-center gap-1.5 mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
              <Sparkles className="h-3 w-3 text-amber-600 shrink-0" />
              <span className="text-[11px] sm:text-xs">How can Pastor Mike help support you today?</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:flex-wrap">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSelectPrompt(prompt)}
                  disabled={isLoading}
                  className="whitespace-nowrap shrink-0 rounded-full border border-stone-200/90 bg-white px-3 py-1.5 text-xs text-stone-700 shadow-2xs transition hover:border-stone-400 hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800/80 dark:text-stone-300 dark:hover:bg-stone-700"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input box */}
        <div className="flex items-end gap-1.5 sm:gap-2 rounded-2xl border border-stone-300/80 bg-white p-1.5 sm:p-2 shadow-xs focus-within:border-stone-400 focus-within:ring-1 focus-within:ring-stone-400 dark:border-stone-700 dark:bg-stone-900/90 dark:focus-within:border-stone-600 dark:focus-within:ring-stone-600">
          {/* Microphone Voice Button */}
          <button
            type="button"
            onClick={onToggleListening}
            disabled={isSpeaking}
            title={
              isSpeaking
                ? "Turn-taking active: Pastor Mike is speaking"
                : isListening
                ? "Listening... Click to stop"
                : "Speak your message"
            }
            className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl transition ${
              isListening
                ? "bg-rose-500 text-white shadow-md animate-pulse"
                : isSpeaking
                ? "bg-stone-100 text-stone-400 dark:bg-stone-800"
                : "text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
            }`}
          >
            {isListening ? (
              <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
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
                ? "Listening... speak now..."
                : "Share your thoughts or prayer request..."
            }
            disabled={isLoading}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-base sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-hidden dark:text-stone-100 dark:placeholder:text-stone-500 max-h-32"
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            title="Send message"
            className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-[#445942] text-white shadow-xs transition hover:bg-[#384a36] disabled:opacity-30 disabled:hover:bg-[#445942] dark:bg-[#5b7858] dark:hover:bg-[#4c6749]"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        {micError && (
          <div className="mt-1.5 px-1 text-[11px] text-rose-500 dark:text-rose-400">
            {micError}
          </div>
        )}

        <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] sm:text-[11px] text-stone-400 dark:text-stone-500">
          <span>Private & stored locally in SQLite</span>
          <span className="hidden sm:inline">Press Enter to send • Shift+Enter for newline</span>
        </div>
      </div>
    </div>
  );
};
