// =============================
// services/extractRules.ts
// -----------------------------
// Rules-based extractor (no AI).
// Uses chrono-node to find datetimes and builds EventLite objects.
// =============================

import type { ExtractionResult, EventLite } from "../../types/events";
import { normalizeText } from "../../lib/text";
import { parseDates } from "../../lib/chrono";

/**
 * Extracts events using deterministic rules (chrono, regex, heuristics).
 * - Input: text (or fileId later), timezone, optional referenceDate.
 * - Output: ExtractionResult with EventLite[].
 */
export async function extractRules(input: {
  text?: string;
  fileId?: string;
  timezone: string;
  referenceDate?: string;
}): Promise<ExtractionResult> {
  // --- 1) Guard: empty input ---
  const raw = (input.text ?? "").trim();
  if (!raw) {
    return { events: [], degraded: false, warnings: ["empty text"] };
  }

  // --- 2) Normalize text ---
  const text = normalizeText(raw);

  // --- 3) Parse dates with chrono ---
  const hits = parseDates(text, input.referenceDate);

  // --- 4) Build EventLite objects ---
  const events: EventLite[] = hits
    .filter(h => isValidISO(h.startISO) && (!h.endISO || isValidISO(h.endISO)))
    .map(h => ({
      title: guessTitleNear(text, h.index),
      start: h.startISO,
      end: h.endISO,
      timezone: input.timezone,
      source: "rules" as const,
      confidence: 0.75,
    }))
    // Enforce invariant: end >= start
    .filter(e => !e.end || Date.parse(e.end) >= Date.parse(e.start));

  // --- 5) Return structured result ---
  return { events, degraded: false };
}

// =============================
// Helpers
// =============================

/** Checks if a string is a valid ISO date. */
function isValidISO(s?: string): boolean {
  if (!s) return false;
  const t = Date.parse(s);
  return Number.isFinite(t);
}

/** 
 * Heuristic: grab the text line near the datetime index.
 * This becomes the EventLite.title.
 */
function guessTitleNear(text: string, index: number): string {
  const before = text.slice(0, index);
  const line = before.split("\n").pop() || "";
  const title = line.trim().replace(/^[-•*\s]+/, ""); // strip bullets/dashes
  return title || "Untitled";
}