#!/usr/bin/env python3
"""
Moonshine Speech-to-Text Adapter
Transcribes a recorded audio file (any format ffmpeg can read — the browser MediaRecorder
default of webm/opus is the realistic input) using pipecat-ai's MoonshineSTTService, called
directly via its low-level run_stt() rather than the full Pipecat pipeline/transport
machinery, which this app has no use for (mirrors kittentts_adapter.py's subprocess pattern).
"""

import os
import sys
import json
import argparse
import asyncio
import subprocess

MOONSHINE_SAMPLE_RATE = 16000
DEFAULT_MODEL = os.environ.get("MOONSHINE_MODEL", "small-streaming")


def convert_to_pcm16(input_path: str) -> bytes:
    """Converts any ffmpeg-readable audio file to raw 16-bit signed mono PCM at 16kHz —
    the exact format MoonshineSTTService.run_stt() expects."""
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Audio file not found: {input_path}")

    result = subprocess.run(
        [
            "ffmpeg", "-y", "-i", input_path,
            "-f", "s16le", "-acodec", "pcm_s16le",
            "-ac", "1", "-ar", str(MOONSHINE_SAMPLE_RATE),
            "-loglevel", "error",
            "-",
        ],
        capture_output=True,
        timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg conversion failed: {result.stderr.decode(errors='replace')[-500:]}")
    return result.stdout


_stt_service = None
_cached_model = None


def _get_stt_service(model_name: str = DEFAULT_MODEL):
    global _stt_service, _cached_model
    if _stt_service is None or _cached_model != model_name:
        from pipecat.services.moonshine.stt import MoonshineSTTService
        _stt_service = MoonshineSTTService(
            settings=MoonshineSTTService.Settings(model=model_name)
        )
        _cached_model = model_name
    return _stt_service


async def transcribe(pcm16: bytes, model_name: str = DEFAULT_MODEL) -> str:
    stt = _get_stt_service(model_name)
    text_parts = []
    async for frame in stt.run_stt(pcm16):
        text = getattr(frame, "text", None)
        if text:
            text_parts.append(text)
    return " ".join(text_parts).strip()


def main():
    parser = argparse.ArgumentParser(description="Moonshine STT adapter")
    parser.add_argument("--input", required=True, help="Path to the recorded audio file")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Model architecture (e.g. small-streaming, base, tiny)")
    args = parser.parse_args()

    try:
        pcm16 = convert_to_pcm16(args.input)
        text = asyncio.run(transcribe(pcm16, args.model))
        print(json.dumps({
            "text": text,
            "engine": "moonshine",
            "model": args.model
        }))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
