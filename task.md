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
