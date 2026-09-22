"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  History,
  MessageSquare,
  Heart,
  PlusCircle,
  Calendar,
  Clock,
  Trash2,
  CheckCircle2,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import type { SessionWithStats } from "@/lib/db";

interface VisitHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}

export const VisitHistoryModal: React.FC<VisitHistoryModalProps> = ({
  isOpen,
  onClose,
  currentSessionId,
  onSelectSession,
  onNewSession,
}) => {
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        if (data.sessions) {
          setSessions(data.sessions);
        }
      }
    } catch (err) {
      console.error("Failed to load visit history:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this visit and its history?")) {
      return;
    }

    setDeletingId(sessionId);
    try {
      const res = await fetch(`/api/sessions?sessionId=${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (sessionId === currentSessionId) {
          onNewSession();
        }
      }
    } catch (err) {
      console.error("Failed to delete visit:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatVisitDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();

      const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

      if (isToday) return `Today at ${timeStr}`;
      if (isYesterday) return `Yesterday at ${timeStr}`;
      return `${date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} at ${timeStr}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-xs">
      <div className="flex h-[92dvh] sm:h-[85vh] w-full max-w-2xl flex-col rounded-t-3xl sm:rounded-2xl border border-stone-200 bg-[#faf8f5] shadow-2xl dark:border-stone-800 dark:bg-stone-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200/80 px-4 py-3.5 sm:px-5 sm:py-4 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-[#445942]/10 p-2 text-[#445942] dark:bg-[#5b7858]/20 dark:text-[#7ba277]">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-100">
                Pastoral Visit History
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Resume any past conversation and recall its dedicated prayers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onNewSession();
                onClose();
              }}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-2xs transition hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
            >
              <PlusCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>New Visit</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* List of Visits */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-stone-400">
              <Sparkles className="h-8 w-8 animate-spin text-[#445942] dark:text-[#7ba277] mb-2" />
              <p className="text-sm font-medium">Loading visit history...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-stone-400">
              <History className="h-10 w-10 text-stone-300 dark:text-stone-600 mb-3" />
              <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
                No previous visits recorded yet
              </p>
              <p className="text-xs mt-1 text-stone-500 max-w-sm">
                Each time you visit Pastor Mike, your conversation and prayer journal are saved here so you can return anytime.
              </p>
            </div>
          ) : (
            sessions.map((sess) => {
              const isActive = sess.id === currentSessionId;
              const hasMessages = sess.messageCount > 0;

              return (
                <div
                  key={sess.id}
                  onClick={() => {
                    onSelectSession(sess.id);
                    onClose();
                  }}
                  className={`group relative flex flex-col gap-2.5 rounded-xl border p-4 transition cursor-pointer ${
                    isActive
                      ? "border-emerald-500/60 bg-emerald-50/50 shadow-xs dark:border-emerald-700/60 dark:bg-emerald-950/30"
                      : "border-stone-200/80 bg-white/90 hover:border-stone-300 hover:bg-stone-50/80 dark:border-stone-800 dark:bg-stone-800/80 dark:hover:border-stone-700 dark:hover:bg-stone-750"
                  }`}
                >
                  {/* Top row: Date, Active badge, and Delete */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-900 dark:text-stone-100">
                        <Calendar className="h-3.5 w-3.5 text-stone-400" />
                        {formatVisitDate(sess.started_at)}
                      </span>

                      {isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Current Visit
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => handleDelete(e, sess.id)}
                      disabled={deletingId === sess.id}
                      title="Delete this visit"
                      className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 rounded-md p-1.5 sm:p-1 text-stone-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition"
                    >
                      <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    </button>
                  </div>

                  {/* Visit Summary / First Message Preview */}
                  <p className="text-xs text-stone-600 line-clamp-2 dark:text-stone-300">
                    {sess.summary || sess.firstMessagePreview ? (
                      sess.summary || `"${sess.firstMessagePreview}"`
                    ) : (
                      <span className="italic text-stone-400">Quiet visit without messages</span>
                    )}
                  </p>

                  {/* Bottom row: Statistics (Messages, Prayers) & Switch indicator */}
                  <div className="flex items-center justify-between pt-1 border-t border-stone-100 dark:border-stone-800/60">
                    <div className="flex items-center gap-3 text-[11px] text-stone-500 dark:text-stone-400">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {sess.messageCount} {sess.messageCount === 1 ? "message" : "messages"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3 text-rose-500" />
                        {sess.prayerCount} {sess.prayerCount === 1 ? "prayer" : "prayers"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-medium text-[#445942] group-hover:translate-x-0.5 transition-transform dark:text-[#7ba277]">
                      <span>{isActive ? "Viewing" : "Switch to Visit"}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-200/80 bg-stone-50/50 px-5 py-3 text-xs text-stone-500 dark:border-stone-800 dark:bg-stone-950/40 dark:text-stone-400">
          <span>{sessions.length} total visits recorded in local SQLite</span>
          <button
            onClick={onClose}
            className="rounded-lg border border-stone-300/80 bg-white px-3 py-1 font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
