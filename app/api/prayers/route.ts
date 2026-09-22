import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateDefaultUser,
  listPrayerRequests,
  savePrayerRequest,
  updatePrayerStatus,
} from "@/lib/db";

export async function GET() {
  try {
    const user = getOrCreateDefaultUser();
    const prayers = listPrayerRequests(user.id);
    return NextResponse.json({ prayers });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, sessionId } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Prayer text is required" }, { status: 400 });
    }

    const user = getOrCreateDefaultUser();
    const prayer = savePrayerRequest(user.id, text.trim(), sessionId || null);
    return NextResponse.json({ prayer });
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
