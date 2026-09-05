# Architecture

```text
Patient Intake + Pasted Report Text
  → Client Zod validation
  → Server Zod validation
  → OpenAI Structured Extraction or Synthetic Fallback
  → Schema validation and normalization
  → Deterministic reference-range classification
  → Conflict and clarification checks
  → Human review and verification
  → Local structured-record continuity and JSON export
```

The browser keeps pasted report text only for the active session source view. Creating a record sends that text to MedLens’s processing route for validation and optional AI processing. `localStorage` and JSON exports contain only a schema-validated structured record, processing metadata, and session review events; they exclude raw report text.
