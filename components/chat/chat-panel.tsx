"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import type { ChatMessage } from "@/lib/types";

const suggestions = ["지연 사업장 알려줘", "진행 중 사업장 몇 곳?", "호원동 공정율은?", "자금집행 현황"];

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "사업장 현황, 공정율, 자금집행에 대해 질문해 주세요.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text.trim() }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.content,
          citations: data.citations,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: "오류가 발생했습니다. 다시 시도해 주세요." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-lg border border-border bg-card">
      <div className="flex gap-2 border-b border-border px-4 py-3">
        <Pill active>전체</Pill>
        <Pill>사업장별</Pill>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-lg bg-accent px-4 py-2.5 text-sm text-white"
                  : "max-w-[85%] rounded-lg bg-neutral-100 px-4 py-2.5 text-sm whitespace-pre-wrap"
              }
            >
              {m.content}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-2 space-y-0.5 border-t border-neutral-200 pt-2 text-xs text-muted">
                  {m.citations.map((c) => (
                    <p key={c}>↳ {c}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <p className="text-sm text-muted">답변 생성 중…</p>}
      </div>

      <div className="border-t border-border p-4">
        <div className="mb-2 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void send(s)}
              className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-muted hover:bg-neutral-200"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="사업장에 대해 질문하세요…"
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <Button type="submit" disabled={loading}>
            전송
          </Button>
        </form>
      </div>
    </div>
  );
}
