import { z } from "zod";
import { classifyLabStatus } from "@/lib/lab-status";
import { normalizeLabName } from "@/lib/normalization";
import { fallbackReasonSchema, medicalRecordSchema, patientIntakeSchema, type ExtractionResponse, type LabResult, type MedicalRecord } from "@/lib/medical-record";

export const RECORD_STORAGE_KEY = "medlens.structured-demo-record.v1";

export type StatusRationale = { status: LabResult["status"]; text: string };

function rangeBounds(range: string | null): { lower: string; upper: string } | null {
  if (!range) return null;
  const match = range.match(/^\s*(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)/i);
  return match ? { lower: match[1], upper: match[2] } : null;
}

function displayedValue(value: LabResult["value"]): string { return String(value); }

export function getLabStatusRationale(lab: LabResult): StatusRationale {
  const status = classifyLabStatus(lab.value, lab.referenceRange);
  const unit = lab.unit ? ` ${lab.unit}` : "";
  const bounds = rangeBounds(lab.referenceRange);
  if (status === "low" && bounds) return { status, text: `${displayedValue(lab.value)}${unit} is below the lower limit of ${bounds.lower}${unit} printed in the source report.` };
  if (status === "high" && bounds) return { status, text: `${displayedValue(lab.value)}${unit} is above the upper limit of ${bounds.upper}${unit} printed in the source report.` };
  if (status === "normal" && lab.referenceRange) return { status, text: `${displayedValue(lab.value)}${unit} is within the source-provided range of ${lab.referenceRange}.` };
  return { status: "not_assessed", text: "No usable reference range was found in the source report. MedLens did not assess this result." };
}

export type ReviewMetrics = {
  patientCaptured: number; patientExpected: number; labs: number; labsWithEvidence: number;
  labsWithRanges: number; labsAssessed: number; awaitingReview: number; verified: number; normalizedLabels: number; potentialConflicts: number; clarificationQuestions: number;
};

export function calculateReviewMetrics(record: MedicalRecord, potentialConflicts = 0, clarificationQuestions = 0): ReviewMetrics {
  const patientValues = [record.patient.age, record.patient.sex, record.patient.symptoms, record.patient.existingConditions, record.patient.allergies, record.patient.medications, record.patient.notes];
  const reviewable = [...record.labs, ...record.observations];
  return {
    patientCaptured: patientValues.filter((value) => String(value).trim().length > 0).length,
    patientExpected: patientValues.length,
    labs: record.labs.length,
    labsWithEvidence: record.labs.filter((lab) => Boolean(lab.source.snippet.trim())).length,
    labsWithRanges: record.labs.filter((lab) => classifyLabStatus(lab.value, lab.referenceRange) !== "not_assessed").length,
    labsAssessed: record.labs.filter((lab) => ["low", "normal", "high"].includes(classifyLabStatus(lab.value, lab.referenceRange))).length,
    awaitingReview: reviewable.filter((item) => item.verificationState === "needs_review").length,
    verified: reviewable.filter((item) => item.verificationState === "verified").length,
    normalizedLabels: record.labs.filter((lab) => lab.normalizationMethod === "known_alias").length,
    potentialConflicts,
    clarificationQuestions,
  };
}

export type QualityGate = {
  readyForReview: boolean;
  blockers: string[];
  checks: { intakeComplete: boolean; hasStructuredRecord: boolean; allLabsHaveProvenance: boolean; rangeStatusPolicySatisfied: boolean; needsHumanReview: boolean; safeSummaryPresent: boolean; hasClarificationNeeds: boolean; hasPotentialConflicts: boolean };
};

export function evaluateRecordQuality(record: MedicalRecord | null, attention = { clarifications: 0, conflicts: 0 }): QualityGate {
  const empty = { intakeComplete: false, hasStructuredRecord: false, allLabsHaveProvenance: false, rangeStatusPolicySatisfied: false, needsHumanReview: false, safeSummaryPresent: false, hasClarificationNeeds: false, hasPotentialConflicts: false };
  if (!record) return { readyForReview: false, blockers: ["No structured record is available."], checks: empty };
  const intakeComplete = patientIntakeSchema.safeParse(record.patient).success;
  const allLabsHaveProvenance = record.labs.every((lab) => lab.provenance && lab.source.snippet.trim().length > 0);
  const rangeStatusPolicySatisfied = record.labs.every((lab) => lab.status === classifyLabStatus(lab.value, lab.referenceRange));
  const safeSummaryPresent = Boolean(record.summary.text.trim()) && /not (medical|clinical) advice|not a diagnosis/i.test(record.summary.text);
  const needsHumanReview = [...record.labs, ...record.observations].some((item) => item.verificationState === "needs_review");
  const checks = { intakeComplete, hasStructuredRecord: true, allLabsHaveProvenance, rangeStatusPolicySatisfied, needsHumanReview, safeSummaryPresent, hasClarificationNeeds: attention.clarifications > 0, hasPotentialConflicts: attention.conflicts > 0 };
  const blockers = [!intakeComplete && "Patient information is incomplete.", !allLabsHaveProvenance && "One or more laboratory results lacks source evidence.", !rangeStatusPolicySatisfied && "A laboratory status does not follow the source-range policy.", !safeSummaryPresent && "The required summary limitation is missing."].filter(Boolean) as string[];
  return { readyForReview: blockers.length === 0, blockers, checks };
}

