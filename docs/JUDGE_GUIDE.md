# MedLens: Judge Quickstart

## Problem

Fragmented patient-entered information and report-derived findings can create a slow, error-prone human-review workflow. The challenge is to organize information, surface possible inconsistencies, preserve evidence, and avoid overclaiming automated clinical decision-making.

## Intended user

A reviewer using synthetic/demo patient records who needs to inspect structured information, evidence, and possible inconsistencies. MedLens supports human review; it is not a diagnostic system.

## 60-second evaluation path

1. Open the live application and load the synthetic/demo workflow.
2. Inspect the structured record and record-quality/processing-trace information.
3. Review a possible allergy or medication conflict.
4. Use “View related information” to see the safely mapped structured-profile target and source evidence context.
5. Use “Generate AI review summary” to see a supplemental Gemini summary.
6. Acknowledge a conflict for the current session; refresh to verify that acknowledgement is not persistent.

## Requirement-to-evidence matrix

| Requirement | Evidence in MedLens |
| --- | --- |
| Structured, understandable record | Dashboard structured patient profile, medications, allergies, labs |
| Traceability | Source evidence, processing trace, correction audit history |
| Possible inconsistency review | Deterministic conflict detection and conflict cards |
| Safe navigation | Fixed allergy/medication target mappings; no raw report text in navigation state |
| Human review workflow | Source review, session-only acknowledgment; conflict remains unresolved |
| Responsible Gemini use | Server-side `/api/review-summary`, allow-listed structured synthetic payload, validated transient output |
| Privacy/data minimization | Raw report text excluded from Gemini payload, URLs, storage, exports, and review history |
| Reliability | 8 test files / 48 tests, production build, diff-check all passed |

## Boundaries

- Synthetic data only.
- Human review only; not a diagnosis or medical advice.
- Gemini is supplementary; deterministic logic remains the traceable source of truth.
- `GEMINI_API_KEY` is server-side only and never committed or exposed to the browser.
- AI output and session acknowledgments are not persisted.

## Repository guide

| Path | Purpose |
| --- | --- |
| `components/record-dashboard.tsx` | Main reviewer workflow UI |
| `lib/conflict-navigation.ts` | Safe fixed-target conflict navigation |
| `lib/gemini-review-summary.ts` | Server-only Gemini request and response validation |
| `lib/review-summary.ts` | Minimized allow-listed Gemini payload |
| `app/api/review-summary/route.ts` | Same-origin server API boundary |
| `tests/` | Deterministic feature and safety coverage |
| `docs/ARCHITECTURE.md` | Architecture, trust boundaries, and data flow |
| `docs/TESTING.md` | Automated and manual validation guidance |
