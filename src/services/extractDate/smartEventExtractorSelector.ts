// services/extractService.ts
import { extractRules } from "./ruleEventExtractor.ts";
import { extractLLM } from "./llmEventExtractor.ts";
import type { ExtractionResult } from "../../types/events.ts";

export async function extractSmart(input: {
  text?: string;
  fileId?: string;
  timezone: string;
  referenceDate?: string;
  llmFirst?: boolean;         // strategy toggle
  budgetMs?: number;
}): Promise<ExtractionResult> {
  if (input.llmFirst) {
    const llm = await extractLLM(input);
    if (!llm.degraded && llm.events.length) return llm;
    const rules = await extractRules(input);
    return rules;
  } else {
    const rules = await extractRules(input);
    if (rules.events.length) return rules;
    const llm = await extractLLM(input);
    return llm;
  }
}