# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app

# Debian bookworm ships Python 3.11 as system python3, which satisfies KittenTTS's <3.13
# requirement for free. python-is-python3 provides the literal `python` symlink that
# app/api/tts/route.ts's execFile("python", ...) calls need — python3 alone does not.
# espeak-ng is a native binary dependency of `phonemizer` (pulled in by kittentts) — pip
# installing the Python wrapper isn't enough, the actual espeak-ng library has to be present.
# ffmpeg converts the browser's recorded audio (webm/opus from MediaRecorder) to the raw
# 16kHz PCM Moonshine expects. (moonshine-voice also depends on `sounddevice`, which needs
# libportaudio2 — but confirmed empirically that MoonshineSTTService's import path never
# actually imports sounddevice, so that's not needed here.)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python-is-python3 espeak-ng ffmpeg \
  && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch *before* requirements.txt. KittenTTS 0.8.1's misaki[en] dependency
# pulls in torch transitively (only for text tokenization/G2P — actual TTS inference stays on
# ONNX Runtime), and pip's default index ships the CUDA/GPU build unless told otherwise —
# confirmed empirically: that build drags in nvidia-cudnn/cublas/nccl/triton/etc., ~2GB+ of
# libraries this GPU-less container can never use. Installing the CPU wheel first satisfies
# misaki's loose `torch>=1.12.0` constraint, so pip never considers the GPU variant at all.
RUN pip install --break-system-packages --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple

COPY requirements.txt ./
# Debian 12 enforces PEP 668 (externally-managed-environment); --break-system-packages is
# the pragmatic choice here since this container has exactly one purpose.
RUN pip install --break-system-packages --no-cache-dir -r requirements.txt

ENV NODE_ENV=production
ENV PORT=3000

# Standalone output doesn't include public/ or .next/static by default (see Next.js docs) —
# both are copied in manually here so server.js serves them.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/server ./server

RUN mkdir -p /app/data /app/models/kittentts /root/.cache/huggingface /root/.cache/moonshine_voice

EXPOSE 3000
CMD ["node", "server.js"]
