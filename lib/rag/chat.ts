import { answerQuestion } from "@/lib/data/seed";
import { isSupabaseServerConfigured } from "@/lib/supabase/admin";
import {
  sbGetOrCreateSession,
  sbMatchChunks,
  sbQuerySitesStructured,
  sbSaveChatMessage,
} from "@/lib/data/supabase-repository";
import { embedQuery, isEmbeddingConfigured } from "@/lib/rag/embed";
import { getChatModel, isGeminiConfigured } from "@/lib/rag/gemini";

export interface ChatResponse {
  content: string;
  citations: string[];
  mode: "rag" | "sql" | "fallback";
}

async function generateLlmAnswer(
  question: string,
  context: string,
  structuredHint?: string
): Promise<string> {
  const system = `당신은 부동산 사업장 관리 시스템 Dumpit RE의 AI 어시스턴트입니다.
제공된 컨텍스트와 DB 조회 결과만 근거로 한국어로 답변하세요.
모르는 내용은 "문서에 명시되지 않았습니다"라고 말하세요. 수치는 정확히 인용하세요.`;

  const userContent = [
    structuredHint ? `## DB 조회\n${structuredHint}` : "",
    context ? `## 문서 컨텍스트\n${context}` : "",
    `## 질문\n${question}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const model = getChatModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    systemInstruction: system,
    generationConfig: { temperature: 0.2 },
  });

  const text = result.response.text();
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

function formatStructuredRows(rows: unknown[]): string {
  return JSON.stringify(rows, null, 2);
}

export async function runChat(
  question: string,
  options?: { siteId?: string | null; sessionId?: string | null }
): Promise<ChatResponse> {
  const citations: string[] = [];
  let structuredHint = "";
  let docContext = "";

  if (isSupabaseServerConfigured()) {
    const structured = await sbQuerySitesStructured(question);
    if (structured) {
      structuredHint = formatStructuredRows(structured.rows);
      citations.push(structured.sql);
    }

    if (isEmbeddingConfigured()) {
      try {
        const embedding = await embedQuery(question);
        const chunks = await sbMatchChunks(embedding, options?.siteId);
        if (chunks?.length) {
          docContext = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");
          citations.push(...chunks.map((c) => `document_chunk · sim ${c.similarity.toFixed(2)}`));
        }
      } catch {
        // embedding/search optional
      }
    }
  }

  if (isGeminiConfigured() && (structuredHint || docContext)) {
    const content = await generateLlmAnswer(question, docContext, structuredHint);
    if (options?.sessionId) {
      await sbSaveChatMessage(options.sessionId, "user", question);
      await sbSaveChatMessage(options.sessionId, "assistant", content, citations);
    }
    return { content, citations, mode: docContext ? "rag" : "sql" };
  }

  const fallback = answerQuestion(question);
  return { content: fallback.content, citations: fallback.citations, mode: "fallback" };
}

export async function createChatSession(siteId?: string | null): Promise<string | null> {
  if (!isSupabaseServerConfigured()) return null;
  return sbGetOrCreateSession(siteId);
}
