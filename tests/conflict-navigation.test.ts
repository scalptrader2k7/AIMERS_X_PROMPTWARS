import { describe, expect, it } from "vitest";
import { getConflictNavigationTarget } from "../lib/conflict-navigation";

describe("conflict navigation targets", () => {
  it("maps allergy conflicts to fixed safe profile and evidence IDs", () => {
    expect(getConflictNavigationTarget({ category: "allergy" })).toEqual({ category: "allergy", profileId: "profile-allergies", evidenceId: "conflict-evidence-allergy", profileLabel: "Allergies" });
  });

  it("maps medication conflicts to fixed safe profile and evidence IDs", () => {
    expect(getConflictNavigationTarget({ category: "medication" })).toEqual({ category: "medication", profileId: "profile-medications", evidenceId: "conflict-evidence-medication", profileLabel: "Medications" });
  });

  it("returns no target for an unsupported category", () => {
    expect(getConflictNavigationTarget({ category: "demographic" })).toBeNull();
  });
});
