export type NormalizationMethod = "known_alias" | "source_preserved";
export type NormalizedLabName = { reportedName: string; normalizedName: string; normalizationMethod: NormalizationMethod };

const aliases: Record<string, string> = {
  hb: "Hemoglobin", hgb: "Hemoglobin", haemoglobin: "Hemoglobin",
  wbc: "White Blood Cell Count", "white blood cells": "White Blood Cell Count",
  rbc: "Red Blood Cell Count", "red blood cells": "Red Blood Cell Count",
  plt: "Platelet Count", platelets: "Platelet Count",
  glucose: "Glucose", "blood glucose": "Glucose",
};

export function normalizeLabName(reportedName: string): NormalizedLabName {
  const source = reportedName.trim(); const normalizedName = aliases[source.toLowerCase()];
  return normalizedName ? { reportedName: source, normalizedName, normalizationMethod: "known_alias" } : { reportedName: source, normalizedName: source, normalizationMethod: "source_preserved" };
}
