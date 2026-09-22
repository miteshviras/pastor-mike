"use client";

import React, { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { ChatMessage, ChatMessageProps } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { PrayerJournalModal } from "@/components/PrayerJournalModal";
import { VisitHistoryModal } from "@/components/VisitHistoryModal";
import { McpModal } from "@/components/McpModal";
import { OnboardingModal } from "@/components/OnboardingModal";
import { VoiceBar } from "@/components/VoiceBar";
import { CrisisBanner } from "@/components/CrisisBanner";
import { PastoralSpeechClient, KITTEN_VOICES } from "@/lib/voice/speech-client";
import type { PrayerRequest } from "@/lib/db";
import { SafetyCheckResult } from "@/lib/ai/safety";
import { Sparkles, HeartHandshake } from "lucide-react";

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSpeed, setSpeechSpeed] = useState(0.88);
  const [voicePreset, setVoicePreset] = useState<string>(() => {
    if (typeof window === "undefined") return "Jasper";
    const saved = localStorage.getItem("pastor_mike_voice");
    return saved && (KITTEN_VOICES as readonly string[]).includes(saved) ? saved : "Jasper";
  });
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [prayerScope, setPrayerScope] = useState<"session" | "all">("session");
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMcpOpen, setIsMcpOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [latestSafety, setLatestSafety] = useState<SafetyCheckResult | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [mcpInfo, setMcpInfo] = useState<{
    isConnected: boolean;
    clientName: string;
    transport?: string;
    toolsCount?: number;
  }>({
    isConnected: true,
    clientName: "Antigravity 2.0 (Google Antigravity)",
    transport: "stdio",
    toolsCount: 7,
  });
  const [providerLabel, setProviderLabel] = useState<string>("Gemini");

  const speechClientRef = useRef<PastoralSpeechClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Speech Client
  useEffect(() => {
    const client = new PastoralSpeechClient({
      speed: speechSpeed,
      voicePreset,
      onListeningStateChange: (listening) => {
        setIsListening(listening);
        if (listening) setMicError(null);
      },
      onSpeakingStateChange: (speaking) => setIsSpeaking(speaking),
      onTranscriptionResult: (transcript, isFinal) => {
        if (isFinal && transcript.trim()) {
          handleSendMessage(transcript.trim());
        }
      },
      onError: (err) => setMicError(err),
    });
    speechClientRef.current = client;

    return () => {
      client.stopSpeaking();
      client.stopListening();
    };
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

  const loadPrayers = async (sid?: string | null, scope: "session" | "all" = prayerScope) => {
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
        // 1. Fetch active MCP client status
        try {
          const mcpRes = await fetch("/api/mcp");
          if (mcpRes.ok) {
            const mcpData = await mcpRes.json();
            if (mcpData.activeClient) {
              setMcpInfo(mcpData.activeClient);
            }
          }
        } catch {}

        // 1b. Fetch the active AI provider (shown as a header badge)
        try {
          const settingsRes = await fetch("/api/settings");
          if (settingsRes.ok) {
            const settingsData = await settingsRes.json();
            if (settingsData.settings?.provider) {
              const labels: Record<string, string> = { gemini: "Gemini", ollama: "Ollama", offline: "Offline" };
              setProviderLabel(labels[settingsData.settings.provider] || settingsData.settings.provider);
            }
          }
        } catch {}

        // 2. Check localStorage for existing active session
        let activeSessionId: string | null = null;
        const savedSessionId = typeof window !== "undefined" ? localStorage.getItem("pastor_mike_session_id") : null;

        if (savedSessionId) {
          const msgRes = await fetch(`/api/sessions?sessionId=${encodeURIComponent(savedSessionId)}`);
          if (msgRes.ok) {
            const msgData = await msgRes.json();
            if (msgData.session) {
              activeSessionId = msgData.session.id;
              setSessionId(msgData.session.id);
              if (msgData.messages && msgData.messages.length > 0) {
                setMessages(
                  msgData.messages.map((m: { id: string; role: "user" | "assistant" | "system"; content: string; metadata: string | null; created_at: string }) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    metadata: m.metadata ? JSON.parse(m.metadata) : null,
                    createdAt: m.created_at,
                  }))
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
                const msgRes = await fetch(`/api/sessions?sessionId=${encodeURIComponent(s.id)}`);
                if (msgRes.ok) {
                  const msgData = await msgRes.json();
                  if (msgData.messages && msgData.messages.length > 0) {
                    activeSessionId = s.id;
                    setSessionId(s.id);
                    if (typeof window !== "undefined") {
                      localStorage.setItem("pastor_mike_session_id", s.id);
                    }
                    setMessages(
                      msgData.messages.map((m: { id: string; role: "user" | "assistant" | "system"; content: string; metadata: string | null; created_at: string }) => ({
                        id: m.id,
                        role: m.role,
                        content: m.content,
                        metadata: m.metadata ? JSON.parse(m.metadata) : null,
                        createdAt: m.created_at,
                      }))
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

        // 4. Create new session only if no sessions exist at all
        if (!activeSessionId) {
          const createRes = await fetch("/api/sessions", { method: "POST" });
          if (createRes.ok) {
            const createData = await createRes.json();
            activeSessionId = createData.session.id;
            setSessionId(createData.session.id);
            if (typeof window !== "undefined") {
              localStorage.setItem("pastor_mike_session_id", createData.session.id);
            }
          }
        }

        // 5. Load visit-scoped prayers strictly for the active session (empty for brand new session)
        if (activeSessionId) {
          await loadPrayers(activeSessionId, "session");
        } else {
          setPrayers([]);
        }

        // 6. Check if first-time onboarding should be displayed
        const hasOnboarded = typeof window !== "undefined" ? localStorage.getItem("pastor_mike_onboarded") === "true" : true;
        if (!hasOnboarded) {
          setIsOnboardingOpen(true);
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

      if (data.mcp) {
        setMcpInfo(data.mcp);
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
          mcp: data.mcp,
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
        speechClientRef.current.speakText(speechText);
      }
    } catch (err) {
      console.error("Error sending message:", err);
      const errorMsg: ChatMessageProps = {
        id: "err_" + Date.now(),
        role: "assistant",
        content: "I'm having a brief moment of difficulty connecting. Please take a quiet breath and try speaking with me again.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = (text: string) => {
    if (speechClientRef.current) {
      if (isSpeaking) {
        speechClientRef.current.stopSpeaking();
      } else {
        speechClientRef.current.speakText(text);
      }
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
        await loadPrayers(sessionId, prayerScope);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleDeletePrayer = async (prayerId: string) => {
    try {
      const res = await fetch(`/api/prayers?id=${encodeURIComponent(prayerId)}`, { method: "DELETE" });
      if (res.ok) {
        setPrayers((prev) => prev.filter((p) => p.id !== prayerId));
      }
    } catch (err) {
      console.error("Error deleting prayer:", err);
    }
  };

  const handleTogglePrayerStatus = async (prayerId: string, currentStatus: "active" | "answered") => {
    const nextStatus = currentStatus === "active" ? "answered" : "active";
    try {
      const res = await fetch("/api/prayers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: prayerId, status: nextStatus }),
      });
      if (res.ok) {
        setPrayers((prev) =>
          prev.map((p) => (p.id === prayerId ? { ...p, status: nextStatus } : p))
        );
      }
    } catch (err) {
      console.error("Error updating prayer status:", err);
    }
  };

  const handleNewSession = async () => {
    try {
      speechClientRef.current?.stopSpeaking();
      speechClientRef.current?.stopListening();
      const res = await fetch("/api/sessions", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.session.id);
        if (typeof window !== "undefined") {
          localStorage.setItem("pastor_mike_session_id", data.session.id);
        }
        setMessages([]);
        setPrayers([]);
        setPrayerScope("session");
        setLatestSafety(null);
      }
    } catch (err) {
      console.error("Error creating new session:", err);
    }
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

      const msgRes = await fetch(`/api/sessions?sessionId=${encodeURIComponent(targetSessionId)}`);
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        setSessionId(targetSessionId);
        if (typeof window !== "undefined") {
          localStorage.setItem("pastor_mike_session_id", targetSessionId);
        }
        setMessages(
          (msgData.messages || []).map((m: { id: string; role: "user" | "assistant" | "system"; content: string; metadata: string | null; created_at: string }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            metadata: m.metadata ? (typeof m.metadata === "string" ? JSON.parse(m.metadata) : m.metadata) : null,
            createdAt: m.created_at,
          }))
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

  const handleCompleteOnboarding = (prefs: { name: string; topics: string[]; enableVoice: boolean }) => {
    if (prefs.enableVoice) {
      setIsVoiceMode(true);
    }

    if (messages.length === 0) {
      const topicText = prefs.topics.length > 0 ? `regarding ${prefs.topics.join(" and ")}` : "in your heart";
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
    <div className="flex min-h-[100dvh] flex-col bg-[#faf8f5] text-stone-900 selection:bg-[#445942]/20 selection:text-stone-900 dark:bg-[#141312] dark:text-stone-100">
      {/* Top Header */}
      <Header
        isVoiceMode={isVoiceMode}
        onToggleVoiceMode={() => setIsVoiceMode(!isVoiceMode)}
        onOpenJournal={() => setIsJournalOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenMcp={() => setIsMcpOpen(true)}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onNewSession={handleNewSession}
        prayerCount={prayers.filter((p) => p.status === "active").length}
        isMcpConnected={mcpInfo.isConnected}
        mcpClientName={mcpInfo.clientName}
        providerLabel={providerLabel}
      />

      {/* Main Conversation Canvas */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-3 py-3 sm:px-4 sm:py-6">
        {/* Safety Crisis Alert if triggered */}
        {latestSafety && latestSafety.isCrisis && (
          <CrisisBanner safety={latestSafety} />
        )}

        {/* Welcome Empty State */}
        {messages.length === 0 && (
          <div className="my-auto flex flex-col items-center justify-center text-center py-6 sm:py-10 px-2">
            <div className="mb-3 sm:mb-4 flex h-13 w-13 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-[#445942]/10 text-[#445942] dark:bg-[#5b7858]/20 dark:text-[#7ba277]">
              <HeartHandshake className="h-6 w-6 sm:h-8 sm:w-8" />
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-semibold text-stone-900 dark:text-stone-100">
              Welcome, Beloved Friend
            </h2>
            <p className="mt-2 max-w-md text-xs sm:text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              I am Pastor Mike, your AI pastoral companion. I am here to offer a listening ear, gentle comfort, Holy Scripture, and prayer.
            </p>
            <div className="mt-3 sm:mt-4 flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-stone-500 dark:text-stone-400">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span>Safe, confidential, and saved locally on your device</span>
            </div>
          </div>
        )}

        {/* Conversation Transcript */}
        <div className="flex-1 space-y-2">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              {...msg}
              onSpeak={handleSpeak}
              onSavePrayer={handleSavePrayer}
              isSpeakingNow={isSpeaking}
            />
          ))}

          {/* Typing/Thinking State with Live MCP Connection Check */}
          {isLoading && (
            <div className="flex flex-col gap-2 my-4 rounded-2xl rounded-tl-xs border border-stone-200/80 bg-white/90 p-4 text-xs shadow-2xs dark:border-stone-800 dark:bg-stone-900/90">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
                  <Sparkles className="h-4 w-4 animate-spin text-amber-600" />
                  <span className="font-serif font-medium">Pastor Mike is reflecting on your words...</span>
                </div>
                {mcpInfo.isConnected && (
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50 text-[11px] font-medium">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span>MCP Active: <strong>{mcpInfo.clientName}</strong></span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-stone-400 dark:text-stone-500 pl-6">
                Checking MCP tools &bull; Executing <code className="font-mono text-[10px] bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded">get_recent_context</code> &bull; Querying <code className="font-mono text-[10px] bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded">search_scripture</code>...
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Floating Voice Status Bar */}
      <VoiceBar
        isVoiceMode={isVoiceMode}
        isListening={isListening}
        isSpeaking={isSpeaking}
        speed={speechSpeed}
        onSpeedChange={setSpeechSpeed}
        voice={voicePreset}
        onVoiceChange={setVoicePreset}
        onClose={() => setIsVoiceMode(false)}
      />

      {/* Bottom Composer Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        isListening={isListening}
        onToggleListening={handleToggleListening}
        isSpeaking={isSpeaking}
        showStarterPills={messages.length === 0}
        micError={micError}
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
        scope={prayerScope}
        onToggleScope={(newScope) => {
          setPrayerScope(newScope);
          loadPrayers(sessionId, newScope);
        }}
      />

      {/* Visit History Modal */}
      <VisitHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        currentSessionId={sessionId}
        onSelectSession={handleSwitchSession}
        onNewSession={() => {
          setIsHistoryOpen(false);
          handleNewSession();
        }}
      />

      {/* MCP & Tools Settings Modal */}
      <McpModal
        isOpen={isMcpOpen}
        onClose={() => setIsMcpOpen(false)}
        onProviderChange={(provider) => {
          const labels: Record<string, string> = { gemini: "Gemini", ollama: "Ollama", offline: "Offline" };
          setProviderLabel(labels[provider] || provider);
        }}
      />

      {/* First-Time User Onboarding & Voice Check Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={handleCompleteOnboarding}
        sessionId={sessionId}
      />
    </div>
  );
}
