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
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  onOpenTestAudio?: () => void;
  onOpenGuide?: () => void;
  userName?: string;
  visitTitle?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  isVoiceMode,
  onToggleVoiceMode,
  onOpenJournal,
  onOpenHistory,
  onNewSession,
  prayerCount,
  providerLabel = "Gemini",
  onOpenProfile,
  onOpenSettings,
  onOpenTestAudio,
  onOpenGuide,
  userName = "JD",
  visitTitle,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 px-3 py-2 sm:px-6 sm:py-2.5 bg-transparent transition-colors">
      <div className="flex items-center justify-between gap-3 max-w-[1600px] mx-auto bg-white/95 backdrop-blur-md rounded-2xl border border-[#ECE8E2] px-4 py-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        {/* Left: Persona Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#77B500] text-white shadow-xs font-bold">
            <span className="text-base font-bold tracking-tight">M</span>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#77B500] ring-1 ring-[#D2EAC0]" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[14px] sm:text-[15px] font-bold tracking-tight text-[#2F2F2F] truncate">
                Pastor Mike
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold tracking-wider uppercase bg-[#EAF6DF] text-[#4F7A00] border border-[#D2EAC0]">
                Available
              </span>
            </div>
            <p className="hidden sm:block text-[11px] font-normal text-[#6B7280] truncate">
              {visitTitle || "Pastoral Care & Scripture Companion"}
            </p>
          </div>
        </div>

        {/* Right: Actions Bar */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Live Pastor Toggle */}
          <button
            type="button"
            onClick={onToggleVoiceMode}
            title={isVoiceMode ? "Disable Live Pastor" : "Enable Live Pastor"}
            className={`flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer touch-manipulation active:scale-95 shadow-xs ${
              isVoiceMode
                ? "border border-[#D2EAC0] bg-[#EAF6DF] text-[#4F7A00]"
                : "border border-[#ECE8E2] bg-white text-[#2F2F2F] hover:border-[#77B500] hover:text-[#77B500]"
            }`}
          >
            {isVoiceMode ? (
              <>
                <Mic className="h-3.5 w-3.5 text-[#77B500] animate-pulse" />
                <span>Live Pastor ON</span>
              </>
            ) : (
              <>
                <MicOff className="h-3.5 w-3.5 text-[#8A8A8A]" />
                <span className="hidden sm:inline">Live Pastor</span>
              </>
            )}
          </button>

          {/* Prayer Journal Button */}
          <button
            type="button"
            onClick={onOpenJournal}
            title="View Prayer Journal"
            className="relative flex items-center justify-center gap-1.5 rounded-full border border-[#ECE8E2] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#2F2F2F] transition hover:border-[#77B500] hover:text-[#77B500] cursor-pointer touch-manipulation active:scale-95 shadow-xs"
          >
            <BookOpen className="h-3.5 w-3.5 text-[#77B500]" />
            <span className="hidden md:inline">Prayer Journal</span>
            {prayerCount > 0 && (
              <span className="flex h-4 min-w-4 px-1.5 items-center justify-center rounded-full bg-[#77B500] text-[10px] font-bold text-white shadow-xs">
                {prayerCount}
              </span>
            )}
          </button>

          {/* Visit History Button (Desktop) */}
          <button
            type="button"
            onClick={onOpenHistory}
            title="View Visit History"
            className="hidden md:flex items-center justify-center gap-1.5 rounded-full border border-[#ECE8E2] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#2F2F2F] transition hover:border-[#77B500] hover:text-[#77B500] cursor-pointer touch-manipulation active:scale-95 shadow-xs"
          >
            <History className="h-3.5 w-3.5 text-[#6B7280]" />
            <span>Visit History</span>
          </button>

          {/* New Visit Button (Desktop) */}
          <button
            type="button"
            onClick={onNewSession}
            title="Start New Visit"
            className="hidden sm:flex items-center justify-center gap-1.5 rounded-full bg-[#77B500] hover:bg-[#689E00] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition cursor-pointer touch-manipulation active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Visit</span>
          </button>

          {/* User Profile Avatar Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              title="User Profile & Settings"
              className="flex items-center gap-1 rounded-full bg-[#DCE7D5] hover:bg-[#D0DFC8] px-2 py-1 text-xs font-bold text-[#3B5B24] transition cursor-pointer border border-[#C5D7BC] shadow-xs active:scale-95"
            >
              <span className="w-5 h-5 flex items-center justify-center text-[11px]">
                {userName.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-[10px] opacity-75">▾</span>
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 top-10 z-50 w-52 rounded-xl border border-[#ECE8E2] bg-white p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
                <div className="px-3 py-2 border-b border-[#F2EFEA]">
                  <p className="text-xs font-bold text-[#2F2F2F]">{userName}</p>
                  <p className="text-[10px] text-[#6B7280] flex items-center gap-1 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#77B500]" />
                    Engine: {providerLabel}
                  </p>
                </div>

                <div className="py-1">
                  {onOpenProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenProfile();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#2F2F2F] hover:bg-[#EAF6DF] hover:text-[#4F7A00] rounded-lg transition"
                    >
                      <span>👤</span> Profile & Preferences
                    </button>
                  )}
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenSettings();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#2F2F2F] hover:bg-[#EAF6DF] hover:text-[#4F7A00] rounded-lg transition"
                    >
                      <span>⚙️</span> AI Engine Settings
                    </button>
                  )}
                  {onOpenTestAudio && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenTestAudio();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#2F2F2F] hover:bg-[#EAF6DF] hover:text-[#4F7A00] rounded-lg transition"
                    >
                      <span>🎧</span> Audio & Mic Setup
                    </button>
                  )}
                  {onOpenGuide && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenGuide();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#2F2F2F] hover:bg-[#EAF6DF] hover:text-[#4F7A00] rounded-lg transition"
                    >
                      <span>📖</span> Guided Tour
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile Overflow Menu Button */}
          <div className="relative md:hidden" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              title="More options & settings"
              className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[#ECE8E2] bg-white text-[#2F2F2F] transition hover:border-[#77B500] cursor-pointer touch-manipulation active:scale-95"
            >
              {isMobileMenuOpen ? (
                <X className="h-4 w-4 text-[#2F2F2F]" />
              ) : (
                <Menu className="h-4 w-4 text-[#2F2F2F]" />
              )}
            </button>

            {/* Mobile Dropdown Card */}
            {isMobileMenuOpen && (
              <div className="absolute right-0 top-10 z-50 w-52 border border-[#ECE8E2] bg-white p-2 shadow-xl rounded-xl">
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onNewSession();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#2F2F2F] transition hover:bg-[#EAF6DF] hover:text-[#4F7A00] rounded-lg cursor-pointer"
                  >
                    <Plus className="h-4 w-4 text-[#77B500]" />
                    <span>New Visit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenHistory();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#2F2F2F] transition hover:bg-[#EAF6DF] hover:text-[#4F7A00] rounded-lg cursor-pointer"
                  >
                    <History className="h-4 w-4 text-[#77B500]" />
                    <span>Visit History</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

