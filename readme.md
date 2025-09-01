# Mini App Backend

Backend API for extracting deadlines/tasks from emails or free text, with optional LLM assistance and ICS calendar export.

## Overview
- Extracts tasks/deadlines using fast rule-based parsing.
- Optional smart mode calls a local LLM (Ollama) if rules miss items.
- Upload `.eml` or `.txt` emails and get grouped tasks back.
- Generate an `.ics` file from extracted tasks for calendar import.

## Quick Start
- Requirements: Node 18+, pnpm/npm, optional Ollama for LLM.
- Install deps from `backend/`:
  - `cd backend && npm install`
- Dev server:
  - `npm run dev` (runs `ts-node src/server.ts`)
- Build + run:
  - `npm run build` then `npm start`
- Health check:
  - GET `http://localhost:4000/api/healthz` → `{ "ok": true }`

## Environment
Create `backend/.env` (or use real env vars):
- `PORT`: API port. Default `4000`.
- `OLLAMA_URL`: Ollama base URL. Default `http://localhost:11434`.
- `LLM_MODEL`: Model name for Ollama. Default `phi3:mini`.

LLM endpoints only work if Ollama is running and the model is available.

## Scripts (package.json)
- `dev`: `ts-node src/server.ts`
- `build`: `tsc -p .` → outputs to `dist/`
- `start`: `node dist/server.js`

## API
Base URL: `http://localhost:4000/api`

- `GET /healthz`
  - Returns `{ ok: true }` for readiness checks.

- `POST /extract` (rules-only)
  - Body: `{ "texts": string[], "nowISO"?: string }`
  - Response: `{ items: ExtractedItem[] }`
  - `ExtractedItem`: `{ title, description?, startISO, endISO?, allDay?, source? }`

- `POST /llm-extract` (smart: rules + optional LLM)
  - Body: `{ "items": { subject: string, text: string }[], "nowISO"?: string, "mode"?: "auto"|"rules"|"llm" }`
  - Response: `{ emails: { subject: string, tasks: ExtractedItem[] }[], mode }`

- `POST /upload` (email files → grouped tasks)
  - Multipart: key `files` (up to 25 files, 2MB each). Accepts `.eml` or `.txt`.
  - Response: `{ count, limitedTo, emails: { subject, index, tasks: ExtractedItem[] }[] }`

- `POST /ics` (generate calendar file)
  - Body: `{ items: { title, description?, startISO, endISO?, allDay? }[] }`
  - Response: `text/calendar` attachment (`deadlines.ics`).

## Curl Examples
- Rules extract from free text:
  - `curl -sS localhost:4000/api/extract -H 'Content-Type: application/json' -d '{"texts":["Submit report by Aug 29 5pm"],"nowISO":"2025-08-28T09:00:00"}' | jq` 

- Smart extract with LLM fallback:
  - `curl -sS localhost:4000/api/llm-extract -H 'Content-Type: application/json' -d '{"items":[{"subject":"Project kickoff","text":"Let\'s meet next Tuesday 1-2pm"}],"mode":"auto"}' | jq`

- Upload emails (`.eml` or `.txt`):
  - `curl -sS -F 'files=@/path/to/email1.eml' -F 'files=@/path/to/email2.txt' localhost:4000/api/upload | jq`

- Create ICS from items:
  - `curl -sS localhost:4000/api/ics -H 'Content-Type: application/json' -d '{"items":[{"title":"Deadline","startISO":"2025-08-29T17:00:00","endISO":"2025-08-29T18:00:00"}]}' -o deadlines.ics`

## Implementation Notes
- Server: Express with CORS and JSON body limit `5mb` (`src/server.ts`).
- Extraction rules: `src/services/extractService.ts`.
- Smart extraction orchestrator: `src/services/extractSmart.ts`.
- LLM service (Ollama): `src/services/llmServices.ts`.
- Email parsing: `src/routes/upload.ts` (`mailparser`, `html-to-text`).
- ICS generation: `src/routes/ics.ts` (`ics` package).

## Project Hygiene
- `node_modules/` and `dist/` should not be committed. Ensure they are in `.gitignore`.
- Large email uploads are limited to 25 files, 2MB each (adjust in `upload.ts`).

## Troubleshooting
- LLM route returns empty tasks:
  - Ensure Ollama is running and `LLM_MODEL` is pulled.
  - Try `mode: "llm"` to force LLM even when rules find items.
- Dates look off by timezone:
  - Times are treated as local; add `nowISO` for deterministic tests.

## License
MIT or your preferred license.
