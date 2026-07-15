import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), ".data", "deleted-masters.json");

type DeletedState = {
  productIds: string[];
  siteIds: string[];
  labNames: string[];
  addresses: string[];
};

let cache: DeletedState | null = null;

function empty(): DeletedState {
  return { productIds: [], siteIds: [], labNames: [], addresses: [] };
}

function load(): DeletedState {
  if (cache) return cache;
  try {
    if (fs.existsSync(FILE)) {
      cache = { ...empty(), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
      return cache!;
    }
  } catch {
    /* ignore */
  }
  cache = empty();
  return cache;
}

function save(state: DeletedState) {
  cache = state;
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn("[deleted-masters] persist failed:", err);
  }
}

function norm(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

export function rememberDeletedMaster(input: {
  productId?: string | null;
  siteId?: string | null;
  labName?: string | null;
  siteAddress?: string | null;
  siteName?: string | null;
}) {
  const state = load();
  let changed = false;
  if (input.productId && !state.productIds.includes(input.productId)) {
    state.productIds.push(input.productId);
    changed = true;
  }
  if (input.siteId && !state.siteIds.includes(input.siteId)) {
    state.siteIds.push(input.siteId);
    changed = true;
  }
  if (input.labName) {
    const k = norm(input.labName);
    if (k && !state.labNames.includes(k)) {
      state.labNames.push(k);
      changed = true;
    }
  }
  for (const a of [input.siteAddress, input.siteName]) {
    if (!a) continue;
    const k = norm(a);
    if (k.length >= 2 && !state.addresses.includes(k)) {
      state.addresses.push(k);
      changed = true;
    }
  }
  if (changed) save(state);
}

export function isProductDeleted(id: string): boolean {
  return load().productIds.includes(id);
}

export function isSiteDeleted(siteId: string): boolean {
  return load().siteIds.includes(siteId);
}

export function isDeletedLabName(labName: string | null | undefined): boolean {
  const k = norm(labName ?? "");
  return Boolean(k && load().labNames.includes(k));
}

export function isDeletedAddressHint(text: string | null | undefined): boolean {
  const t = norm(text ?? "");
  if (!t) return false;
  return load().addresses.some((a) => a.length >= 2 && (t.includes(a) || a.includes(t.slice(0, 8))));
}

/** 재등록 시 삭제 이력 해제 */
export function restoreDeletedMaster(input: {
  labName?: string | null;
  siteAddress?: string | null;
  siteName?: string | null;
  siteId?: string | null;
}) {
  const state = load();
  let changed = false;
  if (input.labName) {
    const k = norm(input.labName);
    const before = state.labNames.length;
    state.labNames = state.labNames.filter((x) => x !== k);
    if (state.labNames.length !== before) changed = true;
  }
  if (input.siteId) {
    const before = state.siteIds.length;
    state.siteIds = state.siteIds.filter((x) => x !== input.siteId);
    if (state.siteIds.length !== before) changed = true;
  }
  for (const a of [input.siteAddress, input.siteName]) {
    if (!a) continue;
    const k = norm(a);
    const before = state.addresses.length;
    state.addresses = state.addresses.filter(
      (x) => !(x === k || (k.length >= 4 && (x.includes(k) || k.includes(x))))
    );
    if (state.addresses.length !== before) changed = true;
  }
  if (changed) save(state);
}
