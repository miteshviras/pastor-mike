# Design — Digital Pastor ("Pastor Mike")

Technical design reference. For setup/usage see [README.md](README.md); for build history see [task.md](task.md).

## Goals & Constraints

- **Local-first, zero cloud keys**: no OpenAI/Anthropic/ElevenLabs dependency. All persistence, reasoning fallback, TTS, and tool execution run on the user's machine.
- **Pastoral safety over cleverness**: crisis and prophecy handling short-circuit the normal reasoning path before any LLM is involved.
- **Graceful degradation**: every external capability (Ollama, KittenTTS, mic STT) has an offline/browser fallback so the app fully works with nothing installed beyond Node.

## Architecture

```
Browser UI (app/page.tsx, components/*, components/avatar/*)
   │
   ▼
Next.js App Router API (app/api/*)
   ├─ /api/chat     → lib/ai/orchestrator.ts (safety → topic match → scripture lookup → reply)
   ├─ /api/sessions → lib/db.ts (session/message history + legacy metadata backfill)
   ├─ /api/prayers  → lib/db.ts (prayer journal CRUD + status toggle)
   ├─ /api/settings → lib/db.ts (active model provider preference)
   ├─ /api/tts      → server/kittentts_adapter.py (spawned per request) + setup_kittentts.py status/download
   └─ /api/stt      → server/stt_adapter.py (spawned per request) + setup_stt.py status/download
   │
   ├─ lib/db.ts       → node:sqlite, data/pastor_mike.db (single shared connection)
   ├─ lib/scripture/  → in-memory WEB/KJV verse dataset, topic + keyword search
   ├─ lib/ai/         → safety filter, offline pastoral templates, orchestrator
   └─ lib/voice/      → PastoralSpeechClient (STT/TTS client), audioLevel.ts, useSentenceSync.ts
```

> **History note**: an earlier build exposed scripture search and prayer journaling as MCP (Model Context Protocol) tools over stdio and HTTP JSON-RPC, for use from Claude Desktop/Cursor. That layer (`lib/mcp/`, `server/mcp_server.ts`, `app/api/mcp/route.ts`, `McpModal.tsx`) was removed — `search_scripture`/`save_prayer_request` are now plain function calls (`searchScripture()`, `savePrayerRequest()`) inside the orchestrator, not tool invocations. If MCP access is wanted again, that's new work, not a revert — the tool schemas in `lib/mcp/definitions.ts` are gone.

## Data Model (`lib/db.ts`)

Single SQLite file, schema created idempotently on first connection (`CREATE TABLE IF NOT EXISTS`), foreign keys on, `ON DELETE CASCADE` from `users` → `sessions`/`prayer_requests`/`preferences` and `sessions` → `messages`/`conversation_summaries`.

| Table | Purpose |
|---|---|
| `users` | Single default user (`user_default`) today; schema supports multi-user later |
| `sessions` | One row per chat session, holds rolling `summary` |
| `messages` | Turn history; `metadata` is a JSON blob (scriptures, prayer, model used, crisis flag) |
| `prayer_requests` | Journal entries, `status` = `active` \| `answered` |
| `preferences` | Generic key/value store, reused as the "memory" tool backing store |
| `scripture_notes` | Reserved for user-saved verse notes (schema present, not yet wired to UI) |
| `conversation_summaries` | Append-only summary log; latest also mirrored onto `sessions.summary` |

IDs are generated client-side as `prefix_<timestamp>_<random>` rather than autoincrement/UUID — good enough for a single-user local app, avoids a dependency.

Design note: message `metadata` stores full scripture/prayer objects (not just references) so history survives reload without re-resolving lookups; `/api/sessions` still backfills older string-only rows for backward compatibility (see task.md Task 11).

## Conversation Pipeline (`lib/ai/orchestrator.ts`)

`processPastoralTurn` runs a fixed pipeline per message, no agent loop:

1. Persist the user message.
2. `evaluateSafety()` — regex-based crisis / medical-legal / prophecy-coercion classification (`lib/ai/safety.ts`). Crisis and prophecy cases return an immediate canned pastoral response with hotline data and skip everything below.
3. Keyword-match the message into one of a fixed topic set (`anxiety`, `grief`, `rest`, `guidance`, `general`) — see `OFFLINE_TOPIC_TEMPLATES` in `lib/ai/pastoral-prompt.ts`.
4. Call `searchScripture()` for that topic to fetch grounding verses.
5. If the message reads as a prayer request, call `savePrayerRequest()`.
6. Try local Ollama (`POST http://127.0.0.1:11434/api/chat`, 3.5s timeout, model `llama3.2` by default). On any failure/timeout/absence, fall back to the offline template (empathy + counsel + scripture excerpt + prayer prompt) — this is the default path in a zero-dependency install.
7. Persist the assistant reply with full metadata and return it.

This is deliberately a straight-line pipeline (not a tool-calling LLM agent): the topic match and scripture lookup happen unconditionally so a reply is always scripturally grounded even when Ollama is absent or ignores instructions.

## Safety Layer (`lib/ai/safety.ts`)

