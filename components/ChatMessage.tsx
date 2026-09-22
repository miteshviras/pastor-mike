"use client";

import React, { useState } from "react";
import {
  Volume2,
  VolumeX,
  BookMarked,
  BookmarkCheck,
  Heart,
  Copy,
  Check,
  Zap,
} from "lucide-react";
import {
  getVerseByReference,
  ScriptureVerse,
} from "@/lib/scripture/bible-data";

export interface MessageMetadata {
  scriptures?: (ScriptureVerse | string)[];
  prayer?: {
    title: string;
    text: string;
  };
  prayerTitle?: string;
  isCrisis?: boolean;
  isProphecyRefusal?: boolean;
  savedPrayerId?: string;
  usedModel?: string;
  mcp?: {
    isConnected: boolean;
    clientName: string;
    transport?: string;
    toolsCalled?: string[];
  };
}

export interface ChatMessageProps {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: MessageMetadata | null;
  createdAt: string;
  onSpeak?: (text: string) => void;
  onSavePrayer?: (text: string) => Promise<boolean>;
  isSpeakingNow?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  role,
  content,
  metadata,
  onSpeak,
  onSavePrayer,
  isSpeakingNow = false,
}) => {
  const isUser = role === "user";
  const [copiedVerse, setCopiedVerse] = useState<string | null>(null);
  const [prayerSaved, setPrayerSaved] = useState<boolean>(
    Boolean(metadata?.savedPrayerId),
  );
  const [savingPrayer, setSavingPrayer] = useState<boolean>(false);

  // Normalize prayer from metadata if only title was persisted
  const activePrayer =
    metadata?.prayer ||
    (metadata?.prayerTitle
      ? {
          title: metadata.prayerTitle,
          text: "May the peace of God which surpasses all understanding guard your heart and mind in Christ Jesus. Amen.",
        }
      : undefined);

  const handleCopyVerse = (ref: string, text: string) => {
    navigator.clipboard.writeText(`"${text}"— ${ref}`);
    setCopiedVerse(ref);
    setTimeout(() => setCopiedVerse(null), 2000);
  };

  const handleSavePrayer = async () => {
    if (!activePrayer || prayerSaved || savingPrayer || !onSavePrayer) return;
    setSavingPrayer(true);
    const success = await onSavePrayer(activePrayer.text);
    if (success) {
      setPrayerSaved(true);
    }
    setSavingPrayer(false);
  };

  if (isUser) {
    return (
      <div className="flex justify-end my-4">
        <div className="max-w-[85%] sm:max-w-[70%] bg-[#5266eb] px-4 py-3 text-white">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 my-5 max-w-[92%] sm:max-w-[82%]">
      {/* Pastor Mike Message Bubble */}
      <div className="border border-border-subtle bg-card p-4 sm:p-5 shadow-hover">
        {/* Header with Pastor avatar and Voice Play */}
        <div className="flex items-center justify-between mb-3 border-b border-border-subtle pb-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5266eb] text-[11px] font-bold text-white">
              M
            </div>
            <span className="text-sm font-semibold text-card-foreground">
              Pastor Mike
            </span>
            {metadata?.usedModel && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground border border-border">
                {metadata.usedModel === "gemini"
                  ? "Google Gemini"
                  : metadata.usedModel === "ollama"
                    ? "Local Ollama"
                    : "Offline Engine"}
              </span>
            )}
          </div>

          {onSpeak && (
            <button
              onClick={() => onSpeak(content)}
              title={isSpeakingNow ? "Stop speaking" : "Listen to Pastor Mike"}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                isSpeakingNow
                  ? "bg-emerald-100 text-emerald-800"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {isSpeakingNow ? (
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
        </div>

        {/* Connected MCP Indicator Badge */}
        {metadata?.mcp && metadata.mcp.isConnected && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-emerald-700">
              <Zap className="h-3.5 w-3.5 text-emerald-600 fill-emerald-500/20" />
              <span>Connected MCP:</span>
              <span className="font-semibold text-emerald-800">
                {metadata.mcp.clientName}
              </span>
            </div>

            {metadata.mcp.toolsCalled &&
              metadata.mcp.toolsCalled.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 text-[11px] text-emerald-700/80">
                  <span className="hidden sm:inline">•</span>
                  <span className="font-mono text-[10px] bg-emerald-500/15 px-1.5 py-0.5 text-emerald-800">
                    {metadata.mcp.toolsCalled.join("•")}
                  </span>
                </div>
              )}
          </div>
        )}

        {/* Message Content */}
        <div className="text-sm leading-relaxed text-card-foreground whitespace-pre-wrap">
          {content}
        </div>

        {/* Scripture Citation Cards */}
        {metadata?.scriptures && metadata.scriptures.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {metadata.scriptures.map((verseItem, idx) => {
              const verse: Partial<ScriptureVerse> & {
                reference: string;
                text: string;
                translation?: string;
                pastoralContext?: string;
              } =
                typeof verseItem === "string"
                  ? getVerseByReference(verseItem) || {
                      reference: verseItem,
                      text: verseItem,
                      translation: "WEB",
                      topic: "comfort",
                      pastoralContext: undefined,
                    }
                  : verseItem;

              const refKey = verse.reference || `ref_${idx}`;
              const bodyText = verse.text || "";

              return (
                <div
                  key={refKey + idx}
                  className="border border-scripture-border bg-scripture-bg p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-card-foreground">
                        {verse.reference}
                      </span>
                      <span className="rounded bg-[#5266eb]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#5266eb]">
                        {verse.translation || "WEB"}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopyVerse(verse.reference, bodyText)}
                      title="Copy Scripture"
                      className="flex items-center gap-1 text-[11px] text-muted-foreground transition hover:text-card-foreground"
                    >
                      {copiedVerse === verse.reference ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <blockquote className="mt-2 text-sm italic leading-relaxed text-card-foreground/80">
                    &ldquo;{bodyText}&rdquo;
                  </blockquote>

                  {verse.pastoralContext && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {verse.pastoralContext}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Prayer Card */}
        {activePrayer && (
          <div className="mt-4 border border-prayer-border bg-prayer-bg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-[#5266eb]" />
                <h4 className="text-sm font-semibold text-card-foreground">
                  {activePrayer.title}
                </h4>
              </div>

              {onSavePrayer && (
                <button
                  onClick={handleSavePrayer}
                  disabled={prayerSaved || savingPrayer}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    prayerSaved
                      ? "border-emerald-500/50 bg-emerald-100 text-emerald-800"
                      : "border-border bg-card text-card-foreground hover:bg-accent"
                  }`}
                >
                  {prayerSaved ? (
                    <>
                      <BookmarkCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span>In Prayer Journal</span>
                    </>
                  ) : (
                    <>
                      <BookMarked className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>
                        {savingPrayer ? "Saving..." : "Save to Journal"}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>

            <p className="mt-2.5 text-sm italic leading-relaxed text-card-foreground/80">
              {activePrayer.text}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
