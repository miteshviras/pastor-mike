"use client";

import React, { useState } from "react";
import { Volume2, VolumeX, BookMarked, BookmarkCheck, Heart, Copy, Check } from "lucide-react";
import { ScriptureVerse } from "@/lib/scripture/bible-data";

export interface MessageMetadata {
  scriptures?: ScriptureVerse[];
  prayer?: {
    title: string;
    text: string;
  };
  isCrisis?: boolean;
  isProphecyRefusal?: boolean;
  savedPrayerId?: string;
  usedModel?: string;
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
  const [prayerSaved, setPrayerSaved] = useState<boolean>(Boolean(metadata?.savedPrayerId));
  const [savingPrayer, setSavingPrayer] = useState<boolean>(false);

  const handleCopyVerse = (ref: string, text: string) => {
    navigator.clipboard.writeText(`"${text}" — ${ref}`);
    setCopiedVerse(ref);
    setTimeout(() => setCopiedVerse(null), 2000);
  };

  const handleSavePrayer = async () => {
    if (!metadata?.prayer || prayerSaved || savingPrayer || !onSavePrayer) return;
    setSavingPrayer(true);
    const success = await onSavePrayer(metadata.prayer.text);
    if (success) {
      setPrayerSaved(true);
    }
    setSavingPrayer(false);
  };

  if (isUser) {
    return (
      <div className="flex justify-end my-4">
        <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-tr-xs bg-[#445942] px-4 py-3 text-white shadow-xs dark:bg-[#4d694a]">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 my-5 max-w-[92%] sm:max-w-[82%]">
      {/* Pastor Mike Message Bubble */}
      <div className="rounded-2xl rounded-tl-xs border border-stone-200/80 bg-white/95 p-4 sm:p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900/90">
        {/* Header with Pastor avatar and Voice Play */}
        <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-2.5 dark:border-stone-800/60">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#445942] text-[11px] font-serif font-bold text-white">
              M
            </div>
            <span className="font-serif text-sm font-semibold text-stone-800 dark:text-stone-200">
              Pastor Mike
            </span>
          </div>

          {onSpeak && (
            <button
              onClick={() => onSpeak(content)}
              title={isSpeakingNow ? "Stop speaking" : "Listen to Pastor Mike"}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                isSpeakingNow
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                  : "text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
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

        {/* Message Content */}
        <div className="prose prose-stone text-sm leading-relaxed text-stone-800 dark:text-stone-200 whitespace-pre-wrap">
          {content}
        </div>

        {/* Scripture Citation Cards */}
        {metadata?.scriptures && metadata.scriptures.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {metadata.scriptures.map((verse) => (
              <div
                key={verse.reference}
                className="rounded-xl border border-[#d8cfc0] bg-[#f7f4ed] p-3.5 shadow-2xs dark:border-[#3d372e] dark:bg-[#1f1d19]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-xs font-bold text-stone-900 dark:text-amber-100">
                      {verse.reference}
                    </span>
                    <span className="rounded bg-stone-200/80 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-400">
                      {verse.translation}
                    </span>
                  </div>

                  <button
                    onClick={() => handleCopyVerse(verse.reference, verse.text)}
                    title="Copy Scripture"
                    className="flex items-center gap-1 text-[11px] text-stone-500 transition hover:text-stone-800 dark:hover:text-stone-300"
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

                <blockquote className="mt-2 font-serif text-sm italic leading-relaxed text-stone-700 dark:text-stone-300">
                  &ldquo;{verse.text}&rdquo;
                </blockquote>

                {verse.pastoralContext && (
                  <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                    {verse.pastoralContext}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Prayer Card */}
        {metadata?.prayer && (
          <div className="mt-4 rounded-xl border border-[#c8d7c6] bg-[#f3f6f3] p-4 shadow-2xs dark:border-[#283727] dark:bg-[#192019]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-[#445942] dark:text-[#7ba277]" />
                <h4 className="font-serif text-sm font-semibold text-stone-900 dark:text-emerald-100">
                  {metadata.prayer.title}
                </h4>
              </div>

              {onSavePrayer && (
                <button
                  onClick={handleSavePrayer}
                  disabled={prayerSaved || savingPrayer}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                    prayerSaved
                      ? "border-emerald-500/50 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                      : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
                  }`}
                >
                  {prayerSaved ? (
                    <>
                      <BookmarkCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span>In Prayer Journal</span>
                    </>
                  ) : (
                    <>
                      <BookMarked className="h-3.5 w-3.5 text-stone-500" />
                      <span>{savingPrayer ? "Saving..." : "Save to Journal"}</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <p className="mt-2.5 text-sm italic leading-relaxed text-stone-700 dark:text-stone-300">
              {metadata.prayer.text}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
