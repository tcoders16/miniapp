// src/routes/ics.ts
import { Router } from "express";
import { z } from "zod";
import { createEvents, type EventAttributes, type DateTime } from "ics";

export const router = Router();

const Item = z.object({
  title: z.string(),
  description: z.string().optional(),
  startISO: z.string(),      // e.g. 2025-08-29T17:00:00
  endISO: z.string().optional(),
  allDay: z.boolean().optional()
});

const InputSchema = z.object({ items: z.array(Item).min(1) });

router.post("/", (req, res) => {
  const parsed = InputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const events: EventAttributes[] = parsed.data.items.map((i) => {
    const start = new Date(i.startISO);
    const end = i.endISO ? new Date(i.endISO) : new Date(start.getTime() + 30 * 60 * 1000);

    // Build correct tuple shapes for ics DateTime
    const startTuple: DateTime = i.allDay
      ? [start.getFullYear(), start.getMonth() + 1, start.getDate()]
      : [start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes()];

    const endTuple: DateTime = i.allDay
      ? [end.getFullYear(), end.getMonth() + 1, end.getDate()]
      : [end.getFullYear(), end.getMonth() + 1, end.getDate(), end.getHours(), end.getMinutes()];

    const evt: EventAttributes = {
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

  createEvents(events, (err, value) => {
    if (err) return res.status(500).json({ error: String(err) });
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="deadlines.ics"');
    res.send(value);
  });
});