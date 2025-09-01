import { z } from "zod";

// =============================
//  ExtractBody schema
// -----------------------------
// Defines the expected request body for POST /api/extract.
// - Either `text` (raw string) OR `fileId` (uploaded file reference) is required.
// - Includes optional timezone and referenceDate fields.
// - Used both for runtime validation (Zod) AND TypeScript type inference.
// =============================
export const ExtractBody = z.object({
  /** 
   * Raw text to parse (e.g. "Meeting next Tuesday 10am").
   * Optional, but must be non-empty string if provided.
   */
  text: z.string().min(1).optional(),

  /**
   * UUID string for a pre-uploaded file containing text.
   * Optional, but must be a valid UUID if provided.
   */
  fileId: z.string().uuid().optional(),

  /**
   * IANA timezone identifier (e.g., "America/Toronto").
   * Defaults to "America/Toronto" if not specified.
   * Ensures extracted events are localized correctly.
   */
  timezone: z.string().default("America/Toronto"),

  /**
   * Optional ISO 8601 datetime string used as an anchor date.
   * Example: "2025-09-01T00:00:00Z"
   * Useful for resolving relative phrases like "next Tuesday".
   */
  referenceDate: z.string().datetime().optional(),
})
/**
 * Refinement rule:
 * - Must provide at least one of `text` or `fileId`.
 * - If both are missing → validation error.
 */
.refine(b => b.text || b.fileId, { message: "Provide `text` or `fileId`" });

// =============================
//  ExtractBodyType
// -----------------------------
// - Infers the TypeScript type directly from the Zod schema.
// - Avoids duplication (schema = runtime validation + type contract).
// - Example inferred shape:
//   {
//     text?: string;
//     fileId?: string;
//     timezone: string;        // always present due to default
//     referenceDate?: string;
//   }
// =============================
export type ExtractBodyType = z.infer<typeof ExtractBody>;