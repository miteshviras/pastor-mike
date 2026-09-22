// Client-side voice controller supporting KittenTTS playback, browser TTS fallback,
// Web Speech STT, and turn-taking logic.

// Mirrors KITTEN_VOICES in server/kittentts_adapter.py
export const KITTEN_VOICES = ["Bella", "Jasper", "Luna", "Bruno", "Rosie", "Hugo", "Kiki", "Leo"] as const;

// Mirrors KITTEN_VOICE_PROFILES in server/kittentts_adapter.py — same reasoning applies here:
// the Web Speech API has no Jasper/Luna/etc. voices either, only whatever the OS/browser
// ships, so each preset maps onto a gender + pitch shift of an installed voice to keep the
// dropdown audibly meaningful on this fallback path too.
const KITTEN_VOICE_PROFILES: Record<string, { gender: "Male" | "Female"; pitch: number }> = {
  Bella: { gender: "Female", pitch: 1.15 },
  Jasper: { gender: "Male", pitch: 1.0 },
  Luna: { gender: "Female", pitch: 0.9 },
  Bruno: { gender: "Male", pitch: 0.8 },
  Rosie: { gender: "Female", pitch: 1.3 },
  Hugo: { gender: "Male", pitch: 1.15 },
  Kiki: { gender: "Female", pitch: 1.4 },
  Leo: { gender: "Male", pitch: 0.9 },
};

// SpeechSynthesisVoice has no standard "gender" field, so this infers it from common voice
// names shipped by Windows/Chrome/Edge/macOS.
const FEMALE_VOICE_NAME_PATTERN = /female|zira|susan|hazel|samantha|victoria|karen|moira|tessa|fiona|catherine|linda|heera|aria/i;
const MALE_VOICE_NAME_PATTERN = /male(?!f)|david|guy|mark|george|daniel|fred|ryan|oliver|james|thomas/i;

export interface SpeechClientOptions {
  speed?: number; // 0.8 to 1.2
  voicePreset?: string;
  onListeningStateChange?: (isListening: boolean) => void;
  onSpeakingStateChange?: (isSpeaking: boolean) => void;
  onTranscriptionResult?: (text: string, isFinal: boolean) => void;
  onError?: (err: string) => void;
  // Fired with the live HTMLAudioElement while KittenTTS audio is playing (and with
  // null when it stops), so callers can read currentTime/duration for pacing UI —
  // e.g. syncing avatar mouth movement or text reveal — without this class knowing about them.
  onAudioElement?: (audio: HTMLAudioElement | null) => void;
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
    try {
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
          if (e.error === "no-speech") return;
          const messages: Record<string, string> = {
            "not-allowed": "Microphone access was blocked. Allow it in your browser's site settings and try again.",
            "audio-capture": "No microphone was found. Check that one is connected and try again.",
            network: "Speech recognition needs an internet connection (Chrome routes it through Google's servers) — it isn't available offline.",
            "service-not-allowed": "The browser blocked speech recognition on this page.",
          };
          this.options.onError?.(messages[e.error] || `Speech recognition error: ${e.error}`);
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
    } catch (err) {
      console.warn("Speech recognition initialization unavailable (e.g. mobile HTTP origin):", err);
    }
  }

  // Turn-taking: Start listening (only if not speaking)
  public startListening() {
    if (this.isSpeaking) {
      return; // Do not listen over assistant speech
    }
    if (!this.recognition) {
      this.options.onError?.("Speech recognition is not available over plain HTTP on mobile. Chrome requires HTTPS or localhost for microphone access.");
      return;
    }
    if (!this.isListening) {
      try {
        this.recognition.start();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.options.onError?.(`Microphone error: ${msg}`);
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
        this.options.onAudioElement?.(audio);

        audio.onended = () => {
          this.isSpeaking = false;
          this.options.onSpeakingStateChange?.(false);
          this.options.onAudioElement?.(null);
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

    const profile = KITTEN_VOICE_PROFILES[this.options.voicePreset || "Jasper"] ?? {
      gender: "Male" as const,
      pitch: 1,
    };
    utterance.pitch = profile.pitch;

    // Pick a voice matching this preset's gender; fall back to any English voice, then
    // whatever the browser defaults to — every preset used to search for the exact same
    // "Guy/David/Male" pattern regardless of selection, which is why all voices sounded
    // identical no matter which preset (male or female) was chosen.
    const voices = window.speechSynthesis.getVoices();
    const genderPattern = profile.gender === "Female" ? FEMALE_VOICE_NAME_PATTERN : MALE_VOICE_NAME_PATTERN;
    const englishVoices = voices.filter((v) => v.lang.startsWith("en"));
    const matchedVoice = englishVoices.find((v) => genderPattern.test(v.name));
    const pickedVoice = matchedVoice || englishVoices[0];
    if (pickedVoice) {
      utterance.voice = pickedVoice;
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
      this.options.onAudioElement?.(null);
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.options.onSpeakingStateChange?.(false);
  }
}
