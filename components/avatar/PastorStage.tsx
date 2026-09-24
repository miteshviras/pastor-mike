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
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent">
      {/* Hero Section Banner */}
      <div className="relative w-full rounded-[22px] bg-gradient-to-r from-[#EFF6E8] via-[#FAF9F5] to-[#F5F8F2] p-5 sm:p-6 border border-[#ECE8E2] shadow-xs overflow-hidden mb-4 shrink-0">
        {/* Botanical leaf decoration in top right corner */}
        <div className="absolute right-0 top-0 bottom-0 w-24 sm:w-32 pointer-events-none select-none opacity-80 hidden sm:block">
          <img
            src="/images/hero_leaf_clean.png"
            alt=""
            className="h-full w-full object-contain object-right-top"
          />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-6">
          {/* Circular 3D Avatar Halo */}
          <div className="relative h-24 w-24 sm:h-28 sm:w-28 shrink-0 rounded-full border-2 border-white shadow-sm overflow-hidden bg-gradient-to-b from-[#E2ECD6] to-[#F2EFE8] flex items-center justify-center">
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
          </div>

          {/* Hero Greeting & Identity */}
          <div className="flex-1 text-center sm:text-left min-w-0 pr-0 sm:pr-24">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F2F2F] mb-1">
              <span className="h-2 w-2 rounded-full bg-[#77B500] ring-2 ring-[#D2EAC0]" />
              <span>Pastor Mike</span>
            </div>

            <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#1F2937] leading-tight mb-1.5">
              You are not alone.
            </h2>

            <p className="text-[12.5px] sm:text-[13px] text-[#4B5563] leading-relaxed max-w-[460px]">
              I&apos;m here to listen, pray, and share God&apos;s wisdom with you. Take a deep breath — let&apos;s walk through this together.
            </p>
          </div>
        </div>
      </div>

      {/* Audio Controls Pill Dock */}
      {!isLoading && assistantText && (
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-4 w-full shrink-0">
          {/* Play/Pause Button */}
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
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold shadow-xs transition cursor-pointer active:scale-95 ${
              isSpeechLoading && !isSpeaking
                ? "bg-white text-[#6B7280] border border-[#ECE8E2]"
                : isSpeaking && !isPaused
                  ? "bg-[#EAF6DF] text-[#4F7A00] border border-[#D2EAC0]"
                  : isPaused
                    ? "bg-[#77B500] text-white hover:bg-[#689E00]"
                    : "bg-[#77B500] text-white hover:bg-[#689E00]"
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
                <span>Resume</span>
              </>
            )}
          </button>

          {/* Restart Button */}
          {onRestart && (
            <button
              onClick={() => onRestart(assistantText)}
              title="Restart from beginning"
              className="flex items-center gap-1.5 rounded-full border border-[#ECE8E2] bg-white px-3.5 py-2 text-xs font-semibold text-[#2F2F2F] hover:border-[#77B500] hover:text-[#77B500] shadow-xs transition cursor-pointer active:scale-95"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Restart</span>
            </button>
          )}

          {/* Stop Button */}
          {onStop && (
            <button
              onClick={onStop}
              title="Stop speaking"
              className="flex items-center gap-1.5 rounded-full border border-[#ECE8E2] bg-white px-3.5 py-2 text-xs font-semibold text-[#2F2F2F] hover:border-red-200 hover:text-red-600 shadow-xs transition cursor-pointer active:scale-95"
            >
              <Square className="h-3 w-3 fill-red-500 text-red-500" />
              <span>Stop</span>
            </button>
          )}

          {/* Voice style selector */}
          {voice && onVoiceChange && (
            <div className="flex items-center">
              <select
                value={voice}
                onChange={(e) => onVoiceChange(e.target.value)}
                aria-label="Pastor Mike voice style"
                className="rounded-full border border-[#ECE8E2] bg-white px-3.5 py-2 text-xs font-semibold text-[#2F2F2F] hover:border-[#77B500] focus:border-[#77B500] focus:outline-none shadow-xs cursor-pointer"
              >
                {KITTEN_VOICES.map((v) => (
                  <option key={v} value={v}>
                    {v} ▾
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Speed selector */}
          {speed !== undefined && onSpeedChange && (
            <div className="flex items-center">
              <select
                value={speed}
                onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                aria-label="Playback pace"
                className="rounded-full border border-[#ECE8E2] bg-white px-3.5 py-2 text-xs font-semibold text-[#2F2F2F] hover:border-[#77B500] focus:border-[#77B500] focus:outline-none shadow-xs cursor-pointer"
              >
                <option value={0.8}>0.8x Calm ▾</option>
                <option value={0.88}>0.9x Warm ▾</option>
                <option value={1}>1.0x Normal ▾</option>
                <option value={1.1}>1.1x Brisk ▾</option>
                <option value={1.25}>1.25x Quick ▾</option>
                <option value={1.5}>1.5x Fast ▾</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Spoken Lyrics Viewport */}
      <div
        ref={lyricsContainerRef}
        className="relative flex-1 min-h-0 w-full overflow-y-auto px-1 py-2 scroll-smooth bg-transparent [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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
                        ? "rounded-md bg-[#EAF6DF] border border-[#D2EAC0] text-[#3B5B24] font-medium px-2 py-0.5 shadow-xs inline-block my-0.5 scale-[1.01]"
                        : isPast
                          ? "opacity-90 text-[#2F2F2F]"
                          : isFuture
                            ? "opacity-40 text-[#9CA3AF]"
                            : "opacity-100 text-[#2F2F2F]"
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
