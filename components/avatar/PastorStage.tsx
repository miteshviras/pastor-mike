"use client";

import React, { Suspense, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Volume2, VolumeX } from "lucide-react";
import { Avatar, AvatarHandle } from "./Avatar";

interface PastorStageProps {
  assistantText: string;
  revealedText: string;
  sentences: string[];
  currentSentenceIndex: number;
  isLoading: boolean;
  isSpeaking: boolean;
  onSpeak: (text: string) => void;
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
  onSpeak,
}: PastorStageProps) {
  const avatarRef = useRef<AvatarHandle>(null);

  useEffect(() => {
    if (isLoading) {
      avatarRef.current?.setMood("thinking");
    } else if (isSpeaking) {
      avatarRef.current?.speak();
    } else {
      avatarRef.current?.stop();
    }
  }, [isLoading, isSpeaking]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-6 overflow-y-auto px-4 pb-8 pt-6 sm:pt-10">
      {/* Avatar — the hero of the view. Fixed size regardless of message content, so it
          never moves or resizes as text streams in below it. */}
      <div
        className="relative aspect-square w-full max-w-[320px] shrink-0 sm:max-w-[380px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(82,102,235,0.14), transparent 72%)",
        }}
      >
        <Canvas
          dpr={1}
          shadows={false}
          gl={{ antialias: false, powerPreference: "low-power", alpha: true }}
        >
          {/* Avatar supplies its own camera (makeDefault), fitted to the loaded model's
              measured size once it resolves — the placeholder sphere before that renders
              fine under R3F's own implicit default camera. */}
          <Suspense fallback={<PlaceholderAvatar />}>
            <AvatarErrorBoundary>
              <Avatar ref={avatarRef} />
            </AvatarErrorBoundary>
          </Suspense>
        </Canvas>
      </div>

      {!isLoading && assistantText && (
        <button
          onClick={() => onSpeak(assistantText)}
          title={isSpeaking ? "Stop speaking" : "Listen to Pastor Mike"}
          className={`flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
            isSpeaking
              ? "bg-emerald-100 text-emerald-800"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          {isSpeaking ? (
            <>
              <VolumeX className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
              <span>Speaking...</span>
            </>
          ) : (
            <>
              <Volume2 className="h-3.5 w-3.5" />
              <span>Listen</span>
            </>
          )}
        </button>
      )}

      {/* Current turn — reads as a caption beneath the pastor, not a chat bubble. */}
      <div className="flex w-full max-w-[700px] flex-col items-center gap-3 text-center">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span>Pastor Mike is reflecting...</span>
            <ThinkingDots />
          </div>
        ) : (
          <p className="text-base leading-relaxed text-slate-800 dark:text-slate-200 sm:text-lg">
            {sentences.map((sentence, i) => {
              const isRevealed = i <= currentSentenceIndex;
              const isCurrent = isSpeaking && i === currentSentenceIndex;
              return (
                <span
                  key={i}
                  className={isCurrent ? "rounded bg-[#5266eb]/15 text-[#5266eb] dark:text-[#9cb4e8]" : undefined}
                  style={{ opacity: isRevealed || !isSpeaking ? 1 : 0.35 }}
                >
                  {sentence}{" "}
                </span>
              );
            })}
            {sentences.length === 0 && revealedText}
          </p>
        )}
      </div>
    </div>
  );
}
