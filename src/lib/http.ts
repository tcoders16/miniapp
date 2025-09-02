// =============================
// lib/http.ts
// -----------------------------
// Provides helper functions to send consistent API responses.
// Every response is wrapped in either:
//   { ok: true, data, meta? }   → success
//   { ok: false, error }        → failure
// =============================

/**
 * Send a successful response.
 * - `data` is the main payload (typed with generics).
 * - `meta` is optional extra info (e.g., pagination).
 */
export const sendOk = <T>(res: any, data: T, meta?: any) =>
  res.json({ ok: true, data, meta });

/**
 * Send an error response.
 * - `code` is a short machine-readable error code (e.g. "E_BAD_INPUT").
 * - `message` is human-readable.
 * - `details` can hold validation errors or debugging info.
 * - `status` sets the HTTP status (default 400).
 */
export const sendErr = (
  res: any,
  code: string,
  message: string,
  details?: any,
  status = 400
) =>
  res.status(status).json({
    ok: false,
    error: { code, message, details },
  });