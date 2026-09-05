# MedLens Architecture and Safety Boundaries

MedLens uses synthetic information only. It organizes information for human review and does not diagnose, treat, prescribe, recommend dosage changes, or provide emergency guidance.

## Architecture

```text
Browser dashboard
  -> deterministic record/review utilities
  -> same-origin /api/review-summary route
  -> server-only Gemini API call
  -> strict response validation
  -> transient text-only UI
```

## Data boundaries

| Data | Boundary |
| --- | --- |
| Structured synthetic patient fields, allergies, medications, labs, deterministic conflicts, clarification questions | Allowed in the dashboard and minimized Gemini request. |
| Raw report text, excerpts, source quotes | Excluded from Gemini requests, URL/navigation state, browser storage, exports, and review history. |
| `GEMINI_API_KEY` | Server-only environment secret; excluded from the repository, client bundle, and network payloads. |
| Gemini output | Server validated; displayed transiently as text only; not persisted, exported, or added to review history. |
| Session-review acknowledgment | React component memory keyed by a fixed conflict category; resets on refresh and is excluded from URLs, browser storage, exports, review history, and Gemini requests. |

## Responsibility split

- **Deterministic logic:** conflict detection, source mapping and navigation, record processing trace, and review workflow.
- **Gemini:** supplemental factual review summary based only on allow-listed structured synthetic fields.

## Trust boundaries

- Browser inputs are minimized and allow-listed before the Gemini request.
- The API route validates request content type, JSON, size, and schema.
- Gemini output is schema-validated before display.

> For human review only. This is not a diagnosis or medical advice.
