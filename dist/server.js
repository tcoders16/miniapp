"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const extract_1 = require("./routes/extract");
const ics_js_1 = require("./routes/ics.js");
const upload_js_1 = require("./routes/upload.js");
const llm_extract_1 = require("./routes/llm-extract");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "5mb" }));
app.get("/api/healthz", (_req, res) => res.json({ ok: true }));
app.use("/api/extract", extract_1.router); // rules-only
app.use("/api/ics", ics_js_1.router);
app.use("/api/upload", upload_js_1.router); // still rules-only
app.use("/api/llm-extract", llm_extract_1.router); // smart extractor
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
