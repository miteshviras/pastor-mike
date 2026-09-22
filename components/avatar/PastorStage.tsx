"use client";

import React, { Suspense, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Sparkles } from "lucide-react";
import { Avatar, AvatarHandle } from "./Avatar";

interface PastorStageProps {
  userText: string;
  revealedText: string;
  sentences: string[];
  currentSentenceIndex: number;
  isLoading: boolean;
  isSpeaking: boolean;
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

export default function PastorStage({
  userText,
  revealedText,
  sentences,
  currentSentenceIndex,
  isLoading,
  isSpeaking,
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
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-4 overflow-hidden px-4 py-4 md:flex-row md:gap-8 md:px-8">
      {/* Avatar — always centered, never moves for message content */}
      <div
        className="relative aspect-square w-full max-w-[260px] shrink-0 md:max-w-[380px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(82,102,235,0.18), transparent 70%)",
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

      {/* Current turn — beside the avatar, not a full scrolling transcript. justify-start (not
          center) so a long reply scrolls from its beginning rather than opening mid-content. */}
      <div className="flex min-h-0 w-full max-w-md flex-1 flex-col justify-start gap-3 overflow-y-auto py-4">
        {userText && (
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            You: <span className="normal-case text-slate-600 dark:text-slate-400">{userText}</span>
          </p>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Sparkles className="h-4 w-4 animate-spin text-amber-600" />
            <span>Pastor Mike is reflecting...</span>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200 sm:text-base">
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
