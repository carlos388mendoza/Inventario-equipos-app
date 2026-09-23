import "server-only";

import { createOpenAI } from "@ai-sdk/openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Crea el modelo de lenguaje vía OpenRouter usando el AI SDK.
 * Lee OPENROUTER_API_KEY únicamente del lado del servidor; si no existe,
 * devuelve null (la app sigue funcionando, las funciones de IA se deshabilitan).
 */
export function getOpenRouterModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const provider = createOpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
  });
  const modelId = process.env.AI_MODEL?.trim() || "openai/gpt-4o-mini";
  return provider(modelId);
}