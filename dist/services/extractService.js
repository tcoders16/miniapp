"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDeadlines = extractDeadlines;
// src/services/extractService.ts
const date_fns_1 = require("date-fns");
const ABSOLUTE_PATTERNS = [
    /\b(20\d{2}-\d{2}-\d{2})\b/g, // 2025-09-03
    /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g, // 9/3/2025
    /\b((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(,\s*\d{4})?)\b/gi // Aug 29, 2025 / Aug 29
];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DEADLINE_WORDS = /(deadline|due|submit|deliver|send|by|meeting|call|review|follow[- ]?up)/i;
// Times like: "11:30", "3pm", "at 09", "@ 7:15 am"
const TIME_RE = /\b(?:(?:at|@)\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
const NOON_MIDNIGHT_RE = /\b(noon|midnight)\b/i;
function toISO(d) {
    const pad = (n) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}
function parseTimeFromText(text) {
    const nm = text.match(NOON_MIDNIGHT_RE);
    if (nm) {
        return nm[1].toLowerCase() === "noon" ? { h: 12, m: 0 } : { h: 0, m: 0 };
    }
    const m = text.match(TIME_RE);
    if (!m)
        return null;
    let hh = parseInt(m[1], 10);
    const mm = m[2] ? parseInt(m[2], 10) : 0;
    const ampm = m[3]?.toLowerCase();
    if (ampm === "am") {
        if (hh === 12)
            hh = 0;
    }
    else if (ampm === "pm") {
        if (hh !== 12)
            hh += 12;
    }
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59)
        return null;
    return { h: hh, m: mm };
}
function withTime(d, h, m) {
    const copy = new Date(d.getTime());
    copy.setHours(h, m, 0, 0);
    return copy;
}
function decideTimes(baseDay, text) {
    const hasExplicitTime = TIME_RE.test(text) || NOON_MIDNIGHT_RE.test(text);
    // Only treat "by" as EOD if there is NO explicit time
    const atEOD = /EOD|end of day/i.test(text) || (!hasExplicitTime && /\bby\b/i.test(text));
    if (atEOD) {
        const start = (0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(baseDay, 17), 0);
        const end = (0, date_fns_1.endOfDay)(baseDay);
        return { start, end, sourceHint: "eod" };
    }
    const t = parseTimeFromText(text);
    const start = t ? withTime(baseDay, t.h, t.m) : (0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(baseDay, 9), 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    return { start, end, sourceHint: t ? "explicit-time" : "default-time" };
}
function extractDeadlines(texts, now = new Date()) {
    const items = [];
    for (const raw of texts) {
        const text = raw.replace(/\s+/g, " ").trim();
        let matched = false;
        // 1) Absolute dates (2025-09-03, 9/3/2025, Aug 29[, 2025])
        for (const pat of ABSOLUTE_PATTERNS) {
            pat.lastIndex = 0;
            let m;
            while ((m = pat.exec(text))) {
                const s = m[1];
                let dt;
                if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                    dt = (0, date_fns_1.parseISO)(s);
                }
                else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
                    // If 2-digit year given, date-fns "M/d/yyyy" will treat as 2-digit incorrectly;
                    // but for simplicity, keep yyyy and rely on now-year when missing year below.
                    dt = (0, date_fns_1.parse)(s, "M/d/yyyy", now);
                }
                else {
                    // "Aug 29" or "Aug 29, 2025"
                    dt = new Date(s);
                }
                if (isNaN(dt.getTime()))
                    continue;
                // If no year in the matched string, set to current year (or next if past)
                const hadYear = /\b\d{4}\b/.test(s);
                if (!hadYear) {
                    dt.setFullYear(now.getFullYear());
                    if (dt < now)
                        dt.setFullYear(now.getFullYear() + 1);
                }
                // Ignore obviously stale years (footer/copyright noise)
                if (dt.getFullYear() < 2015)
                    continue;
                const { start, end } = decideTimes(dt, text);
                items.push({
                    title: makeTitle(text),
                    description: snippet(text),
                    startISO: toISO(start),
                    endISO: toISO(end),
                    source: "absolute"
                });
                matched = true;
            }
        }
        if (matched)
            continue;
        // 2) "tomorrow"
        if (/\btomorrow\b/i.test(text)) {
            const day = (0, date_fns_1.addDays)(now, 1);
            const { start, end } = decideTimes(day, text);
            items.push(makeItem(text, start, end, "relative"));
            continue;
        }
        // 3) next/this weekday (defaults to next occurrence)
        const matchWd = text.match(/\b(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
        if (matchWd) {
            const target = matchWd[2].toLowerCase();
            const idx = WEEKDAYS.indexOf(target);
            const day = (0, date_fns_1.nextDay)(now, idx);
            const { start, end } = decideTimes(day, text);
            items.push(makeItem(text, start, end, "weekday"));
            continue;
        }
    }
    // de-dup
    const dedup = new Map();
    for (const it of items)
        dedup.set(`${it.title}-${it.startISO}`, it);
    return Array.from(dedup.values());
}
function makeItem(text, start, end, source) {
    return {
        title: makeTitle(text),
        description: snippet(text),
        startISO: toISO(start),
        endISO: toISO(end),
        source
    };
}
function makeTitle(text) {
    const base = DEADLINE_WORDS.test(text) ? "Deadline" : "Task";
    return `${base}: ${text.slice(0, 120)}`;
}
function snippet(text) {
    return text.length > 280 ? text.slice(0, 280) + "…" : text;
}
