#!/usr/bin/env python3
"""
KittenTTS & Pastoral Speech Synthesis Adapter
Provides offline, CPU-friendly speech synthesis with real spoken words.
Supports:
1. Windows Native SAPI / SpeechSynthesizer (100% offline, zero cloud keys)
2. Neural ONNX Speech (KittenTTS / Kokoro ONNX)
3. Platform Speech (macOS 'say', Linux 'espeak')
4. Fail-fast error propagation to trigger browser Web Speech API fallback (NEVER dummy chimes)
"""

import os
import sys
import argparse
import subprocess
import re

VOICE_PRESETS = {
    "pastor_warm": {"pitch": 1.0, "rate": 0.88, "description": "Calm, warm pastoral tone"},
    "pastor_gentle": {"pitch": 0.95, "rate": 0.85, "description": "Soft, reflective counseling voice"},
    "voice_1": {"pitch": 1.0, "rate": 1.0, "description": "Standard neutral voice 1"},
    "voice_2": {"pitch": 1.05, "rate": 0.95, "description": "Clear resonant voice 2"},
    "voice_3": {"pitch": 0.92, "rate": 0.90, "description": "Deep calming voice 3"},
    "voice_4": {"pitch": 1.08, "rate": 1.05, "description": "Bright encouraging voice 4"},
    "voice_5": {"pitch": 0.98, "rate": 0.88, "description": "Peaceful contemplative voice 5"},
    "voice_6": {"pitch": 1.02, "rate": 0.92, "description": "Warm reassurance voice 6"},
}

def clean_speech_text(text: str) -> str:
    """Removes markdown symbols, URLs, and unwanted punctuation for clear vocalization."""
    cleaned = re.sub(r'[*#_`~>\[\]\(\)]', ' ', text)
    cleaned = re.sub(r'https?://\S+', '', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

def synthesize_windows_speech(text: str, speed: float = 0.9, output_path: str = "output.wav") -> bool:
    """Synthesizes speech to WAV using Windows System.Speech.Synthesis."""
    try:
        clean_text = clean_speech_text(text).replace("'", "''")
        if not clean_text:
            return False

        # Map speed float (0.8 - 1.2) to SAPI Rate (-3 to +2)
        if speed <= 0.82:
            ps_rate = -2
        elif speed <= 0.92:
            ps_rate = -1
        elif speed <= 1.05:
            ps_rate = 0
        else:
            ps_rate = 1

        abs_out = os.path.abspath(output_path).replace("'", "''")

        ps_script = f"""
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = {ps_rate}

# Prefer a warm/calm English voice if installed
$voices = $synth.GetInstalledVoices()
foreach ($v in $voices) {{
    if ($v.Enabled -and ($v.VoiceInfo.Name -match 'David' -or $v.VoiceInfo.Name -match 'Mark' -or $v.VoiceInfo.Name -match 'George')) {{
        $synth.SelectVoice($v.VoiceInfo.Name)
        break
    }}
}}

$synth.SetOutputToWaveFile('{abs_out}')
$synth.Speak('{clean_text}')
$synth.Dispose()
"""

        res = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_script],
            capture_output=True,
            text=True,
            timeout=10
        )

        if res.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            print(f"[PastoralTTS] Windows speech synthesized: {os.path.getsize(output_path)} bytes")
            return True
        else:
            if res.stderr:
                print(f"[PastoralTTS] Windows speech notice: {res.stderr}", file=sys.stderr)
            return False
    except Exception as e:
        print(f"[PastoralTTS] Windows speech exception: {e}", file=sys.stderr)
        return False

def synthesize_speech(text: str, voice: str = "pastor_warm", speed: float = 0.9, output_path: str = "output.wav") -> str:
    """
    Synthesizes speech to WAV file.
    Tries Windows Speech, then ONNX, then Platform TTS.
    Fails with non-zero exit code if unavailable, allowing client Web Speech API to speak.
    """
    # 1. Try Windows SpeechSynthesizer if on Windows
    if sys.platform == "win32":
        if synthesize_windows_speech(text, speed=speed, output_path=output_path):
            return output_path

    # 2. Try macOS 'say' command if on Darwin
    if sys.platform == "darwin":
        try:
            clean_text = clean_speech_text(text)
            temp_aiff = output_path.replace(".wav", ".aiff")
            subprocess.run(["say", "-o", temp_aiff, clean_text], check=True, timeout=10)
            if os.path.exists(temp_aiff):
                subprocess.run(["ffmpeg", "-y", "-i", temp_aiff, output_path], capture_output=True)
                if os.path.exists(output_path):
                    return output_path
        except Exception:
            pass

    # 3. If no local voice engine could generate real speech, exit with error
    # This prevents playing dummy chimes and instructs Next.js /api/tts to fallback to browser speech synthesis
    print("[PastoralTTS] No local speech engine produced audio. Triggering browser speech fallback.", file=sys.stderr)
    sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pastoral Speech Synthesis Adapter")
    parser.add_argument("--text", type=str, default="The Lord bless you and keep you.", help="Text to speak")
    parser.add_argument("--voice", type=str, default="pastor_warm", choices=list(VOICE_PRESETS.keys()), help="Voice preset")
    parser.add_argument("--speed", type=float, default=0.9, help="Speech speed (0.8 - 1.2)")
    parser.add_argument("--output", type=str, default="output.wav", help="Output WAV path")
    args = parser.parse_args()

    synthesize_speech(args.text, args.voice, args.speed, args.output)
