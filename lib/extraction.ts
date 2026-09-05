import OpenAI from "openai";
import { z } from "zod";
import { createFallbackRecord } from "@/lib/fallback-record";
import { classifyLabStatus } from "@/lib/lab-status";
import { normalizeLabName } from "@/lib/normalization";
import { extractionResponseSchema, type ExtractionRequest, type ExtractionResponse, type FallbackReason, type MedicalRecord } from "@/lib/medical-record";

export const MEDLENS_EXTRACTION_SYSTEM_PROMPT = `You are a medical-information extraction assistant for MedLens. Extract and organize only information directly supported by the supplied patient intake and report text.

Do not diagnose, infer a disease, estimate risk, recommend treatment, recommend medication, recommend dosage changes, suggest emergency action, or provide clinical advice. Do not invent facts, values, units, dates, observations, medications, conditions, allergies, or reference ranges.

For every report-extracted item, preserve the exact reported value where possible; include test name, value, unit if present, report date if present, reference range exactly as stated if present, observation if present, and a short source snippet. Label report-extracted items ai_extracted, assign conservative high, medium, or low confidence, and set verificationStatus to needs_review.

Reference-range rule: include an assessment-ready referenceRange only when the supplied report explicitly contains it. Never use outside medical knowledge or typical ranges. When a usable range is absent or cannot be parsed, leave it absent and set status to not_assessed. The final low/normal/high status is computed locally and must not be invented.

Summary rule: produce a short plain-language summary that only restates available source facts, says values are organized for review, contains a limitation statement, and contains no diagnostic or treatment language. Return only data matching the required structured schema.`;

const modelLabSchema = z.object({
  testName: z.string().trim().min(1).max(200),
  value: z.union([z.number(), z.string().trim().min(1).max(120)]),
  unit: z.string().trim().max(80).nullable(),
  referenceRange: z.string().trim().max(160).nullable(),
  reportDate: z.string().trim().max(80).nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  sourceSnippet: z.string().trim().min(1).max(600),
});

export const modelExtractionSchema = z.object({
  labs: z.array(modelLabSchema).max(100),
  observations: z.array(z.object({
    text: z.string().trim().min(1).max(1000),
    confidence: z.enum(["high", "medium", "low"]),
    reportDate: z.string().trim().max(80).nullable(),
    sourceSnippet: z.string().trim().min(1).max(600),
  })).max(100),
  summary: z.string().trim().min(1).max(1600),
});
type ModelExtraction = z.infer<typeof modelExtractionSchema>;

const structuredOutputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    labs: { type: "array", items: { type: "object", additionalProperties: false, properties: { testName: { type: "string" }, value: { anyOf: [{ type: "number" }, { type: "string" }] }, unit: { anyOf: [{ type: "string" }, { type: "null" }] }, referenceRange: { anyOf: [{ type: "string" }, { type: "null" }] }, reportDate: { anyOf: [{ type: "string" }, { type: "null" }] }, confidence: { type: "string", enum: ["high", "medium", "low"] }, sourceSnippet: { type: "string" } }, required: ["testName", "value", "unit", "referenceRange", "reportDate", "confidence", "sourceSnippet"] } },
    observations: { type: "array", items: { type: "object", additionalProperties: false, properties: { text: { type: "string" }, confidence: { type: "string", enum: ["high", "medium", "low"] }, reportDate: { anyOf: [{ type: "string" }, { type: "null" }] }, sourceSnippet: { type: "string" } }, required: ["text", "confidence", "reportDate", "sourceSnippet"] } },
    summary: { type: "string" },
  },
  required: ["labs", "observations", "summary"],
} as const;

type Provider = (request: ExtractionRequest) => Promise<unknown>;

function isSafeSummary(text: string): boolean {
  return !/\b(diagnos(?:is|e)|disease|treat(?:ment)?|medication|dosage|emergency|recommend|clinical advice)\b/i.test(text);
}

function sourceIsSupported(sourceText: string, reportText: string): boolean {
  return sourceText.length > 4 && reportText.includes(sourceText);
}

