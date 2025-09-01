// src/routes/llm-extract.ts
import { Router } from "express";
import { z } from "zod";
import { extractSmart, type SmartMode } from "../services/extractSmart";

export const router = Router();

const EmailSchema = z.object({
  subject: z.string(),
  text: z.string()
});

const InputSchema = z.object({
  items: z.array(EmailSchema).min(1),
  nowISO: z.string().optional(),                 // optional deterministic "now" (YYYY-MM-DDTHH:mm:00)
  mode: z.enum(["auto", "rules", "llm"]).optional() // default: auto
});

router.post("/", async (req, res) => {
  const parsed = InputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.format() });
  }

  const { items, nowISO, mode = "auto" } = parsed.data;

  try {
    // Run per-email extraction in parallel
    const results = await Promise.all(
      items.map(async (it) => {
        const tasks = await extractSmart(
          it.subject,
          it.text,
          nowISO,
          mode as SmartMode
        );
        return { subject: it.subject, tasks };
      })
    );

    res.json({ emails: results, mode });
  } catch (err: any) {
    console.error("llm-extract failed:", err);
    res.status(500).json({ error: "LLM extraction failed", detail: String(err?.message || err) });
  }
});