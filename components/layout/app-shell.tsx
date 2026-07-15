import { Sidebar } from "@/components/layout/sidebar";

interface AppShellProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function AppShell({ title, children, action }: AppShellProps) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-6">
          <h1 className="text-base font-semibold">{title}</h1>
          {action ? <div className="ml-auto flex items-center gap-2">{action}</div> : null}
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
