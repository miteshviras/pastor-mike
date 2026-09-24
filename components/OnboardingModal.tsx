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

const BLESSING_TEXT =
  "The Lord bless you and keep you; the Lord make his face shine upon you and be gracious to you. Welcome, beloved friend.";

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
  const [downloadingBlessing, setDownloadingBlessing] = useState<boolean>(false);
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

    await testSpeechClientRef.current.speakText(BLESSING_TEXT);
  };

  // Download the blessing test audio — reuses /api/tts directly rather than the speech
  // client, since this needs the raw WAV blob rather than playback.
  const handleDownloadBlessing = async () => {
    if (downloadingBlessing) return;
    setDownloadingBlessing(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: BLESSING_TEXT, voice: "Jasper", speed: testSpeed }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok || !contentType.includes("audio/wav")) {
        console.error("Blessing audio download unavailable: no local TTS engine produced audio.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pastor-mike-blessing.wav";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading blessing audio:", err);
    } finally {
      setDownloadingBlessing(false);
    }
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-xs">
      <div className="flex max-h-[92dvh] sm:max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl border border-[#e4e4e4] bg-white shadow-2xl text-[#1a1a1a]">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-[#e4e4e4] px-4 py-3.5 sm:px-6 sm:py-4 bg-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#77b500] text-white shadow-xs">
              <span className="text-sm font-bold">M</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1a1a1a]">
                Pastor Mike
              </h2>
              <p className="text-xs text-[#6b7280]">
                {singleView ? SINGLE_VIEW_LABELS[singleView] : "Setup Guide & AI Settings"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1a1a] transition cursor-pointer"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {effectiveTopTab === "guide" ? (
          <>
            {/* Step Indicator — hidden in single-view mode, since only one section renders */}
            {!singleView && (
            <div className="mx-4 mt-3 flex gap-1.5 rounded-xl border border-[#e4e4e4] bg-[#fbfbfd] p-1 text-xs font-semibold text-[#1a1a1a]">
              <button
                onClick={() => setStep(1)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition cursor-pointer ${
                  step === 1
                    ? "bg-white text-[#77b500] font-bold shadow-xs border border-[#e4e4e4]"
                    : "text-[#6b7280] hover:text-[#1a1a1a]"
                }`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                  step === 1 ? "bg-[#eef5dd] text-[#77b500]" : "bg-[#eeeeee] text-[#6b7280]"
                }`}>
                  1
                </span>
                <span>Onboarding</span>
              </button>

              <button
                onClick={() => setStep(2)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition cursor-pointer ${
                  step === 2
                    ? "bg-white text-[#77b500] font-bold shadow-xs border border-[#e4e4e4]"
                    : "text-[#6b7280] hover:text-[#1a1a1a]"
                }`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                  step === 2 ? "bg-[#eef5dd] text-[#77b500]" : "bg-[#eeeeee] text-[#6b7280]"
                }`}>
                  2
                </span>
                <span>Test STT & TTS</span>
                {micVerified && (
                  <Check className="h-3.5 w-3.5 text-[#77b500]" />
                )}
              </button>
            </div>
            )}

            {/* Modal Body Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-white space-y-5">
              {/* STEP 1: ONBOARDING */}
              {effectiveStep === 1 && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-[#e4e4e4] bg-[#fbfbfd] p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-[#eef5dd] p-2 text-[#77b500]">
                        <HeartHandshake className="h-5 w-5 text-[#77b500]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#1a1a1a]">
                          Meet Pastor Mike
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-[#6b7280]">
                          I am your AI pastoral companion. I offer empathetic
                          listening, Holy Scripture, and personalized prayer
                          for your daily walk.
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-900">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                      <span className="leading-relaxed">
                        <strong className="font-semibold text-amber-950">Pastoral Disclaimer:</strong> Pastor Mike is
                        an artificial intelligence assistant, not an ordained
                        minister. All conversations and prayer requests
                        remain private on your device.
                      </span>
                    </div>
                  </div>

                  {/* Name input */}
                  <div>
                    <label className="block text-xs font-bold text-[#1a1a1a]">
                      What name may I call you?
                    </label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="e.g. Sarah, David, or Friend (Optional)"
                      className="mt-1.5 w-full rounded-xl border border-[#e4e4e4] bg-white px-3.5 py-2.5 text-sm text-[#1a1a1a] placeholder-[#9ca3af] outline-none transition focus:border-[#77b500] focus:ring-2 focus:ring-[#77b500]/15"
                    />
                  </div>

                  {/* Spiritual Care Areas */}
                  <div>
                    <label className="block text-xs font-bold text-[#1a1a1a]">
                      Select topics you are carrying on your heart:
                    </label>
                    <p className="text-[11px] text-[#6b7280] mt-0.5">
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
                            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                              isSelected
                                ? "bg-[#77b500] text-white shadow-xs"
                                : "border border-[#e4e4e4] bg-white text-[#1a1a1a] hover:bg-[#f3f4f6] hover:border-slate-300"
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
                <div className="space-y-4">
                  {/* KittenTTS Engine Status Card & 1-Click Downloader */}
                  <div className="rounded-xl border border-[#e4e4e4] bg-[#fbfbfd] p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="rounded-lg bg-[#eef5dd] p-2 text-[#77b500]">
                          <Volume2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[#1a1a1a]">
                            KittenTTS Voice Engine
                          </h3>
                          <p className="text-xs text-[#6b7280]">
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
                          className="flex items-center gap-1.5 rounded-lg bg-[#77b500] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#659c00] disabled:opacity-60 cursor-pointer shadow-xs"
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
                      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-medium text-emerald-800">
                        &check; KittenTTS model downloaded and configured! The
                        pastoral neural voice is now active.
                      </div>
                    )}
                  </div>

                  {/* TTS Speech Test */}
                  <div className="rounded-xl border border-[#e4e4e4] bg-[#fbfbfd] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-[#1a1a1a]">
                          Test Text-to-Speech (TTS)
                        </h4>
                        <p className="text-[11px] text-[#6b7280]">
                          Hear Pastor Mike speak a welcoming blessing
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handlePlayBlessing}
                          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer shadow-xs ${
                            isPlayingBlessing
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : "bg-[#77b500] text-white hover:bg-[#659c00]"
                          }`}
                        >
                          {isPlayingBlessing ? (
                            <>
                              <Square className="h-3.5 w-3.5 fill-amber-700" />
                              <span>Stop Voice</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5 fill-white text-white" />
                              <span>Play Blessing</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={handleDownloadBlessing}
                          disabled={downloadingBlessing}
                          title="Download blessing audio"
                          className="flex items-center justify-center rounded-lg border border-[#e4e4e4] bg-white p-1.5 text-[#6b7280] transition hover:bg-[#f3f4f6] hover:text-[#1a1a1a] disabled:opacity-50 cursor-pointer"
                        >
                          <Download className={`h-3.5 w-3.5 ${downloadingBlessing ? "animate-pulse" : ""}`} />
                        </button>
                      </div>
                    </div>

                    {/* Speed selector */}
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-[11px] font-semibold text-[#6b7280]">
                        Voice Pace:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {[0.82, 0.88, 1.0].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => setTestSpeed(rate)}
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                              testSpeed === rate
                                ? "bg-[#77b500] text-white"
                                : "border border-[#e4e4e4] bg-white text-[#1a1a1a] hover:bg-[#f3f4f6]"
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
                  <div className="rounded-xl border border-[#e4e4e4] bg-[#fbfbfd] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-[#1a1a1a]">
                            Speech-to-Text (Browser STT + Moonshine Fallback)
                          </h4>
                          {sttStatus.has_local_model ? (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                              Moonshine Ready
                            </span>
                          ) : (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                              Browser Primary
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#6b7280]">
                          Prioritizes browser voice recognition; falls back to Moonshine STT if offline or unsupported.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!sttStatus.has_local_model && (
                          <button
                            onClick={handleDownloadStt}
                            disabled={isDownloadingStt}
                            className="flex items-center gap-1.5 rounded-lg border border-[#e4e4e4] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1a1a1a] hover:bg-[#f3f4f6] disabled:opacity-50 cursor-pointer shadow-xs"
                            title="Pre-download Moonshine ONNX model for offline speech recognition"
                          >
                            {isDownloadingStt ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#77b500]" />
                                <span>Warming STT...</span>
                              </>
                            ) : downloadSttSuccess ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-[#77b500]" />
                                <span>Ready</span>
                              </>
                            ) : (
                              <>
                                <Download className="h-3.5 w-3.5 text-[#77b500]" />
                                <span>Pre-warm STT</span>
                              </>
                            )}
                          </button>
                        )}

                        <button
                          onClick={handleTestMic}
                          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer shadow-xs ${
                            isTestingMic
                              ? "animate-pulse bg-emerald-600 text-white"
                              : micVerified
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "border border-[#e4e4e4] bg-white text-[#1a1a1a] hover:bg-[#f3f4f6]"
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
                              <Mic className="h-3.5 w-3.5 text-[#77b500]" />
                              <span>Test Microphone</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {isTestingMic && (
                      <p className="mt-2 text-xs italic text-[#77b500]">
                        Speak now, e.g.: &ldquo;Hello Pastor Mike, thank you for listening.&rdquo;
                        {activeSttEngine && (
                          <span className="ml-2 font-semibold text-[#77b500]">
                            ({activeSttEngine})
                          </span>
                        )}
                      </p>
                    )}

                    {micTranscript && (
                      <div className="mt-2.5 rounded-lg border border-[#e4e4e4] bg-white p-2.5 text-xs text-[#1a1a1a]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#6b7280]">
                            Heard:
                          </span>
                          {activeSttEngine && (
                            <span className="text-[10px] text-[#9ca3af]">
                              via {activeSttEngine}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-medium">&ldquo;{micTranscript}&rdquo;</p>
                      </div>
                    )}
                  </div>

                  {/* Automatic Voice Mode checkbox */}
                  <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-[#1a1a1a]">
                    <input
                      type="checkbox"
                      checked={autoVoiceMode}
                      onChange={(e) => setAutoVoiceMode(e.target.checked)}
                      className="rounded border-[#e4e4e4] text-[#77b500] focus:ring-[#77b500]"
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
              <div className="flex items-center justify-end gap-2 border-t border-[#e4e4e4] bg-[#fbfbfd] px-6 py-4">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-[#e4e4e4] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1a1a1a] hover:bg-[#f3f4f6] transition cursor-pointer shadow-xs"
                >
                  Close
                </button>
                {singleView === "profile" && (
                  <button
                    onClick={handleFinish}
                    className="flex items-center gap-1.5 rounded-lg bg-[#77b500] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#659c00] cursor-pointer shadow-xs"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Save Profile</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between border-t border-[#e4e4e4] bg-[#fbfbfd] px-6 py-4">
                {step > 1 ? (
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1 rounded-lg border border-[#e4e4e4] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1a1a1a] hover:bg-[#f3f4f6] transition cursor-pointer shadow-xs"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Previous</span>
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="text-xs font-medium text-[#6b7280] hover:text-[#1a1a1a] transition cursor-pointer"
                  >
                    Skip Setup
                  </button>
                )}

                {step < 2 ? (
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 rounded-lg bg-[#77b500] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#659c00] cursor-pointer shadow-xs"
                  >
                    <span>Continue</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleFinish}
                    className="flex items-center gap-1.5 rounded-lg bg-[#77b500] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#659c00] cursor-pointer shadow-xs"
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
            <div className="flex-1 overflow-y-auto p-6 bg-white space-y-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-[#6b7280] leading-relaxed">
                  Choose which engine generates Pastor Mike&apos;s replies.
                  Falls back to the offline engine automatically if the
                  selected one is unavailable for a given message.
                </p>
                {settingsSaved && (
                  <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#77b500]">
                    <Check className="h-3 w-3" /> Saved
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {/* Gemini */}
                <button
                  onClick={() =>
                    handleSaveProviderSettings({ provider: "gemini" })
                  }
                  disabled={isSavingSettings}
                  className={`w-full rounded-xl border p-4 text-left text-xs transition cursor-pointer ${
                    providerSettings.provider === "gemini"
                      ? "border-2 border-[#77b500] bg-[#eef5dd]/40 shadow-xs"
                      : "border-[#e4e4e4] bg-[#fbfbfd] hover:border-[#b5dd66] hover:bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      className={`h-4 w-4 shrink-0 mt-0.5 ${providerSettings.provider === "gemini" ? "text-[#77b500]" : "text-[#d1d5db]"}`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1a1a1a] text-sm">
                          Google Gemini (Default)
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${providerAvailability.gemini ? "bg-[#eef5dd] text-[#77b500] border border-[#b5dd66]/40" : "bg-amber-100 text-amber-800"}`}
                        >
                          {providerAvailability.gemini
                            ? "Configured"
                            : "No API key set"}
                        </span>
                      </div>
                      <p className="text-[#6b7280] mt-1 text-xs">
                        Cloud model. Requires <code>GEMINI_API_KEY</code> in{" "}
                        <code>.env</code>.
                      </p>
                    </div>
                  </div>
                </button>

                {providerSettings.provider === "gemini" && (
                  <div className="ml-7 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-[#6b7280]">
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
                      className="rounded-lg border border-[#e4e4e4] bg-white px-2.5 py-1 text-xs font-semibold text-[#1a1a1a] focus:border-[#77b500] focus:outline-none focus:ring-1 focus:ring-[#77b500]"
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
                      <span className="text-[10px] font-bold text-[#77b500]">
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
                  className={`w-full rounded-xl border p-4 text-left text-xs transition cursor-pointer ${
                    providerSettings.provider === "ollama"
                      ? "border-2 border-[#77b500] bg-[#eef5dd]/40 shadow-xs"
                      : "border-[#e4e4e4] bg-[#fbfbfd] hover:border-[#b5dd66] hover:bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      className={`h-4 w-4 shrink-0 mt-0.5 ${providerSettings.provider === "ollama" ? "text-[#77b500]" : "text-[#d1d5db]"}`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1a1a1a] text-sm">
                          Local Ollama
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${providerAvailability.ollama ? "bg-[#eef5dd] text-[#77b500] border border-[#b5dd66]/40" : "bg-amber-100 text-amber-800"}`}
                        >
                          {providerAvailability.ollama
                            ? "Reachable"
                            : "Not running"}
                        </span>
                      </div>
                      <p className="text-[#6b7280] mt-1 text-xs">
                        Free, fully local. Requires{" "}
                        <code>ollama run &lt;model&gt;</code> at{" "}
                        <code>http://127.0.0.1:11434</code>.
                      </p>
                    </div>
                  </div>
                </button>

                {providerSettings.provider === "ollama" && (
                  <div className="ml-7 flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#6b7280]">
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
                      className="rounded-lg border border-[#e4e4e4] bg-white px-2.5 py-1 text-xs text-[#1a1a1a] focus:border-[#77b500] focus:outline-none"
                    />
                  </div>
                )}

                {/* Offline */}
                <button
                  onClick={() =>
                    handleSaveProviderSettings({ provider: "offline" })
                  }
                  disabled={isSavingSettings}
                  className={`w-full rounded-xl border p-4 text-left text-xs transition cursor-pointer ${
                    providerSettings.provider === "offline"
                      ? "border-2 border-[#77b500] bg-[#eef5dd]/40 shadow-xs"
                      : "border-[#e4e4e4] bg-[#fbfbfd] hover:border-[#b5dd66] hover:bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      className={`h-4 w-4 shrink-0 mt-0.5 ${providerSettings.provider === "offline" ? "text-[#77b500]" : "text-[#d1d5db]"}`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1a1a1a] text-sm">
                          Offline Pastoral Engine
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Always ready
                        </span>
                      </div>
                      <p className="text-[#6b7280] mt-1 text-xs">
                        Zero external calls, zero cost. Tailored empathy +
                        prayer generated locally from your message.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-[#e4e4e4] bg-[#fbfbfd] px-6 py-4">
              <button
                onClick={onClose}
                className="rounded-lg border border-[#e4e4e4] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1a1a1a] hover:bg-[#f3f4f6] transition cursor-pointer shadow-xs"
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
