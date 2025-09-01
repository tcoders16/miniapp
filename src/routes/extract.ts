// src/routes/extract.ts
import { Router } from "express";
import { z } from "zod";
import { extractDeadlines } from "../services/extractService";

export const router = Router();

const InputSchema = z.object({
  texts: z.array(z.string().min(1)),
  nowISO: z.string().optional()
});

router.post("/", (req, res) => {
  const parsed = InputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

  const { texts, nowISO } = parsed.data;
  const items = extractDeadlines(texts, nowISO ? new Date(nowISO) : undefined);
  res.json({ items });
});