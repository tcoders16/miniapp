// src/services/llmService.ts
import { z } from "zod";

// Read config (ensure `import "dotenv/config"` at the top of src/index.ts)
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const LLM_MODEL  = process.env.LLM_MODEL  || "phi3:mini";

/* ============================== Zod Schemas ============================== */

// Accept common ISO-ish variants from tiny LLMs:
// - YYYY-MM-DDTHH:mm
// - YYYY-MM-DDTHH:mm:ss
// - Either with optional trailing Z
const IsoLike = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z?$/,
  "Time must look like YYYY-MM-DDTHH:mm (optional :ss, optional Z)"
);

export const LlmTaskSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  startISO: IsoLike,
  endISO: IsoLike.optional(),
  allDay: z.boolean().optional(),
  location: z.string().optional(),
  url: z.string().url().optional(),
  attendees: z.array(z.string()).optional(),
  source: z.literal("llm").default("llm"),
  confidence: z.number().min(0).max(1).default(0.5)
});

export const LlmResponseSchema = z.object({
  tasks: z.array(LlmTaskSchema).default([])
});

export type LlmTask = z.infer<typeof LlmTaskSchema>;
export type LlmResponse = z.infer<typeof LlmResponseSchema>;

/* ============================== Prompts ================================= */

const SYSTEM_PROMPT = `You convert emails into calendar-ready tasks/events.

Rules:
- Output ONLY JSON that matches the provided schema (no prose, no markdown).
- Use the user's local timezone: America/Toronto.
- Resolve relative dates like "tomorrow", "next Tuesday", "EOD Friday".
- Prefer clear date/time info in the SUBJECT over vague hints in the BODY.
- If uncertain, return an empty list (no guessing).
- Titles should be short and actionable.
- Default duration: 30 minutes if a start time exists and no end time is given.
- If "EOD", set start=17:00 and end=23:59 on the same day.
- Return local times like 2025-08-29T13:00 or 2025-08-29T13:00:00 (no timezone suffix).

EXAMPLE INPUT:
SUBJECT: Team sync Friday 1–2pm
BODY:
See you there. Room 204.

EXAMPLE OUTPUT:
{"tasks":[{"title":"Meeting","description":"Team sync Friday 1–2pm","startISO":"2025-08-29T13:00","endISO":"2025-08-29T14:00","location":"Room 204","source":"llm","confidence":0.8}]}
`;

function userPrompt(subject: string, body: string, nowISO?: string) {
  const nowLine = nowISO ? `NOW (local): ${nowISO}\n\n` : "";
  return `${nowLine}SUBJECT: ${subject}

BODY:
${body}

SCHEMA (TypeScript):
{
  "tasks": [
    {
      "title": "string",
      "description": "string (optional)",
      "startISO": "YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:00 (local)",
      "endISO": "YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:00 (local, optional)",
      "allDay": "boolean (optional)",
      "location": "string (optional)",
      "url": "string (optional)",
      "attendees": "string[] (optional)",
      "source": "llm",
      "confidence": 0.0-1.0
    }
  ]
}

Return ONLY JSON.`;
}

/* ============================== Helpers ================================= */

function stripCodeFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
}

// Ensure local ISO without trailing Z and with seconds ":00"
function normalizeIsoLocal(s: string): string {
  const noZ = s.endsWith("Z") ? s.slice(0, -1) : s;
  // If only minutes present (YYYY-MM-DDTHH:mm), append seconds
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(noZ)) {
    return `${noZ}:00`;
  }
  // If seconds present already, return as-is
  return noZ;
}

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const chunk = s.slice(start, end + 1);
      try { return JSON.parse(chunk); } catch { /* ignore */ }
    }
    return null;
  }
}

/* ============================== Public API ============================== */

/**
 * Calls a local LLM (Ollama) to extract tasks from a single email.
 * - subject: cleaned subject line
 * - body: plain-text body (HTML already stripped)
 * - nowISO: optional "current" local time for deterministic tests (YYYY-MM-DDTHH:mm or :00)
 */
export async function llmExtract(
  subject: string,
  body: string,
  nowISO?: string
): Promise<LlmResponse> {
  const prompt = `${SYSTEM_PROMPT}\n\n${userPrompt(subject, body, nowISO)}`;

  const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.2, num_ctx: 2048 }
    })
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error(`LLM HTTP ${resp.status}: ${text}`);
    return { tasks: [] };
  }

  // Ollama returns { response: string, ... }
  const data = (await resp.json()) as { response?: string };
  const raw = (data.response ?? "").toString();
  const cleaned = stripCodeFences(raw);
  const parsed = tryParseJson(cleaned);

  const validated = LlmResponseSchema.safeParse(parsed);
  if (!validated.success) {
    console.warn("LLM schema validation failed:", validated.error.format());
    return { tasks: [] };
  }

  // Normalize times and ensure "source":"llm"
  const tasks = validated.data.tasks.map(t => ({
    ...t,
    source: "llm" as const,
    startISO: normalizeIsoLocal(t.startISO),
    endISO: t.endISO ? normalizeIsoLocal(t.endISO) : undefined
  }));

  return { tasks };
}

/**
 * Convenience: runs LLM, then prefixes titles with the email subject for UI grouping.
 */
export async function llmExtractWithSubjectPrefix(
  subject: string,
  body: string,
  nowISO?: string
): Promise<LlmTask[]> {
  const { tasks } = await llmExtract(subject, body, nowISO);
  return tasks.map(t => ({ ...t, title: `[${subject}] ${t.title}` }));
}