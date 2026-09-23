/**
 * Google Gemini Models Service
 * Lists available models for text/conversational generation and provides curated fallbacks.
 */

export const FALLBACK_GEMINI_MODELS: string[] = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-pro-latest",
  "gemini-flash-lite-latest",
  "gemini-2.0-flash",
  "gemma-4-26b-a4b-it",
  "gemma-4-31b-it",
];

// Patterns to exclude non-chat/non-conversational models
const EXCLUDED_PATTERNS = [
  "embedding",
  "image",
  "tts",
  "transcribe",
  "veo",
  "lyria",
  "robotics",
  "banana",
  "computer-use",
  "deep-research",
  "aqa",
];

let cachedModels: string[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Returns all available Gemini models suitable for conversational generation.
 * If an API key is set, queries the Gemini API; otherwise returns the fallback list.
 */
export async function listAvailableGeminiModels(): Promise<string[]> {
  const now = Date.now();
  if (cachedModels && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedModels;
  }

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY;

  if (!apiKey) {
    return FALLBACK_GEMINI_MODELS;
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const modelsIterable = await ai.models.list();

    const candidateModels: string[] = [];

    for await (const m of modelsIterable) {
      if (!m.name) continue;
      const cleanName = m.name.replace(/^models\//, "");

      // Check if it supports content generation
      const actions = (m as { supportedActions?: string[]; supportedGenerationMethods?: string[] }).supportedActions ||
        (m as { supportedActions?: string[]; supportedGenerationMethods?: string[] }).supportedGenerationMethods ||
        [];

      if (actions.length > 0 && !actions.includes("generateContent")) {
        continue;
      }

      // Filter out non-conversational/specialized modalities (audio, vision generation, embeddings)
      const lower = cleanName.toLowerCase();
      if (EXCLUDED_PATTERNS.some((p) => lower.includes(p))) {
        continue;
      }

      candidateModels.push(cleanName);
    }

    if (candidateModels.length === 0) {
      return FALLBACK_GEMINI_MODELS;
    }

    // Sort models: put established flagships and popular prefixes first, followed by others alphabetically
    const preferredOrder = [
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-3.7-flash",
      "gemini-3.8-flash",
      "gemini-3-flash-preview",
      "gemini-3.1-pro-preview",
      "gemini-3.1-flash-lite-preview",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.5-flash-lite",
      "gemini-flash-latest",
      "gemini-pro-latest",
      "gemini-flash-lite-latest",
      "gemini-2.0-flash",
      "gemma-4-26b-a4b-it",
      "gemma-4-31b-it",
    ];

    const sorted = Array.from(new Set([
      ...preferredOrder.filter((m) => candidateModels.includes(m)),
      ...candidateModels.sort((a, b) => a.localeCompare(b)),
    ]));

    cachedModels = sorted;
    lastCacheTime = now;
    return sorted;
  } catch (err) {
    console.warn("Could not fetch remote Gemini models list, using fallbacks:", err);
    return FALLBACK_GEMINI_MODELS;
  }
}
