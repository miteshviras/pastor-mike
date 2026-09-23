"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { chunkTextForTTS } from "./speech-client";

export interface SentenceSync {
  sentences: string[];
  currentSentenceIndex: number;
  revealedText: string;
  setAudioElement: (audio: HTMLAudioElement | null) => void;
  setCurrentChunkIndex: (index: number) => void;
}

export function useSentenceSync(text: string, isSpeaking: boolean): SentenceSync {
  const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Divide into chunks using chunkTextForTTS so UI units match KittenTTS playback units
  const sentences = useMemo(() => {
    if (!text || !text.trim()) return [];
    return chunkTextForTTS(text);
  }, [text]);

  // When speech stops, reset chunk index
  useEffect(() => {
    if (!isSpeaking) {
      setCurrentChunkIndex(-1);
    }
  }, [isSpeaking]);

  const setAudioElement = (audio: HTMLAudioElement | null) => {
    audioRef.current = audio;
  };

  return {
    sentences,
    currentSentenceIndex: isSpeaking ? currentChunkIndex : -1,
    revealedText: text,
    setAudioElement,
    setCurrentChunkIndex,
  };
}
