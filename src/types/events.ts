//  EventLite: minimal calendar event contract
// -----------------------------
// - Represents the smallest useful calendar event in our system.
// - Always use full ISO 8601 strings for `start` and `end`.
//   Example: "2025-08-29T17:00:00Z" or with timezone offset.
// - Designed to be backend/frontend/ICS-friendly (no Date objects).
// - Extendable later with location, description, recurrence, etc.
// =============================
export type EventLite = {
    /** Short human-readable label or title of the event taking place, will become ICS SUMMARY */
    title: string;

    /** Required start time of the event, ISO 8601 string (UTC or offset included) */
    start: string; // e.g. "2025-08-29T17:00:00Z"

    /** Optional end time of the event (ISO). Must be >= start if provided */
    end?: string;  // e.g. "2025-08-29T17:30:00Z"

    /** Flag for all-day events | is the event gonna be for the whole day? (treat as date-only in ICS output) */
    allDay?: boolean;

    /** IANA timezone identifier (e.g., "America/Toronto") is the event in Canada?/US?/Europe?/India? */
    timezone?: string;

    /** Which extractor produced this event: deterministic rules or LLM | which file produced this event is it rules we manually define or the local llm?*/
    source?: "rules" | "llm";

    /** Confidence score (0..1). Rules = ~0.7–0.8, LLM provides own | what sort of confidence can we expect from each this event */
    confidence?: number;
};






//  ExtractionResult: response envelope for event extraction
// -----------------------------
// - Always wraps results in a predictable structure.
// - `events`: array of EventLite (never null).
// - `degraded`: true if fallback logic was used (e.g. LLM timeout).
// - `warnings`: non-fatal issues (ambiguous date, timezone assumption).
// - This ensures clients always receive a consistent shape, even on errors.
// =============================



export type ExtractionResult = {
    events: EventLite[];

    /** True if service had to fallback/degrade (e.g., rules define manually instead of LLMService) */
    degraded: boolean;

    /** Optional notes for clients/logs (e.g., "resolved 'this Friday' to Sept 5")/ Date that are not to sure */
    warnings?: string[];
};