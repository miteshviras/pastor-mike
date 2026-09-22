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

export interface McpConnection {
  id: string;
  client_name: string;
  client_version: string | null;
  transport: string;
  first_seen_at: string;
  last_seen_at: string;
  request_count: number;
}

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, "pastor_mike.db");
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

      CREATE TABLE IF NOT EXISTS mcp_connections (
        id TEXT PRIMARY KEY,
        client_name TEXT NOT NULL,
        client_version TEXT,
        transport TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        request_count INTEGER NOT NULL DEFAULT 0,
        UNIQUE(client_name, transport)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_prayers_user ON prayer_requests(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, started_at);
    `);
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

export function getSession(sessionId: string): Session | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as Session | undefined;
}

export function listSessions(userId: string): Session[] {
  const db = getDb();
  return db.prepare("SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at DESC").all(userId) as unknown as Session[];
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

export function listPrayerRequests(userId: string): PrayerRequest[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM prayer_requests WHERE user_id = ? ORDER BY created_at DESC"
  ).all(userId) as unknown as PrayerRequest[];
}

export function updatePrayerStatus(prayerId: string, status: "active" | "answered"): void {
  const db = getDb();
  db.prepare("UPDATE prayer_requests SET status = ? WHERE id = ?").run(status, prayerId);
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

// MCP Connection Tracking (which external MCP clients have called this server, and when)
export function recordMcpConnection(clientName: string, clientVersion: string | null, transport: "stdio" | "http"): void {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db.prepare(
    "SELECT id FROM mcp_connections WHERE client_name = ? AND transport = ?"
  ).get(clientName, transport) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      "UPDATE mcp_connections SET client_version = ?, last_seen_at = ?, request_count = request_count + 1 WHERE id = ?"
    ).run(clientVersion, now, existing.id);
  } else {
    const id = "mcpconn_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    db.prepare(
      "INSERT INTO mcp_connections (id, client_name, client_version, transport, first_seen_at, last_seen_at, request_count) VALUES (?, ?, ?, ?, ?, ?, 1)"
    ).run(id, clientName, clientVersion, transport, now, now);
  }
}

export function listMcpConnections(): McpConnection[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM mcp_connections ORDER BY last_seen_at DESC LIMIT 20"
  ).all() as unknown as McpConnection[];
}
