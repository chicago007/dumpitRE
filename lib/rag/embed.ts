import { isGeminiConfigured } from "@/lib/rag/gemini";

export const GEMINI_EMBEDDING_DIM = Number(process.env.GEMINI_EMBEDDING_DIMENSION ?? 1536);

export function isEmbeddingConfigured(): boolean {
  return isGeminiConfigured();
}

function embeddingModelName(): string {
  const raw = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
  return raw.startsWith("models/") ? raw : `models/${raw}`;
}

async function embedOne(text: string, taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");

  const model = embeddingModelName();
  const url = `https://generativelanguage.googleapis.com/v1beta/${model}:embedContent?key=${key}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: GEMINI_EMBEDDING_DIM,
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini embedding error: ${await res.text()}`);
  }

  const json = await res.json();
  const values = json.embedding?.values as number[] | undefined;
  if (!values?.length) throw new Error("Empty embedding from Gemini");
  return values;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  for (const text of texts) {
    vectors.push(await embedOne(text, "RETRIEVAL_DOCUMENT"));
  }
  return vectors;
}

export async function embedQuery(text: string): Promise<number[]> {
  return embedOne(text, "RETRIEVAL_QUERY");
}

export { GEMINI_EMBEDDING_DIM as EMBEDDING_DIM };
