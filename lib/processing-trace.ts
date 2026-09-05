import { classifyLabStatus } from "@/lib/lab-status";
import type { ExtractionResponse, MedicalRecord } from "@/lib/medical-record";

export type ProcessingTraceStage = {
  id: "intake" | "report" | "record" | "validation" | "ranges" | "review" | "human_review";
  title: string;
  status: "Complete" | "Active session" | "Synthetic fallback" | "Needs review" | "Available";
  symbol: "✓" | "!";
  evidence: string;
};

export type ProcessingTraceInput = {
  record: MedicalRecord;
  processing: ExtractionResponse["processing"];
  possibleConflictCount: number;
  clarificationQuestionCount: number;
};

function itemLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildProcessingTrace({ record, processing, possibleConflictCount, clarificationQuestionCount }: ProcessingTraceInput): ProcessingTraceStage[] {
  const usableRangeCount = record.labs.filter((lab) => classifyLabStatus(lab.value, lab.referenceRange) !== "not_assessed").length;
  const hasAllSourcedRanges = record.labs.length > 0 && usableRangeCount === record.labs.length;
  const hasNoSourcedRanges = usableRangeCount === 0;
  const hasReviewItems = possibleConflictCount > 0 || clarificationQuestionCount > 0;

  return [
    { id: "intake", title: "Intake captured", status: "Complete", symbol: "✓", evidence: "User-provided patient context is included in this record." },
    { id: "report", title: "Report received", status: "Active session", symbol: "✓", evidence: "Report text is used for the active session and is not included in local persistence or JSON exports." },
    {
      id: "record",
      title: "Structured record created",
      status: processing.mode === "synthetic_fallback" ? "Synthetic fallback" : "Complete",
      symbol: processing.mode === "synthetic_fallback" ? "!" : "✓",
      evidence: processing.mode === "synthetic_fallback"
        ? "A clearly labelled deterministic synthetic demo record was used because live AI processing was unavailable."
        : "A structured record was created from the submitted report through the server-side processing workflow.",
    },
    { id: "validation", title: "Validation and normalization", status: "Complete", symbol: "✓", evidence: "Schema validation and deterministic label normalization are applied before review." },
    {
      id: "ranges",
      title: "Reference range analysis",
      status: hasAllSourcedRanges ? "Complete" : "Needs review",
      symbol: hasAllSourcedRanges ? "✓" : "!",
      evidence: hasAllSourcedRanges
        ? "Statuses are based only on reference ranges available in the source report."
        : hasNoSourcedRanges
          ? "No usable source-provided reference range is available for one or more results; those results are not assessed from an invented range."
          : "Statuses are based only on available source-provided reference ranges. One or more results have no usable source-provided range and are not assessed from an invented range.",
    },
    {
      id: "review",
      title: "Review items surfaced",
      status: hasReviewItems ? "Needs review" : "Complete",
      symbol: hasReviewItems ? "!" : "✓",
      evidence: `${itemLabel(possibleConflictCount, "possible inconsistency", "possible inconsistencies")} and ${itemLabel(clarificationQuestionCount, "clarification question", "clarification questions")} are available for review.`,
    },
    { id: "human_review", title: "Human review available", status: "Available", symbol: "✓", evidence: "Fields can be reviewed, edited, and marked verified by the user." },
  ];
}
