# MedLens

MedLens is a synthetic-demo web application that organizes patient-entered information and pasted report text into a structured, source-traceable record for human review. It is not a diagnostic, treatment, or emergency-guidance tool.

## Run locally

1. Copy `.env.example` to `.env.local` and optionally set a server-only `OPENAI_API_KEY`.
2. Run `npm install`.
3. Run `npm run dev`.

Without a key, MedLens uses its clearly labeled deterministic synthetic fallback so the complete demo flow still works. Use only synthetic information. Run `npm test` and `npm run build` before deployment.

## Challenge requirement coverage

| Requirement | Implemented evidence |
| --- | --- |
| Patient intake | `app/page.tsx`, `lib/medical-record.ts` |
| Pasted report processing | `app/api/extract/route.ts`, `lib/extraction.ts` |
| Structured record and review dashboard | `components/record-dashboard.tsx` |
| Source-range-only status | `lib/lab-status.ts`, `lib/review-utils.ts` |
| Label normalization, literal conflict checks, clarification questions | `lib/normalization.ts`, `lib/conflict-detection.ts`, `lib/clarification-questions.ts` |
| Provenance, evidence, confidence, review state | `lib/medical-record.ts`, `components/record-dashboard.tsx` |
| Safe summary | `lib/extraction.ts`, `components/record-dashboard.tsx` |
| Synthetic fallback | `lib/fallback-record.ts` |
| Edit, verify, local continuity, JSON export | `components/record-dashboard.tsx`, `lib/review-utils.ts` |
| Tests | `tests/` |

## Safety limitations

MedLens does not provide diagnosis, treatment, medication changes, dosage advice, emergency guidance, clinical validation, or compliance certification. The pasted report text remains available only in the active browser session for source review. It is sent to MedLens’s processing route when a record is created, but is not stored in browser localStorage, included in exports, uploaded as a file, or retained as a permanent clinical record. When live AI processing is unavailable, the labeled synthetic demo record does not claim its values were extracted from the entered text.

## Vercel

Import the repository into Vercel, add `OPENAI_API_KEY` only if live extraction is desired, and run the standard Next.js build command. Never use a `NEXT_PUBLIC_` API-key variable.
