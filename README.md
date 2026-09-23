# Digital Pastor ("Pastor Mike") — Local-First Spiritual Companion

A private, local-first web prototype for a **Digital Pastor**: empathetic text and voice conversation with a talking 3D avatar, scripture search, and personal prayer journaling.

---

## Key Features

- **100% Private & Local-First**: No cloud API keys required (OpenAI, Anthropic, ElevenLabs, etc.) — Google Gemini and Ollama are optional, not mandatory.
- **Local SQLite Persistence**: Uses Node.js native `node:sqlite` (`data/pastor_mike.db`) to persist messages, sessions, and prayer requests.
- **Live Pastor — 3D Talking Avatar**: A React Three Fiber-rendered head that lip-syncs to TTS audio (real playback amplitude when available, morph targets or jaw-bone rotation depending on the loaded model), blinks autonomously, and breathes/sways while idle. The current turn's reply streams in beside it as an auto-scrolling, sentence-highlighted transcript. Toggle with the **"Live Pastor"** button in the header.
- **Scripture Knowledge Base**: Offline public domain World English Bible (WEB) & King James Version (KJV) indexed by topics (anxiety, rest, peace, grief, forgiveness, guidance, healing, love).
- **Voice Pipeline**:
  - **TTS**: Local KittenTTS neural synthesis (8 voice presets, default **Jasper**), chunked into short phrases and played back with prefetching for low first-audio latency, with automatic per-chunk fallback to the browser's Web Speech API.
  - **STT**: Continuous listening via the browser's native `SpeechRecognition` where available, with an automatic server-side **Moonshine STT** fallback (via `pipecat-ai`) for browsers that lack it — voice-activity detection segments your speech and transcribes each pause in the background while you keep talking.
- **Pastoral Safety Safeguards**: Built-in crisis detection with immediate compassionate referral to the **988 Suicide & Crisis Lifeline** (24/7 call/text) and Crisis Text Line.
- **Serene Pastoral UI**: Calming dark aesthetic, formatted scripture citation cards with copy buttons, prayer cards with "Save to Journal", and active/answered petition tracking, with per-visit prayer journal isolation and a visit history switcher.
- **Docker Deployment**: A `docker compose up --build` gets you a container with a Python version KittenTTS/Moonshine actually support, independent of whatever Python you have on your host.

---

## System Architecture

```
User (Browser Chat, Voice & 3D Avatar UI)
       │
       ▼
Next.js App Router Backend (/api/chat, /api/prayers, /api/sessions, /api/settings, /api/tts, /api/stt)
       │
       ├──► Local SQLite Database (node:sqlite -> data/pastor_mike.db)
       │
       ├──► TTS Pipeline (KittenTTS Adapter -> server/kittentts_adapter.py, spawned per request)
       │
       ├──► STT Fallback Pipeline (Moonshine Adapter -> server/stt_adapter.py, spawned per request)
       │
       └──► Local Model Runtime (Google Gemini, Ollama at localhost:11434, or Built-in Offline Pastoral Engine)
```

---

## Prerequisites

**Option A — Docker (recommended for the voice pipeline):**
- Docker Desktop (or Docker Engine + Compose).
- Nothing else — the container bundles a compatible Node and Python runtime.

**Option B — Run natively:**
- **Node.js**: v22.5.0 or higher (Node 24 recommended for built-in `node:sqlite`).
- **npm**: v10+
- **Python**: 3.11 or 3.12 recommended. KittenTTS's dependency chain does not currently support Python 3.13+, and the newest KittenTTS release has a broken upstream dependency regardless of Python version — see [Voice Pipeline](#voice-pipeline-kittentts--moonshine-stt) below. Without a compatible Python, the app still works fully via the Windows SAPI / browser Web Speech fallbacks, just with a smaller, less distinct voice set.
- `ffmpeg` on `PATH` (only needed for the Moonshine STT fallback path).
- *(Optional)* **Ollama**: for a local LLM like `llama3.2`, `mistral`, or `qwen2.5`.

---

## Quickstart Setup Guide

### Option A: Docker

```bash
git clone https://github.com/miteshviras/pastor-mike.git
cd pastor-mike
cp .env.example .env
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). Model weights (KittenTTS + Moonshine) download on first use and are cached in named Docker volumes (`hf-cache`, `moonshine-cache`) so they persist across container restarts.

### Option B: Native

```bash
git clone https://github.com/miteshviras/pastor-mike.git
cd pastor-mike
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

### Configure Environment (Optional)

Pastor Mike supports a flexible 3-tier model hierarchy:
1. **Google Gemini API** (`GEMINI_API_KEY` or `GOOGLE_API_KEY`): Recommended for highest-quality pastoral reflections, prayers, and scripture grounding via Google's Gemini models.
2. **Local Ollama** (`OLLAMA_BASE_URL`): For private local open-source LLMs (`llama3.2`, `mistral`, `qwen2.5`).
3. **Built-in Offline Engine**: Zero external dependencies, runs 100% locally with **zero API keys required**.

