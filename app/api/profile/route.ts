import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDefaultUser, getProfile, saveProfile } from "@/lib/db";

export async function GET() {
  const user = getOrCreateDefaultUser();
  return NextResponse.json({ profile: getProfile(user.id) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = getOrCreateDefaultUser();

    const update: { name?: string; topics?: string[] } = {};
    if (typeof body.name === "string") {
      update.name = body.name.trim();
    }
    if (Array.isArray(body.topics) && body.topics.every((t: unknown) => typeof t === "string")) {
      update.topics = body.topics;
    }

    const profile = saveProfile(user.id, update);
    return NextResponse.json({ profile });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
