import { describe, expect, it } from "vitest";
import { generateClarificationQuestions } from "../lib/clarification-questions";
import { detectConflicts } from "../lib/conflict-detection";
import { demoPatient, demoReport } from "../lib/demo-data";
import { createFallbackRecord } from "../lib/fallback-record";
import { normalizeLabName } from "../lib/normalization";

const record = () => createFallbackRecord({ patient: demoPatient, reportText: demoReport, isSyntheticDemo: true }, "demo_mode", new Date("2026-09-05T00:00:00.000Z"));

describe("deterministic data quality utilities", () => {
  it("normalizes only the declared aliases and preserves unknown source terms", () => {
    for (const alias of ["Hb", "HGB", "Haemoglobin"]) expect(normalizeLabName(alias)).toMatchObject({ normalizedName: "Hemoglobin", normalizationMethod: "known_alias" });
    for (const alias of ["WBC", "White Blood Cells"]) expect(normalizeLabName(alias).normalizedName).toBe("White Blood Cell Count");
    for (const alias of ["RBC", "Red Blood Cells"]) expect(normalizeLabName(alias).normalizedName).toBe("Red Blood Cell Count");
    for (const alias of ["PLT", "Platelets"]) expect(normalizeLabName(alias).normalizedName).toBe("Platelet Count");
    expect(normalizeLabName("Ferritin")).toEqual({ reportedName: "Ferritin", normalizedName: "Ferritin", normalizationMethod: "source_preserved" });
  });

  it("flags only explicit, comparable allergy and medication mismatches", () => {
    const allergy = record(); allergy.observations.push({ id: "a", text: "Allergies: latex", confidence: "high", provenance: "ai_extracted", sourceType: "ai_extracted", verificationState: "needs_review", source: { snippet: "Allergies: latex", reportDate: null } });
    expect(detectConflicts(allergy)).toHaveLength(1);
    const medication = record(); medication.patient.medications = "ibuprofen"; medication.observations.push({ id: "m", text: "Medications: aspirin", confidence: "high", provenance: "ai_extracted", sourceType: "ai_extracted", verificationState: "needs_review", source: { snippet: "Medications: aspirin", reportDate: null } });
    expect(detectConflicts(medication)).toHaveLength(1);
    const matching = record(); matching.observations.push({ id: "same", text: "Allergies: Pollen.", confidence: "high", provenance: "ai_extracted", sourceType: "ai_extracted", verificationState: "needs_review", source: { snippet: "Allergies: Pollen.", reportDate: null } });
    expect(detectConflicts(matching)).toHaveLength(0);
    const ambiguous = record(); ambiguous.patient.allergies = "None reported"; ambiguous.observations.push({ id: "unknown", text: "Allergies: unknown", confidence: "low", provenance: "ai_extracted", sourceType: "ai_extracted", verificationState: "needs_review", source: { snippet: "Allergies: unknown", reportDate: null } });
    expect(detectConflicts(ambiguous)).toHaveLength(0);
  });

  it("prioritizes safe clarification questions, avoids duplicates, caps at five, and can return none", () => {
    const questions = generateClarificationQuestions(record());
    expect(questions[0].id).toBe("range-demo-vitamin-b12");
    expect(questions).toHaveLength(1);
    const incomplete = record(); incomplete.labs = incomplete.labs.map((lab) => ({ ...lab, source: { ...lab.source, reportDate: null }, referenceRange: null, unit: null })); incomplete.patient.allergies = ""; incomplete.patient.medications = ""; incomplete.patient.existingConditions = ""; incomplete.patient.symptoms = "headache";
    expect(generateClarificationQuestions(incomplete)).toHaveLength(5);
    const complete = record(); complete.labs = complete.labs.filter((lab) => lab.referenceRange); complete.patient.medications = "Cetirizine"; expect(generateClarificationQuestions(complete)).toHaveLength(0);
  });
});
