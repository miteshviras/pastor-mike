// Manages one persistent Python STT worker process (server/stt_worker.py) instead of
// spawning a fresh `python stt_adapter.py` process per phrase, which was reloading the
// Moonshine model from disk on every single request. The singleton lives on globalThis so
// it survives Next.js dev-mode module hot-reloads; in the production/Docker path this app
// actually runs STT through, it simply lives for the server process's lifetime.

import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import readline from "node:readline";

interface PendingRequest {
  resolve: (value: { text: string; engine: string; model?: string }) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

interface WorkerState {
  proc: ChildProcessWithoutNullStreams;
  pending: Map<string, PendingRequest>;
}

const g = globalThis as unknown as { __sttWorker?: WorkerState };

function spawnWorker(): WorkerState {
  const scriptPath = path.join(process.cwd(), "server", "stt_worker.py");
  const proc = spawn("python", [scriptPath], { cwd: process.cwd() });
  const pending = new Map<string, PendingRequest>();

  readline.createInterface({ input: proc.stdout }).on("line", (line) => {
    let msg: { id?: string; text?: string; engine?: string; model?: string; error?: string };
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
      req.resolve({ text: msg.text || "", engine: msg.engine || "moonshine", model: msg.model });
    }
  });

  const onDown = () => {
    if (g.__sttWorker?.proc === proc) g.__sttWorker = undefined;
    for (const req of pending.values()) {
      clearTimeout(req.timer);
      req.reject(new Error("STT worker exited"));
    }
    pending.clear();
  };
  proc.on("exit", onDown);
  proc.on("error", onDown);

  return { proc, pending };
}

function getWorker(): WorkerState {
  if (g.__sttWorker && !g.__sttWorker.proc.killed) return g.__sttWorker;
  g.__sttWorker = spawnWorker();
  return g.__sttWorker;
}

export function transcribeViaWorker(
  inputPath: string,
  model?: string,
  timeoutMs = 45000
): Promise<{ text: string; engine: string; model?: string }> {
  const worker = getWorker();
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.pending.delete(id);
      reject(new Error("STT worker timed out"));
    }, timeoutMs);

    worker.pending.set(id, { resolve, reject, timer });
    worker.proc.stdin.write(JSON.stringify({ id, input: inputPath, model }) + "\n");
  });
}
