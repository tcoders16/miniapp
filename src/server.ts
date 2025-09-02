import "dotenv/config";
import express from "express";
import cors from "cors";

import { router as extractRouter } from "./routes/extract.ts";


const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/healthz", (_req, res) => res.json({ ok: true }));

app.use("/api/extract", extractRouter);            // rules-only


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));