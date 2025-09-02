// =============================
// lib/text.ts
// -----------------------------
// Utility for cleaning up raw text before parsing.
// =============================

/**
 * Normalize raw text for consistent parsing.
 * - Convert Windows/Mac line endings to \n
 * - Replace tabs with spaces
 * - Trim whitespace
 */
export function normalizeText(s: string): string {
  return s
    .replace(/\r\n?/g, "\n") // normalize line endings
    .replace(/\t/g, "  ")    // tabs → 2 spaces
    .trim();
}