# Testing

Run:

```bash
npm test
npm run build
```

Unit tests cover range classification, request and fallback handling, status rationales, metrics, verification, quality gates, edits, and structured-record serialization.

Manual checks before delivery:

- Use keyboard navigation to load the demo, submit intake, select evidence, edit, verify, export, and clear a record.
- Submit empty intake/report fields and confirm adjacent error messages remain readable.
- Confirm synthetic fallback messaging when no API key is configured.
- Review the intake and dashboard at narrow mobile width.
