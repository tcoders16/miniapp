import "dotenv/config";
import express from "express";
import cors from "cors";

import { router as extractRouter } from "./routes/extract";
import { router as icsRouter } from "./routes/ics.js";
import { router as uploadRouter } from "./routes/upload.js";
import { router as llmExtractRouter } from "./routes/llm-extract";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/healthz", (_req, res) => res.json({ ok: true }));

app.use("/api/extract", extractRouter);            // rules-only
app.use("/api/ics", icsRouter);
app.use("/api/upload", uploadRouter);              // still rules-only
app.use("/api/llm-extract", llmExtractRouter);     // smart extractor

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));