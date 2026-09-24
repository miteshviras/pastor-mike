"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { Header } from "@/components/Header";
import { ChatMessage, ChatMessageProps } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { PrayerJournalModal } from "@/components/PrayerJournalModal";
import { VisitHistorySidebar } from "@/components/VisitHistorySidebar";
import { OnboardingModal } from "@/components/OnboardingModal";
import { VoiceBar } from "@/components/VoiceBar";
import { CrisisBanner } from "@/components/CrisisBanner";
import { PastoralSpeechClient, KITTEN_VOICES } from "@/lib/voice/speech-client";
import { useSentenceSync } from "@/lib/voice/useSentenceSync";
import { attachAudioLevelAnalyser } from "@/lib/voice/audioLevel";
import type { PrayerRequest, SavedVerse } from "@/lib/db";
import { SafetyCheckResult } from "@/lib/ai/safety";
import {
  Sparkles,
  HeartHandshake,
  Play,
  Pause,
  Download,
  Loader2,
  Search,
  X,
  Sun,
  Compass,
  MoreVertical,
} from "lucide-react";

// Keeps the three.js/R3F bundle out of the server-rendered chunk.
const PastorStage = dynamic(() => import("@/components/avatar/PastorStage"), {
  ssr: false,
});

function safeGetStorage(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, value);
    }
  } catch {}
}

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speechSpeed, setSpeechSpeed] = useState(0.88);
  const [voicePreset, setVoicePreset] = useState<string>(() => {
    const saved = safeGetStorage("pastor_mike_voice");
    return saved && (KITTEN_VOICES as readonly string[]).includes(saved)
      ? saved
      : "Jasper";
  });
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [savedVerses, setSavedVerses] = useState<SavedVerse[]>([]);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // Bumped whenever this visit's data changes (message sent, prayer saved) so the always-visible
  // desktop sidebar — which isn't remounted by isHistoryOpen toggling — knows to refetch instead
  // of only updating on a hard refresh.
  const [historyRefreshTick, setHistoryRefreshTick] = useState(0);
  const [allSessions, setAllSessions] = useState<{ id: string; started_at: string; summary: string | null; firstMessagePreview: string | null }[]>([]);
  const [guideModalTab, setGuideModalTab] = useState<
    "guide" | "settings" | "profile" | "test-audio" | null
  >(null);
  const [latestSafety, setLatestSafety] = useState<SafetyCheckResult | null>(
    null,
  );
  const [micError, setMicError] = useState<string | null>(null);
  const [providerLabel, setProviderLabel] = useState<string>("Gemini");
  const [inputText, setInputText] = useState("");
  const [isSpeakingPaused, setIsSpeakingPaused] = useState(false);
  const [speakingText, setSpeakingText] = useState("");
  const [isPraying, setIsPraying] = useState(false);
  // True from the moment a (re)play is requested until that audio actually starts (or fails/
  // gets superseded) — covers the network/synthesis gap so the UI can show a loading state
  // instead of nothing changing.
  const [isSpeechLoading, setIsSpeechLoading] = useState(false);
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;
  const baseInputRef = useRef("");
  // Holds the current reply's prayer text (if any) for the duration of its TTS playback,
  // so onSpeakingChunkChange can tell whether the chunk it's on belongs to the prayer.
  const currentPrayerTextRef = useRef<string | null>(null);

  const speechClientRef = useRef<PastoralSpeechClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Paces the currently-playing reply's text reveal to match TTS playback, for the
  // Pastor Stage's transcript view (Live Pastor mode) — not necessarily the latest reply,
  // since any past reply can be selected and dictated from that view.
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  const isSpeechSessionActive = isSpeaking || isSpeechLoading;
  const activeSpeakingMessage = isSpeechSessionActive
    ? assistantMessages.find((m) => m.content === speakingText)
    : undefined;
  const displayedMessage = activeSpeakingMessage ?? lastAssistantMessage;
  const sentenceSync = useSentenceSync(displayedMessage?.content ?? "", isSpeaking);
  const sentenceSyncRef = useRef(sentenceSync);
  sentenceSyncRef.current = sentenceSync;

  // Initialize Speech Client
  useEffect(() => {
    try {
      const client = new PastoralSpeechClient({
        speed: speechSpeed,
        voicePreset,
        onListeningStateChange: (listening) => {
          setIsListening(listening);
          if (listening) {
            setMicError(null);
            baseInputRef.current = inputTextRef.current.trim();
          }
        },
        onTranscribingChange: (transcribing) => {
          setIsTranscribing(transcribing);
        },
        onSpeakingStateChange: (speaking, paused) => {
          setIsSpeaking(speaking);
          setIsSpeakingPaused(Boolean(paused));
          setIsSpeechLoading(false);
          if (!speaking) {
            setSpeakingText("");
            currentPrayerTextRef.current = null;
            setIsPraying(false);
          }
        },
        onSpeakingChunkChange: (chunkIndex, _totalChunks, chunkText) => {
          sentenceSyncRef.current.setCurrentChunkIndex(chunkIndex);
          const prayerText = currentPrayerTextRef.current;
          setIsPraying(Boolean(prayerText && chunkText && prayerText.includes(chunkText.trim())));
        },
        onTranscriptionResult: (transcript) => {
          if (!transcript || !transcript.trim()) return;
          // Always display transcribed speech in the input box!
          // NEVER automatically send for chat.
          const base = baseInputRef.current;
          const newText = base ? `${base} ${transcript.trim()}` : transcript.trim();
          setInputText(newText);
        },
        onError: (err) => setMicError(err),
        onAudioElement: (audio) => {
          sentenceSyncRef.current.setAudioElement(audio);
          attachAudioLevelAnalyser(audio);
        },
      });
      speechClientRef.current = client;

      return () => {
        client.stopSpeaking();
        client.stopListening();
      };
    } catch (err) {
      console.warn("Speech client initialization skipped:", err);
    }
  }, []);

  // Update speed in speech client
  useEffect(() => {
    speechClientRef.current?.updateOptions({ speed: speechSpeed });
  }, [speechSpeed]);

  // Update voice preset in speech client, and remember the choice
  useEffect(() => {
    speechClientRef.current?.updateOptions({ voicePreset });
    if (typeof window !== "undefined") {
      localStorage.setItem("pastor_mike_voice", voicePreset);
    }
  }, [voicePreset]);

  // The Prayer Journal is global across every visit, not scoped to one session —
  // always fetch the full list for the user.
  const loadPrayers = async () => {
    try {
      const pRes = await fetch("/api/prayers");
      if (pRes.ok) {
        const pData = await pRes.json();
        setPrayers(pData.prayers || []);
      }
    } catch (err) {
      console.error("Error loading prayers:", err);
    }
  };

  const loadSavedVerses = async () => {
    try {
      const vRes = await fetch("/api/verses");
      if (vRes.ok) {
        const vData = await vRes.json();
        setSavedVerses(vData.verses || []);
      }
    } catch (err) {
      console.error("Error loading saved verses:", err);
    }
  };

  const loadSessionsList = async () => {
    try {
      const sRes = await fetch("/api/sessions");
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData.sessions) {
          setAllSessions(sData.sessions);
        }
      }
    } catch (err) {
      console.error("Error loading sessions for sidebar:", err);
    }
  };

  useEffect(() => {
    loadSessionsList();
  }, [historyRefreshTick]);

  // Load or create initial session and prayers
  useEffect(() => {
    async function init() {
      try {
        // 1. Fetch the active AI provider (shown as a header badge)
        try {
          const settingsRes = await fetch("/api/settings");
          if (settingsRes.ok) {
            const settingsData = await settingsRes.json();
            if (settingsData.settings?.provider) {
              const labels: Record<string, string> = {
                gemini: "Gemini",
                ollama: "Ollama",
                offline: "Offline",
              };
              setProviderLabel(
                labels[settingsData.settings.provider] ||
                  settingsData.settings.provider,
              );
            }
          }
        } catch {}

        // 2. Check localStorage for existing active session
        let activeSessionId: string | null = null;
        const savedSessionId =
          typeof window !== "undefined"
            ? localStorage.getItem("pastor_mike_session_id")
            : null;

        if (savedSessionId) {
          const msgRes = await fetch(
            `/api/sessions?sessionId=${encodeURIComponent(savedSessionId)}`,
          );
          if (msgRes.ok) {
            const msgData = await msgRes.json();
            if (msgData.session) {
              activeSessionId = msgData.session.id;
              setSessionId(msgData.session.id);
              setSessionTitle(msgData.session.title ?? null);
              if (msgData.messages && msgData.messages.length > 0) {
                setMessages(
                  msgData.messages.map(
                    (m: {
                      id: string;
                      role: "user" | "assistant" | "system";
                      content: string;
                      metadata: string | null;
                      created_at: string;
                    }) => ({
                      id: m.id,
                      role: m.role,
                      content: m.content,
                      metadata: m.metadata ? JSON.parse(m.metadata) : null,
                      createdAt: m.created_at,
                    }),
                  ),
                );
              }
            }
          }
        }

        // 3. If no saved session, look for the most recent session with content or fallback
        if (!activeSessionId) {
          const sRes = await fetch("/api/sessions");
          if (sRes.ok) {
            const sData = await sRes.json();
            if (sData.sessions && sData.sessions.length > 0) {
              for (const s of sData.sessions) {
                const msgRes = await fetch(
                  `/api/sessions?sessionId=${encodeURIComponent(s.id)}`,
                );
                if (msgRes.ok) {
                  const msgData = await msgRes.json();
                  if (msgData.messages && msgData.messages.length > 0) {
                    activeSessionId = s.id;
                    setSessionId(s.id);
                    setSessionTitle(s.title ?? null);
                    if (typeof window !== "undefined") {
                      localStorage.setItem("pastor_mike_session_id", s.id);
                    }
                    setMessages(
                      msgData.messages.map(
                        (m: {
                          id: string;
                          role: "user" | "assistant" | "system";
                          content: string;
                          metadata: string | null;
                          created_at: string;
                        }) => ({
                          id: m.id,
                          role: m.role,
                          content: m.content,
                          metadata: m.metadata ? JSON.parse(m.metadata) : null,
                          createdAt: m.created_at,
                        }),
                      ),
                    );
                    break;
                  }
                }
              }

              if (!activeSessionId) {
                const latest = sData.sessions[0];
                activeSessionId = latest.id;
                setSessionId(latest.id);
                setSessionTitle(latest.title ?? null);
                if (typeof window !== "undefined") {
                  localStorage.setItem("pastor_mike_session_id", latest.id);
                }
              }
            }
          }
        }

        // 4. Load the Prayer Journal and saved verses — both global across every visit.
        await loadPrayers();
        await loadSavedVerses();

        // 5. Check if first-time onboarding should be displayed
        const hasOnboarded =
          typeof window !== "undefined"
            ? localStorage.getItem("pastor_mike_onboarded") === "true"
            : true;
        if (!hasOnboarded) {
          setGuideModalTab("guide");
        }
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }
    init();
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Reset input box and session base
    setInputText("");
    baseInputRef.current = "";

    // Stop listening if active
    if (isListening) {
      speechClientRef.current?.stopListening();
    }

    // Optimistically add user message
    const tempUserMsg: ChatMessageProps = {
      id: "temp_" + Date.now(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: text,
        }),
      });

      if (!res.ok) {
        throw new Error(`Chat API error: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.sessionId) {
        setSessionId(data.sessionId);
        if (typeof window !== "undefined") {
          localStorage.setItem("pastor_mike_session_id", data.sessionId);
        }
      }

      if (data.sessionTitle) {
        setSessionTitle(data.sessionTitle);
      }

      if (data.safety) {
        setLatestSafety(data.safety);
      }

      const assistantMsg: ChatMessageProps = {
        id: "ast_" + Date.now(),
        role: "assistant",
        content: data.reply,
        metadata: {
          scriptures: data.scriptures,
          prayer: data.prayer,
          isCrisis: data.safety?.isCrisis,
          isProphecyRefusal: data.safety?.isProphecyRefusal,
          savedPrayerId: data.savedPrayerId,
          usedModel: data.usedModel,
          modelName: data.modelName,
        },
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setHistoryRefreshTick((t) => t + 1);

      // Refresh prayers if one was saved
      if (data.savedPrayerId) {
        await loadPrayers();
      }

      // If Voice Mode is active, speak the assistant's reply automatically
      if (isVoiceMode && speechClientRef.current) {
        const speechText = data.prayer
          ? `${data.reply} Let us pray together. ${data.prayer.text}`
          : data.reply;
        currentPrayerTextRef.current = data.prayer ? data.prayer.text : null;
        // speakText() internally stops any prior speech first, which synchronously fires
        // onSpeakingStateChange(false, ...) and clears speakingText/loading — call it before
        // setting them so our values (set after) are the ones that stick.
        speechClientRef.current.speakText(speechText);
        // Tracked as data.reply (not speechText, which also carries the prayer suffix), so it
        // matches assistantMsg.content the same way every other speakingText consumer expects.
        setSpeakingText(data.reply);
        setIsSpeechLoading(true);
      }
    } catch (err) {
      console.error("Error sending message:", err);
      const errorMsg: ChatMessageProps = {
        id: "err_" + Date.now(),
        role: "assistant",
        content:
          "I'm having a brief moment of difficulty connecting. Please take a quiet breath and try speaking with me again.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePlayPause = (text: string) => {
    if (!speechClientRef.current) return;
    // Mirrors PastoralSpeechClient.togglePlayPause()'s own condition for "this will (re)start
    // speech from scratch" vs "this just pauses/resumes what's already playing" — used below
    // to know whether a loading state is warranted.
    const willLoad = !isSpeaking || speakingText !== text;
    // Call the client FIRST: if it's switching messages, it synchronously stops the old
    // speech, which fires onSpeakingStateChange(false, ...) and clears speakingText/loading —
    // setting them again below (after, not before) ensures our values are what the resulting
    // render actually sees, instead of being clobbered by that nested reset.
    speechClientRef.current.togglePlayPause(text);
    setSpeakingText(text);
    if (willLoad) setIsSpeechLoading(true);
  };

  const handleRestartSpeaking = (text: string) => {
    if (!speechClientRef.current) return;
    speechClientRef.current.restartSpeaking(text);
    setSpeakingText(text);
    setIsSpeechLoading(true);
  };

  const handleStopSpeaking = () => {
    if (speechClientRef.current) {
      speechClientRef.current.stopSpeaking();
    }
  };

  const handleToggleLivePastor = () => {
    const next = !isVoiceMode;
    setIsVoiceMode(next);
    if (!next) {
      speechClientRef.current?.stopSpeaking();
    }
  };

  const handleToggleListening = () => {
    if (!speechClientRef.current) return;
    if (isListening) {
      speechClientRef.current.stopListening();
    } else {
      setMicError(null);
      speechClientRef.current.startListening();
    }
  };

  const handleSavePrayer = async (text: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/prayers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sessionId && data.sessionId !== sessionId) {
          setSessionId(data.sessionId);
          if (typeof window !== "undefined") {
            localStorage.setItem("pastor_mike_session_id", data.sessionId);
          }
        }
        await loadPrayers();
        setHistoryRefreshTick((t) => t + 1);
        return data.prayer?.id ?? null;
      }
      return null;
    } catch {
      return null;
    }
  };

  // Synthesizes the full (untruncated) text in one request and triggers a browser download —
  // reuses /api/tts as-is, since synthesize_kittentts() already produces one complete WAV
  // per call regardless of input length.
  const handleDownloadAudio = async (text: string) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: voicePreset, speed: speechSpeed }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok || !contentType.includes("audio/wav")) {
        console.error("Audio download unavailable: no local TTS engine produced audio for this reply.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pastor-mike-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading audio:", err);
    }
  };

  const handleDeletePrayer = async (prayerId: string) => {
    try {
      const res = await fetch(
        `/api/prayers?id=${encodeURIComponent(prayerId)}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setPrayers((prev) => prev.filter((p) => p.id !== prayerId));
      }
    } catch (err) {
      console.error("Error deleting prayer:", err);
    }
  };

  const handleTogglePrayerStatus = async (
    prayerId: string,
    currentStatus: "active" | "answered",
  ) => {
    const nextStatus = currentStatus === "active" ? "answered" : "active";
    try {
      const res = await fetch("/api/prayers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: prayerId, status: nextStatus }),
      });
      if (res.ok) {
        setPrayers((prev) =>
          prev.map((p) =>
            p.id === prayerId ? { ...p, status: nextStatus } : p,
          ),
        );
      }
    } catch (err) {
      console.error("Error updating prayer status:", err);
    }
  };

  // Lets a prayer be marked answered directly from its chat card, once the user confirms
  // in conversation that it's been resolved, without opening the Prayer Journal modal.
  const handleMarkPrayerAnswered = (prayerId: string) =>
    handleTogglePrayerStatus(prayerId, "active");

  const handleSaveVerse = async (
    reference: string,
    text: string,
    translation?: string,
  ): Promise<string | null> => {
    try {
      const res = await fetch("/api/verses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, text, translation, sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedVerses((prev) => [data.verse, ...prev]);
        return data.verse?.id ?? null;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleDeleteVerse = async (verseId: string) => {
    try {
      const res = await fetch(
        `/api/verses?id=${encodeURIComponent(verseId)}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setSavedVerses((prev) => prev.filter((v) => v.id !== verseId));
      }
    } catch (err) {
      console.error("Error deleting saved verse:", err);
    }
  };

  const handleNewSession = () => {
    speechClientRef.current?.stopSpeaking();
    speechClientRef.current?.stopListening();
    // No session row is created here — lazily created on the first message or prayer save.
    setSessionId(null);
    setSessionTitle(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("pastor_mike_session_id");
    }
    setMessages([]);
    setLatestSafety(null);
  };

  const handleSwitchSession = async (targetSessionId: string) => {
    if (targetSessionId === sessionId) {
      setIsHistoryOpen(false);
      return;
    }
    try {
      speechClientRef.current?.stopSpeaking();
      speechClientRef.current?.stopListening();
      setIsLoading(true);

      const msgRes = await fetch(
        `/api/sessions?sessionId=${encodeURIComponent(targetSessionId)}`,
      );
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        setSessionId(targetSessionId);
        setSessionTitle(msgData.session?.title ?? null);
        if (typeof window !== "undefined") {
          localStorage.setItem("pastor_mike_session_id", targetSessionId);
        }
        setMessages(
          (msgData.messages || []).map(
            (m: {
              id: string;
              role: "user" | "assistant" | "system";
              content: string;
              metadata: string | null;
              created_at: string;
            }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              metadata: m.metadata
                ? typeof m.metadata === "string"
                  ? JSON.parse(m.metadata)
                  : m.metadata
                : null,
              createdAt: m.created_at,
            }),
          ),
        );
        setLatestSafety(null);
      }
    } catch (err) {
      console.error("Error switching session:", err);
    } finally {
      setIsLoading(false);
      setIsHistoryOpen(false);
    }
  };

  const handleCompleteOnboarding = (prefs: {
    name: string;
    topics: string[];
    enableVoice: boolean;
  }) => {
    if (prefs.enableVoice) {
      setIsVoiceMode(true);
    }

    if (messages.length === 0) {
      const topicText =
        prefs.topics.length > 0
          ? `regarding ${prefs.topics.join("and")}`
          : "in your heart";
      const greeting = `Peace and grace to you, ${prefs.name || "Beloved Friend"}. I am Pastor Mike. I am glad you have joined me in this quiet space today. I am holding what is ${topicText} with gentle care. How can I walk alongside you right now?`;

      const welcomeMsg: ChatMessageProps = {
        id: "ast_welcome_" + Date.now(),
        role: "assistant",
        content: greeting,
        createdAt: new Date().toISOString(),
      };
      setMessages([welcomeMsg]);

      if (prefs.enableVoice && speechClientRef.current) {
        speechClientRef.current.speakText(greeting);
      }
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F8F5EE] text-[#2F2F2F] selection:bg-[#77B500]/25 selection:text-[#2F2F2F]">
      {/* Top Header */}
      <Header
        isVoiceMode={isVoiceMode}
        onToggleVoiceMode={handleToggleLivePastor}
        onOpenJournal={() => setIsJournalOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onNewSession={handleNewSession}
        prayerCount={prayers.filter((p) => p.status === "active").length}
        providerLabel={providerLabel}
        onOpenProfile={() => setGuideModalTab("profile")}
        onOpenSettings={() => setGuideModalTab("settings")}
        onOpenTestAudio={() => setGuideModalTab("test-audio")}
        onOpenGuide={() => setGuideModalTab("guide")}
        visitTitle={sessionTitle}
      />

      {/* 3-Column Sanctuary Layout */}
      <div className="flex-1 flex overflow-hidden max-w-[1680px] w-full mx-auto px-2 sm:px-4 lg:px-6 pb-2 sm:pb-3 gap-3 sm:gap-4 lg:gap-5 min-h-0">
        {/* Left Column: Sanctuary Architectural Window (Static Emotional Anchor) */}
        <aside className="hidden lg:flex w-56 xl:w-64 2xl:w-72 shrink-0 flex-col rounded-[24px] overflow-hidden border border-[#ECE8E2] bg-[#FAF8F3] relative shadow-xs select-none group">
          <img
            src="/images/sanctuary_window.jpg"
            alt="Sanctuary Window"
            className="h-full w-full object-cover object-center pointer-events-none transition-transform duration-700 ease-out group-hover:scale-[1.02]"
          />
          {/* Scripture Anchor Overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#FAF8F3]/95 via-[#FAF8F3]/85 to-transparent pt-16 pb-6 px-4 text-center pointer-events-none">
            <p className="font-serif italic text-[13px] xl:text-[14px] text-[#2F2F2F] leading-snug font-medium">
              &ldquo;Be still, and know that I am God.&rdquo;
            </p>
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#77B500] mt-1.5">
              Psalm 46:10
            </p>
          </div>
        </aside>

        {/* Center Column: Elevated Main Sanctuary / Conversation Stage */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 rounded-[28px] bg-white border border-[#ECE8E2] shadow-[0_20px_60px_rgba(0,0,0,0.06)] overflow-hidden relative">
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 pt-5 sm:pt-7 pb-4 [scrollbar-width:thin]">
            <AnimatePresence mode="wait" initial={false}>
              {isVoiceMode ? (
                <motion.div
                  key="pastor-stage"
                  className="w-full flex flex-col min-h-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <PastorStage
                    assistantText={displayedMessage?.content ?? ""}
                    assistantMessages={assistantMessages}
                    revealedText={sentenceSync.revealedText}
                    sentences={sentenceSync.sentences}
                    currentSentenceIndex={sentenceSync.currentSentenceIndex}
                    isLoading={isLoading}
                    isSpeaking={isSpeaking}
                    isPaused={isSpeakingPaused}
                    isPraying={isPraying}
                    isSpeechLoading={isSpeechLoading}
                    onTogglePlayPause={handleTogglePlayPause}
                    onRestart={handleRestartSpeaking}
                    onStop={handleStopSpeaking}
                    onDownload={handleDownloadAudio}
                    speed={speechSpeed}
                    onSpeedChange={setSpeechSpeed}
                    voice={voicePreset}
                    onVoiceChange={setVoicePreset}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="conversation-list"
                  className="mx-auto flex h-full w-full max-w-3xl flex-col"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  {/* Hero Greeting Banner */}
                  <div className="relative w-full rounded-[22px] bg-gradient-to-r from-[#EFF6E8] via-[#FAF9F5] to-[#F5F8F2] p-5 sm:p-6 border border-[#ECE8E2] shadow-xs overflow-hidden mb-4 shrink-0">
                    <div className="absolute right-0 top-0 bottom-0 w-32 pointer-events-none select-none opacity-75 hidden sm:block">
                      <img
                        src="/images/botanical_leaf.jpg"
                        alt=""
                        className="h-full w-full object-contain object-right-top mix-blend-multiply"
                      />
                    </div>
                    <div className="relative z-10 flex items-center gap-4 sm:gap-6">
                      <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-full border-2 border-white shadow-sm overflow-hidden bg-gradient-to-b from-[#E2ECD6] to-[#F2EFE8]">
                        <img
                          src="/images/pastor_portrait.jpg"
                          alt="Pastor Mike"
                          className="h-full w-full object-cover object-top"
                        />
                      </div>
                      <div className="min-w-0 pr-0 sm:pr-20">
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F2F2F] mb-1">
                          <span className="h-2 w-2 rounded-full bg-[#77B500] ring-2 ring-[#D2EAC0]" />
                          <span>Pastor Mike</span>
                        </div>
                        <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#1F2937] leading-tight mb-1">
                          You are not alone.
                        </h2>
                        <p className="text-[12px] sm:text-[13px] text-[#4B5563] leading-relaxed max-w-[460px]">
                          I&apos;m here to listen, pray, and share God&apos;s wisdom with you. Take a deep breath — let&apos;s walk through this together.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Safety Crisis Alert if triggered */}
                  {latestSafety && latestSafety.isCrisis && (
                    <CrisisBanner safety={latestSafety} />
                  )}

                  {/* Conversation Messages */}
                  <div className="flex-1 space-y-2">
                    {messages.map((msg) => {
                      const isThisMsgActive = isSpeaking && speakingText === msg.content;
                      const isThisMsgPaused = isThisMsgActive && isSpeakingPaused;
                      return (
                        <ChatMessage
                          key={msg.id}
                          {...msg}
                          onSpeak={handleTogglePlayPause}
                          onRestart={handleRestartSpeaking}
                          onStop={handleStopSpeaking}
                          onMarkAnswered={handleMarkPrayerAnswered}
                          onDownload={handleDownloadAudio}
                          onSaveVerse={handleSaveVerse}
                          isSpeakingNow={isThisMsgActive}
                          isPausedNow={isThisMsgPaused}
                        />
                      );
                    })}

                    {isLoading && (
                      <div className="flex items-center gap-2.5 my-4 rounded-2xl rounded-tl-xs border border-[#ECE8E2] bg-[#FAF8F3] p-4 text-xs shadow-xs">
                        <Sparkles className="h-4 w-4 animate-spin text-[#77B500]" />
                        <span className="font-semibold text-[#2F2F2F]">
                          Pastor Mike is reflecting on your words...
                        </span>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sticky Bottom Composer */}
          <div className="shrink-0 px-4 sm:px-8 pb-3.5 pt-1 bg-white/95 backdrop-blur-xs border-t border-[#F2EFEA]">
            <ChatInput
              value={inputText}
              onChange={setInputText}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              isListening={isListening}
              isTranscribing={isTranscribing}
              onToggleListening={handleToggleListening}
              isSpeaking={isSpeaking}
              micError={micError}
            />
          </div>
        </main>

        {/* Right Column: ChurchSpring Sidebar (#FBFAF7) */}
        <aside className="hidden xl:flex w-72 2xl:w-80 shrink-0 flex-col rounded-[24px] bg-[#FBFAF7] border border-[#ECE8E2] p-4 shadow-xs overflow-y-auto [scrollbar-width:none]">
          {/* Section 1: Replies */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-bold text-[#2F2F2F]">Replies</h3>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EAF6DF] text-[#4F7A00] text-[11px] font-bold border border-[#D2EAC0]">
                {assistantMessages.length}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[#6B7280]">
              <button
                type="button"
                title="Search replies"
                className="p-1 hover:text-[#77B500] transition cursor-pointer"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                title="View past sessions"
                className="p-1 hover:text-[#77B500] transition cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <p className="text-[10.5px] text-[#6B7280] mb-3">
            Your recent conversations with Pastor Mike
          </p>

          {/* Replies Cards */}
          <div className="space-y-2.5 mb-5">
            {assistantMessages.length === 0 ? (
              <p className="text-[12px] text-[#6B7280] px-1">
                No replies yet in this visit — Pastor Mike&apos;s responses
                will appear here as you talk.
              </p>
            ) : (
              assistantMessages.map((msg, i) => {
                const isTarget = msg.content === (displayedMessage?.content ?? "");
                const isActive = isSpeaking && isTarget;
                const isActivePaused = isActive && isSpeakingPaused;
                const isRowLoading = isTarget && isSpeechLoading && !isSpeaking;

                return (
                  <div
                    key={msg.id}
                    className={`relative overflow-hidden rounded-[16px] border p-3 shadow-xs transition cursor-pointer ${
                      isActive || isRowLoading
                        ? "border-[#A8DB80] bg-[#F4FAF0]"
                        : "border-[#ECE8E2] bg-white hover:border-[#77B500]"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#77B500]" />
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-[12px] font-medium text-[#2F2F2F] leading-snug">
                        {msg.content}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTogglePlayPause(msg.content)}
                          disabled={isRowLoading}
                          title={
                            isRowLoading
                              ? "Loading..."
                              : isActive && !isActivePaused
                                ? "Pause"
                                : "Listen"
                          }
                          className="text-[#77B500] hover:scale-105 transition cursor-pointer"
                        >
                          {isRowLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : isActive && !isActivePaused ? (
                            <Pause className="h-3.5 w-3.5 fill-current" />
                          ) : (
                            <Play className="h-3.5 w-3.5 fill-current" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadAudio(msg.content)}
                          title="Download audio"
                          className="text-[#9CA3AF] hover:text-[#77B500] transition cursor-pointer"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="text-[10px] text-[#6B7280]">
                        {i === 0 ? "Latest reply" : `Reply #${assistantMessages.length - i}`}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="bg-[#EAF6DF] text-[#3B5B24] text-[9.5px] font-semibold px-2 py-0.5 rounded-md">
                          Scripture
                        </span>
                        <span className="bg-[#EAF6DF] text-[#3B5B24] text-[9.5px] font-semibold px-2 py-0.5 rounded-md">
                          Guidance
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Section 2: Today's Verse */}
          <div className="mb-5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#2F2F2F] mb-2">
              <Sun className="h-4 w-4 text-[#C8A86A]" />
              <span>Today&apos;s Verse</span>
            </div>
            <div className="relative overflow-hidden rounded-[16px] bg-white border border-[#ECE8E2] p-4 shadow-xs">
              <div className="absolute -right-3 -bottom-3 w-20 h-20 pointer-events-none opacity-60">
                <img
                  src="/images/botanical_leaf.jpg"
                  alt=""
                  className="w-full h-full object-contain mix-blend-multiply"
                />
              </div>
              <div className="relative z-10">
                <span className="text-2xl font-serif text-[#C8A86A] leading-none select-none">“</span>
                <p className="font-serif text-[12.5px] font-medium text-[#2F2F2F] leading-snug pr-6 -mt-2">
                  Cast all your anxiety on Him because He cares for you.
                </p>
                <p className="text-[10px] font-semibold text-[#6B7280] mt-2">
                  1 Peter 5:7
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Your Journey */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#2F2F2F]">
                <Compass className="h-4 w-4 text-[#77B500]" />
                <span>Your Journey</span>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className="text-[11px] font-semibold text-[#77B500] hover:underline cursor-pointer"
              >
                View All
              </button>
            </div>

            <div className="relative pl-3 border-l-2 border-[#ECE8E2] space-y-3 ml-1.5 text-[11px]">
              <div>
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider block mb-1">
                  Today
                </span>
                <div
                  onClick={() => {
                    if (allSessions[0]) handleSwitchSession(allSessions[0].id);
                  }}
                  className="flex items-center justify-between text-[#2F2F2F] font-medium py-0.5 cursor-pointer hover:text-[#77B500] transition"
                >
                  <div className="flex items-center gap-1.5 truncate pr-2">
                    <span className="h-2 w-2 rounded-full bg-[#77B500] shrink-0" />
                    <span className="truncate">
                      {allSessions[0]?.summary || "Conversation about anxiety"}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#9CA3AF] shrink-0">10:42 AM</span>
                </div>
                <div
                  onClick={() => setIsJournalOpen(true)}
                  className="flex items-center justify-between text-[#4B5563] py-0.5 cursor-pointer hover:text-[#77B500] transition"
                >
                  <div className="flex items-center gap-1.5 truncate pr-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D2EAC0] shrink-0" />
                    <span className="truncate">Prayer request</span>
                  </div>
                  <span className="text-[10px] text-[#9CA3AF] shrink-0">9:15 AM</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider block mb-1">
                  Yesterday
                </span>
                <div
                  onClick={() => {
                    if (allSessions[1]) handleSwitchSession(allSessions[1].id);
                  }}
                  className="flex items-center justify-between text-[#4B5563] py-0.5 cursor-pointer hover:text-[#77B500] transition"
                >
                  <div className="flex items-center gap-1.5 truncate pr-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D2EAC0] shrink-0" />
                    <span className="truncate">
                      {allSessions[1]?.summary || "Encouragement and healing"}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#9CA3AF] shrink-0">4:18 PM</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Pastoral Visit History Drawer */}
      <VisitHistorySidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        currentSessionId={sessionId}
        refreshKey={historyRefreshTick}
        onSelectSession={handleSwitchSession}
        onNewSession={() => {
          setIsHistoryOpen(false);
          handleNewSession();
        }}
        onOpenSettings={() => setGuideModalTab("settings")}
        onOpenProfile={() => setGuideModalTab("profile")}
        onOpenTestAudio={() => setGuideModalTab("test-audio")}
        isVoiceMode={isVoiceMode}
      />

      {/* Prayer Journal Modal */}
      <PrayerJournalModal
        isOpen={isJournalOpen}
        onClose={() => setIsJournalOpen(false)}
        prayers={prayers}
        onToggleStatus={handleTogglePrayerStatus}
        onAddPrayer={async (text) => {
          await handleSavePrayer(text);
        }}
        onDeletePrayer={handleDeletePrayer}
        verses={savedVerses}
        onDeleteVerse={handleDeleteVerse}
      />

      {/* Setup Guide & AI Settings Modal — full wizard for "guide", a single
          focused view (no tabs/stepper) for "settings"/"profile"/"test-audio" */}
      <OnboardingModal
        key={guideModalTab ?? "closed"}
        isOpen={guideModalTab !== null}
        singleView={
          guideModalTab === "settings" ||
          guideModalTab === "profile" ||
          guideModalTab === "test-audio"
            ? guideModalTab
            : undefined
        }
        onClose={() => setGuideModalTab(null)}
        onComplete={handleCompleteOnboarding}
        sessionId={sessionId}
        onProviderChange={(provider) => {
          const labels: Record<string, string> = {
            gemini: "Gemini",
            ollama: "Ollama",
            offline: "Offline",
          };
          setProviderLabel(labels[provider] || provider);
        }}
      />
    </div>
  );
}
