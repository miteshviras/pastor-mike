// Client-side voice controller supporting KittenTTS playback, browser TTS fallback,
// Web Speech STT (with a server-side Moonshine fallback for browsers that lack it), and
// turn-taking logic.

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

  public getActiveListeningEngine(): "browser" | "moonshine" | null {
    return this.activeListeningMode;
  }

  public resetBrowserRecognition() {
    this.browserRecognitionFailed = false;
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
          this.isListening = false;
          this.activeListeningMode = null;
          this.options.onListeningStateChange?.(false);
        };

        rec.onerror = (e) => {
          this.isListening = false;
          this.activeListeningMode = null;
          this.options.onListeningStateChange?.(false);
          if (e.error === "no-speech") return;

          // Network or service blocked means browser's cloud speech recognition is down/offline.
          // Fall back gracefully to local Moonshine STT!
          if (e.error === "network" || e.error === "service-not-allowed") {
            console.warn(`[SpeechClient] Browser speech recognition encountered "${e.error}", falling back to Moonshine STT`);
            this.browserRecognitionFailed = true;
            void this.startListeningViaMoonshine();
            return;
          }

          const messages: Record<string, string> = {
            "not-allowed": "Microphone access was blocked. Allow it in your browser's site settings and try again.",
            "audio-capture": "No microphone was found. Check that one is connected and try again.",
          };
          this.options.onError?.(messages[e.error] || `Speech recognition error: ${e.error}`);
        };

        rec.onresult = (e: SpeechRecognitionEvent) => {
          let fullTranscript = "";

          for (let i = 0; i < e.results.length; i++) {
            const part = e.results[i]?.[0]?.transcript?.trim();
            if (part) {
              fullTranscript += (fullTranscript ? " " : "") + part;
            }
          }

          // In continuous mode, the last result indicates whether the latest phrase
          // was finalized upon a speaker pause.
          const lastResult = e.results[e.results.length - 1];
          const isFinal = lastResult ? lastResult.isFinal : false;

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

    // Priority 1: Browser SpeechRecognition (if available and not known to have failed)
    if (this.recognition && !this.browserRecognitionFailed) {
      if (!this.isListening) {
        try {
          this.activeListeningMode = "browser";
          this.options.onEngineChange?.("browser");
          this.recognition.start();
          return;
        } catch (err: unknown) {
          console.warn("[SpeechClient] Browser SpeechRecognition start failed, switching to Moonshine STT:", err);
          this.browserRecognitionFailed = true;
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

  public stopListening() {
    if (this.activeListeningMode === "browser" || (this.recognition && this.isListening && !this.mediaRecorder)) {
      try {
        this.recognition?.stop();
      } catch {}
    }

    if (this.activeListeningMode === "moonshine") {
      this.isListening = false;
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

      if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
        const recorder = this.mediaRecorder;
        const stream = this.mediaStream;
        const chunks = [...this.audioChunks];
        this.mediaRecorder = null;
        this.mediaStream = null;
        this.audioChunks = [];

        try {
          recorder.stop();
        } catch {}
        stream?.getTracks().forEach((t) => t.stop());

        // Process any final speech audio chunk if non-trivial
        const mime = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: mime });
        if (blob.size >= 800) {
          void fetch("/api/stt", { method: "POST", body: blob })
            .then((r) => r.json())
            .then((data) => {
              const transcribed = data.text?.trim();
              if (transcribed) {
                this.accumulatedMoonshineText = this.accumulatedMoonshineText
                  ? `${this.accumulatedMoonshineText} ${transcribed}`
                  : transcribed;
                this.options.onTranscriptionResult?.(this.accumulatedMoonshineText, true);
              }
            })
            .catch(() => {});
        }
      } else if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((t) => t.stop());
        this.mediaStream = null;
      }
    }

    this.activeListeningMode = null;
  }

  private setupMoonshineRecorder(stream: MediaStream) {
    this.audioChunks = [];
    let recorder: MediaRecorder;
    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      recorder = new MediaRecorder(stream);
    }

    this.mediaRecorder = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };

    recorder.start(100);
  }

  private setupMoonshineVad(stream: MediaStream) {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      this.vadAudioContext = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const dataArray = new Float32Array(analyser.fftSize);
      let hasSpoken = false;
      let silenceStart: number | null = null;
      const SPEECH_THRESHOLD = 0.016;
      const PAUSE_DURATION_MS = 1100;

      this.vadInterval = setInterval(() => {
        if (!this.isListening || this.activeListeningMode !== "moonshine") {
          return;
        }

        analyser.getFloatTimeDomainData(dataArray);
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sumSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);

        if (rms > SPEECH_THRESHOLD) {
          hasSpoken = true;
          silenceStart = null;
        } else if (hasSpoken) {
          if (silenceStart === null) {
            silenceStart = Date.now();
          } else if (Date.now() - silenceStart >= PAUSE_DURATION_MS) {
            // Speaker paused for >= 1.1s after talking
            hasSpoken = false;
            silenceStart = null;
            void this.handleMoonshinePause();
          }
        }
      }, 100);
    } catch (err) {
      console.warn("[SpeechClient] VAD setup skipped:", err);
    }
  }

  private async handleMoonshinePause() {
    if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") return;
    if (!this.mediaStream || !this.isListening) return;

    const currentRecorder = this.mediaRecorder;
    const currentChunks = [...this.audioChunks];
    this.audioChunks = [];

    // Immediately start recording the next phrase so no incoming audio is missed
    try {
      this.setupMoonshineRecorder(this.mediaStream);
    } catch (err) {
      console.warn("[SpeechClient] Could not rotate recorder:", err);
    }

    try {
      currentRecorder.stop();
    } catch {}

    const mime = currentRecorder.mimeType || "audio/webm";
    const blob = new Blob(currentChunks, { type: mime });
    if (blob.size < 800) {
      return;
    }

    try {
      const res = await fetch("/api/stt", { method: "POST", body: blob });
      if (!res.ok) return;
      const data = await res.json();
      const transcribed = data.text?.trim();
      if (transcribed) {
        this.accumulatedMoonshineText = this.accumulatedMoonshineText
          ? `${this.accumulatedMoonshineText} ${transcribed}`
          : transcribed;
        // Deliver transcript upon pause!
        this.options.onTranscriptionResult?.(this.accumulatedMoonshineText, true);
      }
    } catch (err) {
      console.warn("[SpeechClient] Pause transcription failed:", err);
    }
  }

  private async startListeningViaMoonshine() {
    try {
      this.activeListeningMode = "moonshine";
      this.options.onEngineChange?.("moonshine");
      this.accumulatedMoonshineText = "";

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;
      this.isListening = true;
      this.options.onListeningStateChange?.(true);

      this.setupMoonshineRecorder(stream);
      this.setupMoonshineVad(stream);
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

    const chunks = this.chunkText(text);
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
      }

      // Clean markdown stars or brackets from speech text
      const cleanText = text.replace(/[*#_>]/g, "").replace(/\n+/g, " ").trim();
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
