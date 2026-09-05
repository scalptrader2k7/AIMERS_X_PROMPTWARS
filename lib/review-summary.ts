import { z } from "zod";
import type { ClarificationQuestion } from "@/lib/clarification-questions";
import type { RecordConflict } from "@/lib/conflict-detection";
import type { MedicalRecord } from "@/lib/medical-record";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max);

export const REVIEW_SUMMARY_DISCLAIMER = "For human review only. This is not a diagnosis or medical advice." as const;

export const reviewSummaryRequestSchema = z.object({
  patient: z.object({ age: z.number().int().min(0).max(130), sex: text(40), symptoms: optionalText(2000), existingConditions: optionalText(2000), notes: optionalText(4000) }).strict(),
  allergies: z.array(text(160)).max(25),
  medications: z.array(text(160)).max(25),
  labs: z.array(z.object({ name: text(200), value: z.union([z.number(), text(120)]), unit: z.string().trim().max(80).nullable(), status: z.enum(["low", "normal", "high", "not_assessed"]), referenceRange: z.string().trim().max(160).nullable() }).strict()).max(100),
  conflicts: z.array(z.object({ title: z.literal("Possible information inconsistency"), category: z.enum(["allergy", "medication", "demographic"]), status: z.literal("possible_conflict") }).strict()).max(10),
  clarificationQuestions: z.array(text(300)).max(5),
}).strict();
export type ReviewSummaryRequest = z.infer<typeof reviewSummaryRequestSchema>;

export const reviewSummarySchema = z.object({
  summary: text(1200),
  reviewPriorities: z.array(text(300)).max(5),
  clarificationQuestions: z.array(text(300)).max(5),
  disclaimer: z.literal(REVIEW_SUMMARY_DISCLAIMER),
}).strict();
export type ReviewSummary = z.infer<typeof reviewSummarySchema>;

function normalizedItems(value: string): string[] {
  return [...new Set(value.split(/[;,\n]/).map((item) => item.trim().toLowerCase()).filter(Boolean))].slice(0, 25);
}

export function buildReviewSummaryRequest(record: MedicalRecord, conflicts: RecordConflict[], questions: ClarificationQuestion[]): ReviewSummaryRequest {
  return reviewSummaryRequestSchema.parse({
    patient: { age: record.patient.age, sex: record.patient.sex, symptoms: record.patient.symptoms, existingConditions: record.patient.existingConditions, notes: record.patient.notes },
    allergies: normalizedItems(record.patient.allergies),
    medications: normalizedItems(record.patient.medications),
    labs: record.labs.map((lab) => ({ name: lab.normalizedName, value: lab.value, unit: lab.unit, status: lab.status, referenceRange: lab.referenceRange })),
    conflicts: conflicts.map((conflict) => ({ title: "Possible information inconsistency", category: conflict.category, status: conflict.status })),
    clarificationQuestions: questions.map((question) => question.question),
  });
}

export function parseReviewSummary(value: unknown): ReviewSummary | null {
  if (typeof value !== "string") return null;
  try { const parsed: unknown = JSON.parse(value); const result = reviewSummarySchema.safeParse(parsed); return result.success ? result.data : null; } catch { return null; }
}
