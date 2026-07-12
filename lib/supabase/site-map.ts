/** Legacy slug ↔ site code ↔ Supabase UUID mapping */

export const LEGACY_TO_CODE: Record<string, string> = {
  "site-hwawon": "HW-001",
  "site-jayang": "JY-002",
  "site-changdong": "CD-003",
  "site-gildong": "GD-004",
  "site-pangyo": "PG-005",
  "site-ilsan": "IS-006",
};

export const CODE_TO_LEGACY: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_TO_CODE).map(([k, v]) => [v, k])
);

export const CODE_TO_UUID: Record<string, string> = {
  "HW-001": "a0000001-0000-4000-8000-000000000001",
  "JY-002": "a0000002-0000-4000-8000-000000000002",
  "CD-003": "a0000003-0000-4000-8000-000000000003",
  "GD-004": "a0000004-0000-4000-8000-000000000004",
  "PG-005": "a0000005-0000-4000-8000-000000000005",
  "IS-006": "a0000006-0000-4000-8000-000000000006",
};

export const UUID_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(CODE_TO_UUID).map(([k, v]) => [v, k])
);

export function legacyIdToUuid(legacyId: string | null): string | null {
  if (!legacyId) return null;
  const code = LEGACY_TO_CODE[legacyId];
  return code ? CODE_TO_UUID[code] ?? null : null;
}

export function uuidToLegacyId(uuid: string): string {
  const code = UUID_TO_CODE[uuid];
  return code ? CODE_TO_LEGACY[code] ?? uuid : uuid;
}

export function resolveLegacyId(legacyOrUuid: string | null): string | null {
  if (!legacyOrUuid) return null;
  if (legacyOrUuid.startsWith("a000000")) return uuidToLegacyId(legacyOrUuid);
  return legacyOrUuid;
}
