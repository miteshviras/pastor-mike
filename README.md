# Digital Pastor ("Pastor Mike") — Local-First Spiritual Companion

A private, local-first web prototype for a **Digital Pastor** supporting empathetic text chat, voice conversations, scripture search, personal prayer journaling, and Model Context Protocol (MCP) tool integration.

Built in accordance with the [Notion Implementation Plan](https://app.notion.com/p/Digital-Pastor-MVP-Implementation-Plan-3e3831767b47815cbb9ede30f907e34d).

---

## Key Features

- **100% Private & Local-First**: No cloud API keys required (OpenAI, Anthropic, ElevenLabs, etc.).
- **Local SQLite Persistence**: Uses Node.js native `node:sqlite` (`pastor_mike.db`) to persist messages, sessions, prayer requests, and user memories.
- **Model Context Protocol (MCP) Server**: Exposes 7 pastoral tools for scripture search, prayer recording, and session recall via stdio (`npm run mcp:server`) or HTTP JSON-RPC (`/api/mcp`).
- **Scripture Knowledge Base**: Offline public domain World English Bible (WEB) & King James Version (KJV) indexed by topics (anxiety, rest, peace, grief, forgiveness, guidance, healing, love).
- **Voice Pipeline with KittenTTS**: Local Python adapter running the `kitten-tts-mini` neural model (default voice **Jasper**, 8 voices total), adjustable delivery speeds (0.8x - 1.2x), and intelligent turn-taking (prevents microphone feedback while speaking).
- **Pastoral Safety Safeguards**: Built-in crisis detection with immediate compassionate referral to the **988 Suicide & Crisis Lifeline** (24/7 call/text) and Crisis Text Line.
- **Serene Pastoral UI**: Calming parchment/sage aesthetic, formatted scripture citation cards with copy buttons, prayer cards with "Save to Journal", and active/answered petition tracking.

---

## System Architecture

```
User (Browser Chat & Voice UI)
       │
       ▼
Next.js App Router Backend (/api/chat, /api/prayers, /api/sessions, /api/tts, /api/mcp)
       │
       ├──► Local SQLite Database (node:sqlite -> data/pastor_mike.db)
       │
       ├──► MCP Tool Server (search_scripture, get_verse, save_prayer_request, ...)
       │        └──► Bible Knowledge Base (WEB / KJV)
       │
       ├──► Voice Pipeline (KittenTTS Adapter -> server/kittentts_adapter.py)
       │
       └──► Local Model Runtime (Ollama at localhost:11434 or Built-in Offline Pastoral Engine)
```

---

## Prerequisites

- **Node.js**: v22.5.0 or higher (Node 26 recommended for built-in `node:sqlite`).
- **npm**: v10+
- **Python**: 3.10+ (for local KittenTTS adapter)
- *(Optional)* **Ollama**: If you want to use a local LLM like `llama3.2`, `mistral`, or `qwen2.5`.

---

## Quickstart Setup Guide

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/miteshviras/pastor-mike.git
cd pastor-mike
npm install
```

### 2. Configure Environment (Optional)

Pastor Mike supports a flexible 3-tier model hierarchy:
1. **Google Gemini API** (`GEMINI_API_KEY` or `GOOGLE_API_KEY`): Recommended for highest-quality pastoral reflections, prayers, and scripture grounding via Google's Gemini models.
2. **Local Ollama** (`OLLAMA_BASE_URL`): For private local open-source LLMs (`llama3.2`, `mistral`, `qwen2.5`).
3. **Built-in Offline Engine**: Zero external dependencies, runs 100% locally with **zero API keys required**.

To configure your environment, copy `.env.example`:

```bash
cp .env.example .env.local
```

If using Google Gemini, obtain a free key at [Google AI Studio](https://aistudio.google.com/app/apikey) and set:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run the Test Suite

Verify database persistence, scripture search, MCP tools, safety rules, and the complete Notion demo script:

```bash
npm test
```

### 4. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## How to Connect with MCP (Model Context Protocol)

Pastor Mike comes equipped with 7 MCP tools:
1. `search_scripture`: Search Holy Scripture by pastoral topic (e.g. anxiety, grief, rest, courage).
2. `get_verse`: Lookup specific verse references (e.g. `Philippians 4:6-7`).
3. `save_prayer_request`: Save a prayer request into the SQLite journal.
4. `get_recent_context`: Retrieve recent conversation summaries and active prayers.
5. `save_memory`: Record a key-value memory about the believer.
6. `load_memory`: Recall a stored memory by key.
7. `summarize_session`: Generate and persist a session summary.

### Option A: In-App MCP Inspector
Click the **"MCP & Tools"** button in the top navigation header to:
- Inspect all active tools and schemas.
- Run live test calls directly inside the browser.
- View real-time connection status.

### Option B: Connect to Claude Desktop
Add this to your `claude_desktop_config.json` (`%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "pastor-mike": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "C:\\Users\\mitesh\\PersonalProjects\\pastor-mike\\server\\mcp_server.ts"
      ]
    }
  }
}
```

### Option C: Connect to Cursor
Add the following to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "pastor-mike": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "C:\\Users\\mitesh\\PersonalProjects\\pastor-mike\\server\\mcp_server.ts"
      ]
    }
  }
}
```

