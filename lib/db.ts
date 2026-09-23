import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

export interface User {
  id: string;
  display_name: string;
  locale: string;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
}

export interface Message {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: string | null;
  created_at: string;
}

export interface PrayerRequest {
  id: string;
  user_id: string;
  session_id: string | null;
  request_text: string;
  status: "active" | "answered";
  created_at: string;
}

export interface Preference {
  id: string;
  user_id: string;
  key: string;
  value: string;
}

export interface ScriptureNote {
  id: string;
  topic: string;
  verse_ref: string;
  verse_text: string;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  session_id: string;
  summary: string;
  created_at: string;
}

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = process.env.SQLITE_DB_PATH || path.join(dataDir, "pastor_mike.db");
    dbInstance = new DatabaseSync(dbPath);

    // Initialize Schema
    dbInstance.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        locale TEXT NOT NULL DEFAULT 'en-US',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        summary TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS prayer_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT,
        request_text TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS preferences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        UNIQUE(user_id, key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS scripture_notes (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        verse_ref TEXT NOT NULL,
        verse_text TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conversation_summaries (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_prayers_user ON prayer_requests(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, started_at);
    `);

    // Purge orphaned prayer records with no associated active session
    try {
      dbInstance.prepare(`
        DELETE FROM prayer_requests 
        WHERE session_id IS NULL 
           OR session_id NOT IN (SELECT id FROM sessions)
      `).run();
    } catch {}
  }
  return dbInstance;
}

// User Helpers
export function getOrCreateDefaultUser(): User {
  const db = getDb();
  const defaultId = "user_default";
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(defaultId) as User | undefined;
  if (existing) return existing;

  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO users (id, display_name, locale, created_at) VALUES (?, ?, ?, ?)"
  ).run(defaultId, "Beloved Friend", "en-US", now);

  return {
    id: defaultId,
    display_name: "Beloved Friend",
    locale: "en-US",
    created_at: now,
  };
}

// Session Helpers
export function createSession(userId: string, id?: string): Session {
  const db = getDb();
  const sessionId = id || "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO sessions (id, user_id, started_at, summary) VALUES (?, ?, ?, ?)"
  ).run(sessionId, userId, now, null);

  return {
    id: sessionId,
    user_id: userId,
    started_at: now,
    ended_at: null,
    summary: null,
  };
}

export interface SessionWithStats extends Session {
  messageCount: number;
  prayerCount: number;
  firstMessagePreview?: string | null;
  lastMessageAt?: string | null;
}

export function getSession(sessionId: string): Session | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as Session | undefined;
}

export function listSessions(userId: string): Session[] {
  const db = getDb();
  return db.prepare("SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at DESC").all(userId) as unknown as Session[];
}

export function listSessionsWithStats(userId: string): SessionWithStats[] {
  const db = getDb();
  return db.prepare(`
    SELECT 
      s.id,
      s.user_id,
      s.started_at,
      s.ended_at,
      s.summary,
      (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as messageCount,
      (SELECT COUNT(*) FROM prayer_requests WHERE session_id = s.id) as prayerCount,
      (SELECT content FROM messages WHERE session_id = s.id AND role = 'user' ORDER BY created_at ASC LIMIT 1) as firstMessagePreview,
      (SELECT created_at FROM messages WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) as lastMessageAt
    FROM sessions s
    WHERE s.user_id = ?
      AND (
        (SELECT COUNT(*) FROM messages WHERE session_id = s.id) > 0
        OR (SELECT COUNT(*) FROM prayer_requests WHERE session_id = s.id) > 0
      )
    ORDER BY COALESCE((SELECT created_at FROM messages WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1), s.started_at) DESC
  `).all(userId) as unknown as SessionWithStats[];
}

export function deleteSession(sessionId: string): boolean {
  const db = getDb();
  db.prepare("DELETE FROM messages WHERE session_id = ?").run(sessionId);
  db.prepare("DELETE FROM prayer_requests WHERE session_id = ?").run(sessionId);
  db.prepare("DELETE FROM conversation_summaries WHERE session_id = ?").run(sessionId);
  const res = db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  return Number(res.changes) > 0;
}

export function updateSessionSummary(sessionId: string, summary: string): void {
  const db = getDb();
  db.prepare("UPDATE sessions SET summary = ? WHERE id = ?").run(summary, sessionId);
}

// Message Helpers
export function saveMessage(
  sessionId: string,
  role: "user" | "assistant" | "system",
  content: string,
  metadata?: Record<string, unknown> | null
): Message {
  const db = getDb();
  const messageId = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();
  const metaStr = metadata ? JSON.stringify(metadata) : null;

  db.prepare(
    "INSERT INTO messages (id, session_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(messageId, sessionId, role, content, metaStr, now);

  return {
    id: messageId,
    session_id: sessionId,
    role,
    content,
    metadata: metaStr,
    created_at: now,
  };
}

export function getSessionMessages(sessionId: string): Message[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC"
  ).all(sessionId) as unknown as Message[];
}

export function countUserMessages(sessionId: string): number {
  const db = getDb();
  const row = db.prepare(
    "SELECT COUNT(*) as count FROM messages WHERE session_id = ? AND role = 'user'"
  ).get(sessionId) as { count: number };
  return row.count;
}

// Prayer Request Helpers
export function savePrayerRequest(
  userId: string,
  requestText: string,
  sessionId?: string | null
): PrayerRequest {
  const db = getDb();
  const prayerId = "pray_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO prayer_requests (id, user_id, session_id, request_text, status, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(prayerId, userId, sessionId || null, requestText, "active", now);

  return {
    id: prayerId,
    user_id: userId,
    session_id: sessionId || null,
    request_text: requestText,
    status: "active",
    created_at: now,
  };
}

export function listPrayerRequests(userId: string, sessionId?: string | null): PrayerRequest[] {
  const db = getDb();
  if (sessionId && sessionId !== "all") {
    return db.prepare(
      "SELECT * FROM prayer_requests WHERE user_id = ? AND session_id = ? ORDER BY created_at DESC"
    ).all(userId, sessionId) as unknown as PrayerRequest[];
  }
  return db.prepare(
    "SELECT * FROM prayer_requests WHERE user_id = ? ORDER BY created_at DESC"
  ).all(userId) as unknown as PrayerRequest[];
}

export function updatePrayerStatus(prayerId: string, status: "active" | "answered"): void {
  const db = getDb();
  db.prepare("UPDATE prayer_requests SET status = ? WHERE id = ?").run(status, prayerId);
}

export function deletePrayerRequest(prayerId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM prayer_requests WHERE id = ?").run(prayerId);
}

// Memory & Preference Helpers
export function saveMemory(userId: string, key: string, value: string): void {
  const db = getDb();
  const id = "pref_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  db.prepare(`
    INSERT INTO preferences (id, user_id, key, value)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
  `).run(id, userId, key, value);
}

export function loadMemory(userId: string, key: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM preferences WHERE user_id = ? AND key = ?").get(userId, key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function getAllMemories(userId: string): Record<string, string> {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM preferences WHERE user_id = ?").all(userId) as unknown as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

// Conversation Summary Helpers
export function saveConversationSummary(sessionId: string, summary: string): ConversationSummary {
  const db = getDb();
  const id = "sum_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();

  // Keep at most one summary row per session — this is called after every turn now, and a
  // blind insert would pile up several rows for the same visit, skewing getRecentContext's
  // "most recent distinct past visits" query toward one over-represented session.
  db.prepare("DELETE FROM conversation_summaries WHERE session_id = ?").run(sessionId);
  db.prepare(
    "INSERT INTO conversation_summaries (id, session_id, summary, created_at) VALUES (?, ?, ?, ?)"
  ).run(id, sessionId, summary, now);

  updateSessionSummary(sessionId, summary);

  return {
    id,
    session_id: sessionId,
    summary,
    created_at: now,
  };
}

export function getRecentContext(userId: string, limit = 5): {
  recentSummaries: string[];
  activePrayers: string[];
  memories: Record<string, string>;
} {
  const db = getDb();
  const summaryRows = db.prepare(`
    SELECT cs.summary
    FROM conversation_summaries cs
    JOIN sessions s ON cs.session_id = s.id
    WHERE s.user_id = ?
    ORDER BY cs.created_at DESC
    LIMIT ?
  `).all(userId, limit) as unknown as { summary: string }[];

  const prayerRows = db.prepare(`
    SELECT request_text
    FROM prayer_requests
    WHERE user_id = ? AND status = 'active'
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit) as unknown as { request_text: string }[];

  const memories = getAllMemories(userId);

  return {
    recentSummaries: summaryRows.map(r => r.summary),
    activePrayers: prayerRows.map(r => r.request_text),
    memories,
  };
}

// AI Provider Settings (which model backend to use, and which model) — stored as a
// reserved key in the preferences table so no schema change is needed.
export interface AiProviderSettings {
  provider: "gemini" | "ollama" | "offline";
  geminiModel: string;
  ollamaModel: string;
}

const PROVIDER_SETTINGS_KEY = "__ai_provider_settings";
const DEFAULT_PROVIDER_SETTINGS: AiProviderSettings = {
  provider: "gemini",
  geminiModel: "gemini-2.5-flash",
  ollamaModel: "llama3.2",
};

export function getProviderSettings(userId: string): AiProviderSettings {
  const raw = loadMemory(userId, PROVIDER_SETTINGS_KEY);
  if (!raw) return DEFAULT_PROVIDER_SETTINGS;
  try {
    return { ...DEFAULT_PROVIDER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROVIDER_SETTINGS;
  }
}

export function saveProviderSettings(userId: string, settings: Partial<AiProviderSettings>): AiProviderSettings {
  const merged = { ...getProviderSettings(userId), ...settings };
  saveMemory(userId, PROVIDER_SETTINGS_KEY, JSON.stringify(merged));
  return merged;
}

// Profile Helpers — "preferred_name" is the same key orchestrator.ts's memory extraction
// writes to after a Gemini/Ollama turn, so a name set here or inferred from conversation
// both land in one place and the most recently saved one wins.
const CARE_TOPICS_KEY = "care_topics";

export interface Profile {
  name: string;
  topics: string[];
}

export function getProfile(userId: string): Profile {
  const name = loadMemory(userId, "preferred_name") || "";
  const rawTopics = loadMemory(userId, CARE_TOPICS_KEY);
  let topics: string[] = [];
  if (rawTopics) {
    try {
      topics = JSON.parse(rawTopics);
    } catch {
      topics = [];
    }
  }
  return { name, topics };
}

export function saveProfile(userId: string, profile: Partial<Profile>): Profile {
  if (profile.name !== undefined) {
    saveMemory(userId, "preferred_name", profile.name);
  }
  if (profile.topics !== undefined) {
    saveMemory(userId, CARE_TOPICS_KEY, JSON.stringify(profile.topics));
  }
  return getProfile(userId);
}

