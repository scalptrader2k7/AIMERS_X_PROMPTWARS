import { z } from "zod";

export const provenanceSchema = z.enum([
  "patient_provided",
  "ai_extracted",
  "ai_generated",
  "user_verified",
]);
export type Provenance = z.infer<typeof provenanceSchema>;

export const confidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof confidenceSchema>;

export const verificationStateSchema = z.enum(["needs_review", "verified"]);
export type VerificationState = z.infer<typeof verificationStateSchema>;

export const labStatusSchema = z.enum(["low", "normal", "high", "not_assessed"]);
export type LabStatus = z.infer<typeof labStatusSchema>;

export const recordSourceTypeSchema = z.enum(["ai_processed", "synthetic_demo"]);
export type RecordSourceType = z.infer<typeof recordSourceTypeSchema>;

const compactText = (max: number) => z.string().trim().min(1).max(max);

export const patientIntakeSchema = z.object({
  // This is an input-validity bound, not a clinical assessment or age-based rule.
  age: z.coerce.number().int().min(0).max(130),
  sex: z.enum(["female", "male", "intersex", "prefer_not_to_say", "not_specified"]),
  symptoms: compactText(2000),
  existingConditions: compactText(2000),
  allergies: compactText(2000),
  medications: compactText(2000),
  notes: z.string().trim().max(4000),
});
export type PatientIntake = z.infer<typeof patientIntakeSchema>;

export const sourceReferenceSchema = z.object({
  snippet: compactText(600),
  reportDate: z.string().trim().max(80).nullable(),
});
export type SourceReference = z.infer<typeof sourceReferenceSchema>;

export const labResultSchema = z.object({
  id: compactText(120),
  testName: compactText(200),
  reportedName: compactText(200),
  normalizedName: compactText(200),
  normalizationMethod: z.enum(["known_alias", "source_preserved"]),
  value: z.union([z.number(), compactText(120)]),
  unit: z.string().trim().max(80).nullable(),
  referenceRange: z.string().trim().max(160).nullable(),
  status: labStatusSchema,
  confidence: confidenceSchema,
  provenance: provenanceSchema,
  sourceType: provenanceSchema,
  verificationState: verificationStateSchema,
  verifiedAt: z.string().datetime().nullable().optional(),
  source: sourceReferenceSchema,
});
export type LabResult = z.infer<typeof labResultSchema>;

export const observationSchema = z.object({
  id: compactText(120),
  text: compactText(1000),
  confidence: confidenceSchema,
  provenance: provenanceSchema,
  sourceType: provenanceSchema,
  verificationState: verificationStateSchema,
  verifiedAt: z.string().datetime().nullable().optional(),
  source: sourceReferenceSchema,
});
export type Observation = z.infer<typeof observationSchema>;

export const safeSummarySchema = z.object({
  text: compactText(1600),
  provenance: z.literal("ai_generated"),
  sourceType: z.literal("ai_generated"),
  verificationState: verificationStateSchema,
});
export type SafeSummary = z.infer<typeof safeSummarySchema>;

export const medicalRecordSchema = z.object({
  schemaVersion: z.literal("1.0"),
  createdAt: z.string().datetime(),
  processedAt: z.string().datetime(),
  isSyntheticDemo: z.boolean(),
  sourceType: recordSourceTypeSchema,
  patient: patientIntakeSchema,
  labs: z.array(labResultSchema).max(100),
  observations: z.array(observationSchema).max(100),
  summary: safeSummarySchema,
});
export type MedicalRecord = z.infer<typeof medicalRecordSchema>;

export const extractionRequestSchema = z.object({
  patient: patientIntakeSchema,
  reportText: compactText(20_000),
  isSyntheticDemo: z.boolean(),
});
export type ExtractionRequest = z.infer<typeof extractionRequestSchema>;

export const fallbackReasonSchema = z.enum(["no_api_key", "api_unavailable", "invalid_ai_response", "demo_mode"]);
export type FallbackReason = z.infer<typeof fallbackReasonSchema>;

export const extractionResponseSchema = z.object({
  record: medicalRecordSchema,
  processing: z.object({
    mode: z.enum(["ai", "synthetic_fallback"]),
    fallbackReason: fallbackReasonSchema.optional(),
    notice: compactText(400),
  }),
});
export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;