### Option D: Run Standalone Stdio Server
To launch the MCP server in your terminal for debugging:

```bash
npm run mcp:server
```

### Option E: HTTP JSON-RPC Endpoint
While the web server is running (`npm run dev`), the MCP gateway is available at:

```http
POST http://localhost:3000/api/mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_scripture",
    "arguments": {
      "topic_or_keyword": "anxiety and work stress"
    }
  }
}
```

---

## Local AI Runtime Configuration

The app operates with zero cloud API keys:

1. **Built-in Offline Pastoral Reasoning Engine (Default)**:
   - Always ready immediately without running any background AI software.
   - Grounded in scripture, compassion, and pastoral empathy.
2. **Ollama Integration (Optional)**:
   - If Ollama is running on your machine (`http://127.0.0.1:11434`), Pastor Mike will automatically detect and route prompts to your local model (e.g. `ollama run llama3.2`).

---

## First-Time User Setup Flow

When opening the app for the first time, an interactive 3-step setup guide launches automatically:
1. **Step 1: Onboarding**: Meet Pastor Mike, review the non-ordained AI disclosure, set your preferred name, and select spiritual focus areas.
2. **Step 2: Connect to MCP**: Verify local tool execution against `/api/mcp` and inspect Claude Desktop / Cursor stdio configuration.
3. **Step 3: Test Audio (STT & TTS)**:
   - Check KittenTTS status.
   - 1-Click **"Start Download TTS"** button to automatically download KittenTTS weights.
   - Listen to a test pastoral blessing (TTS) and test microphone recognition (STT).
   - Click **"Setup Guide"** in the top navigation anytime to re-open this flow.

---

## Voice Pipeline (KittenTTS & Speech Check)

- **1-Click Downloader**: Click **"Setup Guide"** in the UI to check status and download KittenTTS neural weights automatically, or trigger directly via:
  ```bash
  python server/setup_kittentts.py --download
  ```
- **Adapter Script**: Located in [`server/kittentts_adapter.py`](server/kittentts_adapter.py). Uses the `KittenML/kitten-tts-mini-0.8` model with **Jasper** as the default voice (8 voices available: Bella, Jasper, Luna, Bruno, Rosie, Hugo, Kiki, Leo).
- **Test CLI Synthesis**:
  ```bash
  python server/kittentts_adapter.py --text "Peace be with you." --voice Jasper --speed 0.9 --output output.wav
  ```
- **Browser Playback & Microphone STT**: In the UI, click **Voice Mode** or the microphone icon to talk hands-free with turn-taking awareness and speed controls (0.8x to 1.1x).

---

## Test Suite Commands

| Command | Description |
| :--- | :--- |
| `npm test` | Runs the comprehensive Notion E2E Demo test suite |
| `npm run test:db` | Tests SQLite database creation, queries, and migrations |
| `npm run test:scripture` | Tests topical scripture search and direct verse lookups |
| `npm run test:mcp` | Tests all 7 MCP tool handlers |
| `npm run test:mcp-http` | Tests the `/api/mcp` JSON-RPC and REST endpoints |
| `npm run test:ai` | Tests crisis safety (988 hotline), prophecy boundaries, and empathy generation |
| `npm run test:api` | Tests all Next.js App Router API routes |
| `npm run test:tts` | Tests KittenTTS voice synthesis and audio generation |
| `npm run build` | Compiles the production Next.js build |

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
