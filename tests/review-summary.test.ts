import { describe, expect, it } from "vitest";
import { handleReviewSummaryRequest, MAX_REVIEW_SUMMARY_BODY_BYTES } from "../app/api/review-summary/route";
import { generateReviewSummary } from "../lib/gemini-review-summary";
import { createFallbackRecord } from "../lib/fallback-record";
import { generateClarificationQuestions } from "../lib/clarification-questions";
import { detectConflicts } from "../lib/conflict-detection";
import { demoPatient, demoReport } from "../lib/demo-data";
import { buildReviewSummaryRequest, parseReviewSummary, REVIEW_SUMMARY_DISCLAIMER, reviewSummarySchema } from "../lib/review-summary";

const sentinel = "SYNTHETIC_RAW_REPORT_MUST_NOT_LEAVE_THE_CLIENT";
const record = createFallbackRecord({ patient: demoPatient, reportText: demoReport, isSyntheticDemo: true }, "demo_mode", new Date("2026-09-05T00:00:00.000Z"));
const request = buildReviewSummaryRequest(record, detectConflicts(record), generateClarificationQuestions(record));
const validOutput = JSON.stringify({ summary: "Structured information is ready for review.", reviewPriorities: ["Review the displayed structured items."], clarificationQuestions: ["What source detail should be confirmed?"], disclaimer: REVIEW_SUMMARY_DISCLAIMER });

describe("Gemini review summary boundary", () => {
  it("allow-lists only structured review fields and excludes page-state raw report data", () => {
    const pageState = { record, reportText: sentinel, history: [{ targetLabel: sentinel }], localStorage: sentinel, credentials: sentinel };
    const payload = buildReviewSummaryRequest(pageState.record, detectConflicts(pageState.record), generateClarificationQuestions(pageState.record));
    expect(Object.keys(payload).sort()).toEqual(["allergies", "clarificationQuestions", "conflicts", "labs", "medications", "patient"]);
    expect(JSON.stringify(payload)).not.toContain(sentinel);
    expect(JSON.stringify(payload)).not.toContain(record.labs[0].source.snippet);
    expect(payload.labs[0]).toEqual(expect.objectContaining({ name: record.labs[0].normalizedName, value: record.labs[0].value, status: record.labs[0].status }));
    expect(Object.keys(payload.labs[0]).sort()).toEqual(["name", "referenceRange", "status", "unit", "value"]);
  });

  it("returns a controlled unavailable result when GEMINI_API_KEY is absent", async () => {
    const original = process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY;
    await expect(generateReviewSummary(request)).resolves.toBeNull();
    if (original) process.env.GEMINI_API_KEY = original;
  });

  it("accepts bounded valid structured Gemini output", async () => {
    const result = await generateReviewSummary(request, async () => validOutput);
    expect(result).toEqual(reviewSummarySchema.parse(JSON.parse(validOutput)));
  });

  it.each(["not json", JSON.stringify({ summary: "Missing required fields" }), JSON.stringify({ summary: "Unexpected fields", reviewPriorities: [], clarificationQuestions: [], disclaimer: REVIEW_SUMMARY_DISCLAIMER, extra: true }), JSON.stringify({ summary: "Wrong disclaimer", reviewPriorities: [], clarificationQuestions: [], disclaimer: "Not the required disclaimer" }), JSON.stringify({ summary: "Too long", reviewPriorities: Array.from({ length: 6 }, () => "priority"), clarificationQuestions: [], disclaimer: REVIEW_SUMMARY_DISCLAIMER }), JSON.stringify({ summary: "x".repeat(1201), reviewPriorities: [], clarificationQuestions: [], disclaimer: REVIEW_SUMMARY_DISCLAIMER })])("rejects malformed, unexpected, or bounded-invalid model output", async (output) => {
    await expect(generateReviewSummary(request, async () => output)).resolves.toBeNull();
  });

  it("does not treat non-string model output as safe text", () => {
    expect(parseReviewSummary({ summary: "not text" })).toBeNull();
  });

  it("rejects malformed and oversized API requests without echoing body content", async () => {
    const malformed = `{"marker":"${sentinel}"`;
    const malformedResponse = await handleReviewSummaryRequest(new Request("http://localhost/api/review-summary", { method: "POST", headers: { "content-type": "application/json" }, body: malformed }));
    expect(malformedResponse.status).toBe(400);
    expect(JSON.stringify(await malformedResponse.json())).not.toContain(sentinel);
    const oversized = "x".repeat(MAX_REVIEW_SUMMARY_BODY_BYTES + 1);
    const oversizedResponse = await handleReviewSummaryRequest(new Request("http://localhost/api/review-summary", { method: "POST", headers: { "content-type": "application/json" }, body: oversized }));
    expect(oversizedResponse.status).toBe(413);
  });

  it("returns safe validated output from the API route", async () => {
    const response = await handleReviewSummaryRequest(new Request("http://localhost/api/review-summary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) }), async () => reviewSummarySchema.parse(JSON.parse(validOutput)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(reviewSummarySchema.parse(JSON.parse(validOutput)));
  });
});
