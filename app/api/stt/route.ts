import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { transcribeViaWorker } from "@/lib/server/sttWorker";

const execFileAsync = promisify(execFile);

function parseJsonOutput(raw: string) {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]);
    } catch {}
  }
  return JSON.parse(raw.trim());
}

// GET /api/stt — Check Moonshine STT installation and model status
export async function GET() {
  try {
    const setupScript = path.join(process.cwd(), "server", "setup_stt.py");
    const { stdout } = await execFileAsync("python", [setupScript, "--check"], { timeout: 8000 });
    const parsed = parseJsonOutput(stdout);
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({
      installed: false,
      has_library: false,
      has_ffmpeg: false,
      has_local_model: false,
      lib_version: null,
      engine: "Browser-WebSpeechFallback",
      notice: err instanceof Error ? err.message : "Python unavailable",
    });
  }
}

// POST /api/stt — Transcribe recorded audio or trigger 1-click Moonshine model download
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  // 1. Download / Pre-warm action handler
  if (contentType.includes("application/json")) {
    try {
      const body = await req.json();
      if (body.action === "download") {
        const setupScript = path.join(process.cwd(), "server", "setup_stt.py");
        const args = [setupScript, "--download"];
        if (body.model) args.push("--model", body.model);

        const { stdout } = await execFileAsync("python", args, { timeout: 90000 });
        const parsed = parseJsonOutput(stdout);
        return NextResponse.json(parsed);
      }
    } catch (downloadErr) {
      return NextResponse.json(
        {
          installed: false,
          download_status: "error",
          error: downloadErr instanceof Error ? downloadErr.message : "Failed to download Moonshine model",
        },
        { status: 500 }
      );
    }
  }

function getAudioExtension(buffer: Buffer, contentType?: string): string {
  if (contentType?.includes("wav")) return ".wav";
  if (contentType?.includes("ogg")) return ".ogg";
  if (contentType?.includes("mp4") || contentType?.includes("m4a")) return ".m4a";
  if (contentType?.includes("webm")) return ".webm";

  // Check magic bytes
  if (buffer.length >= 4) {
    if (buffer.subarray(0, 4).toString("ascii") === "RIFF") return ".wav";
    if (buffer.subarray(0, 4).toString("ascii") === "OggS") return ".ogg";
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return ".webm";
  }
  return ".webm";
}

  // 2. Transcribe recorded audio blob
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  let tempAudioFile = "";

  try {
    const audioBuffer = Buffer.from(await req.arrayBuffer());
    if (audioBuffer.length === 0) {
      return NextResponse.json({ error: "No audio data received" }, { status: 400 });
    }

    const ext = getAudioExtension(audioBuffer, contentType);
    tempAudioFile = path.join(dataDir, `stt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}${ext}`);
    fs.writeFileSync(tempAudioFile, audioBuffer);

    const result = await transcribeViaWorker(tempAudioFile);
    return NextResponse.json({
      text: result.text || "",
      engine: result.engine || "moonshine",
    });
  } catch (err) {
    const detail = err && typeof err === "object" && "stderr" in err ? (err as { stderr?: string }).stderr : err;
    console.error("[api/stt] Transcription failed:", detail);
    return NextResponse.json({ error: "Transcription failed", detail: String(detail) }, { status: 500 });
  } finally {
    try { fs.unlinkSync(tempAudioFile); } catch {}
  }
}
