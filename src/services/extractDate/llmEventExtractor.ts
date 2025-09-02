//Takes text and give it to LLM 
// =============================
// services/extractLLM.ts
// -----------------------------
// LLM-based extractor using Ollama.
// - Crafts a strict prompt
// - Validates JSON with Zod
// - Sanitizes + enforces invariants
// - Supports timeout via AbortController
// =============================

import { z } from "zod";
import type { ExtractionResult, EventLite } from "../../types/events";
import { ollamaGenerateJSON } from "../../clients/ollama";

// -------- JSON schema guard (Zod) --------
const LlmEvent = z.object({
  title: z.string().min(1),
  start: z.string().min(1),         // ISO 8601 expected
  end: z.string().min(1).optional(),// ISO 8601 if present
  allDay: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const LlmOut = z.object({
  events: z.array(LlmEvent).default([]),
  warnings: z.array(z.string()).optional(),
});

// -------- Public API --------
export async function extractLLM(input: {
  text?: string;
  fileId?: string;            // future: load text from storage
  timezone: string;
  referenceDate?: string;     // use in prompt context
  budgetMs?: number;          // timeout budget
  model?: string;             // override model if needed
}): Promise<ExtractionResult> {
  const raw = (input.text ?? "").trim();
  if (!raw) return { events: [], degraded: false, warnings: ["empty text"] };

  const controller = new AbortController();
  const timeoutMs = clampPositive(input.budgetMs ?? 6000, 1000, 20000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const prompt = buildPrompt({
      text: raw,
      timezone: input.timezone,
      referenceDate: input.referenceDate,
    });

    const respText = await ollamaGenerateJSON({
      prompt,
      model: input.model,      // optional override
      signal: controller.signal,
      options: { temperature: 0 },
    });

    // Some models may wrap JSON in code fences or add prose.
    const jsonStr = extractJsonBlock(respText);
    const parsed = LlmOut.parse(JSON.parse(jsonStr));

    // Sanitize + map to EventLite
    const { events, warnings = [] } = parsed;
    const cleanEvents: EventLite[] = events
      .map((e) => sanitizeEvent(e, input.timezone))
      .filter(Boolean) as EventLite[];

    return { events: cleanEvents, degraded: false, warnings };
  } catch (e: any) {
    // If anything fails (timeout, bad JSON, schema mismatch),
    // signal a graceful degraded state. Caller can decide to fallback to rules.
    const reason =
      e?.name === "AbortError" ? `llm timeout after ${timeoutMs}ms` : (e?.message || "llm error");
    return { events: [], degraded: true, warnings: [reason] };
  } finally {
    clearTimeout(timeout);
  }
}

// -------- Helpers --------

        function buildPrompt(args: { text: string; timezone: string; referenceDate?: string }) {
        const { text, timezone, referenceDate } = args;
        return `
        You are an extraction engine. Extract calendar events from the given text.
        - Resolve relative dates using the reference date if provided.
        - Output ONLY valid, minified JSON with this exact schema:
        {"events":[{"title":"string","start":"ISO","end":"ISO?","allDay":"boolean?"}], "warnings":["string"]}

        Rules:
        - "start" and "end" must be ISO 8601 (include timezone offset or Z).
        - If unsure about end time, omit "end".
        - If the date is clearly all-day, set "allDay": true.
        - Do NOT include any additional fields.
        - Do NOT include any explanations or code fences.

        Context:
        - timezone: ${timezone}
        - referenceDate: ${referenceDate ?? "none"}

        TEXT:
        ${text}
        `.trim();
        }

function clampPositive(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

/** Extract a JSON object from a response that might include prose or code fences. */
function extractJsonBlock(s: string): string {
  // Fast path: already pure JSON
  const trimmed = s.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  // Remove code fences if present
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) return fenceMatch[1].trim();

  // Last resort: try to slice the first {...} block
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1).trim();

  // Give up
  return trimmed;
}

function sanitizeEvent(e: z.infer<typeof LlmEvent>, timezone: string): EventLite | null {
  const startOk = isValidISO(e.start);
  const endOk = !e.end || isValidISO(e.end);
  if (!startOk || !endOk) return null;

  if (e.end && Date.parse(e.end) < Date.parse(e.start)) {
    // Drop invalid range; keep start-only event
    e = { ...e, end: undefined };
  }

  const confidence = typeof e.confidence === "number" ? e.confidence : 0.6;

  return {
    title: e.title.trim() || "Untitled",
    start: e.start,
    end: e.end,
    allDay: e.allDay ?? false,
    timezone,
    source: "llm",
    confidence,
  };
}

function isValidISO(s: string): boolean {
  const t = Date.parse(s);
  return Number.isFinite(t);
}