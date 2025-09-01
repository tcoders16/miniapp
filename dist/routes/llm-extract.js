"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
// src/routes/llm-extract.ts
const express_1 = require("express");
const zod_1 = require("zod");
const extractSmart_1 = require("../services/extractSmart");
exports.router = (0, express_1.Router)();
const EmailSchema = zod_1.z.object({
    subject: zod_1.z.string(),
    text: zod_1.z.string()
});
const InputSchema = zod_1.z.object({
    items: zod_1.z.array(EmailSchema).min(1),
    nowISO: zod_1.z.string().optional(), // optional deterministic "now" (YYYY-MM-DDTHH:mm:00)
    mode: zod_1.z.enum(["auto", "rules", "llm"]).optional() // default: auto
});
exports.router.post("/", async (req, res) => {
    const parsed = InputSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
    }
    const { items, nowISO, mode = "auto" } = parsed.data;
    try {
        // Run per-email extraction in parallel
        const results = await Promise.all(items.map(async (it) => {
            const tasks = await (0, extractSmart_1.extractSmart)(it.subject, it.text, nowISO, mode);
            return { subject: it.subject, tasks };
        }));
        res.json({ emails: results, mode });
    }
    catch (err) {
        console.error("llm-extract failed:", err);
        res.status(500).json({ error: "LLM extraction failed", detail: String(err?.message || err) });
    }
});
