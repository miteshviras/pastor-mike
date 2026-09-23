"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  History,
  MessageSquare,
  Heart,
  PlusCircle,
  Calendar,
  Trash2,
  ChevronRight,
  Sparkles,
  ListChecks,
  Square,
  CheckSquare,
  Settings,
  UserCircle,
  Volume2,
} from "lucide-react";
import type { SessionWithStats } from "@/lib/db";

interface VisitHistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId: string | null;
  // Bumped by the parent whenever this visit's data changes (message sent, prayer saved) —
  // see the effect below for why isOpen alone isn't enough to keep this list fresh.
  refreshKey?: number;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenTestAudio: () => void;
}

function formatVisitDate(isoString: string) {
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

    const timeStr = date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    if (isToday) return `Today at ${timeStr}`;
    if (isYesterday) return `Yesterday at ${timeStr}`;
    return `${date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} at ${timeStr}`;
  } catch {
    return isoString;
  }
}

export const VisitHistorySidebar: React.FC<VisitHistorySidebarProps> = ({
  isOpen,
  onClose,
  currentSessionId,
  refreshKey,
  onSelectSession,
  onNewSession,
  onOpenSettings,
  onOpenProfile,
  onOpenTestAudio,
}) => {
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Close the settings popover when clicking outside it — mirrors Header's mobile dropdown.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        settingsMenuRef.current &&
        !settingsMenuRef.current.contains(event.target as Node)
      ) {
        setIsSettingsMenuOpen(false);
      }
    }
    if (isSettingsMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSettingsMenuOpen]);

  // The sidebar is always mounted on desktop (isOpen only controls the separate mobile drawer,
  // via `hidden md:flex` — it doesn't gate whether this component itself is in the DOM), so
  // isOpen alone doesn't fire a refetch when new messages/visits show up during normal use.
  // currentSessionId covers new/switched visits; refreshKey (bumped by the parent on every
  // sent message and saved prayer) covers this visit's own stats/summary changing in place.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/sessions");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.sessions && !cancelled) setSessions(data.sessions);
      } catch (err) {
        console.error("Failed to load visit history:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, currentSessionId, refreshKey]);

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (
      !window.confirm(
        "Are you sure you want to delete this visit and its history?",
      )
    ) {
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

  const toggleSelected = (sessionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (
      !window.confirm(
        `Delete ${selectedIds.size} visit${selectedIds.size === 1 ? "" : "s"} and their history? This cannot be undone.`,
      )
    ) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/sessions?sessionId=${id}`, { method: "DELETE" }),
        ),
      );
      setSessions((prev) => prev.filter((s) => !selectedIds.has(s.id)));
      if (currentSessionId && selectedIds.has(currentSessionId)) {
        onNewSession();
      }
      exitSelectMode();
    } catch (err) {
      console.error("Failed to bulk delete visits:", err);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const panelContent = (closeOnAction: boolean) => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="rounded-lg bg-[#5266eb]/10 p-2 text-[#5266eb] dark:bg-[#5266eb]/20 dark:text-[#9cb4e8] shrink-0">
            <History className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              Pastoral Visit History
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Resume a past visit anytime
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="md:hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-2.5">
        <button
          onClick={() => {
            onNewSession();
            if (closeOnAction) onClose();
          }}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
        >
          <PlusCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>New Visit</span>
        </button>

        {sessions.length > 0 && (
          <button
            onClick={() =>
              isSelectMode ? exitSelectMode() : setIsSelectMode(true)
            }
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
              isSelectMode
                ? "border-[#5266eb]/40 bg-[#5266eb]/10 text-[#5266eb]"
                : "border-slate-200/80 bg-card text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            <ListChecks className="h-3.5 w-3.5" />
            <span>{isSelectMode ? "Cancel" : "Select"}</span>
          </button>
        )}
      </div>

      {/* List of Visits */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <Sparkles className="h-7 w-7 animate-spin text-[#5266eb] dark:text-[#9cb4e8] mb-2" />
            <p className="text-xs font-medium">Loading visit history...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 px-2">
            <History className="h-9 w-9 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              No previous visits recorded yet
            </p>
            <p className="text-[11px] mt-1 text-slate-500">
              Each visit and its prayers are saved here so you can return
              anytime.
            </p>
          </div>
        ) : (
          sessions.map((sess) => {
            const isActive = sess.id === currentSessionId;
            const isSelected = selectedIds.has(sess.id);

            return (
              <div
                key={sess.id}
                onClick={() => {
                  if (isSelectMode) {
                    toggleSelected(sess.id);
                  } else {
                    onSelectSession(sess.id);
                    if (closeOnAction) onClose();
                  }
                }}
                className={`group relative flex flex-col gap-2 rounded-xl border p-3 transition cursor-pointer ${
                  isSelected
                    ? "border-[#5266eb]/60 bg-[#5266eb]/10"
                    : isActive
                      ? "border-emerald-500/60 bg-emerald-50/50 dark:border-emerald-700/60 dark:bg-emerald-950/30"
                      : "border-slate-200/80 bg-card/90 hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/80 dark:hover:border-slate-700 dark:hover:bg-slate-750"
                }`}
              >
                {/* Top row: Date, Active badge, and Delete */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isSelectMode && (
                      <span className="shrink-0 text-[#5266eb]">
                        {isSelected ? (
                          <CheckSquare className="h-3.5 w-3.5" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                      <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                      {formatVisitDate(sess.started_at)}
                    </span>
                  </div>

                  {!isSelectMode && (
                    <button
                      onClick={(e) => handleDelete(e, sess.id)}
                      disabled={deletingId === sess.id}
                      title="Delete this visit"
                      className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {isActive && !isSelectMode && (
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Current Visit
                  </span>
                )}

                {/* Visit Summary / First Message Preview */}
                <p className="text-[11px] text-slate-600 line-clamp-2 dark:text-slate-300">
                  {sess.summary || sess.firstMessagePreview ? (
                    sess.summary || `"${sess.firstMessagePreview}"`
                  ) : (
                    <span className="italic text-slate-400">
                      Quiet visit without messages
                    </span>
                  )}
                </p>

                {/* Bottom row: Statistics & Switch indicator */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-2.5 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {sess.messageCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3 text-rose-500" />
                      {sess.prayerCount}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 text-[10px] font-medium text-[#5266eb] group-hover:translate-x-0.5 transition-transform dark:text-[#9cb4e8]">
                    <span>
                      {isSelectMode
                        ? isSelected
                          ? "Selected"
                          : "Select"
                        : isActive
                          ? "Viewing"
                          : "Switch"}
                    </span>
                    {!isSelectMode && <ChevronRight className="h-3 w-3" />}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {isSelectMode ? (
        <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2.5 text-[11px]">
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={selectedIds.size === 0 || isBulkDeleting}
            className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 font-medium text-rose-600 transition hover:bg-rose-500/20 disabled:opacity-40 disabled:hover:bg-rose-500/10 dark:text-rose-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{isBulkDeleting ? "Deleting..." : "Delete Selected"}</span>
          </button>
        </div>
      ) : (
        <div className="relative flex items-center justify-between border-t border-border-subtle px-4 py-2.5">
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {sessions.length} total visits recorded in local SQLite
          </span>

          <div ref={settingsMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsSettingsMenuOpen((v) => !v)}
              title="Settings, profile & audio testing"
              className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${
                isSettingsMenuOpen
                  ? "border-[#5266eb]/40 bg-[#5266eb]/10 text-[#5266eb] dark:text-[#9cb4e8]"
                  : "border-slate-200/80 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
            </button>

            {isSettingsMenuOpen && (
              <div className="absolute bottom-full right-0 z-20 mb-2 w-48 rounded-xl border border-border-subtle bg-card p-1.5 shadow-elevated">
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsMenuOpen(false);
                    onOpenSettings();
                    if (closeOnAction) onClose();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-card-foreground transition hover:bg-accent"
                >
                  <Settings className="h-3.5 w-3.5 text-[#5266eb]" />
                  <span>Settings</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsMenuOpen(false);
                    onOpenProfile();
                    if (closeOnAction) onClose();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-card-foreground transition hover:bg-accent"
                >
                  <UserCircle className="h-3.5 w-3.5 text-[#5266eb]" />
                  <span>Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsMenuOpen(false);
                    onOpenTestAudio();
                    if (closeOnAction) onClose();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-card-foreground transition hover:bg-accent"
                >
                  <Volume2 className="h-3.5 w-3.5 text-[#5266eb]" />
                  <span>Test TTS &amp; STT</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Persistent desktop sidebar — always visible, part of the layout */}
      <aside className="hidden md:flex md:w-72 lg:w-80 flex-col border-r border-border-subtle bg-card shrink-0">
        {panelContent(false)}
      </aside>

      {/* Mobile off-canvas drawer, toggled from the header */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onClose}
          />
          <div className="fixed inset-y-0 left-0 z-10 flex h-full w-[85%] max-w-sm flex-col bg-card shadow-elevated">
            {panelContent(true)}
          </div>
        </div>
      )}
    </>
  );
};
