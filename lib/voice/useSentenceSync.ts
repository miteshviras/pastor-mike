"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;
// Average spoken reading rate, used to estimate playback duration from text length.
const CHARS_PER_SECOND = 14;

export interface SentenceSync {
  sentences: string[];
  currentSentenceIndex: number;
  revealedText: string;
  setAudioElement: (audio: HTMLAudioElement | null) => void;
}

// ponytail: paces text reveal from audio.currentTime against a fixed reading-rate estimate
// (not audio.duration — Chromium reports Infinity for some blob-sourced WAV audio until a
// seek forces recalculation, which would stall pacing at 0 for the exact KittenTTS WAV
// playback path this app uses), and isn't real word timing either way. Upgrade path:
// SpeechSynthesisUtterance.onboundary for the browser-TTS fallback, or a streaming TTS API.
export function useSentenceSync(text: string, isSpeaking: boolean): SentenceSync {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 0..1 progress through the current utterance's audio, driven by the timeupdate subscription below.
  const [progress, setProgress] = useState(0);
  const [hasAudio, setHasAudio] = useState(false);

  const sentences = useMemo(() => (text ? text.split(SENTENCE_SPLIT) : []), [text]);

  // Subscribes to the audio element's native progress events — the one legitimate
  // "external system" case for calling setState from inside an effect. Depends on `hasAudio`
  // (not just `isSpeaking`) because the real audio element usually isn't ready yet the instant
  // isSpeaking flips true — KittenTTS synthesis takes a moment after that — so this must also
  // re-run once setAudioElement supplies it, or the listener never actually gets attached.
  useEffect(() => {
    const audio = audioRef.current;
    if (!isSpeaking || !audio) return;

    const estimatedDuration = Math.max(text.length / CHARS_PER_SECOND, 0.1);
    const handleTimeUpdate = () => {
      setProgress(Math.min(1, audio.currentTime / estimatedDuration));
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => audio.removeEventListener("timeupdate", handleTimeUpdate);
  }, [isSpeaking, text, hasAudio]);

  // Not speaking, or no audio element (browser-TTS fallback path): show the full text at rest —
  // derived directly at render time rather than synced through an effect.
  const effectiveProgress = isSpeaking && hasAudio ? progress : 1;
  const revealedChars = Math.floor(effectiveProgress * text.length);
  const revealedText = text.slice(0, revealedChars);

  let currentSentenceIndex = -1;
  if (sentences.length > 0) {
    currentSentenceIndex = sentences.length - 1;
    let offset = 0;
    for (let i = 0; i < sentences.length; i++) {
      offset += sentences[i].length + 1; // +1 for the split whitespace
      if (revealedChars < offset) {
        currentSentenceIndex = i;
        break;
      }
    }
  }

  // Exposed so the owner can wire PastoralSpeechClient's onAudioElement callback here.
  // Called from that callback (not from a React effect), so resetting progress here is safe.
  const setAudioElement = (audio: HTMLAudioElement | null) => {
    audioRef.current = audio;
    setHasAudio(audio !== null);
    setProgress(0);
  };

  return { sentences, currentSentenceIndex, revealedText, setAudioElement };
}
