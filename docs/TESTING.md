# MedLens Manual Acceptance Checklist

## Purpose

This checklist provides a repeatable pre-submission and pre-release manual verification process for MedLens. Use synthetic demo information only. MedLens organizes information for human review and does not diagnose, treat, prescribe, recommend dosage changes, or provide emergency guidance.

## Test setup

- [ ] Use either the local development environment or the live production URL: [https://medlens-nine.vercel.app/](https://medlens-nine.vercel.app/).
- [ ] Use synthetic information only; never use real patient data.
- [ ] Do not enter API keys into the browser or commit them to the repository.
- [ ] Record whether the run uses deterministic synthetic fallback mode or optional live server-side extraction.
- [ ] Record the browser, date, tester, and result in the test record below.

## Core workflow

- [ ] Confirm the intake page loads.
- [ ] Confirm inputs have understandable labels.
- [ ] Select **Load Demo Report** and confirm it populates the synthetic demo information.
- [ ] Select **Create Structured Record** and confirm the request completes.
- [ ] Confirm the dashboard displays structured patient and review content.
- [ ] Confirm the Record Processing Trace shows the seven workflow stages with readable status and safe evidence statements.
- [ ] Confirm source evidence and provenance are visible.
- [ ] Confirm confidence and review states are visible where applicable.
- [ ] Confirm a safe, non-diagnostic summary is visible.
- [ ] Confirm clarification questions are visible and phrased as information requests.
- [ ] When the AI key is absent or the AI service is unavailable, confirm the synthetic fallback disclosure is visible.
- [ ] Select **Generate AI review summary** and confirm loading, safe text-only output, the human-review disclaimer, and an accessible unavailable state when Gemini is not configured.

## Validation and failure behavior

- [ ] Submit missing or invalid form input and confirm a clear, safe error is shown.
- [ ] Confirm invalid or rejected requests do not echo pasted report content in error text.
- [ ] Enter synthetic report text above the supported limit and confirm it is rejected safely.
- [ ] Confirm the app remains usable after a rejected request.
- [ ] Confirm AI unavailability results in a visibly labelled synthetic fallback rather than an unlabelled record or crash.

## Human review workflow

- [ ] Edit an extracted laboratory or record field.
- [ ] Save or apply the edit.
- [ ] Mark a field as verified.
- [ ] Confirm editing a field creates a Review Activity item with safe before and after values.
- [ ] Confirm verifying a field creates a Review Activity item with a review-state transition.
- [ ] Confirm Review Activity contains no raw pasted report text and shows its local, non-permanent disclosure.
- [ ] Confirm the review state visibly changes.
- [ ] Confirm conflicts use possible-inconsistency or requires-clarification wording.
- [ ] Select **View related information** on a possible conflict and confirm focus moves to the correct structured item.
- [ ] Confirm related highlights use neutral review-required wording and do not display or persist raw pasted report text.
- [ ] Confirm the app does not automatically decide which conflicting source is correct.
- [ ] Confirm clarification questions do not become diagnosis or medical advice.
- [ ] Confirm clear-record actions require deliberate user confirmation, if that interaction exists.

## Privacy and export

- [ ] Inspect browser localStorage and confirm raw pasted report text is absent.
- [ ] Export the record as JSON and confirm raw pasted report text is absent.
- [ ] Confirm expected structured record and review fields remain present in the export.
- [ ] Confirm no real patient data, API keys, or secrets are used in testing, screenshots, demos, or repository commits.
- [ ] Confirm the AI review-summary request excludes pasted report text, source excerpts, review history, browser storage, and credentials.

## Accessibility and usability

- [ ] Navigate the primary workflow using keyboard only.
- [ ] Confirm visible keyboard focus on inputs, buttons, and links.
- [ ] Confirm buttons have clear names.
- [ ] Confirm form controls have visible labels.
- [ ] Confirm status and meaning are not communicated by color alone.
- [ ] Confirm the page is understandable at a narrow or mobile viewport.
- [ ] Confirm dialogs, including any clear-record confirmation, can be closed with Cancel and Escape if implemented.
- [ ] Confirm focus is returned logically after closing a dialog, if implemented.

## Automated release gate

```bash
npm test
npm run build
git diff --check
```

All commands must pass before a release. The relevant Vercel deployment must be Ready before sharing the production URL.

## Final acceptance checks

- [ ] Confirm allergy and medication conflicts use their supported deterministic related-information mappings; confirm an unsupported category has no navigation target and shows the safe explanatory notice.
- [ ] Confirm the Gemini review-summary request excludes raw pasted report text, excerpts, source quotes, history, browser data, and credentials.
- [ ] With no Gemini key configured, confirm the summary action returns a controlled unavailable state.
- [ ] Confirm malformed Gemini output produces a controlled unavailable state rather than unvalidated content.
- [ ] Confirm a returned summary includes exactly: “For human review only. This is not a diagnosis or medical advice.”
- [ ] Confirm keyboard activation of conflict navigation moves focus to the related structured profile item and presents its visible related-information label.

## Test record

| Date | Tester | Environment | Mode | Browser/device | Result | Notes |
| ---- | ------ | ----------- | ---- | -------------- | ------ | ----- |
|      |        |             |      |                |        |       |
