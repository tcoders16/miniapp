"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSubjectDateRange = parseSubjectDateRange;
// src/utils/subjectTime.ts
const date_fns_1 = require("date-fns");
/**
 * Try to extract a month/day + start/end time range from subjects like:
 *  - "Friday, August 29, 01:00PM - 02:00PM (EDT - America/Port-au-Prince)"
 *  - "Fri Aug 29 1:00 PM - 2:00 PM"
 *  - "August 29, 01:00 PM–02:00 PM"
 *
 * Returns local ISO strings (YYYY-MM-DDTHH:mm:00) or null if not matched.
 */
function parseSubjectDateRange(subject, now = new Date()) {
    const s = subject.replace(/\u2013|\u2014/g, "-"); // en-dash/em-dash → hyphen
    // Month Day, Start - End (AM/PM). Weekday and trailing TZ are optional.
    const re = /(?:\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,\s+)?([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)\b/i;
    // Try with weekday first
    let m = s.match(re);
    if (!m) {
        m = s.match(/\b([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)\b/i);
        if (!m)
            return null;
    }
    const [, mon, dayStr, startStr, endStr] = m;
    // Parse month/day + time without year first
    const startBase = (0, date_fns_1.parse)(`${mon} ${dayStr} ${startStr}`, "MMMM d h:mma", now);
    if (isNaN(startBase.getTime()))
        return null;
    // Use current year; if it’s already in the past, roll to next year
    let start = (0, date_fns_1.setYear)(startBase, now.getFullYear());
    if ((0, date_fns_1.isBefore)(start, now))
        start = (0, date_fns_1.addYears)(start, 1);
    let end = (0, date_fns_1.parse)(`${mon} ${dayStr} ${endStr}`, "MMMM d h:mma", now);
    end = (0, date_fns_1.setYear)(end, start.getFullYear());
    if (end <= start) {
        // if times are equal or reversed, default to 60 minutes
        end = new Date(start.getTime() + 60 * 60 * 1000);
    }
    const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
    return { startISO: toISO(start), endISO: toISO(end) };
}
