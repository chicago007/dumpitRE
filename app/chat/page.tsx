import { AppShell } from "@/components/layout/app-shell";
import { ChatPanel } from "@/components/chat/chat-panel";

export default function ChatPage() {
  return (
    <AppShell title="Q&A">
      <div className="mx-auto max-w-3xl">
        <ChatPanel />
      </div>
    </AppShell>
  );
}
