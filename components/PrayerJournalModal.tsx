"use client";

import React, { useState } from "react";
import { X, BookOpen, CheckCircle, Clock, Plus, Sparkles } from "lucide-react";
import { PrayerRequest } from "@/lib/db";

interface PrayerJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  prayers: PrayerRequest[];
  onToggleStatus: (prayerId: string, currentStatus: "active" | "answered") => Promise<void>;
  onAddPrayer: (text: string) => Promise<void>;
}

export const PrayerJournalModal: React.FC<PrayerJournalModalProps> = ({
  isOpen,
  onClose,
  prayers,
  onToggleStatus,
  onAddPrayer,
}) => {
  const [filter, setFilter] = useState<"all" | "active" | "answered">("all");
  const [newPrayerText, setNewPrayerText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const filteredPrayers = prayers.filter((p) => {
    if (filter === "active") return p.status === "active";
    if (filter === "answered") return p.status === "answered";
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrayerText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await onAddPrayer(newPrayerText.trim());
    setNewPrayerText("");
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="flex h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-stone-200 bg-[#faf8f5] shadow-2xl dark:border-stone-800 dark:bg-stone-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200/80 px-5 py-4 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-[#445942]/10 p-2 text-[#445942] dark:bg-[#5b7858]/20 dark:text-[#7ba277]">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-100">
                Personal Prayer Journal
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Private petitions and answered prayers stored in SQLite
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between border-b border-stone-200/60 bg-stone-50/50 px-5 py-2.5 dark:border-stone-800/60 dark:bg-stone-950/30">
          <div className="flex gap-1.5">
            {(["all", "active", "answered"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition ${
                  filter === tab
                    ? "bg-[#445942] text-white dark:bg-[#5b7858]"
                    : "text-stone-600 hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-stone-800"
                }`}
              >
                {tab} ({prayers.filter(p => tab === "all" ? true : p.status === tab).length})
              </button>
            ))}
          </div>

          <span className="text-[11px] text-stone-400">Click circle to mark answered</span>
        </div>

        {/* Prayer List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {filteredPrayers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-stone-400">
              <Sparkles className="h-8 w-8 text-stone-300 dark:text-stone-600 mb-2" />
              <p className="text-sm font-medium">No prayers found in this view</p>
              <p className="text-xs mt-1">Prayers mentioned during your conversation will appear here.</p>
            </div>
          ) : (
            filteredPrayers.map((prayer) => {
              const isAnswered = prayer.status === "answered";
              return (
                <div
                  key={prayer.id}
                  className={`group flex items-start gap-3 rounded-xl border p-4 transition shadow-2xs ${
                    isAnswered
                      ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/40"
                      : "border-stone-200/90 bg-white dark:border-stone-800 dark:bg-stone-800/90"
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
                      <div className="h-5 w-5 rounded-full border-2 border-stone-300 hover:border-[#445942] dark:border-stone-600" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm leading-relaxed ${
                        isAnswered
                          ? "text-stone-500 line-through dark:text-stone-400"
                          : "text-stone-800 dark:text-stone-200"
                      }`}
                    >
                      {prayer.request_text}
                    </p>

                    <div className="mt-2 flex items-center gap-3 text-[11px] text-stone-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(prayer.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
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
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add Prayer Form */}
        <form onSubmit={handleCreate} className="border-t border-stone-200/80 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
          <div className="flex gap-2">
            <input
              type="text"
              value={newPrayerText}
              onChange={(e) => setNewPrayerText(e.target.value)}
              placeholder="Add a new prayer to hold in your heart..."
              disabled={isSubmitting}
              className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-hidden dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
            />
            <button
              type="submit"
              disabled={!newPrayerText.trim() || isSubmitting}
              className="flex items-center gap-1 rounded-xl bg-[#445942] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#384a36] disabled:opacity-50 dark:bg-[#5b7858]"
            >
              <Plus className="h-4 w-4" />
              <span>Add</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
