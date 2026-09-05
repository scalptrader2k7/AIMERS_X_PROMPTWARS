import type { PatientIntake } from "@/lib/medical-record";

export const demoPatient: PatientIntake = {
  age: 42,
  sex: "female",
  symptoms: "Tiredness and occasional headache for the past week.",
  existingConditions: "Seasonal allergies.",
  allergies: "Pollen.",
  medications: "No regular medications reported.",
  notes: "Synthetic information prepared for a MedLens demonstration.",
};

export const demoReport = `SYNTHETIC DEMO REPORT — NOT A REAL PATIENT RECORD
Report date: 2026-09-05

Complete blood count excerpt
Hemoglobin: 10.8 g/dL (Reference range: 12.0 - 15.5 g/dL)
White blood cell count: 6.4 x10^9/L (Reference range: 4.0 - 11.0 x10^9/L)
Vitamin B12: 315 pg/mL

Observation: Sample received in suitable condition. Results are presented for review with the supplied report.`;
