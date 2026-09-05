import type { MedicalRecord } from "@/lib/medical-record";

export type RecordConflict = { id: string; category: "allergy" | "medication" | "demographic"; status: "possible_conflict"; intakeValue: string; reportValue: string; intakeSourceLabel: "Patient-provided"; reportSourceLabel: "AI-extracted"; message: "Possible information inconsistency — please review the sources." };
const absent = (value: string) => !value.trim() || /^(none reported|none|unknown|not provided|n\/a|no regular medications reported\.)$/i.test(value.trim());
const canonical = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
function explicitObservation(record: MedicalRecord, name: "allergies" | "medications"): string | null { const pattern = new RegExp(`^\\s*${name}\\s*:\\s*(.+)$`, "im"); for (const item of record.observations) { const found = item.text.match(pattern); if (found) return found[1].trim(); } return null; }
export function detectConflicts(record: MedicalRecord): RecordConflict[] {
  const pairs: Array<["allergy" | "medication", string, string | null]> = [["allergy", record.patient.allergies, explicitObservation(record, "allergies")], ["medication", record.patient.medications, explicitObservation(record, "medications")]];
  return pairs.flatMap(([category, intakeValue, reportValue]) => !reportValue || absent(intakeValue) || absent(reportValue) || canonical(intakeValue) === canonical(reportValue) ? [] : [{ id: `${category}-${canonical(intakeValue)}-${canonical(reportValue)}`, category, status: "possible_conflict" as const, intakeValue, reportValue, intakeSourceLabel: "Patient-provided" as const, reportSourceLabel: "AI-extracted" as const, message: "Possible information inconsistency — please review the sources." }]);
}
