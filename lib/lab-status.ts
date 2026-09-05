import type { LabStatus } from "@/lib/medical-record";

/**
 * Classifies a numeric result strictly against the numeric interval supplied by
 * the source report. It deliberately does not use external medical knowledge.
 */
export function classifyLabStatus(value: number | string | null | undefined, referenceRange: string | null | undefined): LabStatus {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue) || !referenceRange) return "not_assessed";

  // A unit may follow the upper bound (for example, "12.0 - 15.5 g/dL").
  // Only the explicitly printed numeric interval is assessed.
  const match = referenceRange.trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)(?:\s+\S.*)?\s*$/i);
  if (!match) return "not_assessed";

  const lower = Number(match[1]);
  const upper = Number(match[2]);
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper) return "not_assessed";
  if (numericValue < lower) return "low";
  if (numericValue > upper) return "high";
  return "normal";
}
