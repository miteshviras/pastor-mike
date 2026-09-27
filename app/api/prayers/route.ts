import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateDefaultUser,
  getSession,
  createSession,
  listPrayerRequests,
  savePrayerRequest,
  updatePrayerStatus,
  deletePrayerRequest,
  deletePrayerRequests,
} from "@/lib/db";

export async function GET(req?: NextRequest) {
  try {
    const user = getOrCreateDefaultUser();
    const url = req?.url ? new URL(req.url) : null;
    const sessionId = url?.searchParams.get("sessionId") ?? null;
    const statusParam = url?.searchParams.get("status");
    const status = statusParam === "active" || statusParam === "answered" ? statusParam : undefined;
    const limitParam = url?.searchParams.get("limit");
    const offsetParam = url?.searchParams.get("offset");
    const prayers = listPrayerRequests(
      user.id,
      sessionId,
      status,
      limitParam ? Number(limitParam) : undefined,
      offsetParam ? Number(offsetParam) : undefined
    );
    return NextResponse.json({ prayers });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, sessionId: incomingSessionId } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Prayer text is required" }, { status: 400 });
    }

    const user = getOrCreateDefaultUser();
    let sessionId = incomingSessionId;
    if (!sessionId || !getSession(sessionId)) {
      const newSession = createSession(user.id);
      sessionId = newSession.id;
    }

    const prayer = savePrayerRequest(user.id, text.trim(), sessionId);
    return NextResponse.json({ prayer, sessionId });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || (status !== "active" && status !== "answered")) {
      return NextResponse.json({ error: "Valid prayer id and status ('active' | 'answered') required" }, { status: 400 });
    }

    updatePrayerStatus(id, status);
    return NextResponse.json({ success: true, id, status });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids");

    if (idsParam) {
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json({ error: "No prayer ids provided" }, { status: 400 });
      }
      const deletedCount = deletePrayerRequests(ids);
      return NextResponse.json({ success: true, deletedCount, ids });
    }

    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Prayer id required" }, { status: 400 });
    }

    deletePrayerRequest(id);
    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
