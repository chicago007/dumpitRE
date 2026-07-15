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

/** 채팅/제안서 추출용. 404면 .env.local 의 GEMINI_CHAT_MODEL 변경 */
export function getChatModelName(): string {
  const raw = (process.env.GEMINI_CHAT_MODEL ?? "gemini-flash-latest").trim();
  // 일부 키에서 더 이상 안 열리는 구 모델 → latest 별칭으로
  if (raw === "gemini-2.0-flash" || raw === "gemini-2.0-flash-001") {
    return "gemini-flash-latest";
  }
  return raw || "gemini-flash-latest";
}

export function getChatModel() {
  return getGeminiClient().getGenerativeModel({
    model: getChatModelName(),
  });
}

export function getEmbeddingModel() {
  return getGeminiClient().getGenerativeModel({
    model: process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001",
  });
}