export const labEditSchema = z.object({
  testName: z.string().trim().min(1).max(200),
  value: z.string().trim().min(1).max(120),
  unit: z.string().trim().max(80),
  referenceRange: z.string().trim().max(160),
  reportDate: z.string().trim().max(80),
  sourceSnippet: z.string().trim().min(1).max(600),
});
export type LabEdit = z.infer<typeof labEditSchema>;

export function applyLabEdit(record: MedicalRecord, labId: string, edit: LabEdit): MedicalRecord {
  return { ...record, labs: record.labs.map((lab) => lab.id === labId ? { ...lab, testName: normalizeLabName(edit.testName).normalizedName, ...normalizeLabName(edit.testName), value: edit.value, unit: edit.unit || null, referenceRange: edit.referenceRange || null, status: classifyLabStatus(edit.value, edit.referenceRange || null), source: { snippet: edit.sourceSnippet, reportDate: edit.reportDate || null } } : lab) };
}

export function verifyLab(record: MedicalRecord, labId: string, verifiedAt = new Date().toISOString()): MedicalRecord {
  return { ...record, labs: record.labs.map((lab) => lab.id === labId ? { ...lab, provenance: "user_verified", sourceType: "user_verified", verificationState: "verified", verifiedAt } : lab) };
}

export const reviewActionSchema = z.enum(["record_created", "lab_edited", "lab_verified", "conflict_acknowledged"]);
export type ReviewAction = z.infer<typeof reviewActionSchema>;
export const reviewHistoryEventSchema = z.object({ id: z.string().trim().min(1).max(240), at: z.string().datetime(), action: reviewActionSchema, targetLabel: z.string().trim().min(1).max(200), priorDisplayValue: z.string().trim().min(1).max(200).optional(), updatedDisplayValue: z.string().trim().min(1).max(200).optional(), reviewStateTransition: z.string().trim().min(1).max(120).optional() });
export type ReviewHistoryEvent = z.infer<typeof reviewHistoryEventSchema>;

export function createReviewHistoryEvent(event: Omit<ReviewHistoryEvent, "id" | "at"> & { at?: string; id?: string }): ReviewHistoryEvent {
  const at = event.at ?? new Date().toISOString();
  return reviewHistoryEventSchema.parse({ ...event, at, id: event.id ?? `${event.action}-${at}` });
}

export function sortReviewHistoryNewestFirst(history: ReviewHistoryEvent[]): ReviewHistoryEvent[] { return [...history].sort((left, right) => right.at.localeCompare(left.at)); }

export function reviewActionLabel(action: ReviewAction): string { return ({ record_created: "Record created", lab_edited: "Laboratory result edited", lab_verified: "Laboratory result verified", conflict_acknowledged: "Possible inconsistency acknowledged" })[action]; }

const storedRecordSchema = z.object({ record: medicalRecordSchema, processing: z.object({ mode: z.enum(["ai", "synthetic_fallback"]), fallbackReason: fallbackReasonSchema.optional(), notice: z.string() }), history: z.array(reviewHistoryEventSchema).max(200) });
export type StoredReview = z.infer<typeof storedRecordSchema>;
export function serializeReview(value: StoredReview): string { return JSON.stringify(value); }
export function deserializeReview(value: string | null): StoredReview | null { const parsed = z.string().safeParse(value); if (!parsed.success || !value) return null; const json = (() => { try { return JSON.parse(value); } catch { return null; } })(); return storedRecordSchema.safeParse(json).success ? storedRecordSchema.parse(json) : null; }

export type StructuredRecordExport = {
  record: MedicalRecord;
  processing: ExtractionResponse["processing"];
  exportedAt: string;
};

export function createStructuredRecordExport(
  record: MedicalRecord,
  processing: ExtractionResponse["processing"],
  exportedAt: string,
): StructuredRecordExport {
  return { record, processing, exportedAt };
}
