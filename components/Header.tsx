"use client";

import React from "react";
import { BookOpen, Mic, MicOff, PlusCircle, Sparkles, Wrench } from "lucide-react";

interface HeaderProps {
  isVoiceMode: boolean;
  onToggleVoiceMode: () => void;
  onOpenJournal: () => void;
  onOpenMcp: () => void;
  onNewSession: () => void;
  prayerCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  isVoiceMode,
  onToggleVoiceMode,
  onOpenJournal,
  onOpenMcp,
  onNewSession,
  prayerCount,
}) => {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-[#faf8f5]/85 px-4 py-3 backdrop-blur-md dark:border-stone-800/80 dark:bg-[#141312]/85">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        {/* Left: Persona Identity */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#445942] text-white shadow-xs dark:bg-[#5b7858]">
            <span className="font-serif text-lg font-bold">M</span>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-stone-900" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-base font-semibold tracking-tight text-stone-900 dark:text-stone-100">
                Pastor Mike
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-stone-300/80 bg-stone-100/90 px-2 py-0.5 text-[10px] font-medium text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400">
                <Sparkles className="h-2.5 w-2.5 text-amber-600" />
                AI Companion
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Calm, scripture-aware spiritual care
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* New Session */}
          <button
            onClick={onNewSession}
            title="Start a new conversation"
            className="hidden items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-xs transition hover:bg-stone-50 sm:flex dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            <PlusCircle className="h-3.5 w-3.5 text-stone-500" />
            New Visit
          </button>

          {/* Voice Mode Toggle */}
          <button
            onClick={onToggleVoiceMode}
            title={isVoiceMode ? "Disable Voice Mode" : "Enable Voice Mode"}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition shadow-xs ${
              isVoiceMode
                ? "border-emerald-600/40 bg-emerald-50 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
            }`}
          >
            {isVoiceMode ? (
              <>
                <Mic className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                <span>Voice Active</span>
              </>
            ) : (
              <>
                <MicOff className="h-3.5 w-3.5 text-stone-400" />
                <span>Voice Mode</span>
              </>
            )}
          </button>

          {/* MCP & Tools Button */}
          <button
            onClick={onOpenMcp}
            title="Inspect Model Context Protocol (MCP) Tools & Runtime"
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-xs transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            <Wrench className="h-3.5 w-3.5 text-[#445942] dark:text-[#7ba277]" />
            <span className="hidden sm:inline">MCP & Tools</span>
          </button>

          {/* Prayer Journal Button */}
          <button
            onClick={onOpenJournal}
            title="View Prayer Journal"
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-xs transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            <BookOpen className="h-3.5 w-3.5 text-[#445942] dark:text-[#7ba277]" />
            <span className="hidden sm:inline">Prayer Journal</span>
            {prayerCount > 0 && (
              <span className="rounded-full bg-[#445942] px-1.5 py-0.2 text-[10px] font-semibold text-white dark:bg-[#5b7858]">
                {prayerCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
