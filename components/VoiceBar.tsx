"use client";

import React from "react";
import { Mic, Volume2, X, Sliders, User, Play, Pause, Loader2 } from "lucide-react";
import { KITTEN_VOICES } from "@/lib/voice/speech-client";

interface VoiceBarProps {
  isVoiceMode: boolean;
  isListening: boolean;
  isTranscribing?: boolean;
  isSpeaking: boolean;
  isPaused?: boolean;
  onTogglePlayPause?: () => void;
  speed: number;
  onSpeedChange: (newSpeed: number) => void;
  voice: string;
  onVoiceChange: (newVoice: string) => void;
  onClose: () => void;
}

export const VoiceBar: React.FC<VoiceBarProps> = ({
  isVoiceMode,
  isListening,
  isTranscribing = false,
  isSpeaking,
  isPaused = false,
  onTogglePlayPause,
  speed,
  onSpeedChange,
  voice,
  onVoiceChange,
  onClose,
}) => {
  if (!isVoiceMode) return null;

  return (
    <aside
      aria-label="Active voice conversation controls"
      className="border-t border-border/60 bg-background/95 px-3 py-2.5 sm:px-4 sm:py-3 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 rounded-input border border-border-subtle bg-card px-3 py-2 sm:px-4 sm:py-2.5 shadow-nav">
        {/* State Status */}
        <div className="flex min-w-0 items-center gap-2.5">
          {isSpeaking ? (
            <button
              onClick={onTogglePlayPause}
              title={isPaused ? "Resume speech" : "Pause speech"}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                isPaused
                  ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                  : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              }`}
            >
              {isPaused ? (
                <Play className="h-4 w-4 fill-current ml-0.5" />
              ) : (
                <Pause className="h-4 w-4 fill-current" />
              )}
            </button>
          ) : isListening ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white animate-pulse">
              <Mic className="h-4 w-4" />
            </div>
          ) : isTranscribing ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-500">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Mic className="h-4 w-4" />
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-card-foreground">
              {isSpeaking
                ? isPaused
                  ? "Pastor Mike is paused"
                  : "Pastor Mike is speaking..."
                : isListening
                  ? isTranscribing
                    ? "Transcribing in background..."
                    : "Listening... speak now"
                  : isTranscribing
                    ? "Transcribing your words..."
                    : "Voice Mode Active"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {isSpeaking
                ? isPaused
                  ? "Tap to resume audio playback"
                  : "Tap to pause audio playback"
                : isListening
                  ? "Tap microphone below when finished"
                  : isTranscribing
                    ? "Converting speech to text"
                    : "Tap microphone below to speak"}
            </p>
          </div>
        </div>

        {/* Voice, Speed Controls & Exit */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Voice Selector */}
          <div className="flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1">
            <User className="h-3 w-3 text-muted-foreground" />
            <select
              value={voice}
              onChange={(e) => onVoiceChange(e.target.value)}
              aria-label="Voice"
              className="bg-transparent text-[11px] font-medium text-card-foreground focus:outline-hidden"
            >
              {KITTEN_VOICES.map((v) => (
                <option key={v} value={v} className="bg-slate-800 text-white">
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Speed Selector */}
          <div className="hidden items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 sm:flex">
            <Sliders className="h-3 w-3 text-muted-foreground" />
            <select
              value={speed}
              onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
              aria-label="Voice speed delivery"
              className="bg-transparent text-[11px] font-medium text-card-foreground focus:outline-hidden"
            >
              <option value="0.8" className="bg-slate-800 text-white">0.8x Calm</option>
              <option value="0.88" className="bg-slate-800 text-white">0.9x Warm</option>
              <option value="1" className="bg-slate-800 text-white">1.0x Normal</option>
              <option value="1.1" className="bg-slate-800 text-white">1.1x Brisk</option>
            </select>
          </div>

          <button
            onClick={onClose}
            title="Exit Voice Mode"
            aria-label="Exit Voice Mode"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-card-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
