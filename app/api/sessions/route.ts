import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateDefaultUser,
  createSession,
  listSessionsWithStats,
  getSessionMessages,
  getSession,
  deleteSession,
} from "@/lib/db";

import { getVerseByReference, ScriptureVerse } from "@/lib/scripture/bible-data";

export async function GET(req?: NextRequest) {
  try {
    const user = getOrCreateDefaultUser();
    const sessionId = req?.url ? new URL(req.url).searchParams.get("sessionId") : null;

    if (sessionId) {
      const session = getSession(sessionId);
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      const rawMessages = getSessionMessages(sessionId);

      // Normalize metadata to ensure backward compatibility for existing records
      const messages = rawMessages.map((m) => {
        if (!m.metadata) return m;
        try {
          const parsed = JSON.parse(m.metadata);
          if (Array.isArray(parsed.scriptures)) {
            parsed.scriptures = parsed.scriptures.map((item: string | ScriptureVerse) => {
              if (typeof item === "string") {
                const found = getVerseByReference(item);
                return found || { reference: item, text: item, translation: "WEB", topic: "faith" };
              }
              return item;
            });
          }
          if (parsed.prayerTitle && !parsed.prayer) {
            parsed.prayer = {
              title: parsed.prayerTitle,
              text: "Lord, bless and keep my friend in your perfect peace today. Amen.",
            };
          }
          return { ...m, metadata: JSON.stringify(parsed) };
        } catch {
          return m;
        }
      });

      return NextResponse.json({ session, messages });
    }

    const sessions = listSessionsWithStats(user.id);
    return NextResponse.json({ sessions });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = getOrCreateDefaultUser();
    const session = createSession(user.id);
    return NextResponse.json({ session });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Session id required" }, { status: 400 });
    }

    deleteSession(sessionId);
    return NextResponse.json({ success: true, sessionId });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
