import { GoogleGenerativeAI } from "@google/generative-ai";

export const GEMINI_EMBEDDING_DIM = Number(process.env.GEMINI_EMBEDDING_DIMENSION ?? 1536);

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function getGeminiClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  return new GoogleGenerativeAI(key);
}

export function getChatModel() {
  return getGeminiClient().getGenerativeModel({
    model: process.env.GEMINI_CHAT_MODEL ?? "gemini-2.0-flash",
  });
}

export function getEmbeddingModel() {
  return getGeminiClient().getGenerativeModel({
    model: process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001",
  });
}