function buildRecordFromModel(extraction: ModelExtraction, request: ExtractionRequest, now = new Date()): MedicalRecord | null {
  if (!isSafeSummary(extraction.summary)) return null;
  const timestamp = now.toISOString();
  const labs = extraction.labs.map((lab, index) => {
    if (!sourceIsSupported(lab.sourceSnippet, request.reportText)) return null;
    const range = lab.referenceRange && request.reportText.includes(lab.referenceRange) ? lab.referenceRange : null;
    return {
      id: `lab-${index + 1}`,
      testName: normalizeLabName(lab.testName).normalizedName,
      ...normalizeLabName(lab.testName),
      value: lab.value,
      unit: lab.unit,
      referenceRange: range,
      status: classifyLabStatus(lab.value, range),
      confidence: lab.confidence,
      provenance: "ai_extracted" as const,
      sourceType: "ai_extracted" as const,
      verificationState: "needs_review" as const,
      source: { snippet: lab.sourceSnippet, reportDate: lab.reportDate },
    };
  });
  const observations = extraction.observations.map((observation, index) => {
    if (!sourceIsSupported(observation.sourceSnippet, request.reportText)) return null;
    return { id: `observation-${index + 1}`, text: observation.text, confidence: observation.confidence, provenance: "ai_extracted" as const, sourceType: "ai_extracted" as const, verificationState: "needs_review" as const, source: { snippet: observation.sourceSnippet, reportDate: observation.reportDate } };
  });
  if (labs.some((lab) => lab === null) || observations.some((observation) => observation === null)) return null;
  return {
    schemaVersion: "1.0",
    createdAt: timestamp,
    processedAt: timestamp,
    isSyntheticDemo: request.isSyntheticDemo,
    sourceType: "ai_processed",
    patient: request.patient,
    labs: labs as NonNullable<typeof labs[number]>[],
    observations: observations as NonNullable<typeof observations[number]>[],
    summary: { text: `${extraction.summary} Information is organized for review; it is not medical advice or a diagnosis.`, provenance: "ai_generated", sourceType: "ai_generated", verificationState: "needs_review" },
  };
}

async function callOpenAI(request: ExtractionRequest): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("no_api_key");
  const client = new OpenAI({ apiKey, timeout: 12_000, maxRetries: 0 });
  const response = await client.responses.create({
    model: "gpt-4o-mini",
    store: false,
    instructions: MEDLENS_EXTRACTION_SYSTEM_PROMPT,
    input: JSON.stringify({ patient: request.patient, reportText: request.reportText, isSyntheticDemo: request.isSyntheticDemo }),
    text: { format: { type: "json_schema", name: "medlens_extraction", strict: true, schema: structuredOutputSchema } },
  });
  return JSON.parse(response.output_text);
}

export async function processExtraction(request: ExtractionRequest, provider: Provider = callOpenAI): Promise<ExtractionResponse> {
  if (!process.env.OPENAI_API_KEY && provider === callOpenAI) return fallback(request, "no_api_key");
  try {
    const raw = await provider(request);
    const parsed = modelExtractionSchema.safeParse(raw);
    if (!parsed.success) return fallback(request, "invalid_ai_response");
    const record = buildRecordFromModel(parsed.data, request);
    if (!record) return fallback(request, "invalid_ai_response");
    const response = { record, processing: { mode: "ai" as const, notice: "Structured record created from the supplied report. Every extracted item needs review." } };
    return extractionResponseSchema.parse(response);
  } catch (error) {
    const reason: FallbackReason = error instanceof Error && error.message === "no_api_key" ? "no_api_key" : "api_unavailable";
    return fallback(request, reason);
  }
}

function fallback(request: ExtractionRequest, reason: FallbackReason): ExtractionResponse {
  return extractionResponseSchema.parse({
    record: createFallbackRecord(request, reason),
    processing: { mode: "synthetic_fallback", fallbackReason: reason, notice: "Synthetic demo record — live AI processing unavailable. All items still need human review." },
  });
}
