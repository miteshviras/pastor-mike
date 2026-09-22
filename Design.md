# Design — Digital Pastor ("Pastor Mike")

Technical design reference. For setup/usage see [README.md](README.md); for build history see [task.md](task.md).

## Goals & Constraints

- **Local-first, zero cloud keys**: no OpenAI/Anthropic/ElevenLabs dependency. All persistence, reasoning fallback, TTS, and tool execution run on the user's machine.
- **Pastoral safety over cleverness**: crisis and prophecy handling short-circuit the normal reasoning path before any LLM is involved.
- **Graceful degradation**: every external capability (Ollama, KittenTTS, mic STT) has an offline/browser fallback so the app fully works with nothing installed beyond Node.

## Architecture

```
Browser UI (app/page.tsx, components/*)
   │
   ▼
Next.js App Router API (app/api/*)
   ├─ /api/chat     → lib/ai/orchestrator.ts (safety → topic match → MCP tools → reply)
   ├─ /api/sessions → lib/db.ts (session/message history + legacy metadata backfill)
   ├─ /api/prayers  → lib/db.ts (prayer journal CRUD + status toggle)
   ├─ /api/tts      → server/kittentts_adapter.py (spawned per request) + setup_kittentts.py status/download
   └─ /api/mcp      → lib/mcp/tools.ts (JSON-RPC gateway, same tool impls as stdio server)
   │
   ├─ lib/db.ts            → node:sqlite, data/pastor_mike.db (single shared connection)
   ├─ lib/scripture/       → in-memory WEB/KJV verse dataset, topic + keyword search
   ├─ lib/mcp/              → tool definitions (schemas) + tool implementations
   ├─ lib/ai/                → safety filter, offline pastoral templates, orchestrator
   └─ server/mcp_server.ts  → standalone stdio MCP server (@modelcontextprotocol/sdk) for Claude Desktop/Cursor
```

Two MCP entry points share one tool implementation (`lib/mcp/tools.ts`): `server/mcp_server.ts` for stdio clients, `app/api/mcp/route.ts` for HTTP JSON-RPC and the in-app inspector (`McpModal.tsx`).

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
4. Call the `search_scripture` MCP tool for that topic to fetch grounding verses.
5. If the message reads as a prayer request, call `save_prayer_request`.
6. Try local Ollama (`POST http://127.0.0.1:11434/api/chat`, 3.5s timeout, model `llama3.2` by default). On any failure/timeout/absence, fall back to the offline template (empathy + counsel + scripture excerpt + prayer prompt) — this is the default path in a zero-dependency install.
7. Persist the assistant reply with full metadata and return it.

This is deliberately a straight-line pipeline (not a tool-calling LLM agent): the topic match and scripture lookup happen unconditionally so a reply is always scripturally grounded even when Ollama is absent or ignores instructions.

## Safety Layer (`lib/ai/safety.ts`)

Three independent regex pattern sets, checked in order — crisis first (highest priority, always wins), then prophecy/coercion, then medical/legal (flagged but non-blocking today). Crisis responses are static, not model-generated, and include 988, Crisis Text Line, Trevor Project, and Domestic Violence Hotline. This runs before any LLM call so it can't be bypassed by prompt content aimed at the model.

## Scripture Knowledge Base (`lib/scripture/bible-data.ts`)

Small curated offline WEB/KJV verse set, in-memory array, tagged by topic. Search is topic-tag match plus keyword substring match over reference/text — no embeddings/vector search, which is appropriate given the dataset size (avoids adding a vector DB dependency for a few dozen verses).

## MCP Tool Layer (`lib/mcp/`)

- `types.ts` / `definitions.ts`: JSON-schema tool contracts shared by both transports.
- `tools.ts`: `executeMcpTool(name, args, ctx)` — the actual implementations, thin wrappers over `lib/db.ts` and `lib/scripture`.
- Exposed tools: `search_scripture`, `get_verse`, `save_prayer_request`, `get_recent_context`, `save_memory`, `load_memory`, `summarize_session`.

Keeping tool *definitions* separate from *execution* lets the same seven tools be served over stdio (`server/mcp_server.ts`, for Claude Desktop/Cursor) and HTTP JSON-RPC (`app/api/mcp/route.ts`, for the in-app inspector and any HTTP MCP client) without duplicating logic.

## Voice Pipeline

- **TTS**: `server/kittentts_adapter.py` — local ONNX KittenTTS model, invoked as a child process per `/api/tts` request; `server/setup_kittentts.py` handles status-check and one-click weight download (surfaced in `OnboardingModal.tsx`). 8 voice presets, 0.8x–1.2x speed.
- **Client**: `lib/voice/speech-client.ts` wraps browser `SpeechRecognition` (STT) and audio playback, with turn-taking (mic muted while TTS audio plays) to prevent feedback loops. If KittenTTS isn't installed, playback falls back to the browser's built-in `speechSynthesis`.

## UI Shell (`components/*`, `app/page.tsx`)

Single-page chat experience; no client-side router beyond the one route. State (active session, first-run flag) persisted to `localStorage` so a refresh resumes the same session (task.md Task 11). Key components: `Header` (nav + MCP/Setup entry points), `ChatMessage` (renders scripture/prayer cards inline), `ChatInput`, `VoiceBar`, `PrayerJournalModal`, `McpModal` (live tool inspector), `OnboardingModal` (3-step first-run flow), `CrisisBanner`.

## Testing

Script-based, no test framework — each `scripts/test-*.ts` exercises one layer directly (db, scripture, mcp, mcp-http, ai/safety, api routes, tts, onboarding) via `tsx`, asserting with plain `console.assert`/throw. `npm test` runs `scripts/test-e2e-demo.ts`, which walks the full Notion demo script end-to-end. No mocking of SQLite or Ollama — tests hit the real local DB file and treat Ollama-absent as an expected, asserted code path.

## Known Simplifications

- Single hardcoded default user — no auth, no multi-user isolation.
- Topic classification is regex keyword matching, not the LLM — cheap and deterministic, but only covers 4 topics before falling back to `general`.
- No migration system for `lib/db.ts` schema changes — `CREATE TABLE IF NOT EXISTS` only; adding/changing a column requires a manual migration path.
- `scripture_notes` table exists but has no API/UI wired to it yet.
