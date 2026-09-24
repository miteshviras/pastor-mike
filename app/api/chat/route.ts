import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDefaultUser, createSession, getSession } from "@/lib/db";
import { processPastoralTurn } from "@/lib/ai/orchestrator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId: incomingSessionId } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const user = getOrCreateDefaultUser();
    let sessionId = incomingSessionId;

    if (!sessionId || !getSession(sessionId)) {
      const newSession = createSession(user.id);
      sessionId = newSession.id;
    }

    const pastoralTurn = await processPastoralTurn(sessionId, message.trim(), { userId: user.id });

    return NextResponse.json({
      sessionId,
      reply: pastoralTurn.reply,
      scriptures: pastoralTurn.scriptures,
      prayer: pastoralTurn.prayer,
      safety: pastoralTurn.safety,
      savedPrayerId: pastoralTurn.savedPrayerId,
      usedModel: pastoralTurn.usedModel,
      modelName: pastoralTurn.modelName,
      sessionTitle: pastoralTurn.sessionTitle,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
