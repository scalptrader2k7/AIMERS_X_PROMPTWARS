import type { RecordConflict } from "@/lib/conflict-detection";

export type ConflictNavigationTarget = { category: "allergy" | "medication"; profileId: string; evidenceId: string; profileLabel: string };

const targets: Record<"allergy" | "medication", ConflictNavigationTarget> = {
  allergy: { category: "allergy", profileId: "profile-allergies", evidenceId: "conflict-evidence-allergy", profileLabel: "Allergies" },
  medication: { category: "medication", profileId: "profile-medications", evidenceId: "conflict-evidence-medication", profileLabel: "Medications" },
};

export function getConflictNavigationTarget(conflict: Pick<RecordConflict, "category">): ConflictNavigationTarget | null {
  return conflict.category === "allergy" || conflict.category === "medication" ? targets[conflict.category] : null;
}
