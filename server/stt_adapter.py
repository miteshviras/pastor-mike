#!/usr/bin/env python3
"""
Moonshine Speech-to-Text Adapter
Transcribes a recorded audio file (any format ffmpeg can read — the browser MediaRecorder
default of webm/opus is the realistic input) using pipecat-ai's MoonshineSTTService, called
directly via its low-level run_stt() rather than the full Pipecat pipeline/transport
machinery, which this app has no use for (mirrors kittentts_adapter.py's subprocess pattern).
"""

import sys
import json
import argparse
import asyncio
import subprocess

MOONSHINE_SAMPLE_RATE = 16000


def convert_to_pcm16(input_path: str) -> bytes:
    """Converts any ffmpeg-readable audio file to raw 16-bit signed mono PCM at 16kHz —
    the exact format MoonshineSTTService.run_stt() expects."""
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


def _get_stt_service():
    global _stt_service
    if _stt_service is None:
        from pipecat.services.moonshine.stt import MoonshineSTTService
        _stt_service = MoonshineSTTService()
    return _stt_service


async def transcribe(pcm16: bytes) -> str:
    stt = _get_stt_service()
    text_parts = []
    async for frame in stt.run_stt(pcm16):
        text = getattr(frame, "text", None)
        if text:
            text_parts.append(text)
    return " ".join(text_parts).strip()


def main():
    parser = argparse.ArgumentParser(description="Moonshine STT adapter")
    parser.add_argument("--input", required=True, help="Path to the recorded audio file")
    args = parser.parse_args()

    try:
        pcm16 = convert_to_pcm16(args.input)
        text = asyncio.run(transcribe(pcm16))
        print(json.dumps({"text": text}))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
