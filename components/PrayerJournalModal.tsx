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
  ListChecks,
  Square,
  CheckSquare,
} from "lucide-react";
import { PrayerRequest, SavedVerse } from "@/lib/db";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<
    | { type: "prayer"; id: string }
    | { type: "verse"; id: string }
    | { type: "bulk"; kind: "prayers" | "verses" }
    | null
  >(null);

  if (!isOpen) return null;

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const switchTab = (tab: "prayers" | "verses") => {
    exitSelectMode();
    setActiveTab(tab);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredPrayers = prayers.filter((p) => {
    if (filter === "active") return p.status === "active";
    if (filter === "answered") return p.status === "answered";
    return true;
  });

  const handleCreate = async (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!newPrayerText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await onAddPrayer(newPrayerText.trim());
    setNewPrayerText("");
    setIsSubmitting(false);
  };

  const performDeletePrayer = async (prayerId: string) => {
    if (!onDeletePrayer) return;
    setDeletingId(prayerId);
    try {
      await onDeletePrayer(prayerId);
    } finally {
      setDeletingId(null);
    }
  };

  const performDeleteVerse = async (verseId: string) => {
    if (!onDeleteVerse) return;
    setDeletingVerseId(verseId);
    try {
      await onDeleteVerse(verseId);
    } finally {
      setDeletingVerseId(null);
    }
  };

  const performBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkDeleting(true);
    try {
      if (activeTab === "prayers" && onDeletePrayer) {
        await Promise.all(ids.map((id) => onDeletePrayer(id)));
      } else if (activeTab === "verses" && onDeleteVerse) {
        await Promise.all(ids.map((id) => onDeleteVerse(id)));
      }
      exitSelectMode();
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleConfirmDelete = () => {
    if (!confirmTarget) return;
    if (confirmTarget.type === "prayer") {
      void performDeletePrayer(confirmTarget.id);
    } else if (confirmTarget.type === "verse") {
      void performDeleteVerse(confirmTarget.id);
    } else {
      void performBulkDelete();
    }
    setConfirmTarget(null);
  };

  const confirmCopy = (() => {
    if (!confirmTarget) return { title: "", message: "" };
    if (confirmTarget.type === "prayer") {
      return {
        title: "Delete this prayer?",
        message:
          "This will permanently remove this petition from your journal.",
      };
    }
    if (confirmTarget.type === "verse") {
      return {
        title: "Remove this verse?",
        message:
          "This will permanently remove this saved verse from your journal.",
      };
    }
    const kind = confirmTarget.kind === "prayers" ? "prayer" : "verse";
    return {
      title: `Delete ${selectedIds.size} selected ${kind}${selectedIds.size > 1 ? "s" : ""}?`,
      message: `This will permanently remove the selected ${kind}${selectedIds.size > 1 ? "s" : ""} from your journal.`,
    };
  })();

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-xs">
        <div className="flex h-[92dvh] sm:h-[85vh] w-full max-w-xl flex-col rounded-t-3xl sm:rounded-2xl border border-[#e4e4e4] bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#e4e4e4] px-4 py-3.5 sm:px-6 sm:py-4 bg-white">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-[#eef5dd] p-2 text-[#77b500] border border-[#b5dd66]/40 shadow-xs">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-[#1a1a1a]">
                  Prayer Journal &amp; Saved Verses
                </h2>
                <p className="text-[11px] sm:text-xs font-medium text-[#6b7280]">
                  {activeTab === "prayers"
                    ? "All petitions preserved across visits, stored safely in SQLite"
                    : "Scripture Pastor Mike has shared with you, saved for keeps"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1a1a] transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Top-Level Tabs: Prayers vs Verses */}
          <div className="grid grid-cols-2 border-b border-[#e4e4e4] bg-[#fbfbfd] text-xs font-bold">
            <button
              type="button"
              onClick={() => switchTab("prayers")}
              className={`flex items-center justify-center gap-1.5 py-3 border-b-2 transition cursor-pointer ${
                activeTab === "prayers"
                  ? "border-[#77b500] text-[#77b500] bg-white shadow-xs"
                  : "border-transparent text-[#6b7280] hover:text-[#1a1a1a]"
              }`}
            >
              <Heart className="h-3.5 w-3.5" />
              <span>Prayers ({prayers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => switchTab("verses")}
              className={`flex items-center justify-center gap-1.5 py-3 border-b-2 transition cursor-pointer ${
                activeTab === "verses"
                  ? "border-[#77b500] text-[#77b500] bg-white shadow-xs"
                  : "border-transparent text-[#6b7280] hover:text-[#1a1a1a]"
              }`}
            >
              <BookMarked className="h-3.5 w-3.5" />
              <span>Saved Verses ({verses.length})</span>
            </button>
          </div>

          {activeTab === "prayers" ? (
            <>
              {/* Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4e4e4] bg-[#fbfbfd] px-4 py-2 sm:px-6 sm:py-2.5">
                <div className="flex items-center gap-1.5">
                  {(["all", "active", "answered"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setFilter(tab)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold capitalize transition cursor-pointer ${
                        filter === tab
                          ? "bg-[#77b500] text-white shadow-xs"
                          : "text-[#6b7280] hover:bg-[#eef5dd] hover:text-[#4f7a00]"
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

                {prayers.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      isSelectMode ? exitSelectMode() : setIsSelectMode(true)
                    }
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                      isSelectMode
                        ? "border-[#b5dd66] bg-[#eef5dd] text-[#4f7a00]"
                        : "border-[#e4e4e4] bg-white text-[#1a1a1a] hover:border-[#77b500]"
                    }`}
                  >
                    <ListChecks className="h-3.5 w-3.5 text-[#77b500]" />
                    <span>{isSelectMode ? "Cancel" : "Select"}</span>
                  </button>
                )}
              </div>

              {/* Prayer List */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#fbfbfd]">
                {filteredPrayers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-[#6b7280]">
                    <Sparkles className="h-8 w-8 text-[#d1d5db] mb-2" />
                    <p className="text-sm font-bold text-[#1a1a1a]">
                      No prayers in this view
                    </p>
                    <p className="text-xs mt-1 max-w-sm text-[#6b7280]">
                      Add a petition below or ask Pastor Mike to pray with you
                      during your visit.
                    </p>
                  </div>
                ) : (
                  filteredPrayers.map((prayer) => {
                    const isAnswered = prayer.status === "answered";
                    const isSelected = selectedIds.has(prayer.id);
                    return (
                      <div
                        key={prayer.id}
                        onClick={() => {
                          if (isSelectMode) toggleSelected(prayer.id);
                        }}
                        className={`group flex items-start gap-3 rounded-xl border p-4 transition ${
                          isSelectMode ? "cursor-pointer" : ""
                        } ${
                          isSelected
                            ? "border-[#77b500] bg-[#eef5dd]/70 shadow-xs"
                            : isAnswered
                              ? "border-[#b5dd66] bg-[#eef5dd]/50 shadow-xs"
                              : "border-[#e4e4e4] bg-white hover:border-[#77b500] shadow-xs"
                        }`}
                      >
                        {isSelectMode ? (
                          <span className="mt-0.5 shrink-0 text-[#77b500]">
                            {isSelected ? (
                              <CheckSquare className="h-5 w-5" />
                            ) : (
                              <Square className="h-5 w-5 text-[#9ca3af]" />
                            )}
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              onToggleStatus(prayer.id, prayer.status)
                            }
                            title={
                              isAnswered ? "Mark as active" : "Mark as answered"
                            }
                            className="mt-0.5 shrink-0 transition cursor-pointer"
                          >
                            {isAnswered ? (
                              <CheckCircle className="h-5 w-5 text-[#77b500]" />
                            ) : (
                              <div className="h-5 w-5 rounded-full border-2 border-[#b5dd66] hover:border-[#77b500] transition" />
                            )}
                          </button>
                        )}

                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm leading-relaxed ${
                              isAnswered
                                ? "text-[#6b7280] line-through font-normal"
                                : "text-[#1a1a1a] font-medium"
                            }`}
                          >
                            {prayer.request_text}
                          </p>

                          <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#8a8a8a]">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1 font-medium">
                                <Clock className="h-3 w-3 text-[#77b500]" />
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
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  isAnswered
                                    ? "bg-[#eef5dd] text-[#4f7a00] border border-[#b5dd66]"
                                    : "bg-amber-100 text-amber-800 border border-amber-300"
                                }`}
                              >
                                {isAnswered
                                  ? "Answered Prayer ✓"
                                  : "Active Petition"}
                              </span>
                            </div>

                            {onDeletePrayer && !isSelectMode && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmTarget({
                                    type: "prayer",
                                    id: prayer.id,
                                  });
                                }}
                                disabled={deletingId === prayer.id}
                                title="Delete prayer from journal"
                                className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition rounded-md p-1.5 sm:p-1 text-[#6b7280] hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
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

              {isSelectMode ? (
                /* Bulk Delete Bar */
                <div className="flex items-center justify-between border-t border-[#e4e4e4] px-4 py-2.5 text-[11px] bg-white sm:px-6">
                  <span className="font-bold text-[#1a1a1a]">
                    {selectedIds.size} selected
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmTarget({ type: "bulk", kind: "prayers" })
                    }
                    disabled={selectedIds.size === 0 || isBulkDeleting}
                    className="flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-40 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>
                      {isBulkDeleting ? "Deleting..." : "Delete Selected"}
                    </span>
                  </button>
                </div>
              ) : (
                /* Add Prayer Form */
                <form
                  onSubmit={handleCreate}
                  className="border-t border-[#e4e4e4] bg-white p-3 sm:p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-4"
                >
                  <div className="flex items-end gap-1.5 sm:gap-2 rounded-xl border border-[#e4e4e4] bg-white p-1.5 sm:p-2 focus-within:border-[#77b500] focus-within:ring-2 focus-within:ring-[#77b500]/15 shadow-xs">
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
                      className="max-h-24 flex-1 resize-none bg-transparent px-2 py-1.5 text-base sm:text-sm text-[#1a1a1a] placeholder:text-[#8a8a8a] focus:outline-hidden font-normal"
                    />
                    <button
                      type="submit"
                      disabled={!newPrayerText.trim() || isSubmitting}
                      title="Add prayer"
                      className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-[#77b500] text-white transition hover:bg-[#659c00] disabled:opacity-30 disabled:hover:bg-[#77b500] cursor-pointer touch-manipulation active:scale-95 shadow-xs"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-1.5 text-right text-[10px] font-medium text-[#8a8a8a]">
                    {newPrayerText.length}/{MAX_PRAYER_LENGTH}
                  </div>
                </form>
              )}
            </>
          ) : (
            <>
              {/* Verses Header / Select toggle */}
              {verses.length > 0 && (
                <div className="flex items-center justify-end gap-2 border-b border-[#e4e4e4] bg-[#fbfbfd] px-4 py-2 sm:px-6 sm:py-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      isSelectMode ? exitSelectMode() : setIsSelectMode(true)
                    }
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                      isSelectMode
                        ? "border-[#b5dd66] bg-[#eef5dd] text-[#4f7a00]"
                        : "border-[#e4e4e4] bg-white text-[#1a1a1a] hover:border-[#77b500]"
                    }`}
                  >
                    <ListChecks className="h-3.5 w-3.5 text-[#77b500]" />
                    <span>{isSelectMode ? "Cancel" : "Select"}</span>
                  </button>
                </div>
              )}

              {/* Saved Verses List */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#fbfbfd]">
                {verses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-[#6b7280]">
                    <BookMarked className="h-8 w-8 text-[#d1d5db] mb-2" />
                    <p className="text-sm font-bold text-[#1a1a1a]">
                      No verses saved yet
                    </p>
                    <p className="text-xs mt-1 max-w-sm text-[#6b7280]">
                      When Pastor Mike shares a scripture with you in chat, tap
                      &ldquo;Save&rdquo; on it to keep it bookmarked here.
                    </p>
                  </div>
                ) : (
                  verses.map((verse) => {
                    const isSelected = selectedIds.has(verse.id);
                    return (
                      <div
                        key={verse.id}
                        onClick={() => {
                          if (isSelectMode) toggleSelected(verse.id);
                        }}
                        className={`group flex items-start gap-3 rounded-xl border border-l-4 border-l-[#ffba01] p-4 transition shadow-xs ${
                          isSelectMode ? "cursor-pointer" : ""
                        } ${
                          isSelected
                            ? "border-[#77b500] bg-[#eef5dd]/70"
                            : "border-[#e4e4e4] bg-white hover:border-[#77b500]"
                        }`}
                      >
                        {isSelectMode && (
                          <span className="mt-0.5 shrink-0 text-[#77b500]">
                            {isSelected ? (
                              <CheckSquare className="h-5 w-5" />
                            ) : (
                              <Square className="h-5 w-5 text-[#9ca3af]" />
                            )}
                          </span>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#1a1a1a]">
                              {verse.reference}
                            </span>
                            {verse.translation && (
                              <span className="rounded bg-[#eef5dd] border border-[#b5dd66]/40 px-1.5 py-0.5 text-[10px] font-bold text-[#4f7a00]">
                                {verse.translation}
                              </span>
                            )}
                          </div>

                          <blockquote className="mt-1.5 text-sm italic leading-relaxed text-[#2b2b2b]">
                            &ldquo;{verse.verse_text}&rdquo;
                          </blockquote>

                          <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#8a8a8a]">
                            <span className="flex items-center gap-1 font-medium">
                              <Clock className="h-3 w-3 text-[#77b500]" />
                              {new Date(verse.created_at).toLocaleDateString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </span>

                            {onDeleteVerse && !isSelectMode && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmTarget({
                                    type: "verse",
                                    id: verse.id,
                                  });
                                }}
                                disabled={deletingVerseId === verse.id}
                                title="Remove verse from journal"
                                className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition rounded-md p-1.5 sm:p-1 text-[#6b7280] hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
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

              {isSelectMode && (
                <div className="flex items-center justify-between border-t border-[#e4e4e4] px-4 py-2.5 text-[11px] bg-white sm:px-6">
                  <span className="font-bold text-[#1a1a1a]">
                    {selectedIds.size} selected
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmTarget({ type: "bulk", kind: "verses" })
                    }
                    disabled={selectedIds.size === 0 || isBulkDeleting}
                    className="flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-40 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>
                      {isBulkDeleting ? "Deleting..." : "Delete Selected"}
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmTarget !== null}
        title={confirmCopy.title}
        message={confirmCopy.message}
        isProcessing={
          confirmTarget?.type === "bulk"
            ? isBulkDeleting
            : confirmTarget?.type === "prayer"
              ? deletingId !== null
              : deletingVerseId !== null
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
};
