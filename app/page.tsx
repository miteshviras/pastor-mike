"use client";

import React, { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { ChatMessage, ChatMessageProps } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { PrayerJournalModal } from "@/components/PrayerJournalModal";
import { VoiceBar } from "@/components/VoiceBar";
import { CrisisBanner } from "@/components/CrisisBanner";
import { PastoralSpeechClient } from "@/lib/voice/speech-client";
import { PrayerRequest } from "@/lib/db";
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
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [latestSafety, setLatestSafety] = useState<SafetyCheckResult | null>(null);

  const speechClientRef = useRef<PastoralSpeechClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Speech Client
  useEffect(() => {
    const client = new PastoralSpeechClient({
      speed: speechSpeed,
      onListeningStateChange: (listening) => setIsListening(listening),
      onSpeakingStateChange: (speaking) => setIsSpeaking(speaking),
      onTranscriptionResult: (transcript, isFinal) => {
        if (isFinal && transcript.trim()) {
          handleSendMessage(transcript.trim());
        }
      },
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

  // Load or create initial session and prayers
  useEffect(() => {
    async function init() {
      try {
        // 1. Fetch prayers
        const pRes = await fetch("/api/prayers");
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData.prayers) setPrayers(pData.prayers);
        }

        // 2. Fetch existing sessions or create new
        const sRes = await fetch("/api/sessions");
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData.sessions && sData.sessions.length > 0) {
            const latestSession = sData.sessions[0];
            setSessionId(latestSession.id);

            // Fetch messages for this session
            const msgRes = await fetch(`/api/sessions?sessionId=${latestSession.id}`);
            if (msgRes.ok) {
              const msgData = await msgRes.json();
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
                return;
              }
            }
          }
        }

        // Create new session if none exists
        const createRes = await fetch("/api/sessions", { method: "POST" });
        if (createRes.ok) {
          const createData = await createRes.json();
          setSessionId(createData.session.id);
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
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
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
        const pRes = await fetch("/api/prayers");
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData.prayers) setPrayers(pData.prayers);
        }
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
        const pRes = await fetch("/api/prayers");
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData.prayers) setPrayers(pData.prayers);
        }
        return true;
      }
      return false;
    } catch {
      return false;
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
        setMessages([]);
        setLatestSafety(null);
      }
    } catch (err) {
      console.error("Error creating new session:", err);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#faf8f5] text-stone-900 selection:bg-[#445942]/20 selection:text-stone-900 dark:bg-[#141312] dark:text-stone-100">
      {/* Top Header */}
      <Header
        isVoiceMode={isVoiceMode}
        onToggleVoiceMode={() => setIsVoiceMode(!isVoiceMode)}
        onOpenJournal={() => setIsJournalOpen(true)}
        onNewSession={handleNewSession}
        prayerCount={prayers.filter((p) => p.status === "active").length}
      />

      {/* Main Conversation Canvas */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        {/* Safety Crisis Alert if triggered */}
        {latestSafety && latestSafety.isCrisis && (
          <CrisisBanner safety={latestSafety} />
        )}

        {/* Welcome Empty State */}
        {messages.length === 0 && (
          <div className="my-auto flex flex-col items-center justify-center text-center py-10">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#445942]/10 text-[#445942] dark:bg-[#5b7858]/20 dark:text-[#7ba277]">
              <HeartHandshake className="h-8 w-8" />
            </div>
            <h2 className="font-serif text-2xl font-semibold text-stone-900 dark:text-stone-100">
              Welcome, Beloved Friend
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              I am Pastor Mike, your AI pastoral companion. I am here to offer a listening ear, gentle comfort, Holy Scripture, and prayer.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
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

          {/* Typing/Thinking State */}
          {isLoading && (
            <div className="flex items-center gap-2 my-4 rounded-2xl rounded-tl-xs border border-stone-200/80 bg-white/80 px-4 py-3 text-xs text-stone-500 shadow-2xs dark:border-stone-800 dark:bg-stone-900/80">
              <Sparkles className="h-4 w-4 animate-spin text-amber-600" />
              <span className="font-serif italic">Pastor Mike is reflecting on scripture and holding you in prayer...</span>
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
      />
    </div>
  );
}
