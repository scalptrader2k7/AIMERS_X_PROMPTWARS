import { describe, expect, it } from "vitest";
import { demoPatient, demoReport } from "../lib/demo-data";
import { createFallbackRecord } from "../lib/fallback-record";
import { buildProcessingTrace } from "../lib/processing-trace";

const record = () => createFallbackRecord({ patient: demoPatient, reportText: demoReport, isSyntheticDemo: true }, "demo_mode", new Date("2026-09-05T00:00:00.000Z"));

describe("processing trace", () => {
  it("labels synthetic fallback without claiming successful live extraction", () => {
    const trace = buildProcessingTrace({ record: record(), processing: { mode: "synthetic_fallback", fallbackReason: "demo_mode", notice: "Synthetic demo record." }, possibleConflictCount: 0, clarificationQuestionCount: 1 });
    const stage = trace.find((item) => item.id === "record");
    expect(stage).toMatchObject({ status: "Synthetic fallback", evidence: "A clearly labelled deterministic synthetic demo record was used because live AI processing was unavailable." });
    expect(stage?.evidence).not.toContain("created from the submitted report");
  });

  it("describes successful live server-side processing when applicable", () => {
    const trace = buildProcessingTrace({ record: record(), processing: { mode: "ai", notice: "Structured record ready." }, possibleConflictCount: 0, clarificationQuestionCount: 0 });
    expect(trace.find((item) => item.id === "record")).toMatchObject({ status: "Complete", evidence: "A structured record was created from the submitted report through the server-side processing workflow." });
  });

  it("marks all source-provided ranges complete", () => {
    const allRanges = record(); allRanges.labs = allRanges.labs.map((lab) => ({ ...lab, referenceRange: "0 - 100" }));
    const stage = buildProcessingTrace({ record: allRanges, processing: { mode: "ai", notice: "Structured record ready." }, possibleConflictCount: 0, clarificationQuestionCount: 0 }).find((item) => item.id === "ranges");
    expect(stage).toMatchObject({ status: "Complete", symbol: "✓", evidence: "Statuses are based only on reference ranges available in the source report." });
  });

  it("marks missing source-provided ranges for review", () => {
    const withoutRanges = record(); withoutRanges.labs = withoutRanges.labs.map((lab) => ({ ...lab, referenceRange: null, status: "not_assessed" }));
    const stage = buildProcessingTrace({ record: withoutRanges, processing: { mode: "ai", notice: "Structured record ready." }, possibleConflictCount: 0, clarificationQuestionCount: 0 }).find((item) => item.id === "ranges");
    expect(stage).toMatchObject({ status: "Needs review", symbol: "!", evidence: "No usable source-provided reference range is available for one or more results; those results are not assessed from an invented range." });
  });

  it("marks mixed source-provided range availability for review", () => {
    const mixedRanges = record(); mixedRanges.labs[0] = { ...mixedRanges.labs[0], referenceRange: null, status: "not_assessed" };
    const stage = buildProcessingTrace({ record: mixedRanges, processing: { mode: "ai", notice: "Structured record ready." }, possibleConflictCount: 0, clarificationQuestionCount: 0 }).find((item) => item.id === "ranges");
    expect(stage).toMatchObject({ status: "Needs review", symbol: "!", evidence: "Statuses are based only on available source-provided reference ranges. One or more results have no usable source-provided range and are not assessed from an invented range." });
  });

  it("uses grammatical review counts and excludes a raw-report sentinel", () => {
    const rawReportText = "SYNTHETIC_RAW_REPORT_TEXT_MUST_NOT_APPEAR_IN_TRACE";
    const pageState = { record: record(), processing: { mode: "ai" as const, notice: "Structured record ready." }, possibleConflictCount: 1, clarificationQuestionCount: 2, reportText: rawReportText };
    const singularTrace = buildProcessingTrace({ record: pageState.record, processing: pageState.processing, possibleConflictCount: 1, clarificationQuestionCount: 1 });
    const pluralTrace = buildProcessingTrace({ record: pageState.record, processing: pageState.processing, possibleConflictCount: 2, clarificationQuestionCount: 3 });
    const trace = buildProcessingTrace({ record: pageState.record, processing: pageState.processing, possibleConflictCount: 0, clarificationQuestionCount: 0 });
    expect(singularTrace.find((item) => item.id === "review")?.evidence).toBe("1 possible inconsistency and 1 clarification question are available for review.");
    expect(pluralTrace.find((item) => item.id === "review")?.evidence).toBe("2 possible inconsistencies and 3 clarification questions are available for review.");
    expect(trace.find((item) => item.id === "review")?.evidence).toBe("0 possible inconsistencies and 0 clarification questions are available for review.");
    expect(JSON.stringify(trace)).not.toContain(rawReportText);
  });
});
