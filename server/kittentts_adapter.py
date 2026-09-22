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

# Real KittenTTS model + voices: https://github.com/KittenML/KittenTTS
KITTEN_MODEL_ID = "KittenML/kitten-tts-mini-0.8"
DEFAULT_VOICE = "Jasper"
KITTEN_VOICES = ["Bella", "Jasper", "Luna", "Bruno", "Rosie", "Hugo", "Kiki", "Leo"]

# ponytail: SAPI/Windows fallback has no Jasper/Luna/etc. voices, only whatever the OS ships.
# Map each preset onto a gender + pitch shift of an installed SAPI voice so presets are at
# least audibly distinct. Upgrade path: real per-voice timbre once synthesize_kittentts()
# can actually install (see the KittenTTS neural model path above).
KITTEN_VOICE_PROFILES = {
    "Bella": {"gender": "Female", "pitch": 2},
    "Jasper": {"gender": "Male", "pitch": 0},
    "Luna": {"gender": "Female", "pitch": -2},
    "Bruno": {"gender": "Male", "pitch": -4},
    "Rosie": {"gender": "Female", "pitch": 4},
    "Hugo": {"gender": "Male", "pitch": 3},
    "Kiki": {"gender": "Female", "pitch": 6},
    "Leo": {"gender": "Male", "pitch": -1},
}

_kitten_model = None

def _get_kitten_model():
    """Lazily loads and caches the KittenTTS model (first call downloads weights via huggingface_hub)."""
    global _kitten_model
    if _kitten_model is None:
        from kittentts import KittenTTS  # type: ignore
        _kitten_model = KittenTTS(KITTEN_MODEL_ID)
    return _kitten_model

def clean_speech_text(text: str) -> str:
    """Removes markdown symbols, URLs, and unwanted punctuation for clear vocalization."""
    cleaned = re.sub(r'[*#_`~>\[\]\(\)]', ' ', text)
    cleaned = re.sub(r'https?://\S+', '', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

def xml_escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def synthesize_windows_speech(text: str, voice: str = DEFAULT_VOICE, speed: float = 0.9, output_path: str = "output.wav") -> bool:
    """Synthesizes speech to WAV using Windows System.Speech.Synthesis, picking a voice/pitch
    per KITTEN_VOICE_PROFILES so the preset dropdown has an audible effect on this fallback."""
    try:
        clean_text = clean_speech_text(text)
        if not clean_text:
            return False
        safe_text = xml_escape(clean_text).replace("'", "''")

        # Map speed float (0.8 - 1.2) to SAPI Rate (-3 to +2)
        if speed <= 0.82:
            ps_rate = -2
        elif speed <= 0.92:
            ps_rate = -1
        elif speed <= 1.05:
            ps_rate = 0
        else:
            ps_rate = 1

        profile = KITTEN_VOICE_PROFILES.get(voice, {"gender": "Male", "pitch": 0})
        gender = profile["gender"]
        pitch_str = f"+{profile['pitch']}st" if profile["pitch"] >= 0 else f"{profile['pitch']}st"

        abs_out = os.path.abspath(output_path).replace("'", "''")

        ps_script = f"""
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = {ps_rate}

# Pick an installed voice matching this preset's gender; fall back to any enabled voice
$voices = $synth.GetInstalledVoices()
$picked = $voices | Where-Object {{ $_.Enabled -and $_.VoiceInfo.Gender -eq [System.Speech.Synthesis.VoiceGender]::{gender} }} | Select-Object -First 1
if (-not $picked) {{ $picked = $voices | Where-Object {{ $_.Enabled }} | Select-Object -First 1 }}
if ($picked) {{ $synth.SelectVoice($picked.VoiceInfo.Name) }}

$ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><prosody pitch="{pitch_str}">{safe_text}</prosody></speak>'
$synth.SetOutputToWaveFile('{abs_out}')
$synth.SpeakSsml($ssml)
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

def synthesize_kittentts(text: str, voice: str, speed: float, output_path: str) -> bool:
    """Synthesizes speech using the real KittenTTS neural model (kitten-tts-mini)."""
    try:
        clean_text = clean_speech_text(text)
        if not clean_text:
            return False

        model = _get_kitten_model()
        audio = model.generate(clean_text, voice=voice, speed=speed)

        try:
            import soundfile as sf
            sf.write(output_path, audio, 24000)
        except ImportError:
            # soundfile not installed: write PCM16 WAV via stdlib
            import wave
            import numpy as np
            pcm = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)
            with wave.open(output_path, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(24000)
                wf.writeframes(pcm.tobytes())

        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            print(f"[PastoralTTS] KittenTTS ({KITTEN_MODEL_ID}, voice={voice}) synthesized audio.")
            return True
        return False
    except Exception as e:
        print(f"[PastoralTTS] KittenTTS neural synthesis unavailable: {e}", file=sys.stderr)
        return False

def synthesize_speech(text: str, voice: str = DEFAULT_VOICE, speed: float = 0.9, output_path: str = "output.wav") -> str:
    """
    Synthesizes speech to WAV file.
    Tries KittenTTS neural model, then Windows Speech, then Platform TTS.
    Fails with non-zero exit code if unavailable, allowing client Web Speech API to speak.
    """
    # 1. Try the real KittenTTS neural model (kitten-tts-mini) if installed
    if synthesize_kittentts(text, voice, speed, output_path):
        return output_path

    # 2. Try Windows SpeechSynthesizer if on Windows
    if sys.platform == "win32":
        if synthesize_windows_speech(text, voice=voice, speed=speed, output_path=output_path):
            return output_path

    # 3. Try macOS 'say' command if on Darwin
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

    # 4. If no local voice engine could generate real speech, exit with error
    # This prevents playing dummy chimes and instructs Next.js /api/tts to fallback to browser speech synthesis
    print("[PastoralTTS] No local speech engine produced audio. Triggering browser speech fallback.", file=sys.stderr)
    sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pastoral Speech Synthesis Adapter")
    parser.add_argument("--text", type=str, default="The Lord bless you and keep you.", help="Text to speak")
    parser.add_argument("--voice", type=str, default=DEFAULT_VOICE, choices=KITTEN_VOICES, help="KittenTTS voice preset")
    parser.add_argument("--speed", type=float, default=0.9, help="Speech speed (0.8 - 1.2)")
    parser.add_argument("--output", type=str, default="output.wav", help="Output WAV path")
    args = parser.parse_args()

    synthesize_speech(args.text, args.voice, args.speed, args.output)
