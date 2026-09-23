// Client-side voice controller supporting KittenTTS playback, browser TTS fallback,
// Web Speech STT (with a server-side Moonshine fallback for browsers that lack it), and
// turn-taking logic.

import { cleanTextForTTS } from "./ttsTextCleaner";

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
  onTranscribingChange?: (isTranscribing: boolean) => void;
  onSpeakingStateChange?: (isSpeaking: boolean, isPaused?: boolean) => void;
  onTranscriptionResult?: (text: string, isFinal: boolean) => void;
  onError?: (err: string) => void;
  onEngineChange?: (engine: "browser" | "moonshine") => void;
  // Real-time chunk notification for lyrics synchronization
  onSpeakingChunkChange?: (chunkIndex: number, totalChunks: number, chunkText: string) => void;
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

/**
 * Chunks text for TTS generation:
 * Checks for fullstop (. ! ?) or comma (, ; : —).
 * If a fullstop or comma exists within the 10-15 word span, breaks cleanly at that punctuation.
 * If no fullstop or comma is found within that span, falls back to 10-15 words queuing.
 */
export function chunkTextForTTS(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const isFullStop = (w: string) => {
    // Avoid splitting on common title and scripture abbreviations
    if (/^(mr|mrs|ms|dr|vs|st|gen|ps|prov|phil|matt|rev|cor|rom|heb|tim|pet|thess|gal|eph|col)\.$/i.test(w)) {
      return false;
    }
    return /[.!?]["')\]]*$/.test(w);
  };

  const isComma = (w: string) => /[,;:]["')\]]*$/.test(w) || w.endsWith("—") || w.endsWith("--");

  const chunks: string[] = [];
  let start = 0;

  const TARGET_MAX_WORDS = 15;
  const DEFAULT_FALLBACK_CHUNK = 12; // 10-15 words when no punctuation is present

  while (start < words.length) {
    const maxIndex = Math.min(start + TARGET_MAX_WORDS - 1, words.length - 1);

    const fullStopsInWindow: number[] = [];
    const commasInWindow: number[] = [];

    for (let i = start; i <= maxIndex; i++) {
      if (isFullStop(words[i])) {
        fullStopsInWindow.push(i);
      } else if (isComma(words[i])) {
        commasInWindow.push(i);
      }
    }

    let cutIndex = -1;

    // 1. Check for fullstop in the window
    if (fullStopsInWindow.length > 0) {
      if (maxIndex === words.length - 1 && fullStopsInWindow.length === 1 && fullStopsInWindow[0] === words.length - 1) {
        // Only one fullstop at the very end of the remaining words: take to end
        cutIndex = words.length - 1;
      } else {
        // If there are fullstops, choose the first fullstop that has >= 3 words,
        // or the last fullstop in the window if all are tiny (< 3 words)
        let chosen = fullStopsInWindow[0];
        for (const fsIdx of fullStopsInWindow) {
          const len = fsIdx - start + 1;
          if (len >= 3) {
            chosen = fsIdx;
            break;
          }
          chosen = fsIdx;
        }
        cutIndex = chosen;
      }
    } else if (commasInWindow.length > 0) {
      // 2. Check for comma in the window
      // Prefer comma giving between 5 and 15 words, or latest comma in window
      let chosen = commasInWindow[0];
      for (const cmIdx of commasInWindow) {
        const len = cmIdx - start + 1;
        if (len >= 5) {
          chosen = cmIdx;
        }
      }
      cutIndex = chosen;
    } else {
      // 3. No fullstop or comma:
      // "if no fullstop or comma so then 10 to 15 words queuing"
      cutIndex = Math.min(start + DEFAULT_FALLBACK_CHUNK - 1, words.length - 1);
    }

    chunks.push(words.slice(start, cutIndex + 1).join(" "));
    start = cutIndex + 1;
  }

  return chunks;
}

export class PastoralSpeechClient {
  private recognition: ISpeechRecognition | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private isSpeaking = false;
  private isPaused = false;
  private currentText = "";
  private currentChunkIndex = 0;
  private resumeResolver: (() => void) | null = null;
  private isListening = false;
  private options: SpeechClientOptions;
  // Incremented on every stopSpeaking()/new speakText() call so an in-flight chunk loop
  // notices it's been superseded and stops fetching/playing further chunks.
  private speakGeneration = 0;
  // Moonshine STT fallback state
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private accumulatedMoonshineText = "";
  private vadAudioContext: AudioContext | null = null;
  private vadInterval: ReturnType<typeof setInterval> | null = null;
  // Tracks active listening mode: "browser" (native Web Speech API) or "moonshine" (MediaRecorder -> /api/stt)
  private activeListeningMode: "browser" | "moonshine" | null = null;
  private browserRecognitionFailed = false;
  private isFallingBackToMoonshine = false;
  private isStoppingListening = false;
  private inFlightTranscription: Promise<void> | null = null;
  private transcriptionTaskId = 0;

  constructor(options: SpeechClientOptions = {}) {
    this.options = {
      speed: 0.88,
      voicePreset: "Jasper",
      ...options,
    };

    if (typeof window !== "undefined") {
      try {
        if (localStorage.getItem("pastor_mike_browser_stt_failed") === "true") {
          this.browserRecognitionFailed = true;
        }
      } catch {}
      this.initSpeechRecognition();
    }
  }

  public updateOptions(newOptions: Partial<SpeechClientOptions>) {
    this.options = { ...this.options, ...newOptions };
  }

  public getActiveListeningEngine(): "browser" | "moonshine" | null {
    return this.activeListeningMode;
  }

  public resetBrowserRecognition() {
    this.browserRecognitionFailed = false;
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("pastor_mike_browser_stt_failed");
      }
    } catch {}
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
        // Continuous listening: keeps listening and transcribing phrases on each pause
        // until the user explicitly clicks the microphone button to stop!
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-US";

        rec.onstart = () => {
          this.isListening = true;
          this.activeListeningMode = "browser";
          this.options.onEngineChange?.("browser");
          this.options.onListeningStateChange?.(true);
        };

        rec.onend = () => {
          // If we are currently transitioning to or already active in Moonshine fallback, do NOT wipe state
          if (this.isFallingBackToMoonshine || this.activeListeningMode === "moonshine") {
            this.isFallingBackToMoonshine = false;
            return;
          }
          // If the user hasn't clicked stop yet, keep listening seamlessly
          if (this.isListening && this.activeListeningMode === "browser") {
            try {
              this.recognition?.start();
              return;
            } catch {}
          }
          this.isListening = false;
          this.activeListeningMode = null;
          this.options.onListeningStateChange?.(false);
        };

        rec.onerror = (e) => {
          if (e.error === "no-speech") {
            // In continuous listening, silence between sentences is normal. Do not abort listening.
            return;
          }

          // Network or service blocked means browser's cloud speech recognition is down/offline.
          // Fall back gracefully to local Moonshine STT without alarming console warnings!
          if (e.error === "network" || e.error === "service-not-allowed") {
            console.info(`[SpeechClient] Browser speech recognition encountered "${e.error}", falling back to local Moonshine STT`);
            this.browserRecognitionFailed = true;
            try {
              if (typeof window !== "undefined") {
                localStorage.setItem("pastor_mike_browser_stt_failed", "true");
              }
            } catch {}
            this.isFallingBackToMoonshine = true;
            void this.startListeningViaMoonshine();
            return;
          }

          this.isListening = false;
          this.activeListeningMode = null;
          this.options.onListeningStateChange?.(false);

          const messages: Record<string, string> = {
            "not-allowed": "Microphone access was blocked. Allow it in your browser's site settings and try again.",
            "audio-capture": "No microphone was found. Check that one is connected and try again.",
          };
          this.options.onError?.(messages[e.error] || `Speech recognition error: ${e.error}`);
        };

        rec.onresult = (e: SpeechRecognitionEvent) => {
          let fullTranscript = "";
          let isFinal = false;

          for (let i = 0; i < e.results.length; i++) {
            const part = e.results[i]?.[0]?.transcript?.trim();
            if (part) {
              fullTranscript += (fullTranscript ? " " : "") + part;
            }
            if (e.results[i]?.isFinal) {
              isFinal = true;
            }
          }

          if (fullTranscript) {
            this.options.onTranscriptionResult?.(fullTranscript, isFinal);
          }
        };

        this.recognition = rec;
      }
    } catch (err) {
      console.warn("Speech recognition initialization unavailable (e.g. mobile HTTP origin):", err);
    }
  }

  // Turn-taking: Start listening (only if not speaking).
  // Prioritizes browser input (Web Speech API) first; falls back to Moonshine STT if not working/offline.
  public startListening() {
    if (this.isSpeaking) {
      return; // Do not listen over assistant speech
    }

    this.accumulatedMoonshineText = "";
    this.isStoppingListening = false;

    // Priority 1: Browser SpeechRecognition (if available and not known to have failed)
    if (this.recognition && !this.browserRecognitionFailed) {
      if (!this.isListening) {
        try {
          this.activeListeningMode = "browser";
          this.options.onEngineChange?.("browser");
          this.recognition.start();
          return;
        } catch (err: unknown) {
          console.info("[SpeechClient] Browser SpeechRecognition start unavailable, switching to Moonshine STT:", err);
          this.browserRecognitionFailed = true;
          try {
            if (typeof window !== "undefined") {
              localStorage.setItem("pastor_mike_browser_stt_failed", "true");
            }
          } catch {}
          // Fall through to Moonshine fallback below
        }
      } else {
        return;
      }
    }

    // Priority 2: Fallback to local Moonshine STT via MediaRecorder -> /api/stt
    if (
      !this.isListening &&
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined"
    ) {
      void this.startListeningViaMoonshine();
      return;
    }

    this.options.onError?.("Speech recognition is not available in this browser.");
  }

  public async stopListening(): Promise<void> {
    if (this.isStoppingListening) return;
    this.isStoppingListening = true;

    // 1. Web Speech API stop
    if (this.activeListeningMode === "browser" || (this.recognition && this.isListening && !this.mediaRecorder)) {
      this.isListening = false;
      this.activeListeningMode = null;
      this.options.onListeningStateChange?.(false);
      try {
        this.recognition?.stop();
      } catch {}
      this.isStoppingListening = false;
      return;
    }

    // 2. Moonshine STT Stop & Transcribe
    if (this.activeListeningMode === "moonshine" || this.mediaRecorder) {
      // Immediately reset listening flag so mic button returns to idle/stops pulsing
      this.isListening = false;
      this.activeListeningMode = null;
      this.options.onListeningStateChange?.(false);

      if (this.vadInterval) {
        clearInterval(this.vadInterval);
        this.vadInterval = null;
      }
      if (this.vadAudioContext && this.vadAudioContext.state !== "closed") {
        try {
          void this.vadAudioContext.close();
        } catch {}
        this.vadAudioContext = null;
      }

      const recorder = this.mediaRecorder;
      const stream = this.mediaStream;
      const pendingChunks = [...this.audioChunks];
      this.mediaRecorder = null;
      this.mediaStream = null;
      this.audioChunks = [];

      this.options.onTranscribingChange?.(true);

      // Asynchronously await recorder.onstop to ensure the final audio buffer is completely flushed
      let blob: Blob | null = null;
      if (recorder && recorder.state !== "inactive") {
        blob = await new Promise<Blob | null>((resolve) => {
          const collected = [...pendingChunks];
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) collected.push(e.data);
          };
          recorder.onstop = () => {
            const mime = recorder.mimeType || "audio/webm";
            resolve(new Blob(collected, { type: mime }));
          };
          recorder.onerror = () => resolve(null);
          try {
            recorder.stop();
          } catch {
            resolve(null);
          }
        });
      }

      // Safely stop audio stream tracks only after recorder has completely flushed
      stream?.getTracks().forEach((t) => t.stop());

      // Await any in-flight pause background transcription before finalizing
      if (this.inFlightTranscription) {
        try {
          await this.inFlightTranscription;
        } catch {}
        this.inFlightTranscription = null;
      }

      if (blob && blob.size >= 400) {
        try {
          const res = await fetch("/api/stt", {
            method: "POST",
            headers: { "Content-Type": blob.type || "audio/webm" },
            body: blob,
          });
          if (res.ok) {
            const data = await res.json();
            const transcribed = data.text?.trim();
            if (transcribed) {
              this.accumulatedMoonshineText = this.accumulatedMoonshineText
                ? `${this.accumulatedMoonshineText} ${transcribed}`
                : transcribed;
              this.options.onTranscriptionResult?.(this.accumulatedMoonshineText, true);
            }
          } else {
            console.warn("[SpeechClient] /api/stt error on stop:", res.status);
          }
        } catch (err) {
          console.warn("[SpeechClient] Stop transcription failed:", err);
        }
      }

      this.options.onTranscribingChange?.(false);
    }

    this.isStoppingListening = false;
  }

  private setupMoonshineRecorder(stream: MediaStream) {
    this.audioChunks = [];
    let recorder: MediaRecorder;
    const preferredTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "",
    ];
    let selectedType = "";
    for (const type of preferredTypes) {
      if (!type || (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(type))) {
        selectedType = type;
        break;
      }
    }

    try {
      recorder = selectedType ? new MediaRecorder(stream, { mimeType: selectedType }) : new MediaRecorder(stream);
    } catch {
      recorder = new MediaRecorder(stream);
    }

    this.mediaRecorder = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.audioChunks.push(e.data);
      }
    };

    recorder.start(100);
  }

  private async handleMoonshinePause(): Promise<void> {
    if (!this.isListening || this.activeListeningMode !== "moonshine" || !this.mediaRecorder || !this.mediaStream) {
      return;
    }

    const oldRecorder = this.mediaRecorder;
    const oldChunks = [...this.audioChunks];
    this.audioChunks = [];

    // Immediately start recording into a new MediaRecorder on the same stream
    // so not even 1ms of audio is missed during or after the pause
    let newRecorder: MediaRecorder;
    const mimeType = oldRecorder.mimeType || "audio/webm";
    try {
      newRecorder = mimeType
        ? new MediaRecorder(this.mediaStream, { mimeType })
        : new MediaRecorder(this.mediaStream);
    } catch {
      newRecorder = new MediaRecorder(this.mediaStream);
    }

    this.mediaRecorder = newRecorder;
    newRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.audioChunks.push(e.data);
      }
    };
    newRecorder.start(100);

    // Stop old recorder and collect its finalized blob
    const blob = await new Promise<Blob | null>((resolve) => {
      const collected = [...oldChunks];
      oldRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) collected.push(e.data);
      };
      oldRecorder.onstop = () => {
        resolve(new Blob(collected, { type: mimeType }));
      };
      oldRecorder.onerror = () => resolve(null);
      try {
        oldRecorder.stop();
      } catch {
        resolve(null);
      }
    });

    if (!blob || blob.size < 400) {
      return;
    }

    // Process transcription in the background while newRecorder continues listening
    const taskId = ++this.transcriptionTaskId;
    const previousTask = this.inFlightTranscription;
    const currentTask = (async () => {
      if (previousTask) {
        try {
          await previousTask;
        } catch {}
      }

      this.options.onTranscribingChange?.(true);

      try {
        const res = await fetch("/api/stt", {
          method: "POST",
          headers: { "Content-Type": blob.type || "audio/webm" },
          body: blob,
        });
        if (res.ok) {
          const data = await res.json();
          const segment = data.text?.trim();
          if (segment) {
            this.accumulatedMoonshineText = this.accumulatedMoonshineText
              ? `${this.accumulatedMoonshineText} ${segment}`
              : segment;
            this.options.onTranscriptionResult?.(this.accumulatedMoonshineText, true);
          }
        } else {
          console.warn("[SpeechClient] /api/stt error on pause:", res.status);
        }
      } catch (err) {
        console.warn("[SpeechClient] Pause background transcription failed:", err);
      } finally {
        if (this.transcriptionTaskId === taskId) {
          this.inFlightTranscription = null;
          this.options.onTranscribingChange?.(false);
        }
      }
    })();

    this.inFlightTranscription = currentTask;
  }

  private async setupMoonshineVad(stream: MediaStream) {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      this.vadAudioContext = audioCtx;

      // Crucial: AudioContext must be active (not suspended) to process live microphone levels
      if (audioCtx.state === "suspended") {
        try {
          await audioCtx.resume();
        } catch {}
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);

      const dataArray = new Float32Array(analyser.fftSize);
      let hasSpoken = false;
      let silenceStart: number | null = null;
      const listenStartTime = Date.now();
      let speechStartTime: number | null = null;
      let ambientNoiseFloor = 0.003;
      let sampleCount = 0;
      const PAUSE_DURATION_MS = 900; // Standard listening pause (like Google Search & ChatGPT)

      this.vadInterval = setInterval(() => {
        if (!this.isListening || this.activeListeningMode !== "moonshine") {
          return;
        }

        if (audioCtx.state === "suspended") {
          void audioCtx.resume();
        }

        analyser.getFloatTimeDomainData(dataArray);
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sumSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);

        // Track ambient room noise baseline during quiet periods
        if (!hasSpoken && sampleCount < 25) {
          ambientNoiseFloor = (ambientNoiseFloor * sampleCount + rms) / (sampleCount + 1);
          sampleCount++;
        }

        // Adaptive sensitivity
        const threshold = Math.max(0.006, ambientNoiseFloor * 1.6);

        if (rms > threshold) {
          hasSpoken = true;
          if (!speechStartTime) speechStartTime = Date.now();
          silenceStart = null;
        } else if (hasSpoken) {
          if (silenceStart === null) {
            silenceStart = Date.now();
          } else if (Date.now() - silenceStart >= PAUSE_DURATION_MS) {
            // Speaker paused for >= 0.9s after talking!
            // Background transcribe this segment and keep mic listening!
            hasSpoken = false;
            silenceStart = null;
            speechStartTime = null;
            void this.handleMoonshinePause();
          }
        }

        // Safety cap: if speaking continuously for > 15s without pause, rotate and transcribe chunk in background
        if (hasSpoken && speechStartTime && Date.now() - speechStartTime > 15000) {
          hasSpoken = false;
          silenceStart = null;
          speechStartTime = null;
          void this.handleMoonshinePause();
        }

        // Long idle safety cap: if user opened mic but never spoke anything for 60 seconds
        if (!hasSpoken && !this.accumulatedMoonshineText && Date.now() - listenStartTime > 60000) {
          void this.stopListening();
        }
      }, 100);
    } catch (err) {
      console.warn("[SpeechClient] VAD setup skipped:", err);
    }
  }

  private async startListeningViaMoonshine() {
    try {
      this.activeListeningMode = "moonshine";
      this.options.onEngineChange?.("moonshine");
      this.accumulatedMoonshineText = "";

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // If user cancelled or mode changed while waiting for userMedia
      if (this.activeListeningMode !== "moonshine") {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      this.mediaStream = stream;
      this.isListening = true;
      this.options.onListeningStateChange?.(true);

      this.setupMoonshineRecorder(stream);
      await this.setupMoonshineVad(stream);
    } catch (err: unknown) {
      this.activeListeningMode = null;
      this.isListening = false;
      this.options.onListeningStateChange?.(false);
      const msg = err instanceof Error ? err.message : String(err);
      this.options.onError?.(`Microphone error: ${msg}`);
    }
  }

  private chunkText(text: string): string[] {
    return chunkTextForTTS(text);
  }

  // Fetches one chunk's KittenTTS audio. Returns null (rather than throwing) on any
  // failure so the caller can fall back to the browser for just this chunk instead of
  // aborting the whole response.
  private async fetchChunkAudio(text: string): Promise<HTMLAudioElement | null> {
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
      if (!res.ok || !contentType.includes("audio/wav")) return null;
      const blob = await res.blob();
      return new Audio(URL.createObjectURL(blob));
    } catch {
      return null;
    }
  }

  private playAudio(audio: HTMLAudioElement): Promise<void> {
    return new Promise((resolve) => {
      this.currentAudio = audio;
      this.options.onAudioElement?.(audio);
      audio.onended = () => {
        this.options.onAudioElement?.(null);
        URL.revokeObjectURL(audio.src);
        resolve();
      };
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  public getCurrentText(): string {
    return this.currentText;
  }

  public getCurrentChunkIndex(): number {
    return this.currentChunkIndex;
  }

  private waitForResume(): Promise<void> {
    if (!this.isPaused) return Promise.resolve();
    return new Promise((resolve) => {
      this.resumeResolver = resolve;
    });
  }

  public pauseSpeaking() {
    if (!this.isSpeaking || this.isPaused) return;
    this.isPaused = true;
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
      } catch {}
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.pause();
      } catch {}
    }
    this.options.onSpeakingStateChange?.(true, true);
  }

  public resumeSpeaking() {
    if (!this.isSpeaking || !this.isPaused) return;
    this.isPaused = false;
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play().catch(() => {});
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.paused) {
      try {
        window.speechSynthesis.resume();
      } catch {}
    }
    if (this.resumeResolver) {
      const resolver = this.resumeResolver;
      this.resumeResolver = null;
      resolver();
    }
    this.options.onSpeakingStateChange?.(true, false);
  }

  public togglePlayPause(text: string) {
    if (!this.isSpeaking || this.currentText !== text) {
      void this.speakText(text);
    } else if (this.isPaused) {
      this.resumeSpeaking();
    } else {
      this.pauseSpeaking();
    }
  }

  public restartSpeaking(text?: string) {
    const target = text || this.currentText;
    this.stopSpeaking();
    if (target) {
      void this.speakText(target);
    }
  }

  // Speak text with KittenTTS, chunked into short word groups so playback
  // of the first chunk can start almost immediately instead of waiting for the entire
  // response to synthesize. Each next chunk is fetched while the current one is still
  // playing, so there's normally no gap between chunks. A chunk that fails to synthesize
  // server-side falls back to the browser for just that chunk, not the whole response.
  public async speakText(text: string): Promise<void> {
    // 1. Stop listening during speech (turn-taking rule)
    this.stopListening();
    this.stopSpeaking();

    // Strip markdown/emoji/lists/etc. before chunking — chunking needs the cleaned text
    // (list-item and table-row conversion need whole lines, which an arbitrary word-count
    // chunk boundary could otherwise split mid-item), but this.currentText stays RAW: it's
    // what togglePlayPause()/restartSpeaking() compare their `text` argument against to
    // detect "same message" vs "new one" — cleaning it here would break that comparison for
    // every caller still passing the original raw text.
    const cleanedText = cleanTextForTTS(text);
    const chunks = this.chunkText(cleanedText);
    if (chunks.length === 0) return;

    this.currentText = text;
    this.isPaused = false;
    this.currentChunkIndex = 0;

    const generation = ++this.speakGeneration;
    this.isSpeaking = true;
    this.options.onSpeakingStateChange?.(true, false);

    let nextAudioPromise = this.fetchChunkAudio(chunks[0]);

    for (let i = 0; i < chunks.length; i++) {
      if (generation !== this.speakGeneration) return; // superseded by stop/new speakText

      if (this.isPaused) {
        await this.waitForResume();
        if (generation !== this.speakGeneration) return;
      }

      const audio = await nextAudioPromise;
      nextAudioPromise = i + 1 < chunks.length ? this.fetchChunkAudio(chunks[i + 1]) : Promise.resolve(null);

      if (generation !== this.speakGeneration) return;

      if (this.isPaused) {
        await this.waitForResume();
        if (generation !== this.speakGeneration) return;
      }

      this.currentChunkIndex = i;
      // Broadcast active chunk index for lyrics synchronization
      this.options.onSpeakingChunkChange?.(i, chunks.length, chunks[i]);

      if (audio) {
        await this.playAudio(audio);
      } else {
        await this.speakChunkViaBrowser(chunks[i]);
      }
    }

    if (generation === this.speakGeneration) {
      this.isSpeaking = false;
      this.isPaused = false;
      this.currentText = "";
      this.options.onSpeakingStateChange?.(false, false);
      this.options.onSpeakingChunkChange?.(-1, chunks.length, "");
    }
  }

  // Browser Web Speech fallback for a single chunk (used when that chunk's KittenTTS
  // request fails) — resolves once the utterance finishes so the chunk loop can continue.
  private speakChunkViaBrowser(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        resolve();
        return;
      }

      // Chunks already pass through cleanTextForTTS() in speakText() before reaching here —
      // just trim, no need to re-strip markdown.
      const cleanText = text.trim();
      if (!cleanText) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = this.options.speed || 0.88;

      const profile = KITTEN_VOICE_PROFILES[this.options.voicePreset || "Jasper"] ?? {
        gender: "Male" as const,
        pitch: 1,
      };
      utterance.pitch = profile.pitch;

      // Pick a voice matching this preset's gender; fall back to any English voice, then
      // whatever the browser defaults to.
      const voices = window.speechSynthesis.getVoices();
      const genderPattern = profile.gender === "Female" ? FEMALE_VOICE_NAME_PATTERN : MALE_VOICE_NAME_PATTERN;
      const englishVoices = voices.filter((v) => v.lang.startsWith("en"));
      const pickedVoice = englishVoices.find((v) => genderPattern.test(v.name)) || englishVoices[0];
      if (pickedVoice) {
        utterance.voice = pickedVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }

  public stopSpeaking() {
    this.speakGeneration++; // invalidates any in-flight speakText chunk loop
    this.isPaused = false;
    if (this.resumeResolver) {
      const resolver = this.resumeResolver;
      this.resumeResolver = null;
      resolver();
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
      this.options.onAudioElement?.(null);
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.isSpeaking = false;
    this.currentText = "";
    this.currentChunkIndex = 0;
    this.options.onSpeakingStateChange?.(false, false);
    this.options.onSpeakingChunkChange?.(-1, 0, "");
  }
}
