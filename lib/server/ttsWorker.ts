// Manages one persistent Python TTS worker process (server/tts_worker.py) instead of
// spawning a fresh `python kittentts_adapter.py` process per message, which was reloading
// the KittenTTS model from disk on every single request. Mirrors lib/server/sttWorker.ts's
// singleton/protocol shape exactly — see that file for the dev-hot-reload rationale.

import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import readline from "node:readline";

interface PendingRequest {
  resolve: (value: { output: string; engine: string }) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

interface WorkerState {
  proc: ChildProcessWithoutNullStreams;
  pending: Map<string, PendingRequest>;
}

const g = globalThis as unknown as { __ttsWorker?: WorkerState };

function spawnWorker(): WorkerState {
  const scriptPath = path.join(process.cwd(), "server", "tts_worker.py");
  const proc = spawn("python", [scriptPath], { cwd: process.cwd() });
  const pending = new Map<string, PendingRequest>();

  readline.createInterface({ input: proc.stdout }).on("line", (line) => {
    let msg: { id?: string; output?: string; engine?: string; error?: string };
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (!msg.id) return;
    const req = pending.get(msg.id);
    if (!req) return;
    pending.delete(msg.id);
    clearTimeout(req.timer);
    if (msg.error) {
      req.reject(new Error(msg.error));
    } else {
      req.resolve({ output: msg.output || "", engine: msg.engine || "kittentts" });
    }
  });

  const onDown = () => {
    if (g.__ttsWorker?.proc === proc) g.__ttsWorker = undefined;
    for (const req of pending.values()) {
      clearTimeout(req.timer);
      req.reject(new Error("TTS worker exited"));
    }
    pending.clear();
  };
  proc.on("exit", onDown);
  proc.on("error", onDown);

  return { proc, pending };
}

function getWorker(): WorkerState {
  if (g.__ttsWorker && !g.__ttsWorker.proc.killed) return g.__ttsWorker;
  g.__ttsWorker = spawnWorker();
  return g.__ttsWorker;
}

export function synthesizeViaWorker(
  text: string,
  voice: string,
  speed: number,
  outputPath: string,
  timeoutMs = 45000
): Promise<{ output: string; engine: string }> {
  const worker = getWorker();
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.pending.delete(id);
      reject(new Error("TTS worker timed out"));
    }, timeoutMs);

    worker.pending.set(id, { resolve, reject, timer });
    worker.proc.stdin.write(JSON.stringify({ id, text, voice, speed, output: outputPath }) + "\n");
  });
}
