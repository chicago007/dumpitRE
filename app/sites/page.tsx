"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SiteCard } from "@/components/sites/site-card";
import { Pill } from "@/components/ui/pill";
import type { Site } from "@/lib/types";

const filters = [
  { id: "all", label: "전체" },
  { id: "in_progress", label: "진행중" },
  { id: "planned", label: "예정" },
  { id: "completed", label: "완료" },
];

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/sites")
      .then((r) => r.json())
      .then(setSites)
      .catch(console.error);
  }, []);

  const filtered =
    filter === "all" ? sites : sites.filter((s) => s.status === filter);

  const delayedOnly = filter === "delayed";
  const display = delayedOnly
    ? sites.filter(
        (s) =>
          s.status === "in_progress" &&
          s.latestProgressPct != null &&
          s.plannedProgressPct != null &&
          s.latestProgressPct < s.plannedProgressPct - 5
      )
    : filtered;

  return (
    <AppShell title="사업장">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <Pill key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </Pill>
          ))}
          <Pill active={filter === "delayed"} onClick={() => setFilter("delayed")}>
            지연
          </Pill>
          <span className="ml-auto text-sm text-muted">
            {display.length} / {sites.length} 사업장
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {display.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
