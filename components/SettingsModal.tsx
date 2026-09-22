"use client";

import React, { useState, useEffect } from "react";
import { X, Cpu, Check, CheckCircle2 } from "lucide-react";
import type { AiProviderSettings } from "@/lib/db";

const GEMINI_MODEL_OPTIONS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProviderChange?: (provider: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onProviderChange,
}) => {
  const [providerSettings, setProviderSettings] = useState<AiProviderSettings>({
    provider: "gemini",
    geminiModel: "gemini-2.5-flash",
    ollamaModel: "llama3.2",
  });
  const [providerAvailability, setProviderAvailability] = useState<{
    gemini: boolean;
    ollama: boolean;
    offline: boolean;
  }>({
    gemini: false,
    ollama: false,
    offline: true,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Fetch the current AI provider settings whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.settings) setProviderSettings(data.settings);
        if (data.availability) setProviderAvailability(data.availability);
      } catch {
        // Keep defaults
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveProviderSettings = async (
    update: Partial<AiProviderSettings>,
  ) => {
    const next = { ...providerSettings, ...update };
    setProviderSettings(next);
    setIsSavingSettings(true);
    setSettingsSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setProviderSettings(data.settings);
          if (update.provider) onProviderChange?.(data.settings.provider);
        }
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2000);
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-xs">
      <div className="flex h-[92dvh] sm:h-auto sm:max-h-[85vh] w-full max-w-xl flex-col rounded-t-3xl sm:rounded-none border border-border-subtle bg-card shadow-elevated">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3.5 sm:px-5 sm:py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-[#5266eb]/10 p-2 text-[#5266eb] dark:bg-[#5266eb]/20 dark:text-[#9cb4e8]">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                AI Reasoning Engine
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose which engine generates Pastor Mike&apos;s replies
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-card p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-600 leading-relaxed dark:text-slate-300">
                  Falls back to the offline engine automatically if the
                  selected one is unavailable for a given message.
                </p>
                {settingsSaved && (
                  <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    <Check className="h-3 w-3" /> Saved
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {/* Gemini */}
                <button
                  onClick={() =>
                    handleSaveProviderSettings({ provider: "gemini" })
                  }
                  disabled={isSavingSettings}
                  className={`w-full rounded-lg border p-3 text-left text-xs transition ${
                    providerSettings.provider === "gemini"
                      ? "border-emerald-400/80 bg-emerald-50/60 dark:border-emerald-700/60 dark:bg-emerald-950/30"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className={`h-4 w-4 shrink-0 mt-0.5 ${providerSettings.provider === "gemini" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600"}`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          Google Gemini (Default)
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${providerAvailability.gemini ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}
                        >
                          {providerAvailability.gemini
                            ? "Configured"
                            : "No API key set"}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                        Cloud model. Requires <code>GEMINI_API_KEY</code> in{" "}
                        <code>.env</code>.
                      </p>
                    </div>
                  </div>
                </button>

                {providerSettings.provider === "gemini" && (
                  <div className="ml-6 flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Model:
                    </span>
                    <select
                      value={providerSettings.geminiModel}
                      onChange={(e) =>
                        handleSaveProviderSettings({
                          geminiModel: e.target.value,
                        })
                      }
                      disabled={isSavingSettings}
                      className="rounded-lg border border-slate-200 bg-card px-2 py-1 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      {GEMINI_MODEL_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Ollama */}
                <button
                  onClick={() =>
                    handleSaveProviderSettings({ provider: "ollama" })
                  }
                  disabled={isSavingSettings}
                  className={`w-full rounded-lg border p-3 text-left text-xs transition ${
                    providerSettings.provider === "ollama"
                      ? "border-emerald-400/80 bg-emerald-50/60 dark:border-emerald-700/60 dark:bg-emerald-950/30"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className={`h-4 w-4 shrink-0 mt-0.5 ${providerSettings.provider === "ollama" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600"}`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          Local Ollama
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${providerAvailability.ollama ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}
                        >
                          {providerAvailability.ollama
                            ? "Reachable"
                            : "Not running"}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                        Free, fully local. Requires{" "}
                        <code>ollama run &lt;model&gt;</code> at{" "}
                        <code>http://127.0.0.1:11434</code>.
                      </p>
                    </div>
                  </div>
                </button>

                {providerSettings.provider === "ollama" && (
                  <div className="ml-6 flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Model:
                    </span>
                    <input
                      type="text"
                      value={providerSettings.ollamaModel}
                      onChange={(e) =>
                        setProviderSettings((p) => ({
                          ...p,
                          ollamaModel: e.target.value,
                        }))
                      }
                      onBlur={(e) =>
                        handleSaveProviderSettings({
                          ollamaModel: e.target.value,
                        })
                      }
                      placeholder="llama3.2"
                      disabled={isSavingSettings}
                      className="rounded-lg border border-slate-200 bg-card px-2 py-1 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    />
                  </div>
                )}

                {/* Offline */}
                <button
                  onClick={() =>
                    handleSaveProviderSettings({ provider: "offline" })
                  }
                  disabled={isSavingSettings}
                  className={`w-full rounded-lg border p-3 text-left text-xs transition ${
                    providerSettings.provider === "offline"
                      ? "border-emerald-400/80 bg-emerald-50/60 dark:border-emerald-700/60 dark:bg-emerald-950/30"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className={`h-4 w-4 shrink-0 mt-0.5 ${providerSettings.provider === "offline" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600"}`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          Offline Pastoral Engine
                        </span>
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Always ready
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                        Zero external calls, zero cost. Tailored empathy +
                        prayer generated locally from your message.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
