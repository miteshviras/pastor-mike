"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  HeartHandshake,
  Volume2,
  Mic,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Play,
  Square,
  Sparkles,
  Download,
  Loader2,
  Check,
  ShieldCheck,
} from "lucide-react";
import { PastoralSpeechClient } from "@/lib/voice/speech-client";
import type { AiProviderSettings } from "@/lib/db";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (preferences: {
    name: string;
    topics: string[];
    enableVoice: boolean;
  }) => void;
  sessionId: string | null;
  // When set, renders only that one section — no top-level tabs, no step chrome — instead of
  // the full guided wizard. Used by the sidebar's settings popover so Settings/Profile/Test
  // Audio each open as their own focused view rather than being buried in the combined modal.
  singleView?: "settings" | "profile" | "test-audio";
  onProviderChange?: (provider: string) => void;
}

const SINGLE_VIEW_LABELS: Record<"settings" | "profile" | "test-audio", string> = {
  settings: "AI Reasoning Engine",
  profile: "Your name & care topics",
  "test-audio": "Test voice & microphone",
};

const CARE_TOPICS = [
  { id: "anxiety", label: "Anxiety & Peace" },
  { id: "guidance", label: "Guidance & Decisions" },
  { id: "grief", label: "Grief & Loss" },
  { id: "hope", label: "Hope in Trials" },
  { id: "forgiveness", label: "Forgiveness & Healing" },
  { id: "work", label: "Work & Rest" },
  { id: "family", label: "Family & Relationships" },
  { id: "gratitude", label: "Gratitude & Joy" },
];

