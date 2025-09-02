// =============================
// lib/chrono.ts
// -----------------------------
// Wrapper around chrono-node to extract datetimes.
// Keeps parsing logic isolated from services.
// =============================

import  * as chrono from "chrono-node";

/** Minimal chrono hit type we expose to services */
export type ChronoHit = {
  startISO: string;
  endISO?: string;
  index: number; // position in the text
};

/**
 * Parse datetimes from text using chrono-node.
 * - referenceDate helps resolve relative dates (e.g. "next Tuesday").
 * - forwardDate ensures future-looking parsing.
 */
export function parseDates(text: string, referenceDate?: string): ChronoHit[] {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const results = chrono.parse(text, ref, { forwardDate: true });

  return results.map(r => ({
    startISO: r.start?.date().toISOString()!,
    endISO: r.end ? r.end.date().toISOString() : undefined,
    index: r.index,
  }));
}