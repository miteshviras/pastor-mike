import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDefaultUser, getProviderSettings, saveProviderSettings, AiProviderSettings } from "@/lib/db";

// Quick reachability check so the settings UI can show whether Ollama will actually work
async function isOllamaReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  const user = getOrCreateDefaultUser();
  const [ollamaReachable] = await Promise.all([isOllamaReachable()]);

  return NextResponse.json({
    settings: getProviderSettings(user.id),
    availability: {
      gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY),
      ollama: ollamaReachable,
      offline: true,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = getOrCreateDefaultUser();

    const update: Partial<AiProviderSettings> = {};
    if (body.provider === "gemini" || body.provider === "ollama" || body.provider === "offline") {
      update.provider = body.provider;
    }
    if (typeof body.geminiModel === "string" && body.geminiModel.trim()) {
      update.geminiModel = body.geminiModel.trim();
    }
    if (typeof body.ollamaModel === "string" && body.ollamaModel.trim()) {
      update.ollamaModel = body.ollamaModel.trim();
    }

    const settings = saveProviderSettings(user.id, update);
    return NextResponse.json({ settings });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
