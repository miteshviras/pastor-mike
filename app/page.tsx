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
import type { PrayerRequest } from "@/lib/db";
import { SafetyCheckResult } from "@/lib/ai/safety";
import { Sparkles, HeartHandshake } from "lucide-react";

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
  const [prayerScope, setPrayerScope] = useState<"session" | "all">("session");
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [guideModalTab, setGuideModalTab] = useState<
    "guide" | "settings" | null
  >(null);
  const [latestSafety, setLatestSafety] = useState<SafetyCheckResult | null>(
    null,
  );
  const [micError, setMicError] = useState<string | null>(null);
  const [providerLabel, setProviderLabel] = useState<string>("Gemini");
  const [inputText, setInputText] = useState("");
  const [isSpeakingPaused, setIsSpeakingPaused] = useState(false);
  const [speakingText, setSpeakingText] = useState("");
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;
  const baseInputRef = useRef("");

  const speechClientRef = useRef<PastoralSpeechClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Paces the last assistant reply's text reveal to match TTS playback, for the
  // Pastor Stage's current-turn view (Live Pastor mode).
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const sentenceSync = useSentenceSync(lastAssistantMessage?.content ?? "", isSpeaking);
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
          if (!speaking) {
            setSpeakingText("");
          }
        },
        onSpeakingChunkChange: (chunkIndex) => {
          sentenceSyncRef.current.setCurrentChunkIndex(chunkIndex);
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

  const loadPrayers = async (
    sid?: string | null,
    scope: "session" | "all" = prayerScope,
  ) => {
    try {
      const url =
        scope === "all"
          ? "/api/prayers?sessionId=all"
          : sid
            ? `/api/prayers?sessionId=${encodeURIComponent(sid)}`
            : "/api/prayers";
      const pRes = await fetch(url);
      if (pRes.ok) {
        const pData = await pRes.json();
        setPrayers(pData.prayers || []);
      }
    } catch (err) {
      console.error("Error loading prayers:", err);
    }
  };

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
                if (typeof window !== "undefined") {
                  localStorage.setItem("pastor_mike_session_id", latest.id);
                }
              }
            }
          }
        }

        // 4. Load visit-scoped prayers strictly for the active session (empty for brand new session).
        // No session is created here — a real session row is only written once the user sends a
        // message or saves a prayer (see handleSendMessage / handleSavePrayer's lazy-create).
        if (activeSessionId) {
          await loadPrayers(activeSessionId, "session");
        } else {
          setPrayers([]);
        }

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
        },
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Refresh prayers if one was saved
      if (data.savedPrayerId) {
        await loadPrayers(data.sessionId || sessionId, prayerScope);
      }

      // If Voice Mode is active, speak the assistant's reply automatically
      if (isVoiceMode && speechClientRef.current) {
        const speechText = data.prayer
          ? `${data.reply} Let us pray together. ${data.prayer.text}`
          : data.reply;
        setSpeakingText(speechText);
        speechClientRef.current.speakText(speechText);
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
    if (speechClientRef.current) {
      setSpeakingText(text);
      speechClientRef.current.togglePlayPause(text);
    }
  };

  const handleRestartSpeaking = (text: string) => {
    if (speechClientRef.current) {
      setSpeakingText(text);
      speechClientRef.current.restartSpeaking(text);
    }
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

  const handleSavePrayer = async (text: string): Promise<boolean> => {
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
        await loadPrayers(data.sessionId || sessionId, prayerScope);
        return true;
      }
      return false;
    } catch {
      return false;
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

  const handleNewSession = () => {
    speechClientRef.current?.stopSpeaking();
    speechClientRef.current?.stopListening();
    // No session row is created here — lazily created on the first message or prayer save.
    setSessionId(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("pastor_mike_session_id");
    }
    setMessages([]);
    setPrayers([]);
    setPrayerScope("session");
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

        // Load prayers strictly for the switched visit
        await loadPrayers(targetSessionId, "session");
        setPrayerScope("session");
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
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground selection:bg-[#5266eb]/30 selection:text-white">
      {/* Top Header */}
      <Header
        isVoiceMode={isVoiceMode}
        onToggleVoiceMode={handleToggleLivePastor}
        onOpenJournal={() => setIsJournalOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSettings={() => setGuideModalTab("settings")}
        onOpenOnboarding={() => setGuideModalTab("guide")}
        onNewSession={handleNewSession}
        prayerCount={prayers.filter((p) => p.status === "active").length}
        providerLabel={providerLabel}
      />

      {/* Body row: persistent visit history sidebar + chat column */}
      <div className="flex flex-1 overflow-hidden">
        {/* Pastoral Visit History — persistent sidebar on desktop, drawer on mobile */}
        <VisitHistorySidebar
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          currentSessionId={sessionId}
          onSelectSession={handleSwitchSession}
          onNewSession={() => {
            setIsHistoryOpen(false);
            handleNewSession();
          }}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {isVoiceMode ? (
              <motion.div
                key="pastor-stage"
                className="flex min-h-0 flex-1 overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <PastorStage
                  assistantText={lastAssistantMessage?.content ?? ""}
                  revealedText={sentenceSync.revealedText}
                  sentences={sentenceSync.sentences}
                  currentSentenceIndex={sentenceSync.currentSentenceIndex}
                  isLoading={isLoading}
                  isSpeaking={isSpeaking}
                  isPaused={isSpeakingPaused}
                  onTogglePlayPause={handleTogglePlayPause}
                  onRestart={handleRestartSpeaking}
                  onStop={handleStopSpeaking}
                />
              </motion.div>
            ) : (
              <motion.main
                key="conversation-list"
                className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {/* Safety Crisis Alert if triggered */}
                {latestSafety && latestSafety.isCrisis && (
                  <CrisisBanner safety={latestSafety} />
                )}

                {/* Welcome Empty State */}
                {messages.length === 0 && (
                  <div className="my-auto flex flex-col items-center justify-center text-center py-6 sm:py-10 px-2">
                    <div className="mb-3 sm:mb-4 flex h-13 w-13 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-[#5266eb]/10 text-[#5266eb] dark:bg-[#5266eb]/20 dark:text-[#9cb4e8]">
                      <HeartHandshake className="h-6 w-6 sm:h-8 sm:w-8" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      Welcome, Beloved Friend
                    </h2>
                    <p className="mt-2 max-w-md text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      I am Pastor Mike, your AI pastoral companion. I am here to
                      offer a listening ear, gentle comfort, Holy Scripture, and
                      prayer.
                    </p>
                    <div className="mt-3 sm:mt-4 flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                      <span>
                        Safe, confidential, and saved locally on your device
                      </span>
                    </div>
                  </div>
                )}

                {/* Conversation Transcript */}
                <div className={messages.length > 0 ? "flex-1 space-y-2" : "space-y-2"}>
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
                        onSavePrayer={handleSavePrayer}
                        isSpeakingNow={isThisMsgActive}
                        isPausedNow={isThisMsgPaused}
                      />
                    );
                  })}

                  {/* Typing/Thinking State */}
                  {isLoading && (
                    <div className="flex items-center gap-2 my-4 rounded-2xl rounded-tl-xs border border-slate-200/80 bg-card/90 p-4 text-xs dark:border-slate-800 dark:bg-slate-900/90">
                      <Sparkles className="h-4 w-4 animate-spin text-amber-600" />
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Pastor Mike is reflecting on your words...
                      </span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </motion.main>
            )}
          </AnimatePresence>

          {/* Voice Status Bar + Composer, pinned together at the bottom */}
          <div className="sticky bottom-0 z-20">
            <VoiceBar
              isVoiceMode={isVoiceMode}
              isListening={isListening}
              isTranscribing={isTranscribing}
              isSpeaking={isSpeaking}
              isPaused={isSpeakingPaused}
              onTogglePlayPause={() => {
                if (lastAssistantMessage?.content) {
                  handleTogglePlayPause(lastAssistantMessage.content);
                }
              }}
              speed={speechSpeed}
              onSpeedChange={setSpeechSpeed}
              voice={voicePreset}
              onVoiceChange={setVoicePreset}
              onClose={handleToggleLivePastor}
            />

            <ChatInput
              value={inputText}
              onChange={setInputText}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              isListening={isListening}
              isTranscribing={isTranscribing}
              onToggleListening={handleToggleListening}
              isSpeaking={isSpeaking}
              showStarterPills={messages.length === 0}
              micError={micError}
            />
          </div>
        </div>
      </div>

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
        scope={prayerScope}
        onToggleScope={(newScope) => {
          setPrayerScope(newScope);
          loadPrayers(sessionId, newScope);
        }}
      />

      {/* Setup Guide & AI Settings Modal (tabbed) */}
      <OnboardingModal
        key={guideModalTab ?? "closed"}
        isOpen={guideModalTab !== null}
        initialTab={guideModalTab ?? "guide"}
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
