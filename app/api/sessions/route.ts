import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateDefaultUser,
  createSession,
  listSessions,
  getSessionMessages,
  getSession,
} from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const user = getOrCreateDefaultUser();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (sessionId) {
      const session = getSession(sessionId);
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      const messages = getSessionMessages(sessionId);
      return NextResponse.json({ session, messages });
    }

    const sessions = listSessions(user.id);
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
