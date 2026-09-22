import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice = "pastor_warm", speed = 0.9 } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // Try executing local KittenTTS Python adapter if python is available
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const tempAudioFile = path.join(dataDir, `tts_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.wav`);
    const scriptPath = path.join(process.cwd(), "server", "kittentts_adapter.py");

    try {
      await execFileAsync("python", [
        scriptPath,
        "--text",
        text.substring(0, 250), // keep sample concise for fast latency
        "--voice",
        voice,
        "--speed",
        String(speed),
        "--output",
        tempAudioFile,
      ], { timeout: 4000 });

      if (fs.existsSync(tempAudioFile)) {
        const audioBuffer = fs.readFileSync(tempAudioFile);
        // Clean up temporary file
        try { fs.unlinkSync(tempAudioFile); } catch {}

        return new NextResponse(audioBuffer, {
          status: 200,
          headers: {
            "Content-Type": "audio/wav",
            "Content-Length": audioBuffer.length.toString(),
            "X-TTS-Engine": "KittenTTS-Adapter",
          },
        });
      }
    } catch {
      // If Python fails or times out, fallback to browser speech synthesis
    }

    // Fallback response instructs the client to synthesize locally via Web Speech API
    return NextResponse.json({
      fallback: true,
      engine: "web-speech-api",
      text,
      voice,
      speed,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
