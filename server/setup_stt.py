#!/usr/bin/env python3
"""
Moonshine Speech-to-Text Setup & Model Downloader
Checks Moonshine STT installation, ffmpeg availability, and warms/pre-downloads
the Moonshine ONNX model weights into ~/.cache/moonshine_voice/
"""

import os
import sys
import json
import shutil
import argparse
from pathlib import Path

DEFAULT_MODEL = os.environ.get("MOONSHINE_MODEL", "small-streaming")


def get_cache_dir() -> Path:
    """Returns the moonshine model cache directory."""
    return Path(os.path.expanduser("~/.cache/moonshine_voice"))


def check_local_model() -> tuple[bool, str | None]:
    """Checks if any Moonshine ONNX model weights exist in the local cache."""
    cache_dir = get_cache_dir()
    if not cache_dir.exists():
        return False, None

    # Look for any .ort files inside the cache
    ort_files = list(cache_dir.glob("**/*.ort"))
    if ort_files:
        return True, str(ort_files[0].parent)
    return False, None


def check_status() -> dict:
    """Checks if the Pipecat Moonshine service, ffmpeg, and model weights are available."""
    has_library = False
    lib_version = None

    try:
        import pipecat  # type: ignore
        from pipecat.services.moonshine.stt import MoonshineSTTService  # type: ignore
        has_library = True
        lib_version = getattr(pipecat, "__version__", "unknown")
    except ImportError:
        has_library = False

    has_ffmpeg = shutil.which("ffmpeg") is not None
    has_local_model, model_dir = check_local_model()

    is_ready = has_library and has_ffmpeg

    return {
        "installed": is_ready,
        "has_library": has_library,
        "has_ffmpeg": has_ffmpeg,
        "has_local_model": has_local_model,
        "lib_version": lib_version,
        "model": DEFAULT_MODEL,
        "model_dir": model_dir,
        "engine": "Moonshine-STT" if is_ready else "Browser-WebSpeechFallback",
    }


def download_model(model_name: str = DEFAULT_MODEL) -> dict:
    """Initializes MoonshineSTTService once to trigger automatic downloading and caching of model weights."""
    error_detail = None
    download_success = False

    try:
        from pipecat.services.moonshine.stt import MoonshineSTTService  # type: ignore
        # Instantiating the service automatically downloads weights if not already cached
        stt = MoonshineSTTService(
            settings=MoonshineSTTService.Settings(model=model_name)
        )
        download_success = True
    except Exception as e:
        error_detail = str(e)
        print(f"[MoonshineSTT] Error during model download: {e}", file=sys.stderr)

    status = check_status()
    status["download_status"] = "success" if download_success else "error"
    if error_detail:
        status["error"] = error_detail

    return status


def main():
    parser = argparse.ArgumentParser(description="Moonshine STT Setup Utility")
    parser.add_argument("--check", action="store_true", help="Check installation and model status")
    parser.add_argument("--download", action="store_true", help="Download / pre-warm Moonshine model")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Model architecture (e.g. small-streaming, base, tiny)")
    args = parser.parse_args()

    if args.download:
        result = download_model(args.model)
    else:
        result = check_status()

    print(json.dumps(result))


if __name__ == "__main__":
    main()
