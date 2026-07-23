/**
 * 공정확인서 재추출 → lab_progress 반영
 * 사용: npx tsx scripts/reprocess-process-confirms.mts
 */
import fs from "fs";
import path from "path";
import { extractPdfText } from "../lib/analyzers/pdf-extract";
import { parseGisungReport } from "../lib/analyzers/gisung-progress";
import {
  extractProcessConfirmFromPdf,
  injectProcessConfirmExtract,
  looksLikeScannedProcessConfirm,
} from "../lib/analyzers/process-confirm-extract";
import { bindLabProgressToFund } from "../lib/data/lab-progress";
import { labProgressRowId } from "../lib/data/supabase-lab-progress";
import type { LabProgressRow } from "../lib/types";

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

const JOBS: { file: string; labFundId: string; labName: string }[] = [
  {
    file: "1784767746814_71호 등촌동 공정확인서_26.06.pdf",
    labFundId: "lab-100001145",
    labName: "부동산랩 50호",
  },
  {
    file: "1784767748676_73호 번동 공정확인서_26.06.pdf",
    labFundId: "lab-100001160",
    labName: "부동산랩 52호",
  },
  {
    file: "1784767749577_74호 안양동 공정확인서_26.06.pdf",
    labFundId: "lab-100001169",
    labName: "부동산랩 54호",
  },
  {
    file: "1784767750511_76호 자양동 공정확인서_26.06.pdf",
    labFundId: "lab-100001173",
    labName: "부동산랩 55호",
  },
  {
    file: "1784767751716_82호 병점동 공정확인서_26.06.pdf",
    labFundId: "lab-100001212",
    labName: "부동산랩 59호",
  },
];

async function main() {
  loadEnv();
  for (const job of JOBS) {
    const p = path.join(process.cwd(), "uploads", job.file);
    if (!fs.existsSync(p)) {
      console.log("MISSING", job.file);
      continue;
    }
    const buffer = fs.readFileSync(p);
    const fileName = job.file.replace(/^\d+_/, "");
    let pdfText = await extractPdfText(buffer);
    let preview = parseGisungReport(pdfText, fileName);

    const needsVision =
      looksLikeScannedProcessConfirm(fileName, pdfText) ||
      (preview.plannedProgressPct == null && preview.actualProgressPct == null);

    if (needsVision) {
      const confirm = await extractProcessConfirmFromPdf(buffer, fileName);
      console.log("GEMINI", fileName, confirm);
      pdfText = injectProcessConfirmExtract(pdfText, confirm);
      preview = parseGisungReport(pdfText, fileName);
    }

    console.log("PARSED", fileName, {
      date: preview.reportDate,
      planned: preview.plannedProgressPct,
      actual: preview.actualProgressPct,
      ach: preview.achievementPct,
    });

    const row: LabProgressRow = {
      id: labProgressRowId(job.labFundId, job.labName, preview.reportDate),
      labFundId: job.labFundId,
      labName: job.labName,
      fundName: null,
      siteAddress: preview.siteAddress,
      plannedProgressPct: preview.plannedProgressPct,
      actualProgressPct: preview.actualProgressPct,
      achievementPct: preview.achievementPct,
      delayDays: preview.delayDays,
      confirmedDate: preview.reportDate,
      specialNotes: preview.specialNotesSummary,
      sourceFileName: fileName,
      documentId: null,
      updatedAt: new Date().toISOString(),
    };

    const result = await bindLabProgressToFund({
      row,
      labFundId: job.labFundId,
      force: true,
    });
    console.log("SAVED", result.action, result.message, {
      planned: result.row?.plannedProgressPct,
      actual: result.row?.actualProgressPct,
      date: result.row?.confirmedDate,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
