const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 120;

export function chunkText(text: string): string[] {
  if (!text.trim()) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const slice = text.slice(start, end).trim();
    if (slice.length > 40) chunks.push(slice);
    if (end >= text.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}
