import { describe, expect, it } from "vitest";
import { demoPatient, demoReport } from "../lib/demo-data";
import { createFallbackRecord } from "../lib/fallback-record";
import { applyLabEdit, calculateReviewMetrics, createStructuredRecordExport, deserializeReview, evaluateRecordQuality, getLabStatusRationale, serializeReview, type StoredReview, verifyLab } from "../lib/review-utils";

const request = { patient: demoPatient, reportText: demoReport, isSyntheticDemo: true };
const record = () => createFallbackRecord(request, "demo_mode", new Date("2026-09-05T00:00:00.000Z"));

describe("review utilities", () => {
  it("creates deterministic, source-range-only rationales for all status states", () => {
    const source = record();
    expect(getLabStatusRationale(source.labs[0]).text).toContain("below the lower limit of 12.0 g/dL");
    expect(getLabStatusRationale(source.labs[1]).text).toContain("within the source-provided range");
    expect(getLabStatusRationale({ ...source.labs[0], value: 16 }).text).toContain("above the upper limit of 15.5 g/dL");
    expect(getLabStatusRationale(source.labs[2]).text).toBe("No usable reference range was found in the source report. MedLens did not assess this result.");
  });

  it("calculates actual review metrics and updates them after verification", () => {
    expect(calculateReviewMetrics(record())).toMatchObject({ patientCaptured: 7, patientExpected: 7, labs: 3, labsWithEvidence: 3, labsWithRanges: 2, labsAssessed: 2, awaitingReview: 4, verified: 0 });
    const verified = verifyLab(record(), "demo-hemoglobin", "2026-09-05T01:00:00.000Z");
    expect(calculateReviewMetrics(verified)).toMatchObject({ awaitingReview: 3, verified: 1 });
    expect(verified.labs[0]).toMatchObject({ provenance: "user_verified", verificationState: "verified", verifiedAt: "2026-09-05T01:00:00.000Z" });
  });

  it("accepts a reviewable record and explains quality blockers", () => {
    expect(evaluateRecordQuality(record())).toMatchObject({ readyForReview: true });
    const invalid = record(); invalid.labs[0] = { ...invalid.labs[0], referenceRange: null, status: "low" };
    const quality = evaluateRecordQuality(invalid);
    expect(quality.readyForReview).toBe(false);
    expect(quality.checks.rangeStatusPolicySatisfied).toBe(false);
  });

  it("applies edit values without silently verifying a result", () => {
    const edited = applyLabEdit(record(), "demo-hemoglobin", { testName: "Hemoglobin", value: "11.2", unit: "g/dL", referenceRange: "12.0 - 15.5 g/dL", reportDate: "2026-09-05", sourceSnippet: "Hemoglobin: 10.8 g/dL (Reference range: 12.0 - 15.5 g/dL)" });
    expect(edited.labs[0]).toMatchObject({ value: "11.2", verificationState: "needs_review", provenance: "ai_extracted", status: "low" });
  });

  it("excludes raw pasted report text from local persistence while retaining review state", () => {
    const value: StoredReview = { record: record(), processing: { mode: "synthetic_fallback", fallbackReason: "demo_mode", notice: "Synthetic demo record — live AI processing unavailable." }, history: [{ at: "2026-09-05T00:00:00.000Z", label: "Structured record generated" }] };
    const rawReportText = "SYNTHETIC_RAW_REPORT_TEXT_MUST_NOT_BE_STORED";
    const pageState = { ...value, reportText: rawReportText };
    const serialized = serializeReview({ record: pageState.record, processing: pageState.processing, history: pageState.history });
    const restored = deserializeReview(serialized);
    expect(Object.keys(JSON.parse(serialized)).sort()).toEqual(["history", "processing", "record"]);
    expect(restored?.record.labs).toHaveLength(3);
    expect(restored?.processing).toEqual(value.processing);
    expect(restored?.history).toEqual(value.history);
    expect(serialized).not.toContain(rawReportText);
    expect(serialized).not.toContain(demoReport);
    expect(deserializeReview("not json")).toBeNull();
  });

  it("excludes raw pasted report text from JSON export while retaining review data", () => {
    const value: StoredReview = { record: record(), processing: { mode: "synthetic_fallback", fallbackReason: "demo_mode", notice: "Synthetic demo record — live AI processing unavailable." }, history: [{ at: "2026-09-05T00:00:00.000Z", label: "Structured record generated" }] };
    const rawReportText = "SYNTHETIC_RAW_REPORT_TEXT_MUST_NOT_BE_EXPORTED";
    const pageState = { ...value, reportText: rawReportText };
    const exported = createStructuredRecordExport(pageState.record, pageState.processing, "2026-09-05T02:00:00.000Z");
    const serialized = JSON.stringify(exported);
    expect(Object.keys(exported).sort()).toEqual(["exportedAt", "processing", "record"]);
    expect(exported).toMatchObject({ record: value.record, processing: value.processing, exportedAt: "2026-09-05T02:00:00.000Z" });
    expect(serialized).not.toContain(rawReportText);
    expect(serialized).not.toContain(demoReport);
  });
});
