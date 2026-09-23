import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

// POST /api/stt — Transcribe recorded audio via Moonshine (server-side fallback for browsers
// without native SpeechRecognition — see lib/voice/speech-client.ts). Body is the raw audio
// blob (whatever format the browser's MediaRecorder produced, typically webm/opus); the
// adapter script converts it via ffmpeg before running Moonshine.
export async function POST(req: NextRequest) {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const tempAudioFile = path.join(dataDir, `stt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.webm`);

  try {
    const audioBuffer = Buffer.from(await req.arrayBuffer());
    if (audioBuffer.length === 0) {
      return NextResponse.json({ error: "No audio data received" }, { status: 400 });
    }
    fs.writeFileSync(tempAudioFile, audioBuffer);

    const scriptPath = path.join(process.cwd(), "server", "stt_adapter.py");
    const { stdout } = await execFileAsync("python", [scriptPath, "--input", tempAudioFile], {
      timeout: 30000, // model load (cached after first run) + a few seconds of inference
    });

    const parsed = JSON.parse(stdout.trim());
    return NextResponse.json({ text: parsed.text || "" });
  } catch (err) {
    const detail = err && typeof err === "object" && "stderr" in err ? (err as { stderr?: string }).stderr : err;
    console.error("[api/stt] Transcription failed:", detail);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  } finally {
    try { fs.unlinkSync(tempAudioFile); } catch {}
  }
}
