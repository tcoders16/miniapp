import { extractDeadlines } from "./extractService.js";
import { llmExtractWithSubjectPrefix } from "./llmServices";

export type SmartMode = "auto" | "rules" | "llm";

export async function extractSmart(
  subject: string,
  body: string,
  nowISO?: string,
  mode: SmartMode = "auto"
) {
  // Pass 1: rules
  const rulesItems = extractDeadlines([body], nowISO ? new Date(nowISO) : undefined)
    .map(t => ({ ...t, title: `[${subject}] ${t.title}`, source: t.source || "rules", confidence: 0.75 }));

  if (mode === "rules") return rulesItems;

  // Decide whether to call LLM
  const needLLM = mode === "llm" || (mode === "auto" && rulesItems.length === 0);

  if (!needLLM) return rulesItems;

  // Pass 2: LLM
  const llmItems = await llmExtractWithSubjectPrefix(subject, body, nowISO);

  // Merge + de-dupe by (title+startISO), prefer higher confidence
  const byKey = new Map<string, any>();
  [...rulesItems, ...llmItems].forEach(it => {
    const key = `${it.title}__${it.startISO}`;
    const prev = byKey.get(key);
    if (!prev || (it.confidence ?? 0) > (prev.confidence ?? 0)) byKey.set(key, it);
  });

  return Array.from(byKey.values());
}