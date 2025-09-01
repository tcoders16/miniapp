"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
// src/routes/extract.ts
const express_1 = require("express");
const zod_1 = require("zod");
const extractService_1 = require("../services/extractService");
exports.router = (0, express_1.Router)();
const InputSchema = zod_1.z.object({
    texts: zod_1.z.array(zod_1.z.string().min(1)),
    nowISO: zod_1.z.string().optional()
});
exports.router.post("/", (req, res) => {
    const parsed = InputSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.format() });
    const { texts, nowISO } = parsed.data;
    const items = (0, extractService_1.extractDeadlines)(texts, nowISO ? new Date(nowISO) : undefined);
    res.json({ items });
});
