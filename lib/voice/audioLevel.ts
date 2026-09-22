// Drives lip sync from the actual TTS playback waveform via a Web Audio AnalyserNode — cheap
// (one small typed-array read per frame, no AI/face-tracking) and reused across utterances via
// a single AudioContext. LipSyncController falls back to a fake sine-wave pattern when this
// isn't available (e.g. the browser-speechSynthesis fallback path, which exposes no buffer).

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let dataArray: Uint8Array<ArrayBuffer> | null = null;
let currentSource: MediaElementAudioSourceNode | null = null;
let currentAudio: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioContext) return audioContext;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext = new AudioContextClass();
  return audioContext;
}

// Call with the live <audio> element when TTS playback starts, and with null when it stops.
// A fresh MediaElementSourceNode is required per <audio> element (they aren't reusable), so
// each call tears down the previous graph and builds a new one for the given element.
export function attachAudioLevelAnalyser(audio: HTMLAudioElement | null) {
  if (audio === currentAudio) return;
  currentSource?.disconnect();
  analyser?.disconnect();
  currentSource = null;
  analyser = null;
  dataArray = null;
  currentAudio = audio;

  if (!audio) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") ctx.resume();
    const source = ctx.createMediaElementSource(audio);
    const node = ctx.createAnalyser();
    node.fftSize = 256;
    // Route through the analyser but still out to speakers — createMediaElementSource
    // otherwise silences the element by capturing its output for processing only.
    source.connect(node);
    node.connect(ctx.destination);

    currentSource = source;
    analyser = node;
    dataArray = new Uint8Array(node.frequencyBinCount);
  } catch (err) {
    // Blocked AudioContext, unsupported browser, or an element already wired elsewhere —
    // LipSyncController's fake-wave fallback covers this, so just skip real analysis.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[audioLevel] analyser unavailable, falling back to synthetic mouth motion:", err);
    }
  }
}

export function isAudioLevelAvailable(): boolean {
  return analyser !== null;
}

// 0..1 RMS amplitude of the current playback buffer, reused each call (no per-frame allocation).
export function getAudioLevel(): number {
  if (!analyser || !dataArray) return 0;
  analyser.getByteTimeDomainData(dataArray);
  let sumSquares = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const normalized = (dataArray[i] - 128) / 128;
    sumSquares += normalized * normalized;
  }
  const rms = Math.sqrt(sumSquares / dataArray.length);
  // Speech RMS is typically small; scale up so quiet passages still visibly move the mouth.
  return Math.min(1, rms * 4);
}