Three independent regex pattern sets, checked in order — crisis first (highest priority, always wins), then prophecy/coercion, then medical/legal (flagged but non-blocking today). Crisis responses are static, not model-generated, and include 988, Crisis Text Line, Trevor Project, and Domestic Violence Hotline. This runs before any LLM call so it can't be bypassed by prompt content aimed at the model.

## Scripture Knowledge Base (`lib/scripture/bible-data.ts`)

Small curated offline WEB/KJV verse set, in-memory array, tagged by topic. Search is topic-tag match plus keyword substring match over reference/text — no embeddings/vector search, which is appropriate given the dataset size (avoids adding a vector DB dependency for a few dozen verses).

## 3D Avatar (`components/avatar/`)

A React Three Fiber head that makes the assistant feel present rather than a text box with a TTS button bolted on. All controllers are plain classes (not React components) driven from a single `useFrame` tick in `Avatar.tsx` — no extra render loops.

- `Avatar.tsx`: loads a loose glTF (`/models/pastor-mike-head/scene.gltf`), hides non-portrait meshes (outfit/footwear), and auto-frames the camera to the model's measured bounding sphere rather than hand-tuned per-asset numbers — swapping the model file doesn't require re-tuning the camera.
- `LipSyncController.ts`: drives mouth movement via morph targets (viseme/mouth/jaw blendshapes) or jaw-bone rotation, whichever the rig has. Openness is driven by real playback RMS amplitude read from a Web Audio analyser (`lib/voice/audioLevel.ts`) when TTS audio is playing, falling back to a synthetic sine envelope only when no audio element is attached (e.g. the browser `speechSynthesis` fallback).
- `BlinkController.ts` / `IdleController.ts`: autonomous blink loop and idle breathing/sway, independent of speech state, plus a "thinking" look-down and "talking" head nod keyed off an external `AvatarMood`.
- `PastorStage.tsx`: the surrounding stage — canvas with an error boundary (falls back to a plain sphere if the glTF fails to load), playback controls, and an auto-scrolling sentence-highlighted transcript (`useSentenceSync.ts` estimates per-sentence timing from audio duration) while the avatar itself stays visually still.

Toggled via the **"Live Pastor"** header button.

## Voice Pipeline

