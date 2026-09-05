import { classifyLabStatus } from "@/lib/lab-status";
import type { MedicalRecord } from "@/lib/medical-record";
export type ClarificationQuestion = { id: string; question: string; reason: string; relatedField: string };
const missing = (value: string) => !value.trim() || /^(none reported|not provided|unknown|n\/a)$/i.test(value.trim());
export function generateClarificationQuestions(record: MedicalRecord): ClarificationQuestion[] {
  const questions: ClarificationQuestion[] = []; const add = (item: ClarificationQuestion) => { if (questions.length < 5 && !questions.some((question) => question.id === item.id)) questions.push(item); };
  if (!record.labs.some((lab) => lab.source.reportDate)) add({ id: "report-date", question: "What date is shown on the source report?", reason: "Reason: No source-provided report date was retained.", relatedField: "Source report date" });
  for (const lab of record.labs) if (classifyLabStatus(lab.value, lab.referenceRange) === "not_assessed") add({ id: `range-${lab.id}`, question: `Does the source report state a reference range for ${lab.normalizedName}?`, reason: `Reason: The source report did not include a usable reference range for ${lab.normalizedName}.`, relatedField: lab.normalizedName });
  for (const lab of record.labs) if (!lab.unit) add({ id: `unit-${lab.id}`, question: `Does the source report specify a unit for ${lab.normalizedName}?`, reason: `Reason: The source report did not include a unit for ${lab.normalizedName}.`, relatedField: lab.normalizedName });
  if (missing(record.patient.allergies)) add({ id: "allergies", question: "Are there any known allergies to include for review?", reason: "Reason: No allergies were included in the intake.", relatedField: "Allergies" });
  if (missing(record.patient.medications)) add({ id: "medications", question: "Are there any current medications to include for review?", reason: "Reason: No medications were included in the intake.", relatedField: "Medications" });
  if (missing(record.patient.existingConditions)) add({ id: "conditions", question: "Are there existing conditions or relevant history to include?", reason: "Reason: No existing conditions were included in the intake.", relatedField: "Existing conditions" });
  if (record.patient.symptoms.trim() && !/\b(day|days|week|weeks|month|months|year|years|since|began|started)\b/i.test(record.patient.symptoms)) { add({ id: "symptom-duration", question: "When did the reported symptom begin?", reason: "Reason: Symptoms were included without a duration.", relatedField: "Symptoms" }); add({ id: "symptom-frequency", question: "How often does the reported symptom occur?", reason: "Reason: Symptoms were included without frequency information.", relatedField: "Symptoms" }); }
  return questions;
}
