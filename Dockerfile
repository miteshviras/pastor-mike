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

RUN mkdir -p /app/data /app/models/kittentts

EXPOSE 3000
CMD ["node", "server.js"]
