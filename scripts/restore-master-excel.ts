import { readFileSync } from "fs";
import { parseLabStatusExcel } from "../lib/analyzers/lab-status-excel";
import { setLabPortfolio } from "../lib/data/lab-portfolio";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: restore-master-excel.ts <xlsx>");
    process.exit(1);
  }
  const buf = readFileSync(file);
  const name = file.split("/").pop() ?? "master.xlsx";
  const portfolio = parseLabStatusExcel(buf, name);
  console.log("parsed", {
    total: portfolio.stats.totalCount,
    active: portfolio.stats.activeCount,
    repaid: portfolio.stats.repaidCount,
    withProgress: portfolio.funds.filter(
      (f) =>
        f.plannedProgressPct != null ||
        f.actualProgressPct != null ||
        Boolean(f.progressComment?.trim())
    ).length,
  });

  const saved = await setLabPortfolio(portfolio);
  const withP = saved.funds.filter(
    (f) =>
      f.plannedProgressPct != null ||
      f.actualProgressPct != null ||
      Boolean(f.progressComment?.trim())
  );
  console.log("saved", {
    total: saved.stats.totalCount,
    fileName: saved.fileName,
    withProgress: withP.length,
    progressLabs: withP.map((f) => ({
      name: f.name,
      planned: f.plannedProgressPct,
      actual: f.actualProgressPct,
      comment: (f.progressComment ?? "").slice(0, 40),
    })),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