If using Google Gemini, obtain a free key at [Google AI Studio](https://aistudio.google.com/app/apikey) and set:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Run the Test Suite

```bash
npm test
```

See [Test Suite Commands](#test-suite-commands) below for the full list of individual test scripts.

---

## Voice Pipeline (KittenTTS & Moonshine STT)

### Text-to-Speech

- **Adapter Script**: [`server/kittentts_adapter.py`](server/kittentts_adapter.py) — tries the real `kittentts` neural model first, then falls back to Windows SAPI (`System.Speech`), then macOS `say`, then signals the client to use the browser's Web Speech API. Never plays a dummy chime.
- **8 voice presets** (`Bella, Jasper, Luna, Bruno, Rosie, Hugo, Kiki, Leo`, default **Jasper**), each mapped onto a real distinct underlying voice (neural voice, or gender+pitch-shifted SAPI voice, depending on which engine is active) and adjustable delivery speed (0.8x–1.2x).
- Long replies are split sentence-by-sentence and synthesized+concatenated, since the lightweight ONNX model can't handle very long input in one call. On the client, `lib/voice/speech-client.ts` further chunks text into short phrases and prefetches the next chunk while the current one plays, so speech starts within a few seconds instead of waiting for the whole reply to synthesize.
- **1-Click Downloader**: the **"Setup Guide"** modal checks KittenTTS status and can trigger a download, or run directly:
  ```bash
  python server/setup_kittentts.py --download
  ```
- **Test CLI Synthesis**:
  ```bash
  python server/kittentts_adapter.py --text "Peace be with you." --voice Jasper --speed 0.9 --output output.wav
  ```

> **Note on KittenTTS versions**: the newest published KittenTTS release (0.8.1, `kitten-tts-mini`) depends on a version of `misaki` that has never been published to PyPI — installing it via its official wheel URL fails regardless of Python version. `requirements.txt` installs `kittentts` unpinned instead, which lets pip's resolver land on an older, working release (currently resolves to `0.1.3`, the `kitten-tts-nano` model with a different 8-voice set) — the branded preset names above are mapped onto whichever real voices that resolved version exposes.

### Speech-to-Text

- **Primary**: the browser's native `SpeechRecognition` API, running continuously — it keeps listening and streaming transcript updates across pauses until you click the mic button to stop.
- **Fallback**: if native recognition is unavailable or errors (common outside Chromium, or over non-HTTPS origins on mobile), the client records your microphone via `MediaRecorder` and runs a lightweight voice-activity detector; each ~900ms pause is sent to [`/api/stt`](app/api/stt/route.ts) and transcribed in the background via **Moonshine STT** ([`server/stt_adapter.py`](server/stt_adapter.py), using [`pipecat-ai`](https://docs.pipecat.ai)'s `MoonshineSTTService` called directly, not the full pipeline/transport framework) while you keep talking. Segments accumulate into one transcript.
- **1-Click Downloader / Status Check**:
  ```bash
  python server/setup_stt.py --check
  python server/setup_stt.py --download
  ```

### Browser Playback & Microphone

In the UI, click **Live Pastor** or the microphone icon to talk hands-free with turn-taking awareness (mic pauses while Pastor Mike speaks) and adjustable speech speed.

---

## First-Time User Setup Flow

When opening the app for the first time, a 2-step setup guide launches automatically (reopen anytime via **"Setup Guide"** in the header):
1. **Step 1: Onboarding**: Meet Pastor Mike, review the non-ordained AI disclosure, set your preferred name, and select spiritual focus areas.
2. **Step 2: Test Audio (STT & TTS)**: Check KittenTTS status, 1-click download the model weights, listen to a test pastoral blessing, and test microphone recognition.

---

## Test Suite Commands

| Command | Description |
| :--- | :--- |
| `npm test` | Runs the comprehensive end-to-end demo test suite |
| `npm run test:db` | Tests SQLite database creation, queries, and migrations |
| `npm run test:scripture` | Tests topical scripture search and direct verse lookups |
| `npm run test:ai` | Tests crisis safety (988 hotline), prophecy boundaries, and empathy generation |
| `npm run test:api` | Tests all Next.js App Router API routes |
| `npm run test:tts` | Tests KittenTTS voice synthesis and audio generation |
| `npm run test:tts-chunking` | Tests TTS text chunking and prefetched chunk playback |
| `npm run test:lyrics` | Tests the avatar transcript's sentence-highlight sync |
| `npm run test:play-pause` | Tests TTS playback pause/resume/restart/stop |
| `npm run test:stt` | Tests Moonshine STT transcription |
| `npm run test:stt-flow` | Tests the STT-to-input flow (transcript fills the composer without auto-sending) |
| `npm run test:standard-listening` | Tests the standard (non-continuous) listening flow |
| `npm run test:onboarding` | Tests the first-run setup guide flow |
| `npm run build` | Compiles the production Next.js build |

A few additional scripts exist under `scripts/` without an `npm run` shortcut — run directly via `npx tsx scripts/<name>.ts`: `test-continuous-pause-stt.ts` (continuous listening across multiple pauses), `test-dynamic-pastoral.ts` (offline pastoral reasoning engine), `test-visit-history.ts` (visit-scoped prayer journal isolation), `test-three-warning.ts` (suppresses a known `THREE.Clock` deprecation warning).

---

## Safety & Crisis Escalation

Pastor Mike is an AI pastoral companion and explicitly clarifies that it is not an ordained minister, priest, or counselor.

If crisis keywords (self-harm, suicidal ideation, domestic abuse) are detected, the app shifts immediately to safety mode:
- **988 Suicide & Crisis Lifeline**: Call or text `988` (Free, confidential, 24/7).
- **Crisis Text Line**: Text `HOME` to `741741`.
- **National Domestic Violence Hotline**: `1-800-799-SAFE (7233)`.

---

## License

MIT License. Open source and private.
