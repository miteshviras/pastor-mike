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
DEFAULT_VOICE = "Jasper"
KITTEN_VOICES = ["Bella", "Jasper", "Luna", "Bruno", "Rosie", "Hugo", "Kiki", "Leo"]

# ponytail: SAPI/Windows fallback has no Jasper/Luna/etc. voices, only whatever the OS ships
# (typically exactly one male + one female voice — "Microsoft David"/"Microsoft Zira" on
# stock Windows). Map each preset onto a gender + pitch shift of that installed voice so
# presets are at least audibly distinct. Measured empirically: SAPI's SSML prosody pitch is
# NOT 1:1 with real semitones (a requested 20st swing only produced ~11 semitones of actual
# shift), so the spread here is wider than "20 real semitones" would need, to stay clearly
# audible between adjacent presets of the same gender.
KITTEN_VOICE_PROFILES = {
    "Bella": {"gender": "Female", "pitch": 0},
    "Jasper": {"gender": "Male", "pitch": 0},
    "Luna": {"gender": "Female", "pitch": -8},
    "Bruno": {"gender": "Male", "pitch": -9},
    "Rosie": {"gender": "Female", "pitch": 6},
    "Hugo": {"gender": "Male", "pitch": 7},
    "Kiki": {"gender": "Female", "pitch": 10},
    "Leo": {"gender": "Male", "pitch": -4},
}

# pip resolves kittentts to whatever version is actually installable (see requirements.txt —
# newer releases depend on an unpublished `misaki` version), which lands on 0.1.3, a much
# older/simpler release than the "mini-0.8" model + Bella/Jasper-named voices this file was
# originally written against. That version's real API takes no model ID (it always downloads
# the "kitten-tts-nano-0.1" model) and only knows 8 voices named "expr-voice-{2,3,4,5}-{m,f}"
# — conveniently also 4 male + 4 female, so each branded preset still maps onto a genuinely
# distinct neural voice, just under a different real name.
KITTEN_NEURAL_VOICE_MAP = {
    "Jasper": "expr-voice-2-m",
    "Bruno": "expr-voice-3-m",
    "Hugo": "expr-voice-4-m",
    "Leo": "expr-voice-5-m",
    "Bella": "expr-voice-2-f",
    "Luna": "expr-voice-3-f",
    "Rosie": "expr-voice-4-f",
    "Kiki": "expr-voice-5-f",
}

_kitten_model = None

def _get_kitten_model():
    """Lazily loads and caches the KittenTTS model (first call downloads weights via huggingface_hub)."""
    global _kitten_model
    if _kitten_model is None:
        from kittentts import KittenTTS  # type: ignore
        _kitten_model = KittenTTS()
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
    """Synthesizes speech using the real KittenTTS neural model (kitten-tts-nano).

    Chunks the text into sentences and synthesizes + concatenates each separately, rather
    than passing the whole text to model.generate() in one call. Empirically confirmed: the
    nano model's ONNX graph throws "invalid expand shape" (ONNXRuntimeError) on longer
    multi-sentence/paragraph text (e.g. a real ~900-char pastoral response) even though any
    single sentence from that same text synthesizes fine on its own — this looks like a fixed
    max input length in the exported graph, not a text-content issue.
    """
    try:
        clean_text = clean_speech_text(text)
        if not clean_text:
            return False

        import numpy as np

        model = _get_kitten_model()
        neural_voice = KITTEN_NEURAL_VOICE_MAP.get(voice, "expr-voice-2-m")

        sentences = [s for s in re.split(r'(?<=[.!?])\s+', clean_text) if s.strip()]
        if not sentences:
            sentences = [clean_text]

        silence = np.zeros(int(0.15 * 24000), dtype=np.float32)  # brief pause between sentences
        chunks = []
        for sentence in sentences:
            chunk = np.asarray(model.generate(sentence, voice=neural_voice, speed=speed)).reshape(-1)
            chunks.append(chunk)
            chunks.append(silence)
        audio = np.concatenate(chunks[:-1])

        try:
            import soundfile as sf
            sf.write(output_path, audio, 24000)
        except ImportError:
            # soundfile not installed: write PCM16 WAV via stdlib
            import wave
            pcm = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)
            with wave.open(output_path, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(24000)
                wf.writeframes(pcm.tobytes())

        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            print(f"[PastoralTTS] KittenTTS (voice={voice} -> {neural_voice}, {len(sentences)} sentence(s)) synthesized audio.")
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
    # 1. Try the real KittenTTS neural model if installed
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
