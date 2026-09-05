# MedLens

MedLens is a synthetic-demo application that turns patient-entered information and pasted report text into a structured, traceable record for human review.

## Live Demo

[https://medlens-nine.vercel.app/](https://medlens-nine.vercel.app/)

## The Problem

Medical report text is often free-form and difficult to organize for review alongside patient-entered context. MedLens provides a review-oriented workspace that keeps source evidence, reported ranges, confidence, and human verification visible without making medical decisions.

## Why MedLens

- Fragmented information becomes a structured, traceable review record.
- Possible inconsistencies are surfaced by deterministic conflict detection rather than automatically resolved.
- Source ambiguity remains reviewable through evidence and safe conflict-to-source navigation.
- Accountability is supported by the processing trace and local correction history.
- The optional server-side Gemini review summary reduces summarization burden using only allow-listed structured synthetic fields; it does not diagnose or provide medical advice.

## Verification evidence

| Check | Verified evidence |
| --- | --- |
| `npm test` | 7 test files / 43 tests passing |
| `npm run build` | Production build passing |
| `git diff --check` | No whitespace errors |
| Security boundaries | Gemini key is server-only; raw report text is excluded from the Gemini payload; Gemini output is not persisted |

## Features

- Patient intake for age, sex, symptoms, conditions, allergies, medications, and notes.
- Pasted synthetic report processing through a validated server-side route.
- Structured record and review dashboard with profile, laboratories, observations, and a patient-friendly overview.
- Source-range-only result status: Low, Normal, High, or Not assessed is determined only from a usable range printed in the report.
- Deterministic label normalization that preserves the exact reported laboratory label.
- Literal conflict checks for explicit allergy and medication mismatches; MedLens does not decide which value is correct.
- Context-aware clarification questions for missing source or intake details.
- Provenance, evidence snippets, confidence, source type, and review state for extracted information.
- A safe, source-bounded summary with non-diagnostic limitations.
- Laboratory editing, manual verification, local structured-record continuity, and JSON export.
- A clearly labeled deterministic synthetic fallback when live AI processing is unavailable.
- Optional Gemini AI review summary using only a minimized structured review payload.
- Session-only reviewer acknowledgment for possible conflicts; it resets on refresh, does not resolve a conflict, and is not sent to Gemini or persisted.

## Demo Workflow

1. Open the [live demo](https://medlens-nine.vercel.app/).
2. Select **Load Demo Report** or enter synthetic patient and report information.
3. Select **Create Structured Record**.
4. Review the dashboard, source evidence, confidence, status rationale, possible flags, and clarification questions.
5. Optionally edit a result, mark it verified, or export the structured record as JSON.

## Challenge Requirement Coverage

| Requirement                                                           | Implemented evidence                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Patient intake                                                        | `app/page.tsx`, `lib/medical-record.ts`                                               |
| Pasted report processing                                              | `app/api/extract/route.ts`, `lib/extraction.ts`                                       |
| Structured record and review dashboard                                | `components/record-dashboard.tsx`                                                     |
| Source-range-only status                                              | `lib/lab-status.ts`, `lib/review-utils.ts`                                            |
| Label normalization, literal conflict checks, clarification questions | `lib/normalization.ts`, `lib/conflict-detection.ts`, `lib/clarification-questions.ts` |
| Provenance, evidence, confidence, review state                        | `lib/medical-record.ts`, `components/record-dashboard.tsx`                            |
| Safe summary                                                          | `lib/extraction.ts`, `components/record-dashboard.tsx`                                |
| Synthetic fallback                                                    | `lib/fallback-record.ts`                                                              |
| Edit, verify, local continuity, JSON export                           | `components/record-dashboard.tsx`, `lib/review-utils.ts`                              |
| Tests                                                                 | `tests/`                                                                              |

## Technology

- Next.js App Router, React, and TypeScript
- Tailwind CSS
- Zod validation schemas
- OpenAI JavaScript SDK with a server-side Responses API route
- Google Gemini Developer API through the server-only `@google/genai` SDK
- Vitest unit tests
- Browser `localStorage` for the structured record, processing metadata, and local review history only

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local`.
3. Optionally configure the server-only `OPENAI_API_KEY` in `.env.local`:

```bash
OPENAI_API_KEY=your_key_here
```

The keys are optional and must remain server-side.

### Gemini API integration

The dashboard can optionally generate an AI review summary through the same-origin `/api/review-summary` route. The browser sends only a minimized structured review payload; pasted report text, source excerpts, review history, browser storage, and credentials are excluded. Gemini is called only on the server using `GEMINI_API_KEY`.

After copying `.env.example`, add the key only to `.env.local` locally:

```bash
cp .env.example .env.local
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

In production, add the same server-only values through Vercel Environment Variables. Never commit the key or expose it to the browser. Use synthetic information only. The generated content is for human review only and is not diagnosis or medical advice.

4. Start the development server:

```bash
npm run dev
```

5. Before deployment, run:

```bash
npm test
npm run build
```

Without `OPENAI_API_KEY`, MedLens remains usable with its clearly labeled deterministic synthetic fallback. Use synthetic information only for this demo.

## Deployment

- Production URL: [https://medlens-nine.vercel.app/](https://medlens-nine.vercel.app/)
- Production branch: `main`
- `OPENAI_API_KEY` is optional and must remain server-side.

To enable optional live extraction in Vercel, add `OPENAI_API_KEY` in the project environment variables and redeploy. Keep this key server-side. Never use `NEXT_PUBLIC_OPENAI_API_KEY` or expose API credentials to the browser.

For the optional Gemini review summary, set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` in Vercel Environment Variables. Never use `NEXT_PUBLIC_GEMINI_API_KEY`.

## Safety and Privacy Limitations

- MedLens does not provide diagnosis, treatment recommendations, medication changes, dosage advice, emergency guidance, clinical validation, or compliance certification.
- It must not be used to make medical decisions or replace qualified clinical assessment.
- Use synthetic information only for this demo.
- Pasted report text remains available only in the active browser session for source review.
- Pasted report text is sent to MedLens's processing route when a record is created, but is not stored in browser localStorage, included in JSON exports, uploaded as a file, or retained as a permanent clinical record.
- If live AI processing is unavailable, the clearly labeled deterministic synthetic fallback does not claim that its values were extracted from user-entered report text.

## Future Improvements

- Consent-based workflows for appropriate real-world deployments.
- Clinician-defined review policies and configurable workflows.
- Broader parsing support for additional report formats.
- A compliant storage architecture for approved use cases.
- Collaboration and review workflows for authorized teams.
