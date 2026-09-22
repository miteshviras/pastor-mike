# Digital Pastor ("Pastor Mike") — Tasks Roadmap

Tracking roadmap based on the [Notion Implementation Plan](https://app.notion.com/p/Digital-Pastor-MVP-Implementation-Plan-3e3831767b47815cbb9ede30f907e34d).
Each task is committed and pushed upon completion.

---

## Tasks Progress

- [x] **Task 1: Project Setup & Dependencies**
  - Initialize `task.md` roadmap.
  - Install core UI packages (`lucide-react`, `clsx`, `tailwind-merge`).
  - Configure serene pastoral theme tokens (warm stone/sage/parchment colors).
  - *Commit: `chore: setup project styling, lucide icons, and task tracking roadmap`*

- [x] **Task 2: SQLite Persistence Layer (`lib/db.ts`)**
  - Implement SQLite database using Node.js built-in `node:sqlite` (`pastor_mike.db`).
  - Define schema: `users`, `sessions`, `messages`, `prayer_requests`, `preferences`, `scripture_notes`, `conversation_summaries`.
  - Provide CRUD utilities for active sessions, messages, and prayer journal.
  - Add automated test verification (`scripts/test-db.ts`).
  - *Commit: `feat: implement SQLite persistence layer and data model`*

- [x] **Task 3: Scripture Knowledge Base & Topical Search (`lib/scripture/`)**
  - Build curated offline Bible dataset (WEB & KJV public domain) organized by pastoral topics (anxiety, peace, grief, forgiveness, strength, hope, purpose, work, healing, etc.).
  - Implement verse reference retrieval and keyword/topical search algorithms.
  - Add automated test verification (`scripts/test-scripture.ts`).
  - *Commit: `feat: implement scripture knowledge base and topical search engine`*

- [x] **Task 4: MCP Tool Layer (`lib/mcp/`)**
  - Define tool contracts: `search_scripture`, `get_verse`, `save_prayer_request`, `get_recent_context`, `save_memory`, `load_memory`, `summarize_session`.
  - Connect tools to database and scripture search engine.
  - Add automated test verification (`scripts/test-mcp.ts`).
  - *Commit: `feat: implement MCP tool layer and tool contracts`*

- [x] **Task 5: Pastoral Conversation & Safety Engine (`lib/ai/`)**
  - Create Pastor Mike persona prompt (warm, calm, non-performative, non-divine AI disclosure).
  - Implement crisis detection safeguards (self-harm, domestic abuse, medical emergency) with 988 Lifeline referral.
  - Implement local model orchestrator supporting local Ollama + offline pastoral reasoning engine.
  - Add automated test verification (`scripts/test-ai.ts`).
  - *Commit: `feat: implement pastoral conversation engine and safety guardrails`*

- [x] **Task 6: Backend API Routes (`app/api/`)**
  - `/api/chat`: Handles conversation turns, tool calls, context injection, and message persistence.
  - `/api/sessions`: Manages sessions and conversation history.
  - `/api/prayers`: Handles prayer journal queries and status toggling (`active` / `answered`).
  - Add automated test verification (`scripts/test-api.ts`).
  - *Commit: `feat: implement backend API routes for chat, sessions, and prayers`*

- [x] **Task 7: Voice Pipeline (KittenTTS & Audio)**
  - `/api/tts` & KittenTTS ONNX adapter integration script (`server/kittentts_adapter.py`).
  - Client-side voice controller (`lib/voice/speech-client.ts`) with browser audio synthesis fallback, turn-taking, and speed controls (0.8x - 1.2x).
  - Add automated test verification (`scripts/test-tts.ts`).
  - *Commit: `feat: implement KittenTTS voice pipeline and speech client`*

- [x] **Task 8: Serene Pastoral UI Shell & Components**
  - Pastoral Header with Pastor Mike avatar, AI disclosure badge, and Prayer Journal trigger (`components/Header.tsx`).
  - Message transcript with scripture citation cards, prayer cards with "Save to Journal", and audio play buttons (`components/ChatMessage.tsx`).
  - Calm chat input with starter suggestion pills and microphone speech button (`components/ChatInput.tsx`).
  - Prayer Journal slide-over drawer / modal (`components/PrayerJournalModal.tsx`).
  - Crisis banner component with 988 emergency escalation (`components/CrisisBanner.tsx`).
  - Floating VoiceBar with speed controls and turn-taking feedback (`components/VoiceBar.tsx`).
  - Main unified pastoral experience (`app/page.tsx`).
  - *Commit: `feat: implement serene pastoral UI shell, components, and prayer journal`*

- [x] **Task 9: End-to-End Testing & Demo Flow Verification**
  - Verify complete demo script from Notion (anxiety prompt -> scripture -> prayer -> voice -> journal save) (`scripts/test-e2e-demo.ts`).
  - Verify offline capability without external cloud keys.
  - Complete test runner in `package.json` (`npm test`).
  - Final Next.js production build verification.
  - *Commit: `test: add e2e demo script and complete roadmap tasks`*

- [x] **Task 10: Official MCP Server & Comprehensive Setup Guide**
  - Implement official Model Context Protocol (MCP) stdio server using `@modelcontextprotocol/sdk` (`server/mcp_server.ts`).
  - Implement `/api/mcp` JSON-RPC and REST tool calling gateway (`app/api/mcp/route.ts`).
  - Add interactive in-app MCP & Tools modal with live test execution and copyable Claude Desktop/Cursor configuration (`components/McpModal.tsx`).
  - Rewrite `README.md` with complete setup guide, MCP connection instructions, voice pipeline guide, and test suite commands.
  - *Commit: `feat: add official MCP server, in-app tool inspector, and setup guide in README`*

- [x] **Task 11: Fix UI Session Persistence, Scripture/Prayer Metadata & Dark Mode Contrast**
  - Fix message metadata in `lib/ai/orchestrator.ts`: Persist full scripture verse objects `{ reference, text, translation, topic }` and prayer objects `{ title, text }` instead of raw string references to prevent empty quotes upon page reload.
  - Add backward compatibility layer in `/api/sessions/route.ts` to automatically resolve legacy string references into full scripture verses and prayer text.
  - Retain active session ID across browser refreshes via `localStorage` in `app/page.tsx`.
  - Fix dark mode background contrast on prayer petition cards (`dark:bg-stone-800/90` instead of unsupported `dark:bg-stone-850`) in `components/PrayerJournalModal.tsx`.
  - Improve prayer card "Save to Journal" button styling and contrast in `components/ChatMessage.tsx`.
  - *Commit: `fix: resolve message metadata persistence and dark mode card contrast`*

- [x] **Task 12: First-Time User Onboarding Flow & KittenTTS Auto-Downloader**
  - Implement 3-step interactive onboarding modal (`components/OnboardingModal.tsx`):
    - **Step 1: Onboarding**: Meet Pastor Mike, AI companion disclosure, user preferred name, and spiritual care focus tags.
    - **Step 2: Connect to MCP**: 7 local MCP tools overview, live interactive tool test against `/api/mcp`, and copyable Claude Desktop/Cursor config.
    - **Step 3: Test STT & TTS**: KittenTTS status checker, 1-click **"Start Download TTS"** button, interactive TTS audio playback test with speed controls, and microphone STT input verification.
  - Add KittenTTS setup utility script (`server/setup_kittentts.py`) and API handlers (`GET/POST /api/tts`).
  - Add **"Setup Guide"** launcher button to navigation header (`components/Header.tsx`).
  - Add automatic first-time detection and preference persistence via `localStorage` and SQLite memory in `app/page.tsx`.
  - Add automated test verification (`scripts/test-onboarding.ts`).
  - *Commit: `feat: implement first-time onboarding flow, MCP connection, and KittenTTS auto-downloader`*

- [x] **Task 13: Fix MCP Client Configuration & Dark Mode Contrast in McpModal**
  - Fix Windows MCP client configuration: Claude Desktop and Cursor require `cmd.exe /c npx -y tsx server/mcp_server.ts` and explicit working directory (`cwd`) pointing to the project directory, resolving `ERR_MODULE_NOT_FOUND` when launched outside the repository.
  - Add OS toggle (Windows vs macOS/Linux) in `components/McpModal.tsx` and dynamically fetch real `projectRoot` from `GET /api/mcp`.
  - Add dedicated Cursor configuration guidelines for both GUI settings and `~/.cursor/mcp.json`.
  - Fix dark mode card background styling: Replaced invalid `dark:bg-stone-850` with `dark:bg-stone-800` across all cards, eliminating white backgrounds and invisible white-on-white text in dark mode.
  - *Commit: `fix: resolve MCP connection config for Windows/Cursor and dark mode card contrast`*

- [x] **Task 14: Fix TTS Voice Synthesis & Remove Dummy Chime Tone**
  - Fix `server/kittentts_adapter.py`: Replace dummy 1.5s musical chime generator (`generate_soothing_tone_wav`) with real spoken audio synthesis using Windows SAPI / System.Speech (supporting speed rates and natural voices).
  - Implement fail-fast fallback: If local speech synthesis fails, exit with error instead of creating a dummy chime WAV, cleanly delegating vocalization to the browser's Web Speech API.
  - Expand `/api/tts` text length limit from 250 to 800 characters and increase timeout from 6s to 15s to allow complete pastoral counsel and prayers to be vocalized in full.
  - *Commit: `fix: replace dummy chime with real speech synthesis and expand TTS length`*

- [x] **Task 15: Connected MCP Detection & Dynamic Non-Generic Pastoral Engine**
  - Implement active MCP connection detection (`getActiveMcpClient`, `recordMcpConnection`) tracking client name (Antigravity 2.0 / Claude Desktop / Cursor), transport (`stdio` / `http`), and real-time tool executions.
  - Implement Dynamic Pastoral Reasoning Engine (`lib/ai/dynamic-pastoral-engine.ts`) replacing static canned boilerplate templates with situation-specific, nuanced empathy reflections and tailored prayer compositions.
  - Show connected MCP badge and tool execution tags (`⚡ Connected MCP: Antigravity 2.0 • Tools: get_recent_context, search_scripture`) directly in assistant message bubbles (`components/ChatMessage.tsx`).
  - Add live MCP connection check in conversation typing/reflection state (`app/page.tsx`) and pulsing connection status dot in header (`components/Header.tsx`).
  - Persist MCP metadata in SQLite messages so connected client badges remain across reloads and visits.
  - Add dynamic pastoral testing suite (`scripts/test-dynamic-pastoral.ts`) and verify end-to-end demo flow.
  - *Commit: `feat: add connected MCP detection, UI badges, and dynamic pastoral content engine`*

- [x] **Task 16: Environment Configuration Template (`.env.example`)**
  - Create `.env.example` template covering server port, SQLite DB location, local Ollama URLs/models, voice presets, and MCP server configuration.
  - Whitelist `.env.example` in `.gitignore` (`!.env.example`) so the template is tracked while protecting local `.env*` files.
  - Support `process.env.SQLITE_DB_PATH` in `lib/db.ts` and `process.env.OLLAMA_BASE_URL` / `OLLAMA_MODEL` in `lib/ai/orchestrator.ts`.
  - Update `README.md` Quickstart Guide with environment configuration step (`cp .env.example .env.local`).
  - *Commit: `chore: add .env.example template and environment variable support`*

- [x] **Task 17: Google Gemini API Integration & Google API Key Support**
  - Install `@google/genai` modern SDK and implement `tryGeminiChat` in `lib/ai/orchestrator.ts`.
  - Support `GEMINI_API_KEY`, `GOOGLE_API_KEY`, and `GOOGLE_GENAI_API_KEY` with seamless fallback hierarchy: **Google Gemini -> Local Ollama -> Offline Dynamic Engine**.
  - Document Google API Key in `.env.example` with link to get free keys at Google AI Studio.
  - Display active model pill (`Google Gemini` / `Local Ollama` / `Offline Engine`) in `components/ChatMessage.tsx`.
  - Update `README.md` Quickstart Guide explaining Gemini cloud vs Ollama local vs offline choices.
  - *Commit: `feat: add Google Gemini API support and Google API key configuration`*

- [x] **Task 18: Visit History & Visit-Scoped Prayer Journal Isolation**
  - Implement Visit History switcher modal (`components/VisitHistoryModal.tsx`) with relative timestamps, message previews, message/prayer counts, active visit badge, and visit deletion.
  - Add "Visit History" action button in `components/Header.tsx` next to New Visit.
  - Implement visit-scoped prayer journal in `lib/db.ts` (`listPrayerRequests(userId, sessionId)`), isolating petitions strictly to each visit.
  - Eliminate prefilled/dummy test prayers: new visits start completely clean with 0 prayers.
  - Add scope switcher (`[This Visit]` vs `[All Visits]`) and individual petition deletion in `components/PrayerJournalModal.tsx`.
  - Add `deleteSession` with cascading message and prayer cleanup, and `listSessionsWithStats` in `lib/db.ts`.
  - Add `DELETE` endpoints to `/api/sessions` and `/api/prayers`.
  - Add comprehensive test suite (`scripts/test-visit-history.ts`) verifying cross-session isolation, clean new visits, and stats calculations.
  - *Commit: `feat: add visit history switcher and visit-scoped prayer journal isolation`*







