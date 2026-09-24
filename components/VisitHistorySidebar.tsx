"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  History,
  MessageSquare,
  Heart,
  Plus,
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
  refreshKey?: number;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenTestAudio: () => void;
  isVoiceMode?: boolean;
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
  isVoiceMode = false,
}) => {
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Close the settings popover when clicking outside
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
      console.error("Failed to delete session:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelected = (sessionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
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
        `Are you sure you want to delete ${selectedIds.size} selected visit${selectedIds.size > 1 ? "s" : ""}?`,
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
      console.error("Failed to delete selected visits:", err);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const panelContent = (closeOnAction: boolean) => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e4e4e4] px-4 py-3.5 bg-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="rounded-lg bg-[#eef5dd] p-2 text-[#77b500] shrink-0 border border-[#b5dd66]/40">
            <History className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-[#1a1a1a] truncate">
              Visit History
            </h2>
            <p className="text-[11px] font-medium text-[#6b7280] truncate">
              Resume past visits & prayers
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="md:hidden rounded-lg p-1.5 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1a1a] shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between gap-2 border-b border-[#e4e4e4] px-4 py-2.5 bg-[#fbfbfd]">
        <button
          onClick={() => {
            onNewSession();
            if (closeOnAction) onClose();
          }}
          className="flex items-center gap-1.5 rounded-lg bg-[#77b500] hover:bg-[#659c00] px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs transition cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Visit</span>
        </button>

        {sessions.length > 0 && (
          <button
            onClick={() =>
              isSelectMode ? exitSelectMode() : setIsSelectMode(true)
            }
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
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

      {/* List of Visits */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[#fbfbfd]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-[#6b7280]">
            <Sparkles className="h-7 w-7 animate-spin text-[#77b500] mb-2" />
            <p className="text-xs font-semibold">Loading visits...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-[#6b7280] px-2">
            <History className="h-9 w-9 text-[#d1d5db] mb-3" />
            <p className="text-xs font-bold text-[#1a1a1a]">
              No previous visits recorded yet
            </p>
            <p className="text-[11px] mt-1 text-[#6b7280]">
              Each conversation and prayer is safely kept here for you.
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
                    ? "border-[#77b500] bg-[#eef5dd]/70 shadow-xs"
                    : isActive
                      ? "border-[#b5dd66] bg-[#eef5dd]/40 shadow-xs"
                      : "border-[#e4e4e4] bg-white hover:border-[#77b500] hover:shadow-xs"
                }`}
              >
                {/* Top row: Date, Active badge, and Delete */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isSelectMode && (
                      <span className="shrink-0 text-[#77b500]">
                        {isSelected ? (
                          <CheckSquare className="h-3.5 w-3.5" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-[#9ca3af]" />
                        )}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] font-bold text-[#1a1a1a] truncate">
                      <Calendar className="h-3 w-3 text-[#77b500] shrink-0" />
                      {formatVisitDate(sess.started_at)}
                    </span>
                  </div>

                  {!isSelectMode && (
                    <button
                      onClick={(e) => handleDelete(e, sess.id)}
                      disabled={deletingId === sess.id}
                      title="Delete this visit"
                      className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 rounded-md p-1 text-[#6b7280] hover:bg-rose-50 hover:text-rose-600 transition shrink-0 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {isActive && !isSelectMode && (
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#eef5dd] border border-[#b5dd66] px-2 py-0.5 text-[10px] font-bold text-[#4f7a00]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#77b500] animate-pulse" />
                    Current Visit
                  </span>
                )}

                {/* Visit Summary */}
                <p className="text-[11px] text-[#4b5563] line-clamp-2 leading-relaxed">
                  {sess.summary || sess.firstMessagePreview ? (
                    sess.summary || `"${sess.firstMessagePreview}"`
                  ) : (
                    <span className="italic text-[#9ca3af]">
                      Quiet visit without messages
                    </span>
                  )}
                </p>

                {/* Bottom row: Statistics & Switch indicator */}
                <div className="flex items-center justify-between pt-1 border-t border-[#eeeeee]">
                  <div className="flex items-center gap-2.5 text-[10px] font-medium text-[#6b7280]">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {sess.messageCount}
                    </span>
                    <span className="flex items-center gap-1 text-[#77b500]">
                      <Heart className="h-3 w-3 fill-current" />
                      {sess.prayerCount}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 text-[10px] font-bold text-[#77b500] group-hover:translate-x-0.5 transition-transform">
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
        <div className="flex items-center justify-between border-t border-[#e4e4e4] px-4 py-2.5 text-[11px] bg-white">
          <span className="font-bold text-[#1a1a1a]">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={selectedIds.size === 0 || isBulkDeleting}
            className="flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-40 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{isBulkDeleting ? "Deleting..." : "Delete Selected"}</span>
          </button>
        </div>
      ) : (
        <div className="relative flex items-center justify-between border-t border-[#e4e4e4] px-4 py-2.5 bg-white">
          <span className="text-[10px] font-medium text-[#6b7280]">
            {sessions.length} total visits preserved in local SQLite
          </span>

          <div ref={settingsMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsSettingsMenuOpen((v) => !v)}
              title="Settings, profile & audio testing"
              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition cursor-pointer ${
                isSettingsMenuOpen
                  ? "border-[#77b500] bg-[#eef5dd] text-[#4f7a00]"
                  : "border-[#e4e4e4] text-[#6b7280] hover:border-[#77b500] hover:text-[#77b500] bg-white"
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
            </button>

            {isSettingsMenuOpen && (
              <div className="absolute bottom-full right-0 z-20 mb-2 w-48 rounded-xl border border-[#e4e4e4] bg-white p-1.5 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsMenuOpen(false);
                    onOpenSettings();
                    if (closeOnAction) onClose();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#1a1a1a] transition hover:bg-[#eef5dd] hover:text-[#4f7a00] cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5 text-[#77b500]" />
                  <span>Settings</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsMenuOpen(false);
                    onOpenProfile();
                    if (closeOnAction) onClose();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#1a1a1a] transition hover:bg-[#eef5dd] hover:text-[#4f7a00] cursor-pointer"
                >
                  <UserCircle className="h-3.5 w-3.5 text-[#77b500]" />
                  <span>Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsMenuOpen(false);
                    onOpenTestAudio();
                    if (closeOnAction) onClose();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#1a1a1a] transition hover:bg-[#eef5dd] hover:text-[#4f7a00] cursor-pointer"
                >
                  <Volume2 className="h-3.5 w-3.5 text-[#77b500]" />
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
      {/* Drawer overlay for viewing full visit history */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          <div className="fixed inset-y-0 left-0 z-10 flex h-full w-[85%] max-w-sm flex-col bg-white shadow-2xl border-r border-[#ECE8E2]">
            {panelContent(true)}
          </div>
        </div>
      )}
    </>
  );
};
