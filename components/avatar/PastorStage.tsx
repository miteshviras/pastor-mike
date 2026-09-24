"use client";

import React, { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Play, Pause, RotateCcw, Square, Download, Loader2 } from "lucide-react";
import { Avatar, AvatarHandle } from "./Avatar";
import type { ChatMessageProps } from "@/components/ChatMessage";

// Silence Three.js r183+ deprecation warning for THREE.Clock used internally by @react-three/fiber
if (typeof window !== "undefined") {
  if (
    typeof (THREE as unknown as { setConsoleFunction?: unknown })
      .setConsoleFunction === "function"
  ) {
    (
      THREE as unknown as {
        setConsoleFunction: (
          fn: (type: string, message: string, ...params: unknown[]) => void,
        ) => void;
      }
    ).setConsoleFunction((type, message, ...params) => {
      if (
        typeof message === "string" &&
        message.includes("Clock: This module has been deprecated")
      ) {
        return;
      }
      const method =
        (console as unknown as Record<string, (...args: unknown[]) => void>)[
          type
        ] || console.log;
      method.call(console, message, ...params);
    });
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
  assistantMessages: ChatMessageProps[];
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
  onDownload,
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
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden md:flex-row">
      <div className="flex h-full min-h-0 flex-1 flex-col items-center overflow-hidden px-4 pt-1 sm:pt-2 pb-2">
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

          {/* Audio Controls Bar: Play / Pause, Restart, Stop — isolated in a pill so text never overlaps */}
          {!isLoading && assistantText && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/90 border border-border/60 shadow-sm backdrop-blur-md">
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
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-xs transition ${
                  isSpeechLoading && !isSpeaking
                    ? "bg-card text-muted-foreground"
                    : isSpeaking && !isPaused
                      ? "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/70 dark:text-amber-200"
                      : isPaused
                        ? "bg-emerald-600 text-white hover:bg-emerald-700 animate-pulse"
                        : "bg-[#5266eb] text-white hover:bg-[#4353d4]"
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

        {/* Now-playing viewport: only the currently-active reply's lyrics view, centered.
          Every reply (playing or not) is selectable from the right-side panel instead. */}
        <div
          ref={lyricsContainerRef}
          style={{
            maskImage:
              "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
          }}
          className="relative flex-1 min-h-0 w-full max-w-[640px] overflow-y-auto px-4 pt-6 pb-10 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex w-full flex-col items-center gap-2 pb-10 pt-2 text-center">
            {isLoading ? (
              <div className="flex flex-col items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span>Pastor Mike is reflecting...</span>
                <ThinkingDots />
              </div>
            ) : isSpeaking && assistantText ? (
              <p className="max-w-[640px] px-6 text-base leading-relaxed text-slate-800 dark:text-slate-200 sm:text-lg transition-all duration-300">
                {sentences.map((sentence, i) => {
                  const isCurrent = i === currentSentenceIndex;
                  const isPast =
                    currentSentenceIndex !== -1 && i < currentSentenceIndex;
                  const isFuture =
                    currentSentenceIndex !== -1 && i > currentSentenceIndex;

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
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {assistantMessages.length > 0
                  ? "Select a reply from the list to hear it."
                  : "Send a message below to begin."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right-side panel: every one of Pastor Mike's replies, selectable to dictate. */}
      <aside className="flex w-full shrink-0 flex-col overflow-hidden border-t border-border/40 md:h-full md:w-72 md:border-l md:border-t-0 lg:w-80">
        <div className="shrink-0 border-b border-border/40 px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Replies
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex flex-col gap-2">
            {assistantMessages.length === 0 && (
              <p className="px-1 text-sm text-slate-500 dark:text-slate-400">
                No replies yet.
              </p>
            )}

            {assistantMessages.map((msg) => {
              const isTarget = msg.content === assistantText;
              const isActive = isSpeaking && isTarget;
              const isActivePaused = isActive && isPaused;
              const isRowLoading = isTarget && isSpeechLoading && !isSpeaking;

              return (
                <div
                  key={msg.id}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${
                    isActive || isRowLoading
                      ? "border-[#5266eb]/50 bg-[#5266eb]/10"
                      : "border-border/40 bg-card/40 hover:bg-card/70"
                  }`}
                >
                  <p className="line-clamp-2 flex-1 text-left text-sm text-slate-600 dark:text-slate-400">
                    {msg.content}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => onTogglePlayPause(msg.content)}
                      disabled={isRowLoading}
                      title={
                        isRowLoading
                          ? "Loading audio..."
                          : isActive && !isActivePaused
                            ? "Pause"
                            : isActivePaused
                              ? "Resume"
                              : "Listen to this reply"
                      }
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
                    >
                      {isRowLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isActive && !isActivePaused ? (
                        <Pause className="h-3.5 w-3.5 fill-current" />
                      ) : (
                        <Play className="h-3.5 w-3.5 fill-current" />
                      )}
                    </button>
                    {onDownload && (
                      <button
                        onClick={() => onDownload(msg.content)}
                        title="Download this reply as audio"
                        className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}
