// src/routes/extract.ts
import { Router } from "express";
import { postExtract } from "../controller/extractController";

// Create an isolated router for all /api/extract endpoints
export const router = Router();

/**
 * POST /api/extract
 * - Validates the body with Zod (inside the controller)
 * - Delegates to the service (rules/LLM depending on your controller)
 * - Responds with { ok, data } or { ok:false, error }
 */
router.post("/", postExtract);