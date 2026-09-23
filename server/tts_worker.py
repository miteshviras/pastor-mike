#!/usr/bin/env python3
"""
Persistent KittenTTS worker — loads the model once and serves synthesis requests over
stdin/stdout as newline-delimited JSON, so app/api/tts/route.ts (via lib/server/ttsWorker.ts)
doesn't pay a full model-reload cost on every message the way the old spawn-per-request
kittentts_adapter.py CLI path did. Mirrors server/stt_worker.py's protocol/shape exactly.

Protocol (line-delimited JSON, flushed after every line so the parent can read as it goes):
  stdin  -> {"id": str, "text": str, "voice": str, "speed": float, "output": <path>}
  stdout -> {"id": str, "output": <path>, "engine": "kittentts"}
         or {"id": str, "error": str}
"""

import sys
import json

from kittentts_adapter import synthesize_file, DEFAULT_VOICE


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            result = synthesize_file(
                req["text"],
                req.get("voice") or DEFAULT_VOICE,
                req.get("speed") or 0.9,
                req["output"],
            )
            result["id"] = req_id
        except Exception as e:
            result = {"id": req_id, "error": str(e)}

        print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
