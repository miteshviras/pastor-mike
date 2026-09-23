#!/usr/bin/env python3
"""
Persistent Moonshine STT worker — loads the model once and serves transcription
requests over stdin/stdout as newline-delimited JSON, so app/api/stt/route.ts (via
lib/server/sttWorker.ts) doesn't pay a full model-reload cost (1-3+s) on every recorded
phrase the way the old spawn-per-request stt_adapter.py CLI path did.

Protocol (line-delimited JSON, flushed after every line so the parent can read as it goes):
  stdin  -> {"id": str, "input": <path>, "model"?: str}
  stdout -> {"id": str, "text": str, "engine": "moonshine", "model": str}
         or {"id": str, "error": str}
"""

import sys
import json

from stt_adapter import transcribe_file, DEFAULT_MODEL


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            result = transcribe_file(req["input"], req.get("model") or DEFAULT_MODEL)
            result["id"] = req_id
        except Exception as e:
            result = {"id": req_id, "error": str(e)}

        print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
