"use client";

import React from "react";
import { Mic, Volume2, X, Sliders } from "lucide-react";

interface VoiceBarProps {
  isVoiceMode: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  speed: number;
  onSpeedChange: (newSpeed: number) => void;
  onClose: () => void;
}

export const VoiceBar: React.FC<VoiceBarProps> = ({
  isVoiceMode,
  isListening,
  isSpeaking,
  speed,
  onSpeedChange,
  onClose,
}) => {
  if (!isVoiceMode) return null;

  return (
    <aside
      aria-label="Active voice conversation controls"
      className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 w-[92%] max-w-lg rounded-2xl border border-stone-300/80 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-md dark:border-stone-700 dark:bg-stone-900/95"
    >
      <div className="flex items-center justify-between gap-3">
        {/* State Status */}
        <div className="flex items-center gap-2.5">
          {isSpeaking ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <Volume2 className="h-4 w-4 animate-pulse" />
            </div>
          ) : isListening ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white shadow-xs animate-pulse">
              <Mic className="h-4 w-4" />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
              <Mic className="h-4 w-4" />
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
              {isSpeaking
                ? "Pastor Mike is speaking..."
                : isListening
                ? "Listening... speak now"
                : "Voice Mode Active"}
            </p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              {isSpeaking
                ? "Turn-taking: mic paused during speech"
                : isListening
                ? "Your audio is processed locally"
                : "Tap microphone below to speak"}
            </p>
          </div>
        </div>

        {/* Speed Controls & Exit */}
        <div className="flex items-center gap-2">
          {/* Speed Selector */}
          <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 dark:border-stone-700 dark:bg-stone-800">
            <Sliders className="h-3 w-3 text-stone-400" />
            <select
              value={speed}
              onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
              aria-label="Voice speed delivery"
              className="bg-transparent text-[11px] font-medium text-stone-700 focus:outline-hidden dark:text-stone-300"
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
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
