import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateDefaultUser,
  listSavedVerses,
  saveVerse,
  deleteSavedVerse,
  deleteSavedVerses,
} from "@/lib/db";

export async function GET(req?: NextRequest) {
  try {
    const user = getOrCreateDefaultUser();
    const url = req?.url ? new URL(req.url) : null;
    const limitParam = url?.searchParams.get("limit");
    const offsetParam = url?.searchParams.get("offset");
    const verses = listSavedVerses(
      user.id,
      limitParam ? Number(limitParam) : undefined,
      offsetParam ? Number(offsetParam) : undefined
    );
    return NextResponse.json({ verses });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reference, text, translation, sessionId } = body;

    if (!reference || typeof reference !== "string" || !reference.trim()) {
      return NextResponse.json({ error: "Verse reference is required" }, { status: 400 });
    }
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Verse text is required" }, { status: 400 });
    }

    const user = getOrCreateDefaultUser();
    const verse = saveVerse(user.id, reference.trim(), text.trim(), translation || null, sessionId);
    return NextResponse.json({ verse });
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
        return NextResponse.json({ error: "No verse ids provided" }, { status: 400 });
      }
      const deletedCount = deleteSavedVerses(ids);
      return NextResponse.json({ success: true, deletedCount, ids });
    }

    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Verse id required" }, { status: 400 });
    }

    deleteSavedVerse(id);
    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
