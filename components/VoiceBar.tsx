"use client";

import React from "react";
import { Mic, Volume2, X, Sliders, User } from "lucide-react";
import { KITTEN_VOICES } from "@/lib/voice/speech-client";

interface VoiceBarProps {
  isVoiceMode: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  speed: number;
  onSpeedChange: (newSpeed: number) => void;
  voice: string;
  onVoiceChange: (newVoice: string) => void;
  onClose: () => void;
}

export const VoiceBar: React.FC<VoiceBarProps> = ({
  isVoiceMode,
  isListening,
  isSpeaking,
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
      className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 w-[92%] max-w-lg border border-border-subtle bg-card px-4 py-3 shadow-elevated backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-3">
        {/* State Status */}
        <div className="flex items-center gap-2.5">
          {isSpeaking ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Volume2 className="h-4 w-4 animate-pulse" />
            </div>
          ) : isListening ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white animate-pulse">
              <Mic className="h-4 w-4" />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Mic className="h-4 w-4" />
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-card-foreground">
              {isSpeaking
                ? "Pastor Mike is speaking..."
                : isListening
                  ? "Listening... speak now"
                  : "Voice Mode Active"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isSpeaking
                ? "Turn-taking: mic paused during speech"
                : isListening
                  ? "Your audio is processed locally"
                  : "Tap microphone below to speak"}
            </p>
          </div>
        </div>

        {/* Voice, Speed Controls & Exit */}
        <div className="flex items-center gap-2">
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
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1">
            <Sliders className="h-3 w-3 text-muted-foreground" />
            <select
              value={speed}
              onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
              aria-label="Voice speed delivery"
              className="bg-transparent text-[11px] font-medium text-card-foreground focus:outline-hidden"
            >
              <option value="0.8">0.8x Calm</option>
              <option value="0.88">0.9x Warm</option>
              <option value="1.0">1.0x Normal</option>
              <option value="1.1">1.1x Brisk</option>
            </select>
          </div>

          <button
            onClick={onClose}
            title="Exit Voice Mode"
            aria-label="Exit Voice Mode"
            className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-card-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
