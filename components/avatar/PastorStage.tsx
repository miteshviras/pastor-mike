"use client";

import React, { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Play, Pause, RotateCcw, Square } from "lucide-react";
import { Avatar, AvatarHandle } from "./Avatar";

// Silence Three.js r183+ deprecation warning for THREE.Clock used internally by @react-three/fiber
if (typeof window !== "undefined") {
  if (typeof (THREE as unknown as { setConsoleFunction?: unknown }).setConsoleFunction === "function") {
    (THREE as unknown as { setConsoleFunction: (fn: (type: string, message: string, ...params: unknown[]) => void) => void }).setConsoleFunction(
      (type, message, ...params) => {
        if (typeof message === "string" && message.includes("Clock: This module has been deprecated")) {
          return;
        }
        const method = (console as unknown as Record<string, (...args: unknown[]) => void>)[type] || console.log;
        method.call(console, message, ...params);
      },
    );
  }

  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    if (first.includes("Clock: This module has been deprecated")) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

interface PastorStageProps {
  assistantText: string;
  revealedText: string;
  sentences: string[];
  currentSentenceIndex: number;
  isLoading: boolean;
  isSpeaking: boolean;
  isPaused?: boolean;
  isPraying?: boolean;
  onSpeak?: (text: string) => void;
  onTogglePlayPause: (text: string) => void;
  onRestart?: (text: string) => void;
  onStop?: () => void;
}

// Avoids a hard crash if the .glb is missing/corrupt — the rest of the app keeps working.
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
      <meshStandardMaterial color="#5266eb" />
    </mesh>
  );
}

function ThinkingDots() {
  return (
    <span className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-500"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

export default function PastorStage({
  assistantText,
  revealedText,
  sentences,
  currentSentenceIndex,
  isLoading,
  isSpeaking,
  isPaused = false,
  isPraying = false,
  onTogglePlayPause,
  onRestart,
  onStop,
}: PastorStageProps) {
  const avatarRef = useRef<AvatarHandle>(null);
  const activeSpanRef = useRef<HTMLSpanElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync avatar mouth animation with speaking and pause states
  useEffect(() => {
    if (isLoading) {
      avatarRef.current?.setMood("thinking");
    } else if (isSpeaking && !isPaused) {
      avatarRef.current?.speak();
    } else {
      avatarRef.current?.stop();
    }
  }, [isLoading, isSpeaking, isPaused]);

  // Smoothly keep the currently spoken sentence in view within the isolated lyrics container.
  // Only the lyrics container scrolls; the idol/model above stays completely stationary!
  useEffect(() => {
    if (isSpeaking && activeSpanRef.current && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;
      const activeEl = activeSpanRef.current;

      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const relativeTop = activeRect.top - containerRect.top + container.scrollTop;
      const targetScroll = relativeTop - container.clientHeight * 0.45;

      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: "smooth",
      });
    }
  }, [currentSentenceIndex, isSpeaking]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center overflow-hidden px-4 pt-1 sm:pt-2 pb-2">
      {/* Pinned Stationary Block: Avatar (Idol) + Audio Play/Pause Controls */}
      <div className="relative z-20 flex shrink-0 flex-col items-center gap-2.5 pb-2.5 pt-1 w-full bg-background/95 backdrop-blur-md border-b border-border/25 shadow-xs">
        {/* Avatar — lifelike human portrait proportion */}
        <div
          className="relative h-[270px] sm:h-[330px] md:h-[370px] w-full max-w-[440px] shrink-0"
          style={{
            background:
              "radial-gradient(circle at center, rgba(82,102,235,0.18), transparent 72%)",
          }}
        >
          <Canvas
            dpr={1}
            shadows={false}
            gl={{ antialias: true, powerPreference: "low-power", alpha: true }}
          >
            <Suspense fallback={<PlaceholderAvatar />}>
              <AvatarErrorBoundary>
                <Avatar ref={avatarRef} isPraying={isPraying} />
              </AvatarErrorBoundary>
            </Suspense>
          </Canvas>
        </div>

        {/* Audio Controls Bar: Play / Pause, Restart, Stop — isolated in a pill so text never overlaps */}
        {!isLoading && assistantText && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/90 border border-border/60 shadow-sm backdrop-blur-md">
            <button
              onClick={() => onTogglePlayPause(assistantText)}
              title={
                isSpeaking && !isPaused
                  ? "Pause speaking"
                  : isPaused
                    ? "Resume speaking"
                    : "Listen to Pastor Mike"
              }
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-xs transition ${
                isSpeaking && !isPaused
                  ? "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/70 dark:text-amber-200"
                  : isPaused
                    ? "bg-emerald-600 text-white hover:bg-emerald-700 animate-pulse"
                    : "bg-[#5266eb] text-white hover:bg-[#4353d4]"
              }`}
            >
              {isSpeaking && !isPaused ? (
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
                className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Restart</span>
              </button>
            )}

            {isSpeaking && onStop && (
              <button
                onClick={onStop}
                title="Stop speaking"
                className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>Stop</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lyrics Viewport: ONLY the text highlights and scrolls up like lyrics, scrollbar hidden, text fades at edges */}
      <div
        ref={lyricsContainerRef}
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
        }}
        className="relative flex-1 min-h-0 w-full max-w-[720px] overflow-y-auto px-4 pt-6 pb-28 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-full flex-col items-center gap-3 text-center pb-24 pt-2">
          {isLoading ? (
            <div className="flex flex-col items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span>Pastor Mike is reflecting...</span>
              <ThinkingDots />
            </div>
          ) : (
            <p className="text-base leading-relaxed text-slate-800 dark:text-slate-200 sm:text-lg transition-all duration-300">
              {sentences.map((sentence, i) => {
                const isCurrent = isSpeaking && i === currentSentenceIndex;
                const isPast =
                  isSpeaking &&
                  currentSentenceIndex !== -1 &&
                  i < currentSentenceIndex;
                const isFuture =
                  isSpeaking &&
                  currentSentenceIndex !== -1 &&
                  i > currentSentenceIndex;

                return (
                  <span
                    key={i}
                    ref={isCurrent ? activeSpanRef : null}
                    className={`transition-all duration-300 ${
                      isCurrent
                        ? "rounded-md bg-[#5266eb]/25 dark:bg-[#5266eb]/35 text-[#4353d4] dark:text-[#a8beff] font-semibold px-2 py-0.5 shadow-sm inline-block my-0.5 scale-[1.02]"
                        : isPast
                          ? "opacity-90 text-slate-800 dark:text-slate-200"
                          : isFuture
                            ? "opacity-35 text-slate-400 dark:text-slate-500"
                            : "opacity-100 text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {sentence}{" "}
                  </span>
                );
              })}
              {sentences.length === 0 && (revealedText || assistantText)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
