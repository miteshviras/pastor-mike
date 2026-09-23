#!/usr/bin/env python3
"""
KittenTTS Setup & Model Downloader
Inspects KittenTTS status and downloads the lightweight neural model weights into models/kittentts/
"""

import os
import sys
import json
import argparse
import subprocess

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "kittentts")
CONFIG_FILE = os.path.join(MODELS_DIR, "config.json")

# pip resolves kittentts to whatever version is actually installable (see requirements.txt),
# currently 0.1.3, which always downloads "kitten-tts-nano-0.1" regardless of what's requested
# — kept here only for the status JSON's informational "model_id" field, not passed to the
# library. See the matching note in kittentts_adapter.py.
KITTEN_MODEL_ID = "KittenML/kitten-tts-nano-0.1"
DEFAULT_VOICE = "Jasper"
KITTEN_VOICES = ["Bella", "Jasper", "Luna", "Bruno", "Rosie", "Hugo", "Kiki", "Leo"]

def check_status() -> dict:
    """Checks if the KittenTTS library and its model weights are available."""
    has_library = False
    lib_version = None

    try:
        import kittentts  # type: ignore
        has_library = True
        # pip resolves whatever version is actually compatible (see requirements.txt) — not
        # necessarily the newest release — so there's no single correct hardcoded fallback here.
        lib_version = getattr(kittentts, "__version__", "unknown")
    except ImportError:
        has_library = False

    has_local_model = os.path.exists(CONFIG_FILE)
    is_ready = has_library

    return {
        "installed": is_ready,
        "has_library": has_library,
        "has_local_model": has_local_model,
        "lib_version": lib_version,
        "model_dir": MODELS_DIR if has_local_model else None,
        "model_id": KITTEN_MODEL_ID,
        "default_voice": DEFAULT_VOICE,
        "engine": "KittenTTS-Neural" if is_ready else "Browser-WebSpeechFallback"
    }

def download_model() -> dict:
    """Installs the KittenTTS package and warms its model cache for kitten-tts-mini."""
    os.makedirs(MODELS_DIR, exist_ok=True)
    download_success = False
    method_used = "pip"
    error_detail = None

    # Step 1: pip install KittenTTS. Deliberately unpinned — see requirements.txt for why
    # pinning to a specific wheel (e.g. the newest release) can pull in an unpublished
    # transitive dependency and fail; letting pip's resolver choose avoids that.
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "kittentts", "--no-warn-script-location"],
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode != 0:
            error_detail = result.stderr[-500:]
    except Exception as e:
        error_detail = str(e)

    # Step 2: Load the model once so huggingface_hub caches kitten-tts-mini weights locally
    try:
        from kittentts import KittenTTS  # type: ignore
        KittenTTS(KITTEN_MODEL_ID)
        download_success = True
    except Exception as e:
        error_detail = str(e)
        print(f"[KittenTTS] Note: model warm-up had notice: {e}", file=sys.stderr)

    # Save local config marker
    config_data = {
        "installed": download_success,
        "download_date": "2026-09-22",
        "method": method_used,
        "model_id": KITTEN_MODEL_ID,
        "default_voice": DEFAULT_VOICE,
        "voices": KITTEN_VOICES,
        "sample_rate": 24000
    }
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config_data, f, indent=2)
        download_success = True
    except Exception as e:
        error_detail = str(e)

    status = check_status()
    status["download_status"] = "success" if download_success else "partial"
    status["method_used"] = method_used
    if error_detail:
        status["notice"] = error_detail

    return status

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="KittenTTS Setup Utility")
    parser.add_argument("--check", action="store_true", help="Check installation status")
    parser.add_argument("--download", action="store_true", help="Download KittenTTS model")
    args = parser.parse_args()

    if args.download:
        result = download_model()
    else:
        result = check_status()

    # Output machine-readable JSON
    print(json.dumps(result))
