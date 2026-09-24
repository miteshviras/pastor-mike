"use client";

import React, { Suspense, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Avatar, AvatarHandle } from "./Avatar";
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  Loader2,
} from "lucide-react";
import { KITTEN_VOICES } from "@/lib/voice/speech-client";

interface PastorStageProps {
  assistantText: string;
  assistantMessages: { id: string; content: string }[];
  revealedText: string;
  sentences: string[];
  currentSentenceIndex: number;
  isLoading: boolean;
  isSpeaking: boolean;
  isPaused?: boolean;
  isPraying?: boolean;
  isSpeechLoading?: boolean;
  onSpeak?: (text: string) => void;
  onTogglePlayPause: (text: string) => void;
  onRestart?: (text: string) => void;
  onStop?: () => void;
  onDownload?: (text: string) => Promise<void>;
  speed?: number;
  onSpeedChange?: (speed: number) => void;
  voice?: string;
  onVoiceChange?: (voice: string) => void;
}

// Avoids a hard crash if the .glb is missing/corrupt
class AvatarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[PastorStage] Avatar failed to load:", error);
  }
  render() {
    if (this.state.hasError) {
      return <PlaceholderAvatar />;
    }
    return this.props.children;
  }
}

function PlaceholderAvatar() {
  return (
    <mesh>
      <sphereGeometry args={[0.6, 24, 24]} />
      <meshStandardMaterial color="#77b500" />
    </mesh>
  );
}

