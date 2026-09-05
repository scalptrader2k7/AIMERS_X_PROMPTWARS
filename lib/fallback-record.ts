import { demoReport } from "@/lib/demo-data";
import { classifyLabStatus } from "@/lib/lab-status";
import { normalizeLabName } from "@/lib/normalization";
import type { ExtractionRequest, FallbackReason, MedicalRecord } from "@/lib/medical-record";

/** A no-network, schema-valid record used when live processing is unavailable. */
export function createFallbackRecord(request: ExtractionRequest, reason: FallbackReason, now = new Date()): MedicalRecord {
  const timestamp = now.toISOString();
  const reportDate = "2026-09-05";
  const hemoglobinRange = "12.0 - 15.5 g/dL";
  const whiteCellRange = "4.0 - 11.0 x10^9/L";

  return {
    schemaVersion: "1.0",
    createdAt: timestamp,
    processedAt: timestamp,
    isSyntheticDemo: true,
    sourceType: "synthetic_demo",
    patient: { ...request.patient },
    labs: [
      {
        id: "demo-hemoglobin",
        testName: "Hemoglobin",
        ...normalizeLabName("Hemoglobin"),
        value: 10.8,
        unit: "g/dL",
        referenceRange: hemoglobinRange,
        status: classifyLabStatus(10.8, hemoglobinRange),
        confidence: "high",
        provenance: "ai_extracted",
        sourceType: "ai_extracted",
        verificationState: "needs_review",
        source: { snippet: "Hemoglobin: 10.8 g/dL (Reference range: 12.0 - 15.5 g/dL)", reportDate },
      },
      {
        id: "demo-white-blood-cell-count",
        testName: "White blood cell count",
        ...normalizeLabName("White blood cell count"),
        value: 6.4,
        unit: "x10^9/L",
        referenceRange: whiteCellRange,
        status: classifyLabStatus(6.4, whiteCellRange),
        confidence: "high",
        provenance: "ai_extracted",
        sourceType: "ai_extracted",
        verificationState: "needs_review",
        source: { snippet: "White blood cell count: 6.4 x10^9/L (Reference range: 4.0 - 11.0 x10^9/L)", reportDate },
      },
      {
        id: "demo-vitamin-b12",
        testName: "Vitamin B12",
        ...normalizeLabName("Vitamin B12"),
        value: 315,
        unit: "pg/mL",
        referenceRange: null,
        status: classifyLabStatus(315, null),
        confidence: "high",
        provenance: "ai_extracted",
        sourceType: "ai_extracted",
        verificationState: "needs_review",
        source: { snippet: "Vitamin B12: 315 pg/mL", reportDate },
      },
    ],
    observations: [
      {
        id: "demo-observation-1",
        text: "Sample received in suitable condition.",
        confidence: "high",
        provenance: "ai_extracted",
        sourceType: "ai_extracted",
        verificationState: "needs_review",
        source: { snippet: "Observation: Sample received in suitable condition.", reportDate },
      },
    ],
    summary: {
      text: `Synthetic demo record: supplied report values have been organized for review. The report includes two stated reference ranges and one value without a supplied range. This is an information-organizing summary, not medical advice or a diagnosis.`,
      provenance: "ai_generated",
      sourceType: "ai_generated",
      verificationState: "needs_review",
    },
  };
}

export const FALLBACK_REPORT_SOURCE = demoReport;
