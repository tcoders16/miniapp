"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSmart = extractSmart;
const extractService_js_1 = require("./extractService.js");
const llmServices_1 = require("./llmServices");
async function extractSmart(subject, body, nowISO, mode = "auto") {
    // Pass 1: rules
    const rulesItems = (0, extractService_js_1.extractDeadlines)([body], nowISO ? new Date(nowISO) : undefined)
        .map(t => ({ ...t, title: `[${subject}] ${t.title}`, source: t.source || "rules", confidence: 0.75 }));
    if (mode === "rules")
        return rulesItems;
    // Decide whether to call LLM
    const needLLM = mode === "llm" || (mode === "auto" && rulesItems.length === 0);
    if (!needLLM)
        return rulesItems;
    // Pass 2: LLM
    const llmItems = await (0, llmServices_1.llmExtractWithSubjectPrefix)(subject, body, nowISO);
    // Merge + de-dupe by (title+startISO), prefer higher confidence
    const byKey = new Map();
    [...rulesItems, ...llmItems].forEach(it => {
        const key = `${it.title}__${it.startISO}`;
        const prev = byKey.get(key);
        if (!prev || (it.confidence ?? 0) > (prev.confidence ?? 0))
            byKey.set(key, it);
    });
    return Array.from(byKey.values());
}
