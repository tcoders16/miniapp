"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
// src/routes/ics.ts
const express_1 = require("express");
const zod_1 = require("zod");
const ics_1 = require("ics");
exports.router = (0, express_1.Router)();
const Item = zod_1.z.object({
    title: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    startISO: zod_1.z.string(), // e.g. 2025-08-29T17:00:00
    endISO: zod_1.z.string().optional(),
    allDay: zod_1.z.boolean().optional()
});
const InputSchema = zod_1.z.object({ items: zod_1.z.array(Item).min(1) });
exports.router.post("/", (req, res) => {
    const parsed = InputSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const events = parsed.data.items.map((i) => {
        const start = new Date(i.startISO);
        const end = i.endISO ? new Date(i.endISO) : new Date(start.getTime() + 30 * 60 * 1000);
        // Build correct tuple shapes for ics DateTime
        const startTuple = i.allDay
            ? [start.getFullYear(), start.getMonth() + 1, start.getDate()]
            : [start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes()];
        const endTuple = i.allDay
            ? [end.getFullYear(), end.getMonth() + 1, end.getDate()]
            : [end.getFullYear(), end.getMonth() + 1, end.getDate(), end.getHours(), end.getMinutes()];
        const evt = {
            title: i.title,
            description: i.description ?? "",
            start: startTuple,
            end: endTuple,
            // These are valid per your typings:
            startInputType: "local",
            endInputType: "local"
            // (You can add url/location/organizer/etc. later)
        };
        return evt;
    });
    (0, ics_1.createEvents)(events, (err, value) => {
        if (err)
            return res.status(500).json({ error: String(err) });
        res.setHeader("Content-Type", "text/calendar; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="deadlines.ics"');
        res.send(value);
    });
});