- **TTS**: `server/kittentts_adapter.py` — tries the real `kittentts` neural model first (voice/model resolved by whatever version `pip` lands on, see README's note on the upstream `misaki` dependency issue), then Windows SAPI (`System.Speech`, per-preset gender+pitch mapping), then macOS `say`, then signals the client to use the browser's Web Speech API — never plays a dummy chime. Long text is split into sentences and synthesized+concatenated (the lightweight ONNX model errors on long multi-sentence input in one call). `server/setup_kittentts.py` handles status-check and one-click install + model cache warm-up.
- **STT**: `lib/voice/speech-client.ts`'s `PastoralSpeechClient` tries native browser `SpeechRecognition` first, configured for **continuous listening** (keeps transcribing across pauses until the user clicks stop, auto-restarting recognition internally rather than stopping on first silence). If native recognition is unavailable or errors, it falls back to a `MediaRecorder` + lightweight VAD (RMS with an adaptive noise floor) that segments speech on ~900ms pauses and posts each segment to `/api/stt` in the background while still recording, via `server/stt_adapter.py` (`pipecat-ai`'s `MoonshineSTTService.run_stt()`, called directly rather than through Pipecat's full pipeline/transport framework, which this app has no other use for). The browser-STT-unavailable state is cached in `localStorage` so later sessions skip straight to the Moonshine path.
- **Client playback**: `speakText()` chunks replies into short phrases and prefetches the next chunk while the current one plays (pipelined, not blocking) so speech starts in a few seconds rather than after the whole reply synthesizes; any chunk that fails server-side falls back individually to browser `speechSynthesis`. Turn-taking (mic muted while TTS plays) prevents feedback loops either way.

## Docker

`Dockerfile` (Node 24 bookworm-slim + Python 3.11 via `apt`) and `docker-compose.yml` exist specifically to get a Python version KittenTTS/Moonshine's dependency chains actually support, independent of the host's Python. Named volumes (`hf-cache`, `moonshine-cache`) persist downloaded model weights across container recreation, separate from the `models/kittentts` bind mount (which only holds a small status marker file). See README's Docker quickstart.

## Theme & Design System (ChurchSpring Warm Sanctuary)

The UI is built on the **ChurchSpring Warm Sanctuary design system** (blending ChurchSpring platform branding with warm editorial cues from Apple Health, Calm, and Notion), providing an emotionally comforting, peaceful church technology aesthetic that invites spiritual stillness and reflection:

- **Canvas & Surfaces**:
  - **Main Background**: `#F8F5EE` (warm parchment/linen tone)
  - **Secondary Surface (Right Sidebar)**: `#FBFAF7`
  - **Cards & Dialogs**: `#FFFFFF`
  - **Borders**: `#ECE8E2`
  - **Subtle Dividers**: `#F2EFEA`
- **Brand Colors**:
  - **Primary ChurchSpring Green**: `#77B500` (hover `#689E00`) for primary actions and affirmative states.
  - **Soft Pastel Green**: `#EAF6DF` (border `#D2EAC0`) for active pill tags, sentence highlights, and prayer cards.
  - **Accent Forest Green**: `#3B5B24` / `#234A14` for scripture text contrast.
- **Spiritual Warmth Accents**: Soft amber/gold (`#C8A86A`) for Today's Verse and answered prayer milestones.
- **Typography & Hierarchy**: High-contrast charcoal (`#2F2F2F`) headings and editorial body text formatted for calm, readable spiritual counsel (`leading-[1.8]`, `text-[15px]`), paired with serif headings (`font-serif`) for pastoral warmth.
- **Three-Column Desktop Layout**:
  - **Left Panel (~20-22%)**: Static emotional anchor featuring an architectural cathedral arched window looking out over rolling hills and church steeple, potted olive plant, Holy Bible, and Psalm 46:10 quotation.
  - **Center Column (~56-60%)**: Elevated main sanctuary card (`rounded-[28px] bg-white border border-[#ECE8E2] shadow-[0_20px_60px_rgba(0,0,0,0.06)]`) featuring the hero banner (`You are not alone`), circular 3D avatar halo, audio pill dock, editorial conversation stream with scripture cards, and sticky composer dock.
  - **Right Sidebar (~24%)**: `#FBFAF7` surface hosting recent `Replies` cards (with audio playback trigger), `Today's Verse` card, and `Your Journey` chronological spiritual visit timeline.
- **Card System**:
  - **User Message**: High-contrast charcoal pill (`#1A1A1A`) with clean white text (`rounded-2xl rounded-tr-xs`).
  - **Pastor Mike Hero**: Soft gradient banner (`from-[#EFF6E8] via-[#FAF9F5] to-[#F5F8F2]`) with 3D avatar halo, botanical leaf accent, and greeting.
  - **Scripture Citation Card**: Clean container (`#EEF8E7`/90) with a 4px ChurchSpring green left border (`#77B500`), book icon, translation badge (`WEB`/`KJV`/`NIV`), right-hand landscape church illustration, and "Save Verse" / "Copy" quick actions.
  - **Pastoral Prayer Card**: Soft pastel green container (`#EAF6DF`) with heart badge, prayer petition text, and 1-click "Mark as Answered" action.
  - **Modals & Dialogs**: Elevated white dialog cards (`bg-white border-[#ECE8E2] shadow-2xl`), light canvas interior (`#FBFAF7`), and green active pill selections—zero dark mode overrides.
- **Live Pastor Stage**: 3D Avatar rendered inside the soft circular halo with autonomous breathing, blinking, and lipsync synchronized to KittenTTS playback and amplitude analyser. Audio controls provide 44px rounded-full pills for Resume/Listen, Restart, Stop, voice selector, and speed dropdown. Spoken lyrics highlight each sentence in soft green (`#EAF6DF` / `#3B5B24`).

## UI Shell (`components/*`, `components/avatar/*`, `app/page.tsx`)

Single-page chat experience; no client-side router beyond the one route. State (active session, first-run flag) persisted to `localStorage` so a refresh resumes the same session. Key components: `Header` (Live Pastor toggle, Setup Guide, Settings, Prayer Journal), `ChatMessage` (renders scripture/prayer cards inline), `ChatInput`, `VoiceBar`, `PrayerJournalModal`, `VisitHistorySidebar`, `OnboardingModal` (2-step first-run flow: profile, then audio setup), `CrisisBanner`.

## Testing

Script-based, no test framework — each `scripts/test-*.ts` exercises one layer directly (db, scripture, ai/safety, api routes, tts, tts-chunking, stt, onboarding, visit history, ...) via `tsx`, asserting with plain `console.assert`/throw. `npm test` runs `scripts/test-e2e-demo.ts`, which walks a full conversation end-to-end. No mocking of SQLite or Ollama — tests hit the real local DB file and treat Ollama-absent as an expected, asserted code path.

## Known Simplifications

- Single hardcoded default user — no auth, no multi-user isolation.
- Topic classification is regex keyword matching, not the LLM — cheap and deterministic, but only covers 4 topics before falling back to `general`.
- No migration system for `lib/db.ts` schema changes — `CREATE TABLE IF NOT EXISTS` only; adding/changing a column requires a manual migration path.
- `scripture_notes` table exists but has no API/UI wired to it yet.
- KittenTTS's actual installed voice set/model depends on whatever version `pip` resolves at build time (see README) — the 8 branded preset names are consistent, but which real underlying voice each maps to can change if a future `kittentts` release fixes the `misaki` dependency and a newer version resolves instead.
- TTS/STT each spawn a fresh Python process per request rather than running a persistent model server — simple and consistent with the rest of the app's "no long-running background service" design, but each call pays model-load overhead (mitigated for STT/TTS model *weights* by the Docker named volumes, not eliminated — the ONNX runtime session itself still initializes per process).
- The avatar's sentence-timing sync (`useSentenceSync.ts`) estimates per-sentence duration from total audio length rather than real per-word timing — reasonably close for pacing the transcript highlight, not phoneme-accurate.
