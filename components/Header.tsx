"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  BookOpen,
  History,
  Mic,
  MicOff,
  Plus,
  Menu,
  X,
  Sparkles,
} from "lucide-react";

interface HeaderProps {
  isVoiceMode: boolean;
  onToggleVoiceMode: () => void;
  onOpenJournal: () => void;
  onOpenHistory: () => void;
  onNewSession: () => void;
  prayerCount: number;
  providerLabel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  isVoiceMode,
  onToggleVoiceMode,
  onOpenJournal,
  onOpenHistory,
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
    <header className="sticky top-0 z-30 border-b border-[#e4e4e4] bg-white/95 px-3 py-2.5 sm:px-6 sm:py-3.5 backdrop-blur-md shadow-sm transition-colors">
      <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
        {/* Left: Persona Identity */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-[#77b500] text-white shadow-sm font-bold">
            <span className="text-base sm:text-lg">M</span>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#77b500] ring-2 ring-emerald-400" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-[#1a1a1a] truncate">
                Pastor Mike
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-[#eef5dd] text-[#4f7a00] border border-[#b5dd66]">
                Available
              </span>
            </div>
            <p className="hidden sm:block text-[11px] font-medium text-[#6b7280]">
              Pastoral Care & Scripture Companion
            </p>
          </div>
        </div>

        {/* Right: Actions Bar */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Live Pastor Toggle */}
          <button
            type="button"
            onClick={onToggleVoiceMode}
            title={isVoiceMode ? "Disable Live Pastor" : "Enable Live Pastor"}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs font-bold transition cursor-pointer touch-manipulation active:scale-95 ${
              isVoiceMode
                ? "border-[#b5dd66] bg-[#eef5dd] text-[#4f7a00] shadow-sm"
                : "border-[#e4e4e4] bg-white text-[#1a1a1a] hover:border-[#77b500] hover:text-[#77b500]"
            }`}
          >
            {isVoiceMode ? (
              <>
                <Mic className="h-4 w-4 text-[#77b500] animate-pulse" />
                <span>Live Pastor ON</span>
              </>
            ) : (
              <>
                <MicOff className="h-4 w-4 text-[#8a8a8a]" />
                <span className="hidden sm:inline">Live Pastor</span>
              </>
            )}
          </button>

          {/* Prayer Journal Button */}
          <button
            type="button"
            onClick={onOpenJournal}
            title="View Prayer Journal"
            className="relative flex items-center justify-center gap-1.5 rounded-lg border border-[#e4e4e4] bg-white px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold text-[#1a1a1a] transition hover:border-[#77b500] hover:text-[#77b500] cursor-pointer touch-manipulation active:scale-95"
          >
            <BookOpen className="h-4 w-4 text-[#77b500]" />
            <span className="hidden md:inline">Prayer Journal</span>
            {prayerCount > 0 && (
              <span className="flex h-4 min-w-4 px-1.5 items-center justify-center rounded-full bg-[#77b500] text-[10px] font-bold text-white shadow-xs">
                {prayerCount}
              </span>
            )}
          </button>

          {/* Visit History Button (Desktop) */}
          <button
            type="button"
            onClick={onOpenHistory}
            title="View Visit History"
            className="hidden md:flex items-center justify-center gap-1.5 rounded-lg border border-[#e4e4e4] bg-white px-3 py-2 text-xs font-semibold text-[#1a1a1a] transition hover:border-[#77b500] hover:text-[#77b500] cursor-pointer touch-manipulation active:scale-95"
          >
            <History className="h-4 w-4 text-[#6b7280]" />
            <span>Visit History</span>
          </button>

          {/* New Visit Button (Desktop) */}
          <button
            type="button"
            onClick={onNewSession}
            title="Start New Visit"
            className="hidden sm:flex items-center justify-center gap-1.5 rounded-lg bg-[#77b500] hover:bg-[#659c00] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer touch-manipulation active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>New Visit</span>
          </button>

          {/* Mobile Overflow Menu Button */}
          <div className="relative md:hidden" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              title="More options & settings"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#e4e4e4] bg-white text-[#1a1a1a] transition hover:border-[#77b500] cursor-pointer touch-manipulation active:scale-95"
            >
              {isMobileMenuOpen ? (
                <X className="h-4 w-4 text-[#1a1a1a]" />
              ) : (
                <Menu className="h-4 w-4 text-[#1a1a1a]" />
              )}
            </button>

            {/* Backdrop */}
            {isMobileMenuOpen && (
              <div
                className="fixed inset-0 z-40 bg-black/20 md:hidden"
                onClick={() => setIsMobileMenuOpen(false)}
              />
            )}

            {/* Mobile Dropdown Card */}
            {isMobileMenuOpen && (
              <div className="absolute right-0 top-11 z-50 w-56 border border-[#e4e4e4] bg-white p-2 shadow-xl rounded-xl">
                <div className="space-y-1">
                  {/* New Visit */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onNewSession();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#1a1a1a] transition hover:bg-[#eef5dd] hover:text-[#4f7a00] rounded-lg cursor-pointer"
                  >
                    <Plus className="h-4 w-4 text-[#77b500]" />
                    <span>New Visit</span>
                  </button>

                  {/* Visit History */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenHistory();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#1a1a1a] transition hover:bg-[#eef5dd] hover:text-[#4f7a00] rounded-lg cursor-pointer"
                  >
                    <History className="h-4 w-4 text-[#77b500]" />
                    <span>Visit History</span>
                  </button>
                </div>

                <div className="mt-2 border-t border-[#eeeeee] pt-2 px-2 text-[10px] text-[#6b7280]">
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
