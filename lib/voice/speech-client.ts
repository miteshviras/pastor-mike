// Client-side voice controller supporting KittenTTS playback, browser TTS fallback,
// Web Speech STT, and turn-taking logic.

export interface SpeechClientOptions {
  speed?: number; // 0.8 to 1.2
  voicePreset?: string;
  onListeningStateChange?: (isListening: boolean) => void;
  onSpeakingStateChange?: (isSpeaking: boolean) => void;
  onTranscriptionResult?: (text: string, isFinal: boolean) => void;
  onError?: (err: string) => void;
}

// Global browser SpeechRecognition interface
interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
    length: number;
  };
}

interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
}

export class PastoralSpeechClient {
  private recognition: ISpeechRecognition | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private isSpeaking = false;
  private isListening = false;
  private options: SpeechClientOptions;

  constructor(options: SpeechClientOptions = {}) {
    this.options = {
      speed: 0.88,
      voicePreset: "Jasper",
      ...options,
    };

    if (typeof window !== "undefined") {
      this.initSpeechRecognition();
    }
  }

  public updateOptions(newOptions: Partial<SpeechClientOptions>) {
    this.options = { ...this.options, ...newOptions };
  }

  private initSpeechRecognition() {
    const windowObj = window as unknown as {
      SpeechRecognition?: new () => ISpeechRecognition;
      webkitSpeechRecognition?: new () => ISpeechRecognition;
    };

    const SpeechRecClass = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;

    if (SpeechRecClass) {
      const rec = new SpeechRecClass();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onstart = () => {
        this.isListening = true;
        this.options.onListeningStateChange?.(true);
      };

      rec.onend = () => {
        this.isListening = false;
        this.options.onListeningStateChange?.(false);
      };

      rec.onerror = (e) => {
        this.isListening = false;
        this.options.onListeningStateChange?.(false);
        if (e.error !== "no-speech") {
          this.options.onError?.(`Speech recognition error: ${e.error}`);
        }
      };

      rec.onresult = (e: SpeechRecognitionEvent) => {
        let transcript = "";
        let isFinal = false;

        for (let i = 0; i < e.results.length; i++) {
          transcript += e.results[i][0].transcript;
          if (e.results[i].isFinal) isFinal = true;
        }

        this.options.onTranscriptionResult?.(transcript, isFinal);
      };

      this.recognition = rec;
    }
  }

  // Turn-taking: Start listening (only if not speaking)
  public startListening() {
    if (this.isSpeaking) {
      return; // Do not listen over assistant speech
    }
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
      } catch {
        // Recognition already started
      }
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
    }
  }

  // Speak text with KittenTTS or browser speech fallback
  public async speakText(text: string): Promise<void> {
    // 1. Stop listening during speech (turn-taking rule)
    this.stopListening();
    this.stopSpeaking();

    this.isSpeaking = true;
    this.options.onSpeakingStateChange?.(true);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice: this.options.voicePreset || "Jasper",
          speed: this.options.speed || 0.88,
        }),
      });

      const contentType = res.headers.get("content-type") || "";

      if (res.ok && contentType.includes("audio/wav")) {
        // Played from KittenTTS WAV output
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        this.currentAudio = audio;

        audio.onended = () => {
          this.isSpeaking = false;
          this.options.onSpeakingStateChange?.(false);
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = () => {
          this.fallbackBrowserTTS(text);
        };

        await audio.play();
      } else {
        // Fallback to browser Web Speech API
        this.fallbackBrowserTTS(text);
      }
    } catch {
      this.fallbackBrowserTTS(text);
    }
  }

  private fallbackBrowserTTS(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      this.isSpeaking = false;
      this.options.onSpeakingStateChange?.(false);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown stars or brackets from speech text
    const cleanText = text.replace(/[*#_>]/g, "").replace(/\n+/g, " ").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = this.options.speed || 0.88;
    utterance.pitch = 0.98;

    // Pick a natural calm voice if available
    const voices = window.speechSynthesis.getVoices();
    const calmVoice = voices.find(v => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Guy") || v.name.includes("David") || v.name.includes("Male")));
    if (calmVoice) {
      utterance.voice = calmVoice;
    }

    utterance.onend = () => {
      this.isSpeaking = false;
      this.options.onSpeakingStateChange?.(false);
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.options.onSpeakingStateChange?.(false);
    };

    window.speechSynthesis.speak(utterance);
  }

  public stopSpeaking() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.options.onSpeakingStateChange?.(false);
  }
}
