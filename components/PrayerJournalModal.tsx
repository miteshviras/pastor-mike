"use client";

import React, { useState } from "react";
import {
  X,
  BookOpen,
  BookMarked,
  CheckCircle,
  Clock,
  Send,
  Sparkles,
  Trash2,
  Heart,
} from "lucide-react";
import { PrayerRequest, SavedVerse } from "@/lib/db";

interface PrayerJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  prayers: PrayerRequest[];
  onToggleStatus: (
    prayerId: string,
    currentStatus: "active" | "answered",
  ) => Promise<void>;
  onAddPrayer: (text: string) => Promise<void>;
  onDeletePrayer?: (prayerId: string) => Promise<void>;
  verses: SavedVerse[];
  onDeleteVerse?: (verseId: string) => Promise<void>;
}

const MAX_PRAYER_LENGTH = 150;

export const PrayerJournalModal: React.FC<PrayerJournalModalProps> = ({
  isOpen,
  onClose,
  prayers,
  onToggleStatus,
  onAddPrayer,
  onDeletePrayer,
  verses,
  onDeleteVerse,
}) => {
  const [activeTab, setActiveTab] = useState<"prayers" | "verses">("prayers");
  const [filter, setFilter] = useState<"all" | "active" | "answered">("all");
  const [newPrayerText, setNewPrayerText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingVerseId, setDeletingVerseId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredPrayers = prayers.filter((p) => {
    if (filter === "active") return p.status === "active";
    if (filter === "answered") return p.status === "answered";
    return true;
  });

  const handleCreate = async (
    e: React.FormEvent | React.KeyboardEvent,
  ) => {
    e.preventDefault();
    if (!newPrayerText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await onAddPrayer(newPrayerText.trim());
    setNewPrayerText("");
    setIsSubmitting(false);
  };

  const handleDelete = async (prayerId: string) => {
    if (!onDeletePrayer) return;
    if (
      !window.confirm("Are you sure you want to remove this prayer petition?")
    )
      return;
    setDeletingId(prayerId);
    try {
      await onDeletePrayer(prayerId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteVerse = async (verseId: string) => {
    if (!onDeleteVerse) return;
    if (!window.confirm("Remove this verse from your journal?")) return;
    setDeletingVerseId(verseId);
    try {
      await onDeleteVerse(verseId);
    } finally {
      setDeletingVerseId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-xs">
      <div className="flex h-[92dvh] sm:h-[85vh] w-full max-w-xl flex-col rounded-t-3xl sm:rounded-none border border-border-subtle bg-card shadow-elevated">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3.5 sm:px-5 sm:py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-[#5266eb]/10 p-2 text-[#5266eb] dark:bg-[#5266eb]/20 dark:text-[#9cb4e8]">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
                My Journal
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                {activeTab === "prayers"
                  ? "All petitions across your visits, stored in SQLite"
                  : "Scripture Pastor Mike has shared with you, saved for keeps"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Top-Level Tabs: Prayers vs Verses */}
        <div className="grid grid-cols-2 border-b border-slate-200/80 bg-slate-100/50 text-xs font-medium dark:border-slate-800 dark:bg-slate-950/40">
          <button
            type="button"
            onClick={() => setActiveTab("prayers")}
            className={`flex items-center justify-center gap-1.5 py-3 border-b-2 transition ${
              activeTab === "prayers"
                ? "border-[#5266eb] text-[#5266eb] font-semibold dark:border-[#9cb4e8] dark:text-[#9cb4e8]"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            <Heart className="h-3.5 w-3.5" />
            <span>Prayers ({prayers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("verses")}
            className={`flex items-center justify-center gap-1.5 py-3 border-b-2 transition ${
              activeTab === "verses"
                ? "border-[#5266eb] text-[#5266eb] font-semibold dark:border-[#9cb4e8] dark:text-[#9cb4e8]"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            <BookMarked className="h-3.5 w-3.5" />
            <span>Verses ({verses.length})</span>
          </button>
        </div>

        {activeTab === "prayers" ? (
          <>
        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-200/60 bg-slate-50/50 px-4 py-2 sm:px-5 sm:py-2.5 dark:border-slate-800/60 dark:bg-slate-950/30">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5">
            {(["all", "active", "answered"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition ${
                  filter === tab
                    ? "bg-[#5266eb] text-white dark:bg-[#5266eb]"
                    : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {tab} (
                {
                  prayers.filter((p) =>
                    tab === "all" ? true : p.status === tab,
                  ).length
                }
                )
              </button>
            ))}
          </div>
        </div>

        {/* Prayer List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {filteredPrayers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <Sparkles className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                No prayers recorded in your journal yet
              </p>
              <p className="text-xs mt-1 max-w-sm text-slate-500 dark:text-slate-400">
                Start by writing a petition below or asking Pastor Mike for
                prayer during your visit.
              </p>
            </div>
          ) : (
            filteredPrayers.map((prayer) => {
              const isAnswered = prayer.status === "answered";
              return (
                <div
                  key={prayer.id}
                  className={`group flex items-start gap-3 rounded-xl border p-4 transition ${
                    isAnswered
                      ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/40"
                      : "border-slate-200/90 bg-card dark:border-slate-800 dark:bg-slate-800/90"
                  }`}
                >
                  <button
                    onClick={() => onToggleStatus(prayer.id, prayer.status)}
                    title={isAnswered ? "Mark as active" : "Mark as answered"}
                    className="mt-0.5 shrink-0 transition"
                  >
                    {isAnswered ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-slate-300 hover:border-[#5266eb] dark:border-slate-600" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm leading-relaxed ${
                        isAnswered
                          ? "text-slate-500 line-through dark:text-slate-400"
                          : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {prayer.request_text}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(prayer.created_at).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            isAnswered
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
                          }`}
                        >
                          {isAnswered ? "Answered Prayer ✓" : "Active Petition"}
                        </span>
                      </div>

                      {onDeletePrayer && (
                        <button
                          type="button"
                          onClick={() => handleDelete(prayer.id)}
                          disabled={deletingId === prayer.id}
                          title="Delete prayer from journal"
                          className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition rounded-md p-1.5 sm:p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-700 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add Prayer Form */}
        <form
          onSubmit={handleCreate}
          className="border-t border-slate-200/80 bg-card p-3 sm:p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-end gap-1.5 sm:gap-2 rounded-input border border-border bg-card p-1.5 sm:p-2 focus-within:border-[#5266eb] focus-within:ring-2 focus-within:ring-[#5266eb]/15">
            <textarea
              value={newPrayerText}
              onChange={(e) => setNewPrayerText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleCreate(e);
                }
              }}
              placeholder="Add a new prayer to your journal..."
              maxLength={MAX_PRAYER_LENGTH}
              rows={1}
              disabled={isSubmitting}
              className="max-h-24 flex-1 resize-none bg-transparent px-2 py-1.5 text-base sm:text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={!newPrayerText.trim() || isSubmitting}
              title="Add prayer"
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-[#5266eb] text-white transition hover:bg-[#3f52c9] disabled:opacity-30 disabled:hover:bg-[#5266eb] cursor-pointer touch-manipulation active:scale-95"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-1.5 text-right text-[10px] text-slate-400 dark:text-slate-500">
            {newPrayerText.length}/{MAX_PRAYER_LENGTH}
          </div>
        </form>
          </>
        ) : (
          /* Saved Verses List */
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {verses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <BookMarked className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  No verses saved yet
                </p>
                <p className="text-xs mt-1 max-w-sm text-slate-500 dark:text-slate-400">
                  When Pastor Mike shares a scripture with you in chat, tap
                  &ldquo;Save&rdquo; on it to keep it here.
                </p>
              </div>
            ) : (
              verses.map((verse) => (
                <div
                  key={verse.id}
                  className="group flex items-start gap-3 rounded-xl border border-slate-200/90 bg-card p-4 transition dark:border-slate-800 dark:bg-slate-800/90"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {verse.reference}
                      </span>
                      {verse.translation && (
                        <span className="rounded bg-[#5266eb]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#5266eb]">
                          {verse.translation}
                        </span>
                      )}
                    </div>

                    <blockquote className="mt-1.5 text-sm italic leading-relaxed text-slate-700 dark:text-slate-300">
                      &ldquo;{verse.verse_text}&rdquo;
                    </blockquote>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(verse.created_at).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </span>

                      {onDeleteVerse && (
                        <button
                          type="button"
                          onClick={() => handleDeleteVerse(verse.id)}
                          disabled={deletingVerseId === verse.id}
                          title="Remove verse from journal"
                          className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition rounded-md p-1.5 sm:p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-700 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
