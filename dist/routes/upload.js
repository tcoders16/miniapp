"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
// src/routes/upload.ts
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const mailparser_1 = require("mailparser");
const html_to_text_1 = require("html-to-text");
const extractService_js_1 = require("../services/extractService.js");
// Router
exports.router = (0, express_1.Router)();
/**
 * Multer config:
 * - memoryStorage so we can read file.buffer
 * - limit to 25 files, 2 MB each (adjust as needed)
 * - optional fileFilter if you want to restrict extensions
 */
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 25 },
    // fileFilter: (_req, file, cb) => {
    //   const ok = /\.(eml|txt)$/i.test(file.originalname);
    //   cb(ok ? null : new Error("Only .eml or .txt files allowed"), ok);
    // },
});
/**
 * POST /api/upload
 * multipart/form-data with key "files"
 * Parses up to 25 emails, extracts deadlines per email,
 * prefixes task titles with the email subject, and returns grouped results.
 */
exports.router.post("/", upload.array("files", 25), async (req, res) => {
    try {
        const files = req.files || [];
        if (!files.length)
            return res.status(400).json({ error: "No files uploaded" });
        // Hard cap at 25 even if client tries more
        const slice = files.slice(0, 25);
        const parsed = [];
        for (let i = 0; i < slice.length; i++) {
            const f = slice[i];
            // Ensure we have a buffer — requires memoryStorage
            const content = (f.buffer || Buffer.alloc(0)).toString("utf8");
            if (!content) {
                parsed.push({ subject: "(empty file)", text: "", index: i });
                continue;
            }
            // Try parsing as .eml; if it fails, treat as plain text (.txt)
            try {
                const mail = await (0, mailparser_1.simpleParser)(content);
                const subject = (mail.subject || "(no subject)").trim();
                // Prefer plain text part. If missing, convert HTML → text.
                let text = (mail.text || "").toString().trim();
                if (!text && mail.html) {
                    text = (0, html_to_text_1.htmlToText)(mail.html.toString(), {
                        wordwrap: false,
                        selectors: [{ selector: "a", options: { hideLinkHrefIfSameAsText: true } }],
                    }).trim();
                }
                parsed.push({ subject, text, index: i });
            }
            catch {
                // Plain text fallback:
                // First line → subject, rest → body
                const [firstLine, ...rest] = content.split(/\r?\n/);
                const subject = (firstLine || "(no subject)").trim();
                const text = rest.join("\n").trim();
                parsed.push({ subject, text, index: i });
            }
        }
        // Run extractor per email and prefix titles with [subject]
        const results = parsed.map((p) => {
            const items = (0, extractService_js_1.extractDeadlines)([p.text]);
            const tasks = items.map((it) => ({
                ...it,
                title: `[${p.subject}] ${it.title}`,
            }));
            return { subject: p.subject, index: p.index, tasks };
        });
        // Keep original order (drag/drop order)
        results.sort((a, b) => a.index - b.index);
        res.json({
            count: results.length,
            limitedTo: 25,
            emails: results,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Upload parse failed", detail: String(err?.message || err) });
    }
});
