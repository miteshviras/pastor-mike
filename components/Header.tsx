"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  BookOpen,
  Compass,
  History,
  Mic,
  MicOff,
  PlusCircle,
  Sparkles,
  Menu,
  X,
  Cpu,
  Layers,
  CheckCircle2,
} from "lucide-react";

interface HeaderProps {
  isVoiceMode: boolean;
  onToggleVoiceMode: () => void;
  onOpenJournal: () => void;
  onOpenHistory: () => void;
  onOpenMcp: () => void;
  onOpenOnboarding: () => void;
  onNewSession: () => void;
  prayerCount: number;
  isMcpConnected?: boolean;
  mcpClientName?: string;
  providerLabel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  isVoiceMode,
  onToggleVoiceMode,
  onOpenJournal,
  onOpenHistory,
  onOpenMcp,
  onOpenOnboarding,
  onNewSession,
  prayerCount,
  isMcpConnected = true,
  mcpClientName = "Antigravity 2.0",
  providerLabel = "Gemini",
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close mobile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    }
    if (isMobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#faf8f5]/90 px-3 py-2.5 sm:px-4 sm:py-3 backdrop-blur-md dark:border-stone-800/80 dark:bg-[#141312]/90">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
        {/* Left: Persona Identity */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="relative flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-[#445942] text-white shadow-xs dark:bg-[#5b7858]">
            <span className="font-serif text-sm sm:text-lg font-bold">M</span>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-stone-900" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="font-serif text-sm sm:text-base font-semibold tracking-tight text-stone-900 dark:text-stone-100 truncate">
                Pastor Mike
              </h1>

              {/* Subtitle / badge: Hidden on very small screens to prevent overflow */}
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-stone-300/80 bg-stone-100/90 px-2 py-0.5 text-[10px] font-medium text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400">
                <Sparkles className="h-2.5 w-2.5 text-amber-600" />
                AI Companion
              </span>

              {providerLabel && (
                <button
                  type="button"
                  onClick={onOpenMcp}
                  title="Active AI provider — click to change in Settings"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#445942]/30 bg-[#445942]/10 px-2 py-0.5 text-[10px] font-medium text-[#445942] transition hover:bg-[#445942]/15 dark:border-[#7ba277]/30 dark:bg-[#7ba277]/10 dark:text-[#7ba277]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{providerLabel}</span>
                </button>
              )}
            </div>

            <p className="hidden md:block text-xs text-stone-500 dark:text-stone-400 truncate">
              Calm, scripture-aware spiritual care
            </p>
          </div>
        </div>

        {/* Right: Actions Bar */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* New Session (Desktop only) */}
          <button
            onClick={onNewSession}
            title="Start a new conversation"
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-xs transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            <PlusCircle className="h-3.5 w-3.5 text-stone-500" />
            <span>New Visit</span>
          </button>

          {/* Visit History */}
          <button
            onClick={onOpenHistory}
            title="View past visits and switch between conversations"
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white p-2 sm:px-3 sm:py-1.5 text-xs font-medium text-stone-700 shadow-xs transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            <History className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-[#445942] dark:text-[#7ba277]" />
            <span className="hidden sm:inline">Visit History</span>
          </button>

          {/* Voice Mode Toggle */}
          <button
            onClick={onToggleVoiceMode}
            title={isVoiceMode ? "Disable Voice Mode" : "Enable Voice Mode"}
            className={`flex items-center gap-1.5 rounded-lg border p-2 sm:px-3 sm:py-1.5 text-xs font-medium transition shadow-xs ${
              isVoiceMode
                ? "border-emerald-600/40 bg-emerald-50 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
            }`}
          >
            {isVoiceMode ? (
              <>
                <Mic className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-emerald-600 animate-pulse" />
                <span className="hidden sm:inline">Voice Active</span>
              </>
            ) : (
              <>
                <MicOff className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-stone-400" />
                <span className="hidden sm:inline">Voice Mode</span>
              </>
            )}
          </button>

          {/* Setup Guide (Desktop) */}
          <button
            onClick={onOpenOnboarding}
            title="Setup Guide: Persona, MCP Connection & Audio Testing"
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-xs transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            <Compass className="h-3.5 w-3.5 text-[#445942] dark:text-[#7ba277]" />
            <span>Setup Guide</span>
          </button>

          {/* MCP & Tools Button (Desktop) */}
          <button
            onClick={onOpenMcp}
            title={isMcpConnected ? `Connected MCP: ${mcpClientName}` : "Inspect Model Context Protocol (MCP) Tools & Runtime"}
            className={`hidden sm:flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-xs transition ${
              isMcpConnected
                ? "border-emerald-300/80 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/70 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {isMcpConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isMcpConnected ? "bg-emerald-500" : "bg-stone-400"}`}></span>
            </span>
            <span>MCP & Tools</span>
          </button>

          {/* Prayer Journal Button */}
          <button
            onClick={onOpenJournal}
            title="View Prayer Journal"
            className="relative flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white p-2 sm:px-3 sm:py-1.5 text-xs font-medium text-stone-700 shadow-xs transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            <BookOpen className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-[#445942] dark:text-[#7ba277]" />
            <span className="hidden sm:inline">Prayer Journal</span>
            {prayerCount > 0 && (
              <span className="flex h-4 min-w-4 sm:h-auto sm:min-w-0 sm:px-1.5 sm:py-0.2 items-center justify-center rounded-full bg-[#445942] text-[10px] font-semibold text-white dark:bg-[#5b7858]">
                {prayerCount}
              </span>
            )}
          </button>

          {/* Mobile Overflow Menu Button (Mobile only) */}
          <div className="relative sm:hidden" ref={menuRef}>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              title="More options & settings"
              className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 shadow-xs transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
            >
              {isMobileMenuOpen ? (
                <X className="h-4 w-4 text-stone-600 dark:text-stone-300" />
              ) : (
                <Menu className="h-4 w-4 text-stone-600 dark:text-stone-300" />
              )}
              {isMcpConnected && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500" />
              )}
            </button>

            {/* Mobile Dropdown Card */}
            {isMobileMenuOpen && (
              <div className="absolute right-0 top-10 z-50 w-56 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl dark:border-stone-800 dark:bg-stone-900">
                <div className="space-y-1">
                  {/* New Visit */}
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onNewSession();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                  >
                    <PlusCircle className="h-4 w-4 text-[#445942] dark:text-[#7ba277]" />
                    <span>New Visit</span>
                  </button>

                  {/* MCP & Tools Settings */}
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenMcp();
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                  >
                    <div className="flex items-center gap-2.5">
                      <Cpu className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>MCP & AI Settings</span>
                    </div>
                    {isMcpConnected && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    )}
                  </button>

                  {/* Setup Guide */}
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenOnboarding();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                  >
                    <Compass className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                    <span>Setup Guide</span>
                  </button>
                </div>

                <div className="mt-2 border-t border-stone-100 pt-2 px-2 text-[10px] text-stone-400 dark:border-stone-800 dark:text-stone-500">
                  <div className="flex items-center justify-between">
                    <span>Engine: {providerLabel}</span>
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <span className="h-1 w-1 rounded-full bg-emerald-500" />
                      {mcpClientName.split(" ")[0]}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
