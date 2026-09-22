"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  BookOpen,
  Compass,
  History,
  Mic,
  MicOff,
  PlusCircle,
  Menu,
  X,
  Settings,
} from "lucide-react";

interface HeaderProps {
  isVoiceMode: boolean;
  onToggleVoiceMode: () => void;
  onOpenJournal: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenOnboarding: () => void;
  onNewSession: () => void;
  prayerCount: number;
  providerLabel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  isVoiceMode,
  onToggleVoiceMode,
  onOpenJournal,
  onOpenHistory,
  onOpenSettings,
  onOpenOnboarding,
  onNewSession,
  prayerCount,
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
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 px-3 py-2.5 sm:px-4 sm:py-3 backdrop-blur-md shadow-nav">
      <div className="flex items-center justify-between gap-2">
        {/* Left: Persona Identity */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="relative flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-[#5266eb] text-white">
            <span className="text-sm sm:text-lg font-bold">M</span>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full border-2 border-[#171721] bg-emerald-500" />
          </div>

          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold tracking-tight text-[#ededf3] truncate">
              Pastor Mike
            </h1>
          </div>
        </div>

        {/* Right: Actions Bar */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Voice Mode Toggle */}
          <button
            type="button"
            onClick={onToggleVoiceMode}
            title={isVoiceMode ? "Disable Voice Mode" : "Enable Voice Mode"}
            className={`flex items-center justify-center gap-1.5 rounded-full border p-2 min-h-[38px] min-w-[38px] sm:min-h-0 sm:min-w-0 sm:px-3 sm:py-1.5 text-xs font-medium transition cursor-pointer touch-manipulation active:scale-95 ${
              isVoiceMode
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-transparent text-[#ededf3] hover:bg-card/10"
            }`}
          >
            {isVoiceMode ? (
              <>
                <Mic className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-emerald-400 animate-pulse" />
                <span className="hidden md:inline">Voice Active</span>
              </>
            ) : (
              <>
                <MicOff className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-[#c3c3cc]" />
                <span className="hidden md:inline">Voice Mode</span>
              </>
            )}
          </button>

          {/* Setup Guide (Desktop) */}
          <button
            type="button"
            onClick={onOpenOnboarding}
            title="Setup Guide: Persona & Audio Testing"
            className="hidden md:flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-xs font-medium text-[#ededf3] transition hover:bg-card/10 cursor-pointer touch-manipulation active:scale-95"
          >
            <Compass className="h-3.5 w-3.5 text-[#9cb4e8]" />
            <span>Setup Guide</span>
          </button>

          {/* Settings Button (Desktop) */}
          <button
            type="button"
            onClick={onOpenSettings}
            title="AI Reasoning Engine Settings"
            className="hidden md:flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-xs font-medium text-[#ededf3] transition hover:bg-card/10 cursor-pointer touch-manipulation active:scale-95"
          >
            <Settings className="h-3.5 w-3.5 text-[#9cb4e8]" />
            <span>Settings</span>
          </button>

          {/* Prayer Journal Button */}
          <button
            type="button"
            onClick={onOpenJournal}
            title="View Prayer Journal"
            className="relative flex items-center justify-center gap-1.5 rounded-full border border-transparent p-2 min-h-[38px] min-w-[38px] sm:min-h-0 sm:min-w-0 sm:px-3 sm:py-1.5 text-xs font-medium text-[#ededf3] transition hover:bg-card/10 cursor-pointer touch-manipulation active:scale-95"
          >
            <BookOpen className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-[#9cb4e8]" />
            <span className="hidden md:inline">Prayer Journal</span>
            {prayerCount > 0 && (
              <span className="flex h-4 min-w-4 sm:h-auto sm:min-w-0 sm:px-1.5 sm:py-0.2 items-center justify-center rounded-full bg-[#5266eb] text-[10px] font-semibold text-white">
                {prayerCount}
              </span>
            )}
          </button>

          {/* Mobile Overflow Menu Button (shown until there's room for the full desktop bar) */}
          <div className="relative md:hidden" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              title="More options & settings"
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-[#ededf3] transition hover:bg-card/10 cursor-pointer touch-manipulation active:scale-95"
            >
              {isMobileMenuOpen ? (
                <X className="h-4 w-4 text-[#ededf3]" />
              ) : (
                <Menu className="h-4 w-4 text-[#ededf3]" />
              )}
            </button>

            {/* Backdrop for mobile menu so tapping outside closes it reliably on touch screens */}
            {isMobileMenuOpen && (
              <div
                className="fixed inset-0 z-40 bg-black/20 md:hidden"
                onClick={() => setIsMobileMenuOpen(false)}
              />
            )}

            {/* Mobile Dropdown Card */}
            {isMobileMenuOpen && (
              <div className="absolute right-0 top-11 z-50 w-56 border border-border-subtle bg-card p-2 shadow-elevated rounded-xl">
                <div className="space-y-1">
                  {/* New Visit */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onNewSession();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-card-foreground transition hover:bg-accent rounded-lg cursor-pointer touch-manipulation active:scale-95"
                  >
                    <PlusCircle className="h-4 w-4 text-[#5266eb]" />
                    <span>New Visit</span>
                  </button>

                  {/* Visit History */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenHistory();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-card-foreground transition hover:bg-accent rounded-lg cursor-pointer touch-manipulation active:scale-95"
                  >
                    <History className="h-4 w-4 text-[#5266eb]" />
                    <span>Visit History</span>
                  </button>

                  {/* Settings */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-medium text-card-foreground transition hover:bg-accent rounded-lg cursor-pointer touch-manipulation active:scale-95"
                  >
                    <div className="flex items-center gap-2.5">
                      <Settings className="h-4 w-4 text-[#5266eb]" />
                      <span>AI Settings</span>
                    </div>
                  </button>

                  {/* Setup Guide */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenOnboarding();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-card-foreground transition hover:bg-accent rounded-lg cursor-pointer touch-manipulation active:scale-95"
                  >
                    <Compass className="h-4 w-4 text-muted-foreground" />
                    <span>Setup Guide</span>
                  </button>
                </div>

                <div className="mt-2 border-t border-border-subtle pt-2 px-2 text-[10px] text-muted-foreground">
                  <span>Engine: {providerLabel}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
