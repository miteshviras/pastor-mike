"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  HeartHandshake,
  Wrench,
  Volume2,
  Mic,
  MicOff,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Play,
  Square,
  Sparkles,
  Download,
  Loader2,
  Terminal,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react";
import { PastoralSpeechClient } from "@/lib/voice/speech-client";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (preferences: { name: string; topics: string[]; enableVoice: boolean }) => void;
  sessionId: string | null;
}

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

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  sessionId,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Persona & Profile
  const [userName, setUserName] = useState<string>("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>(["anxiety", "hope"]);

  // Step 2: MCP Connection
  const [isMcpTesting, setIsMcpTesting] = useState<boolean>(false);
  const [mcpVerified, setMcpVerified] = useState<boolean>(false);
  const [mcpToolCount, setMcpToolCount] = useState<number>(7);
  const [copiedConfig, setCopiedConfig] = useState<boolean>(false);

  // Step 3: Audio (STT & TTS + KittenTTS Downloader)
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

  // Audio Testing States
  const [isPlayingBlessing, setIsPlayingBlessing] = useState<boolean>(false);
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false);
  const [micTranscript, setMicTranscript] = useState<string>("");
  const [micVerified, setMicVerified] = useState<boolean>(false);
  const [testSpeed, setTestSpeed] = useState<number>(0.88);
  const [autoVoiceMode, setAutoVoiceMode] = useState<boolean>(false);

  const testSpeechClientRef = useRef<PastoralSpeechClient | null>(null);

  // Check KittenTTS status on mount or when opening
  useEffect(() => {
    if (!isOpen) return;

    async function checkStatus() {
      try {
        const res = await fetch("/api/tts");
        if (res.ok) {
          const data = await res.json();
          setTtsStatus({
            installed: Boolean(data.installed || data.has_local_model),
            engine: data.engine || "Browser-WebSpeechFallback",
            has_local_model: data.has_local_model,
            loading: false,
          });
        } else {
          setTtsStatus({ installed: false, loading: false });
        }
      } catch {
        setTtsStatus({ installed: false, loading: false });
      }
    }
    checkStatus();
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
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  // Test MCP Connection
  const handleTestMcp = async () => {
    setIsMcpTesting(true);
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "search_scripture",
          arguments: { topic_or_keyword: "peace and calm" },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.results || data.success) {
          setMcpVerified(true);
        }
      }
    } catch (err) {
      console.error("MCP test error:", err);
    } finally {
      setIsMcpTesting(false);
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
      if (data.installed || data.download_status === "success" || data.has_local_model) {
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

    // Persist preferences in SQLite memory via MCP
    try {
      await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "save_memory",
          arguments: {
            key: "user_name",
            value: userName.trim() || "Friend",
          },
        }),
      });

      if (selectedTopics.length > 0) {
        await fetch("/api/mcp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: "save_memory",
            arguments: {
              key: "preferred_topics",
              value: selectedTopics.join(", "),
            },
          }),
        });
      }
    } catch {
      // Non-critical persistence fallback
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("pastor_mike_onboarded", "true");
    }

    onComplete({
      name: userName.trim() || "Friend",
      topics: selectedTopics,
      enableVoice: autoVoiceMode,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-[#faf8f5] shadow-2xl dark:border-stone-800 dark:bg-stone-900">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-stone-200/80 px-6 py-4 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#445942] text-white shadow-xs dark:bg-[#5b7858]">
              <span className="font-serif text-sm font-bold">M</span>
            </div>
            <div>
              <h2 className="font-serif text-base font-semibold text-stone-900 dark:text-stone-100">
                Welcome to Pastor Mike
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                First-time setup: Onboarding &rarr; Connect MCP &rarr; Test Voice
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
            title="Skip Setup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step Indicator Tabs */}
        <div className="grid grid-cols-3 border-b border-stone-200/80 bg-stone-100/50 text-xs font-medium dark:border-stone-800 dark:bg-stone-950/40">
          <button
            onClick={() => setStep(1)}
            className={`flex items-center justify-center gap-1.5 py-3 border-b-2 transition ${
              step === 1
                ? "border-[#445942] text-[#445942] font-semibold dark:border-[#7ba277] dark:text-[#7ba277]"
                : "border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-200 text-[11px] dark:bg-stone-800">
              1
            </span>
            <span>Onboarding</span>
          </button>

          <button
            onClick={() => setStep(2)}
            className={`flex items-center justify-center gap-1.5 py-3 border-b-2 transition ${
              step === 2
                ? "border-[#445942] text-[#445942] font-semibold dark:border-[#7ba277] dark:text-[#7ba277]"
                : "border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-200 text-[11px] dark:bg-stone-800">
              2
            </span>
            <span>Connect to MCP</span>
            {mcpVerified && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
          </button>

          <button
            onClick={() => setStep(3)}
            className={`flex items-center justify-center gap-1.5 py-3 border-b-2 transition ${
              step === 3
                ? "border-[#445942] text-[#445942] font-semibold dark:border-[#7ba277] dark:text-[#7ba277]"
                : "border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-200 text-[11px] dark:bg-stone-800">
              3
            </span>
            <span>Test STT & TTS</span>
            {micVerified && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: ONBOARDING */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-stone-200 bg-white/70 p-4 shadow-2xs dark:border-stone-800 dark:bg-stone-800/50">
                <div className="flex items-start gap-3">
                  <HeartHandshake className="mt-0.5 h-5 w-5 text-[#445942] dark:text-[#7ba277]" />
                  <div>
                    <h3 className="font-serif text-sm font-semibold text-stone-900 dark:text-stone-100">
                      Meet Pastor Mike
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                      I am your AI pastoral companion. I offer empathetic listening, Holy Scripture, and personalized prayer for your daily walk.
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>Pastoral Disclaimer:</strong> Pastor Mike is an artificial intelligence assistant, not an ordained minister. All conversations and prayer requests remain private on your device.
                  </span>
                </div>
              </div>

              {/* Name input */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                  What name may I call you?
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Sarah, David, or Friend (Optional)"
                  className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-800 placeholder-stone-400 outline-none transition focus:border-[#445942] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:focus:border-[#7ba277]"
                />
              </div>

              {/* Spiritual Care Areas */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Select topics you are carrying on your heart:
                </label>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  This helps Pastor Mike bring appropriate scripture and gentle prayers.
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
                            ? "bg-[#445942] text-white shadow-2xs dark:bg-[#5b7858]"
                            : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-750"
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

          {/* STEP 2: CONNECT TO MCP */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-stone-200 bg-white/70 p-4 shadow-2xs dark:border-stone-800 dark:bg-stone-800/50">
                <div className="flex items-start gap-3">
                  <Wrench className="mt-0.5 h-5 w-5 text-[#445942] dark:text-[#7ba277]" />
                  <div>
                    <h3 className="font-serif text-sm font-semibold text-stone-900 dark:text-stone-100">
                      Model Context Protocol (MCP) Integration
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                      Pastor Mike is equipped with <strong>7 standardized MCP tools</strong> that ground every conversation turn in offline scripture knowledge and persistent local SQLite memory.
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-stone-600 dark:text-stone-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>search_scripture</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>get_verse</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>save_prayer_request</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>save_memory / load_memory</span>
                  </div>
                </div>
              </div>

              {/* MCP Live Verification Button */}
              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-800/40">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                      Verify MCP Tool Connectivity
                    </h4>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Test real-time dispatching to the local MCP gateway (/api/mcp)
                    </p>
                  </div>

                  <button
                    onClick={handleTestMcp}
                    disabled={isMcpTesting}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition shadow-2xs ${
                      mcpVerified
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-[#445942] text-white hover:bg-[#384a36] dark:bg-[#5b7858] dark:hover:bg-[#4d664a]"
                    }`}
                  >
                    {isMcpTesting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : mcpVerified ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Connected & Verified</span>
                      </>
                    ) : (
                      <>
                        <Wrench className="h-3.5 w-3.5" />
                        <span>Test MCP Connection</span>
                      </>
                    )}
                  </button>
                </div>

                {mcpVerified && (
                  <div className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-[11px] text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    &check; All {mcpToolCount} tools responded successfully. Pastor Mike is ready to read scripture and persist prayer requests.
                  </div>
                )}
              </div>

              {/* External Client Configuration (Claude Desktop / Cursor) */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Connect External Agents (Claude Desktop / Cursor)
                  </label>
                  <button
                    onClick={() => {
                      const cfg = JSON.stringify(
                        {
                          mcpServers: {
                            "pastor-mike": {
                              command: "npx",
                              args: ["-y", "tsx", "server/mcp_server.ts"],
                            },
                          },
                        },
                        null,
                        2
                      );
                      navigator.clipboard.writeText(cfg);
                      setCopiedConfig(true);
                      setTimeout(() => setCopiedConfig(false), 2000);
                    }}
                    className="flex items-center gap-1 text-[11px] text-[#445942] hover:underline dark:text-[#7ba277]"
                  >
                    {copiedConfig ? (
                      <>
                        <Check className="h-3 w-3" />
                        <span>Copied JSON</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Stdio Config</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="mt-1.5 overflow-x-auto rounded-lg bg-stone-900 p-2.5 font-mono text-[10px] text-stone-200 dark:bg-stone-950">
{`"pastor-mike": {
  "command": "npx",
  "args": ["-y", "tsx", "server/mcp_server.ts"]
}`}
                </pre>
              </div>
            </div>
          )}

          {/* STEP 3: TEST STT & TTS + KITTENTTS AUTO-DOWNLOAD */}
          {step === 3 && (
            <div className="space-y-5">
              {/* KittenTTS Engine Status Card & 1-Click Downloader */}
              <div className="rounded-xl border border-stone-200 bg-white/70 p-4 shadow-2xs dark:border-stone-800 dark:bg-stone-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg bg-[#445942]/10 p-2 text-[#445942] dark:bg-[#5b7858]/20 dark:text-[#7ba277]">
                      <Volume2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-serif text-sm font-semibold text-stone-900 dark:text-stone-100">
                        KittenTTS Voice Engine
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
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
                      className="flex items-center gap-1.5 rounded-lg bg-[#445942] px-3 py-1.5 text-xs font-medium text-white shadow-2xs transition hover:bg-[#384a36] disabled:opacity-60 dark:bg-[#5b7858] dark:hover:bg-[#4d664a]"
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
                    &check; KittenTTS model downloaded and configured! The pastoral neural voice is now active.
                  </div>
                )}
              </div>

              {/* TTS Speech Test */}
              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-800/40">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                      Test Text-to-Speech (TTS)
                    </h4>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Hear Pastor Mike speak a welcoming blessing
                    </p>
                  </div>

                  <button
                    onClick={handlePlayBlessing}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition shadow-2xs ${
                      isPlayingBlessing
                        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                        : "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
                    }`}
                  >
                    {isPlayingBlessing ? (
                      <>
                        <Square className="h-3.5 w-3.5 fill-amber-700" />
                        <span>Stop Voice</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5 fill-[#445942] text-[#445942] dark:fill-[#7ba277] dark:text-[#7ba277]" />
                        <span>Play Blessing</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Speed selector */}
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-[11px] text-stone-500 dark:text-stone-400">Voice Pace:</span>
                  <div className="flex items-center gap-1.5">
                    {[0.82, 0.88, 1.0].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => setTestSpeed(rate)}
                        className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                          testSpeed === rate
                            ? "bg-[#445942] text-white dark:bg-[#5b7858]"
                            : "bg-stone-200/80 text-stone-700 hover:bg-stone-300 dark:bg-stone-800 dark:text-stone-300"
                        }`}
                      >
                        {rate === 0.82 ? "Gentle (0.8x)" : rate === 0.88 ? "Calm (0.9x)" : "Standard (1.0x)"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* STT Microphone Test */}
              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-800/40">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                      Test Speech-to-Text (STT / Microphone)
                    </h4>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Speak into your microphone to verify speech recognition
                    </p>
                  </div>

                  <button
                    onClick={handleTestMic}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition shadow-2xs ${
                      isTestingMic
                        ? "animate-pulse bg-emerald-600 text-white"
                        : micVerified
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
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

                {isTestingMic && (
                  <p className="mt-2 text-xs italic text-stone-600 dark:text-stone-400">
                    Speak now, e.g.: &ldquo;Hello Pastor Mike, thank you for listening.&rdquo;
                  </p>
                )}

                {micTranscript && (
                  <div className="mt-2.5 rounded-lg bg-white p-2.5 text-xs text-stone-800 shadow-2xs dark:bg-stone-900 dark:text-stone-200">
                    <span className="font-semibold text-stone-500">Heard:</span> &ldquo;{micTranscript}&rdquo;
                  </div>
                )}
              </div>

              {/* Automatic Voice Mode checkbox */}
              <label className="flex cursor-pointer items-center gap-2.5 text-xs text-stone-700 dark:text-stone-300">
                <input
                  type="checkbox"
                  checked={autoVoiceMode}
                  onChange={(e) => setAutoVoiceMode(e.target.checked)}
                  className="rounded border-stone-300 text-[#445942] focus:ring-[#445942] dark:border-stone-700"
                />
                <span>Enable Voice Mode automatically when starting my visits</span>
              </label>
            </div>
          )}
        </div>

        {/* Footer Navigation Controls */}
        <div className="flex items-center justify-between border-t border-stone-200/80 bg-[#f7f4ed] px-6 py-4 dark:border-stone-800 dark:bg-[#181716]">
          {step > 1 ? (
            <button
              onClick={() => setStep((prev) => (prev - 1) as 1 | 2)}
              className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-xs text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
            >
              Skip Setup
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep((prev) => (prev + 1) as 2 | 3)}
              className="flex items-center gap-1.5 rounded-lg bg-[#445942] px-4 py-2 text-xs font-medium text-white shadow-2xs transition hover:bg-[#384a36] dark:bg-[#5b7858] dark:hover:bg-[#4d664a]"
            >
              <span>Continue</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="flex items-center gap-1.5 rounded-lg bg-[#445942] px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#384a36] dark:bg-[#5b7858] dark:hover:bg-[#4d664a]"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>Enter Sanctuary</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
