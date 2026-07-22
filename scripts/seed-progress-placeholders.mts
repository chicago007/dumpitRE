import fs from "fs";
import path from "path";

function loadEnvLocal() {
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

async function main() {
  loadEnvLocal();
  const { ensureActiveLabProgressPlaceholders, listLabProgress } = await import(
    "../lib/data/lab-progress"
  );
  const created = await ensureActiveLabProgressPlaceholders();
  const rows = await listLabProgress();
  console.log(
    JSON.stringify(
      {
        created,
        total: rows.length,
        names: rows.map((r) => ({
          name: r.labName,
          confirmed: r.confirmedDate,
          actual: r.actualProgressPct,
          placeholder: r.id.endsWith("--placeholder"),
        })),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
