import fs from "fs";
import path from "path";
import { parseLabStatusExcel } from "@/lib/analyzers/lab-status-excel";
import type { LabPortfolioSnapshot } from "@/lib/types";

let snapshot: LabPortfolioSnapshot | null = null;
let seeded = false;

function trySeedFromSample() {
  if (seeded || snapshot) return;
  seeded = true;
  try {
    const samplePath = path.join(process.cwd(), "samples", "부동산랩현황.xlsx");
    if (!fs.existsSync(samplePath)) return;
    const buffer = fs.readFileSync(samplePath);
    snapshot = parseLabStatusExcel(buffer, "부동산랩현황.xlsx");
  } catch (err) {
    console.warn("[lab-portfolio] sample seed failed:", err);
  }
}

export function getLabPortfolio(): LabPortfolioSnapshot | null {
  trySeedFromSample();
  return snapshot;
}

export function setLabPortfolio(next: LabPortfolioSnapshot): LabPortfolioSnapshot {
  snapshot = next;
  return snapshot;
}