function ThinkingDots() {
  return (
    <span className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#77b500]"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

export default function PastorStage({
  assistantText,
  assistantMessages,
  revealedText,
  sentences,
  currentSentenceIndex,
  isLoading,
  isSpeaking,
  isPaused = false,
  isPraying = false,
  isSpeechLoading = false,
  onTogglePlayPause,
  onRestart,
  onStop,
  speed,
  onSpeedChange,
  voice,
  onVoiceChange,
}: PastorStageProps) {
  const avatarRef = useRef<AvatarHandle>(null);
  const activeSpanRef = useRef<HTMLSpanElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isSpeaking && !isPaused) {
      avatarRef.current?.speak();
    } else {
      avatarRef.current?.stop();
    }
  }, [isSpeaking, isPaused]);

  // Smoothly keep the currently spoken sentence in view
  useEffect(() => {
    if (isSpeaking && activeSpanRef.current && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;
      const activeEl = activeSpanRef.current;

      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const relativeTop =
        activeRect.top - containerRect.top + container.scrollTop;
      const targetScroll = relativeTop - container.clientHeight * 0.45;

      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: "smooth",
      });
    }
  }, [currentSentenceIndex, isSpeaking]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center overflow-hidden px-4 pt-2 sm:pt-3 pb-2 bg-[#fbfbfd]">
      {/* Pinned Stationary Block: Avatar + Audio Controls */}
      <div className="relative z-20 flex shrink-0 flex-col items-center gap-2.5 pb-2.5 pt-1 w-full max-w-2xl">
        {/* Avatar Stage Card — Warm, modern church platform illumination */}
        <div className="relative h-[220px] sm:h-[260px] md:h-[290px] w-full max-w-[440px] shrink-0 rounded-2xl border border-[#e4e4e4] shadow-sm overflow-hidden bg-gradient-to-b from-[#f8f9fa] via-[#f7f8f4] to-[#eef5dd]/40 flex items-center justify-center">
          <Canvas
            dpr={1}
            shadows={false}
            gl={{
              antialias: true,
              powerPreference: "low-power",
              alpha: true,
            }}
          >
            <Suspense fallback={<PlaceholderAvatar />}>
              <AvatarErrorBoundary>
                <Avatar ref={avatarRef} isPraying={isPraying} />
              </AvatarErrorBoundary>
            </Suspense>
          </Canvas>

          {/* Pastor Mike Name Badge */}
          <div className="absolute bottom-2.5 px-3.5 py-1 rounded-full bg-white/95 border border-[#e4e4e4] shadow-xs text-xs font-bold text-[#1a1a1a] flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#77b500]" />
            <span>Pastor Mike</span>
          </div>
        </div>

        {/* Unified Audio Controls Dock */}
        {!isLoading && assistantText && (
          <div className="flex flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#e4e4e4] shadow-xs">
            <button
              onClick={() => onTogglePlayPause(assistantText)}
              disabled={isSpeechLoading && !isSpeaking}
              title={
                isSpeechLoading && !isSpeaking
                  ? "Loading audio..."
                  : isSpeaking && !isPaused
                    ? "Pause speaking"
                    : isPaused
                      ? "Resume speaking"
                      : "Listen to Pastor Mike"
              }
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-xs transition cursor-pointer ${
                isSpeechLoading && !isSpeaking
                  ? "bg-white text-[#6b7280]"
                  : isSpeaking && !isPaused
                    ? "bg-[#eef5dd] text-[#4f7a00] border border-[#b5dd66]"
                    : isPaused
                      ? "bg-[#77b500] text-white hover:bg-[#659c00] animate-pulse"
                      : "bg-[#77b500] text-white hover:bg-[#659c00]"
              }`}
            >
              {isSpeechLoading && !isSpeaking ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : isSpeaking && !isPaused ? (
                <>
                  <Pause className="h-3.5 w-3.5 fill-current" />
                  <span>Pause</span>
                </>
              ) : isPaused ? (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Listen</span>
                </>
              )}
            </button>

            {isSpeaking && onRestart && (
              <button
                onClick={() => onRestart(assistantText)}
                title="Restart from beginning"
                className="flex items-center gap-1 rounded-full border border-[#e4e4e4] bg-white px-2.5 py-1.5 text-xs font-medium text-[#6b7280] hover:border-[#77b500] hover:text-[#77b500] transition cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span className="hidden sm:inline">Restart</span>
              </button>
            )}

            {isSpeaking && onStop && (
              <button
                onClick={onStop}
                title="Stop speaking"
                className="flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition cursor-pointer"
              >
                <Square className="h-3 w-3 fill-current" />
                <span className="hidden sm:inline">Stop</span>
              </button>
            )}

            {/* Voice style selector */}
            {voice && onVoiceChange && (
              <div className="flex items-center gap-1 pl-1.5 border-l border-[#e4e4e4]">
                <select
                  value={voice}
                  onChange={(e) => onVoiceChange(e.target.value)}
                  aria-label="Pastor Mike voice style"
                  className="rounded-full border border-[#e4e4e4] bg-white px-2.5 py-1 text-[11px] font-bold text-[#1a1a1a] focus:border-[#77b500] focus:outline-none cursor-pointer"
                >
                  {KITTEN_VOICES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Speed selector */}
            {speed !== undefined && onSpeedChange && (
              <div className="flex items-center gap-1">
                <select
                  value={speed}
                  onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                  aria-label="Playback pace"
                  className="rounded-full border border-[#e4e4e4] bg-white px-2 py-1 text-[11px] font-bold text-[#1a1a1a] focus:border-[#77b500] focus:outline-none cursor-pointer"
                >
                  <option value={0.75}>0.75x</option>
                  <option value={0.82}>0.82x</option>
                  <option value={0.88}>0.88x Calm</option>
                  <option value={0.95}>0.95x</option>
                  <option value={1.0}>1.0x</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spoken Lyrics Viewport */}
      <div
        ref={lyricsContainerRef}
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
        }}
        className="relative flex-1 min-h-0 w-full max-w-2xl overflow-y-auto px-4 pt-4 pb-8 scroll-smooth bg-[#fbfbfd] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-full flex-col items-center gap-2 pb-6 pt-2 text-center">
          {isLoading ? (
            <div className="flex flex-col items-center gap-2 text-sm font-medium text-[#6b7280]">
              <span>Pastor Mike is reflecting...</span>
              <ThinkingDots />
            </div>
          ) : isSpeaking && assistantText ? (
            <p className="max-w-2xl px-4 text-base leading-relaxed text-[#1a1a1a] sm:text-lg transition-all duration-300">
              {sentences.map((sentence, i) => {
                const isCurrent = i === currentSentenceIndex;
                const isPast = i < currentSentenceIndex;
                const isFuture = i > currentSentenceIndex;

                return (
                  <span
                    key={i}
                    ref={isCurrent ? activeSpanRef : null}
                    className={`transition-all duration-300 ${
                      isCurrent
                        ? "rounded-md bg-[#eef5dd] border border-[#b5dd66]/60 text-[#4f7a00] font-bold px-2 py-0.5 shadow-xs inline-block my-0.5 scale-[1.02]"
                        : isPast
                          ? "opacity-90 text-[#2b2b2b]"
                          : isFuture
                            ? "opacity-35 text-[#9ca3af]"
                            : "opacity-100 text-[#2b2b2b]"
                    }`}
                  >
                    {sentence}{" "}
                  </span>
                );
              })}
              {sentences.length === 0 && (revealedText || assistantText)}
            </p>
          ) : (
            <p className="text-sm font-medium text-[#6b7280]">
              {assistantMessages.length > 0
                ? "Select a reply from the list to hear it."
                : "Send a message below to begin."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
