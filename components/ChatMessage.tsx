"use client";

import React, { useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  Copy,
  Check,
  Download,
  CheckCheck,
  BookMarked,
  BookmarkCheck,
  HeartHandshake,
  BookOpen,
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
  modelName?: string;
}

export interface ChatMessageProps {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: MessageMetadata | null;
  createdAt: string;
  onSpeak?: (text: string) => void;
  onRestart?: (text: string) => void;
  onStop?: () => void;
  onMarkAnswered?: (prayerId: string) => Promise<void>;
  onDownload?: (text: string) => Promise<void>;
  onSaveVerse?: (
    reference: string,
    text: string,
    translation?: string,
  ) => Promise<string | null>;
  isSpeakingNow?: boolean;
  isPausedNow?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  role,
  content,
  metadata,
  onSpeak,
  onRestart,
  onStop,
  onMarkAnswered,
  onDownload,
  onSaveVerse,
  isSpeakingNow = false,
  isPausedNow = false,
}) => {
  const isUser = role === "user";
  const [copiedVerse, setCopiedVerse] = useState<string | null>(null);
  const [savedVerseRefs, setSavedVerseRefs] = useState<Set<string>>(
    new Set(),
  );
  const [savingVerseRef, setSavingVerseRef] = useState<string | null>(null);
  const savedPrayerId = metadata?.savedPrayerId;
  const [prayerAnswered, setPrayerAnswered] = useState<boolean>(false);
  const [markingAnswered, setMarkingAnswered] = useState<boolean>(false);
  const [downloadingAudio, setDownloadingAudio] = useState<boolean>(false);

  const handleDownload = async () => {
    if (!onDownload || downloadingAudio) return;
    setDownloadingAudio(true);
    try {
      await onDownload(content);
    } finally {
      setDownloadingAudio(false);
    }
  };

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

  const handleSaveVerse = async (
    reference: string,
    text: string,
    translation?: string,
  ) => {
    if (!onSaveVerse || savedVerseRefs.has(reference) || savingVerseRef)
      return;
    setSavingVerseRef(reference);
    const newVerseId = await onSaveVerse(reference, text, translation);
    if (newVerseId) {
      setSavedVerseRefs((prev) => new Set(prev).add(reference));
    }
    setSavingVerseRef(null);
  };

  const handleMarkAnswered = async () => {
    if (!savedPrayerId || prayerAnswered || markingAnswered || !onMarkAnswered)
      return;
    setMarkingAnswered(true);
    await onMarkAnswered(savedPrayerId);
    setPrayerAnswered(true);
    setMarkingAnswered(false);
  };

  if (isUser) {
    return (
      <div className="flex justify-end my-4">
        <div className="max-w-[85%] sm:max-w-[70%] bg-[#1a1a1a] text-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl rounded-tr-xs shadow-xs font-normal">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 my-5 max-w-[95%] sm:max-w-[85%]">
      {/* Pastor Mike Message Card */}
      <div className="border border-[#e4e4e4] bg-white p-4 sm:p-5 shadow-sm rounded-2xl">
        {/* Header with Pastor avatar and Voice Play */}
        <div className="flex items-center justify-between mb-3 border-b border-[#eeeeee] pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#77b500] text-xs font-bold text-white shadow-xs">
              M
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#1a1a1a]">
                Pastor Mike
              </span>
              {metadata?.usedModel && (
                <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-semibold text-[#6b7280] border border-[#e4e4e4]">
                  {metadata.usedModel === "gemini"
                    ? metadata.modelName
                      ? `Gemini (${metadata.modelName})`
                      : "Gemini"
                    : metadata.usedModel === "ollama"
                      ? "Ollama"
                      : "Offline"}
                </span>
              )}
            </div>
          </div>

          {onSpeak && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onSpeak(content)}
                title={
                  isSpeakingNow && !isPausedNow
                    ? "Pause speaking"
                    : isSpeakingNow && isPausedNow
                      ? "Resume speaking"
                      : "Listen to Pastor Mike"
                }
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                  isSpeakingNow && !isPausedNow
                    ? "bg-[#eef5dd] text-[#4f7a00] border border-[#b5dd66]"
                    : isSpeakingNow && isPausedNow
                      ? "bg-[#77b500] text-white hover:bg-[#659c00] animate-pulse"
                      : "border border-[#e4e4e4] bg-white text-[#1a1a1a] hover:border-[#77b500] hover:text-[#77b500]"
                }`}
              >
                {isSpeakingNow && !isPausedNow ? (
                  <>
                    <Pause className="h-3.5 w-3.5 fill-current" />
                    <span>Pause</span>
                  </>
                ) : isSpeakingNow && isPausedNow ? (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Resume</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current text-[#77b500]" />
                    <span>Listen</span>
                  </>
                )}
              </button>

              {isSpeakingNow && onRestart && (
                <button
                  onClick={() => onRestart(content)}
                  title="Restart from beginning"
                  className="rounded-lg p-1.5 border border-[#e4e4e4] text-[#6b7280] hover:border-[#77b500] hover:text-[#77b500] transition cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}

              {isSpeakingNow && onStop && (
                <button
                  onClick={onStop}
                  title="Stop speaking"
                  className="rounded-lg p-1.5 border border-red-200 text-red-600 hover:bg-red-50 transition cursor-pointer"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              )}

              {onDownload && (
                <button
                  onClick={handleDownload}
                  disabled={downloadingAudio}
                  title="Download this reply as audio"
                  className="rounded-lg p-1.5 border border-[#e4e4e4] text-[#6b7280] hover:border-[#77b500] hover:text-[#77b500] transition cursor-pointer disabled:opacity-50"
                >
                  <Download className={`h-3.5 w-3.5 ${downloadingAudio ? "animate-pulse" : ""}`} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Message Content */}
        <div className="text-sm leading-relaxed text-[#2b2b2b] whitespace-pre-wrap font-normal">
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
                  className="border border-[#e4e4e4] border-l-4 border-l-[#77b500] bg-[#fbfbfd] p-3.5 rounded-xl shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-[#77b500]" />
                      <span className="text-xs font-bold text-[#1a1a1a]">
                        {verse.reference}
                      </span>
                      <span className="rounded bg-[#eef5dd] border border-[#b5dd66]/40 px-1.5 py-0.5 text-[10px] font-bold text-[#4f7a00]">
                        {verse.translation || "WEB"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {onSaveVerse && (
                        <button
                          onClick={() =>
                            handleSaveVerse(
                              verse.reference,
                              bodyText,
                              verse.translation,
                            )
                          }
                          disabled={savingVerseRef === verse.reference}
                          title="Save this verse to your journal"
                          className="flex items-center gap-1 text-[11px] font-semibold text-[#6b7280] transition hover:text-[#77b500] cursor-pointer"
                        >
                          {savedVerseRefs.has(verse.reference) ? (
                            <>
                              <BookmarkCheck className="h-3 w-3 text-[#77b500]" />
                              <span className="text-[#4f7a00]">Saved</span>
                            </>
                          ) : (
                            <>
                              <BookMarked className="h-3 w-3" />
                              <span>
                                {savingVerseRef === verse.reference
                                  ? "Saving..."
                                  : "Save"}
                              </span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => handleCopyVerse(verse.reference, bodyText)}
                        title="Copy Scripture"
                        className="flex items-center gap-1 text-[11px] font-semibold text-[#6b7280] transition hover:text-[#77b500] cursor-pointer"
                      >
                        {copiedVerse === verse.reference ? (
                          <>
                            <Check className="h-3 w-3 text-[#77b500]" />
                            <span className="text-[#4f7a00]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <blockquote className="mt-2 text-sm italic leading-relaxed text-[#3a3a3a]">
                    &ldquo;{bodyText}&rdquo;
                  </blockquote>

                  {verse.pastoralContext && (
                    <p className="mt-2 text-xs text-[#8a8a8a]">
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
          <div className="mt-4 border border-[#b5dd66] bg-[#eef5dd]/90 p-4 rounded-xl shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartHandshake className="h-4 w-4 text-[#77b500]" />
                <h4 className="text-sm font-bold text-[#1a1a1a]">
                  {activePrayer.title}
                </h4>
              </div>

              <div className="flex items-center gap-1.5">
                {onMarkAnswered && savedPrayerId && (
                  <button
                    onClick={handleMarkAnswered}
                    disabled={prayerAnswered || markingAnswered}
                    title="Confirm this prayer has been answered"
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                      prayerAnswered
                        ? "border border-[#b5dd66] bg-white text-[#4f7a00] shadow-xs"
                        : "bg-[#77b500] hover:bg-[#659c00] text-white shadow-xs"
                    }`}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>
                      {prayerAnswered
                        ? "Answered"
                        : markingAnswered
                          ? "Marking..."
                          : "Mark as Answered"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            <p className="mt-2.5 text-sm italic leading-relaxed text-[#2b2b2b]">
              {activePrayer.text}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
