import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

// GET /api/tts — Check KittenTTS installation and model status
export async function GET() {
  try {
    const setupScript = path.join(process.cwd(), "server", "setup_kittentts.py");
    const { stdout } = await execFileAsync("python", [setupScript, "--check"], { timeout: 6000 });
    const parsed = JSON.parse(stdout.trim());
    return NextResponse.json(parsed);
  } catch (err) {
    // If Python is missing or script errors, report fallback status
    return NextResponse.json({
      installed: false,
      has_library: false,
      has_local_model: false,
      lib_version: null,
      model_dir: null,
      engine: "Browser-WebSpeechFallback",
      notice: err instanceof Error ? err.message : "Python unavailable",
    });
  }
}

// POST /api/tts — Synthesize audio or trigger 1-click model download
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Download action handler
    if (body.action === "download") {
      try {
        const setupScript = path.join(process.cwd(), "server", "setup_kittentts.py");
        const { stdout } = await execFileAsync("python", [setupScript, "--download"], { timeout: 45000 });
        const parsed = JSON.parse(stdout.trim());
        return NextResponse.json(parsed);
      } catch (downloadErr) {
        return NextResponse.json(
          {
            installed: false,
            download_status: "error",
            error: downloadErr instanceof Error ? downloadErr.message : "Failed to download model",
          },
          { status: 500 }
        );
      }
    }

    // 2. TTS Speech Synthesis
    const { text, voice = "Jasper", speed = 0.9 } = body;

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
        text.substring(0, 800),
        "--voice",
        voice,
        "--speed",
        String(speed),
        "--output",
        tempAudioFile,
      ], { timeout: 45000 }); // KittenTTS synthesizes sentence-by-sentence (see kittentts_adapter.py);
      // a near-800-char response measured ~21s, so 15s was cutting real synthesis off mid-run.

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
    } catch (err) {
      // If Python fails or times out, fallback to browser speech synthesis — but log why,
      // since silently swallowing this made real synthesis failures indistinguishable from
      // "no local engine available" during earlier debugging.
      const detail = err && typeof err === "object" && "stderr" in err ? (err as { stderr?: string }).stderr : err;
      console.error("[api/tts] Python synthesis failed, falling back to browser TTS:", detail);
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
