import { describe, expect, it } from "vitest";
import { handleExtractionRequest, POST } from "../app/api/extract/route";
import { demoPatient, demoReport } from "../lib/demo-data";
import { processExtraction } from "../lib/extraction";
import { createFallbackRecord } from "../lib/fallback-record";
import { classifyLabStatus } from "../lib/lab-status";
import { extractionRequestSchema, medicalRecordSchema } from "../lib/medical-record";

const validRequest = { patient: demoPatient, reportText: demoReport, isSyntheticDemo: true };

describe("safe extraction processing", () => {
  it("accepts a valid request shape", () => {
    expect(extractionRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("returns a safe 400 response for invalid request data", async () => {
    const response = await POST(new Request("http://localhost/api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reportText: "" }) }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Check the patient details and report text, then try again." });
  });

  it("rejects a non-JSON request without echoing its body", async () => {
    const requestContent = "SYNTHETIC_NON_JSON_CONTENT_MUST_NOT_BE_ECHOED";
    const response = await POST(new Request("http://localhost/api/extract", { method: "POST", headers: { "content-type": "text/plain" }, body: requestContent }));
    const payload = await response.json();
    expect(response.status).toBe(415);
    expect(payload).toEqual({ error: "Send a JSON request to create a structured record." });
    expect(JSON.stringify(payload)).not.toContain(requestContent);
  });

  it("rejects malformed JSON without echoing the payload", async () => {
    const requestContent = '{"synthetic":"SYNTHETIC_MALFORMED_CONTENT_MUST_NOT_BE_ECHOED"';
    const response = await POST(new Request("http://localhost/api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: requestContent }));
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: "The request body must contain valid JSON." });
    expect(JSON.stringify(payload)).not.toContain("SYNTHETIC_MALFORMED_CONTENT_MUST_NOT_BE_ECHOED");
  });

  it("rejects an oversized report before invoking processing", async () => {
    let processingCalls = 0;
    const reportText = "x".repeat(20_001);
    const response = await handleExtractionRequest(
      new Request("http://localhost/api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ patient: demoPatient, reportText, isSyntheticDemo: true }) }),
      async () => { processingCalls += 1; throw new Error("Processing must not run for rejected input."); },
    );
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: "Check the patient details and report text, then try again." });
    expect(processingCalls).toBe(0);
    expect(JSON.stringify(payload)).not.toContain(reportText);
  });

  it("uses a valid synthetic fallback when no API key is available", async () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const response = await processExtraction(validRequest);
    if (original) process.env.OPENAI_API_KEY = original;
    expect(response.processing).toMatchObject({ mode: "synthetic_fallback", fallbackReason: "no_api_key" });
    expect(medicalRecordSchema.safeParse(response.record).success).toBe(true);
  });

  it("derives fallback lab statuses from source-provided ranges", () => {
    const record = createFallbackRecord(validRequest, "demo_mode", new Date("2026-09-05T00:00:00.000Z"));
    expect(record.labs[0].status).toBe(classifyLabStatus(record.labs[0].value, record.labs[0].referenceRange));
    expect(record.labs[1].status).toBe(classifyLabStatus(record.labs[1].value, record.labs[1].referenceRange));
    expect(record.labs[2].status).toBe("not_assessed");
  });

  it("safely falls back when provider output is malformed", async () => {
    const response = await processExtraction(validRequest, async () => ({ labs: "not an array" }));
    expect(response.processing).toMatchObject({ mode: "synthetic_fallback", fallbackReason: "invalid_ai_response" });
  });

  it("safely falls back when a provider fails without exposing details", async () => {
    const response = await processExtraction(validRequest, async () => { throw new Error("provider detail that must not reach a user"); });
    expect(response.processing).toMatchObject({ mode: "synthetic_fallback", fallbackReason: "api_unavailable" });
    expect(response.processing.notice).not.toContain("provider detail");
  });
});