const DEFAULT_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-pro-latest",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.0-flash",
  "gemma-4-26b-a4b-it",
  "gemma-4-31b-it",
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  sessionId: _sessionId,
  singleView,
  onProviderChange,
}) => {
  const [step, setStep] = useState<1 | 2>(1);

  // The top-level Setup Guide/Settings tab bar was removed (Settings/Profile/Test Audio are
  // now reached via the sidebar's settings popover instead) — "guide" is the only way this
  // component opens without singleView, so effectiveTopTab just picks between that and
  // singleView="settings". The step conditionals below stay as-is, just pointed at the
  // requested section in single-view mode, with the stepper chrome hidden around them.
  const effectiveTopTab = singleView === "settings" ? "settings" : "guide";
  const effectiveStep = singleView === "profile" ? 1 : singleView === "test-audio" ? 2 : step;

  // Step 1: Persona & Profile
  const [userName, setUserName] = useState<string>("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([
    "anxiety",
    "hope",
  ]);

  // Step 2: Audio (STT & TTS + KittenTTS Downloader)
  const [ttsStatus, setTtsStatus] = useState<{
    installed: boolean;
    engine?: string;
    has_local_model?: boolean;
    loading: boolean;
  }>({
    installed: false,
    loading: true,
  });
  const [isDownloadingTts, setIsDownloadingTts] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // STT Status & Model Downloader
  const [sttStatus, setSttStatus] = useState<{
    installed: boolean;
    engine?: string;
    has_local_model?: boolean;
    has_ffmpeg?: boolean;
    loading: boolean;
  }>({
    installed: false,
    loading: true,
  });
  const [isDownloadingStt, setIsDownloadingStt] = useState<boolean>(false);
  const [downloadSttSuccess, setDownloadSttSuccess] = useState<boolean>(false);
  const [activeSttEngine, setActiveSttEngine] = useState<string | null>(null);

  // Audio Testing States
  const [isPlayingBlessing, setIsPlayingBlessing] = useState<boolean>(false);
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false);
  const [micTranscript, setMicTranscript] = useState<string>("");
  const [micVerified, setMicVerified] = useState<boolean>(false);
  const [testSpeed, setTestSpeed] = useState<number>(0.88);
  const [autoVoiceMode, setAutoVoiceMode] = useState<boolean>(false);

  // Settings tab: AI provider selection
  const [providerSettings, setProviderSettings] = useState<AiProviderSettings>({
    provider: "gemini",
    geminiModel: "gemini-2.5-flash",
    ollamaModel: "llama3.2",
  });
  const [geminiModels, setGeminiModels] = useState<string[]>(DEFAULT_GEMINI_MODELS);
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

  const testSpeechClientRef = useRef<PastoralSpeechClient | null>(null);

  // Check KittenTTS and Moonshine STT status on mount or when opening
  useEffect(() => {
    if (!isOpen) return;

    async function checkStatus() {
      try {
        const [ttsRes, sttRes] = await Promise.allSettled([
          fetch("/api/tts"),
          fetch("/api/stt"),
        ]);
        if (ttsRes.status === "fulfilled" && ttsRes.value.ok) {
          const data = await ttsRes.value.json();
          setTtsStatus({
            installed: Boolean(data.installed || data.has_local_model),
            engine: data.engine || "Browser-WebSpeechFallback",
            has_local_model: data.has_local_model,
            loading: false,
          });
        } else {
          setTtsStatus({ installed: false, loading: false });
        }
        if (sttRes.status === "fulfilled" && sttRes.value.ok) {
          const data = await sttRes.value.json();
          setSttStatus({
            installed: Boolean(data.installed),
            engine: data.engine || "Browser-WebSpeechFallback",
            has_local_model: data.has_local_model,
            has_ffmpeg: data.has_ffmpeg,
            loading: false,
          });
        } else {
          setSttStatus({ installed: false, loading: false });
        }
      } catch {
        setTtsStatus({ installed: false, loading: false });
        setSttStatus({ installed: false, loading: false });
      }
    }
    checkStatus();
  }, [isOpen]);

  // Fetch AI provider settings whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.settings) setProviderSettings(data.settings);
        if (data.availability) setProviderAvailability(data.availability);
        if (Array.isArray(data.geminiModels) && data.geminiModels.length > 0) {
          setGeminiModels(data.geminiModels);
        }
      } catch {
        // Keep defaults
      }
    }
    loadSettings();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Fetch previously saved profile (name & care topics) whenever the modal opens, so
  // reopening Profile shows what was saved last time instead of always starting blank.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.profile?.name) setUserName(data.profile.name);
        if (data.profile?.topics?.length > 0) setSelectedTopics(data.profile.topics);
      } catch {
        // Keep defaults
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Clean up audio on unmount or close
  useEffect(() => {
    return () => {
      testSpeechClientRef.current?.stopSpeaking();
      testSpeechClientRef.current?.stopListening();
    };
  }, []);

  if (!isOpen) return null;

  const toggleTopic = (id: string) => {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

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

  // 1-Click Download KittenTTS
  const handleDownloadTts = async () => {
    setIsDownloadingTts(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download" }),
      });
      const data = await res.json();
      if (
        data.installed ||
        data.download_status === "success" ||
        data.has_local_model
      ) {
        setTtsStatus({
          installed: true,
          engine: "KittenTTS-Neural",
          has_local_model: true,
          loading: false,
        });
        setDownloadSuccess(true);
      }
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setIsDownloadingTts(false);
    }
  };

  // 1-Click Download Moonshine STT Model
  const handleDownloadStt = async () => {
    setIsDownloadingStt(true);
    try {
      const res = await fetch("/api/stt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download" }),
      });
      const data = await res.json();
      if (
        data.installed ||
        data.download_status === "success" ||
        data.has_local_model
      ) {
        setSttStatus({
          installed: true,
          engine: "Moonshine-STT",
          has_local_model: true,
          has_ffmpeg: true,
          loading: false,
        });
        setDownloadSttSuccess(true);
      }
    } catch (err) {
      console.error("STT download error:", err);
    } finally {
      setIsDownloadingStt(false);
    }
  };

  // Play Pastoral Blessing Test Audio
  const handlePlayBlessing = async () => {
    if (isPlayingBlessing) {
      testSpeechClientRef.current?.stopSpeaking();
      setIsPlayingBlessing(false);
      return;
    }

    setIsPlayingBlessing(true);
    const blessingText =
      "The Lord bless you and keep you; the Lord make his face shine upon you and be gracious to you. Welcome, beloved friend.";

    if (!testSpeechClientRef.current) {
      testSpeechClientRef.current = new PastoralSpeechClient({
        speed: testSpeed,
        onSpeakingStateChange: (speaking) => {
          setIsPlayingBlessing(speaking);
        },
      });
    } else {
      testSpeechClientRef.current.updateOptions({ speed: testSpeed });
    }

    await testSpeechClientRef.current.speakText(blessingText);
  };

  // Test STT Microphone
  const handleTestMic = () => {
    if (isTestingMic) {
      testSpeechClientRef.current?.stopListening();
      setIsTestingMic(false);
      return;
    }

    setMicTranscript("");
    setIsTestingMic(true);

    if (!testSpeechClientRef.current) {
      testSpeechClientRef.current = new PastoralSpeechClient({
        speed: testSpeed,
        onListeningStateChange: (listening) => setIsTestingMic(listening),
        onEngineChange: (engine) => {
          setActiveSttEngine(engine === "browser" ? "Browser Web Speech" : "Moonshine Local STT");
        },
        onTranscriptionResult: (transcript, isFinal) => {
          setMicTranscript(transcript);
          if (transcript.trim().length > 0) {
            setMicVerified(true);
          }
          if (isFinal) {
            setIsTestingMic(false);
          }
        },
        onError: () => {
          setIsTestingMic(false);
        },
      });
    } else {
      testSpeechClientRef.current.updateOptions({
        onListeningStateChange: (listening) => setIsTestingMic(listening),
        onEngineChange: (engine) => {
          setActiveSttEngine(engine === "browser" ? "Browser Web Speech" : "Moonshine Local STT");
        },
        onTranscriptionResult: (transcript, isFinal) => {
          setMicTranscript(transcript);
          if (transcript.trim().length > 0) {
            setMicVerified(true);
          }
          if (isFinal) {
            setIsTestingMic(false);
          }
        },
      });
    }

    testSpeechClientRef.current.startListening();
  };

  const handleFinish = async () => {
    testSpeechClientRef.current?.stopSpeaking();
    testSpeechClientRef.current?.stopListening();

    if (typeof window !== "undefined") {
      localStorage.setItem("pastor_mike_onboarded", "true");
    }

    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userName.trim() || "Friend",
          topics: selectedTopics,
        }),
      });
    } catch (err) {
      console.error("Failed to save profile:", err);
    }

    onComplete({
      name: userName.trim() || "Friend",
      topics: selectedTopics,
      enableVoice: autoVoiceMode,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-xs">
      <div className="flex max-h-[92dvh] sm:max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl sm:rounded-none border border-border-subtle bg-card shadow-elevated">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3.5 sm:px-6 sm:py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5266eb] text-white dark:bg-[#5266eb]">
              <span className="text-sm font-bold">M</span>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Pastor Mike
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {singleView ? SINGLE_VIEW_LABELS[singleView] : "Setup Guide & AI Settings"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {effectiveTopTab === "guide" ? (
          <>
            {/* Step Indicator — hidden in single-view mode, since only one section renders */}
            {!singleView && (
            <div className="mx-4 mt-3 flex gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-1 text-xs font-medium dark:border-slate-800 dark:bg-slate-950/20">
              <button
                onClick={() => setStep(1)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition ${
                  step === 1
                    ? "bg-card text-[#5266eb] font-semibold shadow-sm dark:bg-slate-800 dark:text-[#9cb4e8]"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] dark:bg-slate-800">
                  1
                </span>
                <span>Onboarding</span>
              </button>

              <button
                onClick={() => setStep(2)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition ${
                  step === 2
                    ? "bg-card text-[#5266eb] font-semibold shadow-sm dark:bg-slate-800 dark:text-[#9cb4e8]"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] dark:bg-slate-800">
                  2
                </span>
                <span>Test STT & TTS</span>
                {micVerified && (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
              </button>
            </div>
            )}

            {/* Modal Body Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* STEP 1: ONBOARDING */}
              {effectiveStep === 1 && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-slate-200 bg-card/70 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                    <div className="flex items-start gap-3">
                      <HeartHandshake className="mt-0.5 h-5 w-5 text-[#5266eb] dark:text-[#9cb4e8]" />
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Meet Pastor Mike
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          I am your AI pastoral companion. I offer empathetic
                          listening, Holy Scripture, and personalized prayer
                          for your daily walk.
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      <span>
                        <strong>Pastoral Disclaimer:</strong> Pastor Mike is
                        an artificial intelligence assistant, not an ordained
                        minister. All conversations and prayer requests
                        remain private on your device.
                      </span>
                    </div>
                  </div>

                  {/* Name input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      What name may I call you?
                    </label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="e.g. Sarah, David, or Friend (Optional)"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-card px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#5266eb] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-[#9cb4e8]"
                    />
                  </div>

                  {/* Spiritual Care Areas */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Select topics you are carrying on your heart:
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      This helps Pastor Mike bring appropriate scripture and
                      gentle prayers.
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {CARE_TOPICS.map((topic) => {
                        const isSelected = selectedTopics.includes(topic.id);
                        return (
                          <button
                            key={topic.id}
                            onClick={() => toggleTopic(topic.id)}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                              isSelected
                                ? "bg-[#5266eb] text-white dark:bg-[#5266eb]"
                                : "border border-slate-200 bg-card text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750"
                            }`}
                          >
                            {topic.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: TEST STT & TTS + KITTENTTS AUTO-DOWNLOAD */}
              {effectiveStep === 2 && (
                <div className="space-y-5">
                  {/* KittenTTS Engine Status Card & 1-Click Downloader */}
                  <div className="rounded-xl border border-slate-200 bg-card/70 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="rounded-lg bg-[#5266eb]/10 p-2 text-[#5266eb] dark:bg-[#5266eb]/20 dark:text-[#9cb4e8]">
                          <Volume2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            KittenTTS Voice Engine
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {ttsStatus.installed || downloadSuccess
                              ? "🟢 KittenTTS Neural Engine Installed & Ready"
                              : "⚪ Not Downloaded (Using browser voice fallback)"}
                          </p>
                        </div>
                      </div>

                      {/* If not installed, provide 1-click Download button */}
                      {!ttsStatus.installed && !downloadSuccess && (
                        <button
                          onClick={handleDownloadTts}
                          disabled={isDownloadingTts}
                          className="flex items-center gap-1.5 rounded-lg bg-[#5266eb] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#3f52c9] disabled:opacity-60 dark:bg-[#5266eb] dark:hover:bg-[#4d664a]"
                        >
                          {isDownloadingTts ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Downloading (~25MB)...</span>
                            </>
                          ) : (
                            <>
                              <Download className="h-3.5 w-3.5" />
                              <span>Start Download TTS</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {downloadSuccess && (
                      <div className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-[11px] text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        &check; KittenTTS model downloaded and configured! The
                        pastoral neural voice is now active.
                      </div>
                    )}
                  </div>

                  {/* TTS Speech Test */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          Test Text-to-Speech (TTS)
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Hear Pastor Mike speak a welcoming blessing
                        </p>
                      </div>

                      <button
                        onClick={handlePlayBlessing}
                        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                          isPlayingBlessing
                            ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                            : "border border-slate-300 bg-card text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {isPlayingBlessing ? (
                          <>
                            <Square className="h-3.5 w-3.5 fill-amber-700" />
                            <span>Stop Voice</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5 fill-[#5266eb] text-[#5266eb] dark:fill-[#9cb4e8] dark:text-[#9cb4e8]" />
                            <span>Play Blessing</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Speed selector */}
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Voice Pace:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {[0.82, 0.88, 1.0].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => setTestSpeed(rate)}
                            className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                              testSpeed === rate
                                ? "bg-[#5266eb] text-white dark:bg-[#5266eb]"
                                : "bg-slate-200/80 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {rate === 0.82
                              ? "Gentle (0.8x)"
                              : rate === 0.88
                                ? "Calm (0.9x)"
                                : "Standard (1.0x)"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* STT Microphone Test */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            Speech-to-Text (Browser STT + Moonshine Fallback)
                          </h4>
                          {sttStatus.has_local_model ? (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              Moonshine Ready
                            </span>
                          ) : (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              Browser Primary
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          Prioritizes browser voice recognition; falls back to Moonshine STT if offline or unsupported.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!sttStatus.has_local_model && (
                          <button
                            onClick={handleDownloadStt}
                            disabled={isDownloadingStt}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-card px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            title="Pre-download Moonshine ONNX model for offline speech recognition"
                          >
                            {isDownloadingStt ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#5266eb]" />
                                <span>Warming STT...</span>
                              </>
                            ) : downloadSttSuccess ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Ready</span>
                              </>
                            ) : (
                              <>
                                <Download className="h-3.5 w-3.5 text-[#5266eb]" />
                                <span>Pre-warm STT</span>
                              </>
                            )}
                          </button>
                        )}

                        <button
                          onClick={handleTestMic}
                          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                            isTestingMic
                              ? "animate-pulse bg-emerald-600 text-white"
                              : micVerified
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "border border-slate-300 bg-card text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {isTestingMic ? (
                            <>
                              <Mic className="h-3.5 w-3.5 animate-bounce" />
                              <span>Listening...</span>
                            </>
                          ) : micVerified ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              <span>Mic Verified</span>
                            </>
                          ) : (
                            <>
                              <Mic className="h-3.5 w-3.5" />
                              <span>Test Microphone</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {isTestingMic && (
                      <p className="mt-2 text-xs italic text-slate-600 dark:text-slate-400">
                        Speak now, e.g.: &ldquo;Hello Pastor Mike, thank you for listening.&rdquo;
                        {activeSttEngine && (
                          <span className="ml-2 font-medium text-[#5266eb] dark:text-[#9cb4e8]">
                            ({activeSttEngine})
                          </span>
                        )}
                      </p>
                    )}

                    {micTranscript && (
                      <div className="mt-2.5 rounded-lg bg-card p-2.5 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-500">
                            Heard:
                          </span>
                          {activeSttEngine && (
                            <span className="text-[10px] text-slate-400">
                              via {activeSttEngine}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-medium">&ldquo;{micTranscript}&rdquo;</p>
                      </div>
                    )}
                  </div>

                  {/* Automatic Voice Mode checkbox */}
                  <label className="flex cursor-pointer items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={autoVoiceMode}
                      onChange={(e) => setAutoVoiceMode(e.target.checked)}
                      className="rounded border-slate-300 text-[#5266eb] focus:ring-[#5266eb] dark:border-slate-700"
                    />
                    <span>
                      Enable Voice Mode automatically when starting my visits
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Footer Navigation Controls */}
            {singleView ? (
              <div className="flex items-center justify-end gap-2 border-t border-slate-200/80 bg-[#f7f4ed] px-6 py-4 dark:border-slate-800 dark:bg-[#181716]">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 bg-card px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  Close
                </button>
                {singleView === "profile" && (
                  <button
                    onClick={handleFinish}
                    className="flex items-center gap-1.5 rounded-lg bg-[#5266eb] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3f52c9] dark:bg-[#5266eb] dark:hover:bg-[#4d664a]"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Save Profile</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between border-t border-slate-200/80 bg-[#f7f4ed] px-6 py-4 dark:border-slate-800 dark:bg-[#181716]">
                {step > 1 ? (
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-card px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Previous</span>
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Skip Setup
                  </button>
                )}

                {step < 2 ? (
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 rounded-lg bg-[#5266eb] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#3f52c9] dark:bg-[#5266eb] dark:hover:bg-[#4d664a]"
                  >
                    <span>Continue</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleFinish}
                    className="flex items-center gap-1.5 rounded-lg bg-[#5266eb] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3f52c9] dark:bg-[#5266eb] dark:hover:bg-[#4d664a]"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span>Enter Sanctuary</span>
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* SETTINGS TAB: AI Reasoning Engine */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-600 leading-relaxed dark:text-slate-300">
                  Choose which engine generates Pastor Mike&apos;s replies.
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
                  <div className="ml-6 flex items-center gap-2 flex-wrap">
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
                      aria-label="Default Gemini Model"
                      className="rounded-lg border border-slate-200 bg-card px-2 py-1 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#5266eb]"
                    >
                      {Array.from(
                        new Set([
                          ...(providerSettings.geminiModel
                            ? [providerSettings.geminiModel]
                            : []),
                          ...geminiModels,
                        ])
                      ).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    {settingsSaved && (
                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        Default updated
                      </span>
                    )}
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

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-slate-200/80 bg-[#f7f4ed] px-6 py-4 dark:border-slate-800 dark:bg-[#181716]">
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-200 bg-card px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
