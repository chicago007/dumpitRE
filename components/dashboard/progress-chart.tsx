"use client";

import type { PortfolioProgressPoint } from "@/lib/types";

interface ProgressChartProps {
  data: PortfolioProgressPoint[];
}

export function ProgressChart({ data }: ProgressChartProps) {
  const max = 100;
  const w = 560;
  const h = 180;
  const pad = { top: 16, right: 16, bottom: 28, left: 36 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  const x = (i: number) => pad.left + (i / Math.max(1, data.length - 1)) * innerW;
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  const plannedPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.planned)}`).join(" ");
  const actualPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.actual)}`).join(" ");

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">월별 공정율 추이</h3>
        <div className="flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-neutral-400" /> 계획
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-accent" /> 실적
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="월별 공정율 추이">
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={w - pad.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#e5e5e5"
              strokeWidth={1}
            />
            <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" fontSize={10} fill="#737373">
              {tick}
            </text>
          </g>
        ))}
        <path d={plannedPath} fill="none" stroke="#a3a3a3" strokeWidth={2} />
        <path d={actualPath} fill="none" stroke="#2563eb" strokeWidth={2} />
        {data.map((d, i) => (
          <text
            key={d.month}
            x={x(i)}
            y={h - 8}
            textAnchor="middle"
            fontSize={10}
            fill="#737373"
          >
            {d.month.slice(5)}월
          </text>
        ))}
      </svg>
      <p className="mt-2 text-xs text-muted">Source: progress_reports · 2026년 1–7월 · 포트폴리오 평균 (%)</p>
    </div>
  );
}
