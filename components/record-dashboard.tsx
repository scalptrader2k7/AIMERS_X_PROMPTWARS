"use client";

import { useMemo, useState } from "react";
import { applyLabEdit, calculateReviewMetrics, createReviewHistoryEvent, createStructuredRecordExport, evaluateRecordQuality, getLabStatusRationale, labEditSchema, reviewActionLabel, sortReviewHistoryNewestFirst, verifyLab, type LabEdit, type ReviewHistoryEvent } from "@/lib/review-utils";
import { detectConflicts } from "@/lib/conflict-detection";
import { generateClarificationQuestions } from "@/lib/clarification-questions";
import { buildProcessingTrace } from "@/lib/processing-trace";
import { getConflictNavigationTarget } from "@/lib/conflict-navigation";
import { buildReviewSummaryRequest, reviewSummarySchema, type ReviewSummary } from "@/lib/review-summary";
import { isAcknowledged, SESSION_ACKNOWLEDGMENT_STATUS, toSessionAcknowledgmentId, toggleAcknowledgment, type SessionAcknowledgmentId } from "@/lib/session-review-acknowledgment";
import type { ExtractionResponse, LabResult, MedicalRecord } from "@/lib/medical-record";

type Props = { record: MedicalRecord; processing: ExtractionResponse["processing"]; reportText: string | null; history: ReviewHistoryEvent[]; onRecordChange: (record: MedicalRecord, event?: ReviewHistoryEvent) => void; onClear: () => void };

const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const detailDate = (record: MedicalRecord) => record.labs.find((lab) => lab.source.reportDate)?.source.reportDate ?? "Not provided";
const editFromLab = (lab: LabResult): LabEdit => ({ testName: lab.testName, value: String(lab.value), unit: lab.unit ?? "", referenceRange: lab.referenceRange ?? "", reportDate: lab.source.reportDate ?? "", sourceSnippet: lab.source.snippet });

export function RecordDashboard({ record, processing, reportText, history, onRecordChange, onClear }: Props) {
  const [selectedId, setSelectedId] = useState(record.labs[0]?.id ?? "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<LabEdit | null>(null);
  const [editError, setEditError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState("");
  const [acknowledgedConflicts, setAcknowledgedConflicts] = useState<Set<SessionAcknowledgmentId>>(new Set());
  const [relatedCategory, setRelatedCategory] = useState<"allergy" | "medication" | null>(null);
  const [aiSummary, setAiSummary] = useState<ReviewSummary | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const selected = record.labs.find((lab) => lab.id === selectedId) ?? record.labs[0];
  const conflicts = useMemo(() => detectConflicts(record), [record]);
  const clarifications = useMemo(() => generateClarificationQuestions(record), [record]);
  const metrics = useMemo(() => calculateReviewMetrics(record, conflicts.length, clarifications.length), [record, conflicts.length, clarifications.length]);
  const quality = useMemo(() => evaluateRecordQuality(record, { conflicts: conflicts.length, clarifications: clarifications.length }), [record, conflicts.length, clarifications.length]);
  const processingTrace = useMemo(() => buildProcessingTrace({ record, processing, possibleConflictCount: conflicts.length, clarificationQuestionCount: clarifications.length }), [record, processing, conflicts.length, clarifications.length]);
  const isFallback = processing.mode === "synthetic_fallback";

  function saveEdit() {
    if (!editingId || !edit) return;
    const parsed = labEditSchema.safeParse(edit);
    if (!parsed.success) { setEditError("Check the edited laboratory fields. A test name, reported value, and source evidence are required."); return; }
    const currentLab = record.labs.find((lab) => lab.id === editingId);
    onRecordChange(applyLabEdit(record, editingId, parsed.data), createReviewHistoryEvent({ action: "lab_edited", targetLabel: currentLab?.testName ?? "Laboratory result", priorDisplayValue: currentLab ? `${currentLab.value}${currentLab.unit ? ` ${currentLab.unit}` : ""}` : undefined, updatedDisplayValue: `${parsed.data.value}${parsed.data.unit ? ` ${parsed.data.unit}` : ""}`, reviewStateTransition: "Needs review" }));
    setEditingId(null); setEdit(null); setEditError(""); setNotice("Laboratory result updated. It still needs human review.");
  }

  function markVerified(lab: LabResult) {
    const timestamp = new Date().toISOString();
    onRecordChange(verifyLab(record, lab.id, timestamp), createReviewHistoryEvent({ at: timestamp, action: "lab_verified", targetLabel: lab.testName, reviewStateTransition: "Needs review → Verified by user" }));
    setNotice(`${lab.testName} marked verified. Verified indicates user review; it does not indicate clinical accuracy.`);
  }

  function exportJson() {
    const payload = createStructuredRecordExport(record, processing, new Date().toISOString());
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "medlens-structured-record.json"; anchor.click(); URL.revokeObjectURL(url);
    setNotice("Structured record JSON download started.");
  }

  function viewRelatedInformation(conflict: (typeof conflicts)[number]) {
    const target = getConflictNavigationTarget(conflict);
    if (!target) { setNotice("Related structured information is not available for this possible inconsistency. Review the displayed sources."); return; }
    setRelatedCategory(target.category);
    setNotice(`Related information highlighted. Focus moved to ${target.profileLabel}; report-derived information is also highlighted.`);
    requestAnimationFrame(() => document.getElementById(target.profileId)?.focus());
  }

  async function generateAiReviewSummary() {
    setIsGeneratingSummary(true); setSummaryError("");
    try {
      const response = await fetch("/api/review-summary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(buildReviewSummaryRequest(record, conflicts, clarifications)) });
      const payload: unknown = await response.json();
      const parsed = reviewSummarySchema.safeParse(payload);
      if (!response.ok || !parsed.success) { setAiSummary(null); setSummaryError("AI review summary is unavailable. The structured record remains available for human review."); return; }
      setAiSummary(parsed.data);
    } catch { setAiSummary(null); setSummaryError("AI review summary is unavailable. The structured record remains available for human review."); }
    finally { setIsGeneratingSummary(false); }
  }

  return <main className="dashboard-shell">
    <header className="record-header">
      <div><a className="brand" href="#record-title"><span className="brand-mark" aria-hidden="true">M</span><span>MedLens</span></a><p className="record-kicker">Structured Medical Record</p><h1 id="record-title">Review the source, then review the record.</h1></div>
      <div className="header-actions"><span className={`mode-badge ${isFallback ? "fallback" : ""}`}>{isFallback ? "Synthetic demo record" : "AI-assisted structured extraction"}</span><p>Report date: {detailDate(record)}</p><span className="review-badge">Needs review</span><button className="quiet-button" type="button" onClick={exportJson}>Export JSON</button><button className="danger-button" type="button" onClick={() => setConfirmClear(true)}>Clear local record</button></div>
    </header>
    <aside className="safety-notice persistent"><strong>Important safety notice</strong><p>MedLens organizes medical information for review and does not provide medical diagnosis, treatment, or emergency guidance. Consult a qualified healthcare professional for medical decisions.</p></aside>
    {isFallback && <p className="fallback-notice" role="status">Synthetic demo record — live AI processing unavailable. It does not claim the demo values were extracted from the text you entered.</p>}
    <section className="processing-details" aria-labelledby="processing-title"><h2 id="processing-title">Processing details</h2><dl><div><dt>Input type</dt><dd>Pasted report text</dd></div><div><dt>Processing method</dt><dd>{isFallback ? "Synthetic fallback" : "AI-assisted structured extraction"}</dd></div><div><dt>Raw report retention</dt><dd>Active browser session only; not saved in localStorage</dd></div></dl></section>
    <p className="sr-only" aria-live="polite">{notice}</p>{notice && <p className="visible-feedback" role="status">{notice}</p>}

    <div className="review-layout">
      <div className="review-main">
        <Profile patient={record.patient} relatedCategory={relatedCategory} />
        <section className="review-section" aria-labelledby="labs-title"><div className="section-heading"><div><h2 id="labs-title">Laboratory results</h2><p>All extracted results remain reviewable. Status is calculated only from a supplied source range.</p></div></div><LabTable labs={record.labs} selectedId={selectedId} onSelect={setSelectedId} onEdit={(lab) => { setEditingId(lab.id); setEdit(editFromLab(lab)); setEditError(""); }} onVerify={markVerified} />
          {editingId && edit && <EditLab edit={edit} onChange={setEdit} error={editError} onSave={saveEdit} onCancel={() => { setEditingId(null); setEdit(null); setEditError(""); }} />}
        </section>
        <section className="review-section" aria-labelledby="observations-title"><h2 id="observations-title">Report observations</h2>{record.observations.length ? <ul className="observation-list">{record.observations.map((item, index) => { const category = observationConflictCategory(item.text); const isPrimaryEvidence = category !== null && record.observations.findIndex((candidate) => observationConflictCategory(candidate.text) === category) === index; return <li key={item.id} id={isPrimaryEvidence ? `conflict-evidence-${category}` : undefined} className={isPrimaryEvidence && category === relatedCategory ? "related-information" : ""} tabIndex={isPrimaryEvidence ? -1 : undefined}>{isPrimaryEvidence && category === relatedCategory && <strong className="related-label">Related information</strong>}<p>{item.text}</p><MetaTags provenance={item.provenance} confidence={item.confidence} state={item.verificationState} /></li>; })}</ul> : <p>No report observations were extracted.</p>}</section>
        <section className="overview-card" aria-labelledby="overview-title"><h2 id="overview-title">Patient-friendly overview</h2><p className="summary-meta">AI-generated · Informational — not clinical advice</p><p>{record.summary.text}</p></section>
        <AiReviewSummary summary={aiSummary} error={summaryError} pending={isGeneratingSummary} onGenerate={generateAiReviewSummary} />
        <ProcessingTrace stages={processingTrace} />
        {conflicts.length > 0 && <section className="quality-card" aria-labelledby="conflicts-title"><h2 id="conflicts-title">Possible information inconsistency</h2><p>Acknowledgments are temporary and reset when this page is refreshed. They are not diagnostic decisions.</p>{conflicts.map((conflict) => { const acknowledgmentId = toSessionAcknowledgmentId(conflict.category); const acknowledged = isAcknowledged(acknowledgedConflicts, acknowledgmentId); return <article className="conflict-item" key={conflict.id}><p><strong>{label(conflict.category)}</strong></p><p>Patient-provided: {conflict.intakeValue}</p><p>AI-extracted: {conflict.reportValue}</p><p>Please review the sources. MedLens does not determine which value is correct.</p>{acknowledged && <p className="acknowledgment-status" role="status">{SESSION_ACKNOWLEDGMENT_STATUS}</p>}<div className="row-actions"><button className="text-button" type="button" aria-pressed={acknowledged} onClick={() => setAcknowledgedConflicts((items) => toggleAcknowledgment(items, acknowledgmentId))}>{acknowledged ? "Remove acknowledgment" : "Acknowledge for review"}</button>{getConflictNavigationTarget(conflict) ? <button className="text-button" type="button" aria-label={`View related information for ${label(conflict.category)}`} onClick={() => viewRelatedInformation(conflict)}>View related information</button> : <p>Related structured information is not available for this possible inconsistency.</p>}</div></article>; })}</section>}
        <Clarifications questions={clarifications} />
        <Scorecard metrics={metrics} />
        <QualityGate quality={quality} />
        <ReviewActivity history={history} />
      </div>
      <aside className="source-panel" aria-labelledby="source-title"><h2 id="source-title">Source &amp; Provenance</h2><p className="source-retention">The pasted report text remains available in the active browser session for source review. When you create a structured record, it is sent to MedLens’s processing route for validation and, when configured, optional AI processing. It is not stored in browser localStorage, included in exports, uploaded as a file, or retained by MedLens as a permanent clinical record.</p>{selected && <Evidence lab={selected} isFallback={isFallback} />}<div className="source-viewer"><h3>Original pasted report</h3><pre>{reportText ?? "Source report text is not restored after refresh. The saved structured record, processing metadata, and local review history remain available for demo continuity."}</pre></div><p className="storage-note">The structured record, processing metadata, and local review history are saved locally for demo continuity only, not as a permanent clinical record.</p></aside>
    </div>
    {confirmClear && <div className="dialog-backdrop"><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="clear-title"><h2 id="clear-title">Clear saved record?</h2><p>This removes the structured demo record, processing metadata, and review history from this browser. Raw report text is not stored locally.</p><div><button className="danger-button" type="button" onClick={onClear}>Clear local record</button><button className="quiet-button" type="button" onClick={() => setConfirmClear(false)}>Cancel</button></div></section></div>}
  </main>;
}

function Profile({ patient, relatedCategory }: { patient: MedicalRecord["patient"]; relatedCategory: "allergy" | "medication" | null }) { const fields = [["Age", String(patient.age)], ["Sex", label(patient.sex)], ["Symptoms", patient.symptoms], ["Existing conditions", patient.existingConditions], ["Allergies", patient.allergies], ["Medications", patient.medications], ["Notes", patient.notes]]; return <section className="review-section profile" aria-labelledby="profile-title"><h2 id="profile-title">Patient-provided profile</h2><dl>{fields.map(([name, value]) => { const category = name === "Allergies" ? "allergy" : name === "Medications" ? "medication" : null; return <div key={name} id={category ? `profile-${name.toLowerCase()}` : undefined} className={category === relatedCategory ? "related-information" : ""} tabIndex={category ? -1 : undefined}>{category === relatedCategory && <strong className="related-label">Related information</strong>}<dt>{name}</dt><dd>{value?.trim() ? value : "Not provided"}</dd><span className="source-label patient">Patient-provided</span></div>; })}</dl></section>; }
function observationConflictCategory(text: string): "allergy" | "medication" | null { return /^\s*allergies\s*:/i.test(text) ? "allergy" : /^\s*medications\s*:/i.test(text) ? "medication" : null; }
function AiReviewSummary({ summary, error, pending, onGenerate }: { summary: ReviewSummary | null; error: string; pending: boolean; onGenerate: () => void }) { return <section className="ai-review-summary" aria-labelledby="ai-review-summary-title"><div className="section-heading"><div><h2 id="ai-review-summary-title">AI review summary</h2><p>Optional server-side Gemini review aid. It organizes supplied structured data for human review only.</p></div><button className="primary-button" type="button" disabled={pending} onClick={onGenerate}>{pending ? "Generating AI review summary…" : "Generate AI review summary"}</button></div>{error && <p className="visible-feedback" role="alert">{error}</p>}{summary && <div className="ai-summary-output" role="status"><p>{summary.summary}</p>{summary.reviewPriorities.length > 0 && <><h3>Review priorities</h3><ul>{summary.reviewPriorities.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></>}{summary.clarificationQuestions.length > 0 && <><h3>Clarification questions</h3><ul>{summary.clarificationQuestions.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></>}<p className="summary-disclaimer">{summary.disclaimer}</p></div>}</section>; }
function ProcessingTrace({ stages }: { stages: ReturnType<typeof buildProcessingTrace> }) { return <section className="processing-trace" aria-labelledby="trace-title"><div className="section-heading"><div><h2 id="trace-title">Record Processing Trace</h2><p>A concise record of the review workflow. It does not display prompts or hidden reasoning.</p></div></div><ol>{stages.map((stage) => <li key={stage.id}><span className={`trace-symbol ${stage.symbol === "!" ? "attention" : ""}`} aria-hidden="true">{stage.symbol}</span><div><div className="trace-stage-heading"><h3>{stage.title}</h3><span className={`trace-status ${stage.status === "Needs review" || stage.status === "Synthetic fallback" ? "attention" : ""}`}>{stage.status}</span></div><p>{stage.evidence}</p></div></li>)}</ol></section>; }
function MetaTags({ provenance, confidence, state }: { provenance: string; confidence: string; state: string }) { return <div className="meta-tags"><span className="source-label">{label(provenance)}</span><span>{label(confidence)} confidence</span><span>{label(state)}</span></div>; }
function LabTable({ labs, selectedId, onSelect, onEdit, onVerify }: { labs: LabResult[]; selectedId: string; onSelect: (id: string) => void; onEdit: (lab: LabResult) => void; onVerify: (lab: LabResult) => void }) { return <div className="table-scroll"><table><caption className="sr-only">Reviewable laboratory results</caption><thead><tr><th>Test</th><th>Result</th><th>Source-provided range</th><th>Status</th><th>Confidence</th><th>Review</th></tr></thead><tbody>{labs.map((lab) => { const rationale = getLabStatusRationale(lab); return <tr key={lab.id} className={selectedId === lab.id ? "selected-row" : ""}><td><strong>{lab.normalizedName}</strong>{lab.normalizationMethod === "known_alias" && <small>Reported as: {lab.reportedName}<br />Normalized from source label</small>}<small>{lab.source.reportDate ?? "Date not provided"}</small></td><td>{lab.value}{lab.unit ? ` ${lab.unit}` : ""}</td><td>{lab.referenceRange ?? "Range not provided — status not assessed."}</td><td><span className={`status ${rationale.status}`}>{label(rationale.status)}</span><small>{rationale.text}</small></td><td>{label(lab.confidence)}</td><td><MetaTags provenance={lab.provenance} confidence={lab.confidence} state={lab.verificationState} /><div className="row-actions"><button type="button" className="text-button" onClick={() => onSelect(lab.id)}>View evidence</button><button type="button" className="text-button" onClick={() => onEdit(lab)}>Edit</button>{lab.verificationState !== "verified" && <button type="button" className="text-button" onClick={() => onVerify(lab)}>Mark verified</button>}</div></td></tr>; })}</tbody></table></div>; }
function EditLab({ edit, onChange, error, onSave, onCancel }: { edit: LabEdit; onChange: (value: LabEdit) => void; error: string; onSave: () => void; onCancel: () => void }) { const set = (key: keyof LabEdit, value: string) => onChange({ ...edit, [key]: value }); return <section className="edit-panel" aria-labelledby="edit-title"><h3 id="edit-title">Edit laboratory result</h3><div className="field-grid">{(["testName", "value", "unit", "referenceRange", "reportDate", "sourceSnippet"] as const).map((key) => <label key={key}>{key === "referenceRange" ? "Source-provided reference range" : label(key)}{key === "sourceSnippet" ? <textarea value={edit[key]} onChange={(event) => set(key, event.target.value)} rows={3} /> : <input value={edit[key]} onChange={(event) => set(key, event.target.value)} />}{key === "referenceRange" && <span className="field-hint">Enter only wording exactly as stated in the source report.</span>}</label>)}</div>{error && <p className="field-error" role="alert">{error}</p>}<div className="row-actions"><button type="button" className="primary-button" onClick={onSave}>Save review edit</button><button type="button" className="quiet-button" onClick={onCancel}>Cancel</button></div></section>; }
function Evidence({ lab, isFallback }: { lab: LabResult; isFallback: boolean }) { return <section className="evidence-card" aria-live="polite"><h3>Selected evidence</h3><dl><div><dt>Source</dt><dd>{label(lab.provenance)}</dd></div><div><dt>Extraction method</dt><dd>{isFallback ? "Synthetic fallback" : "AI-assisted structured extraction"}</dd></div><div><dt>Evidence confidence</dt><dd>{label(lab.confidence)}</dd></div><div><dt>Review state</dt><dd>{label(lab.verificationState)}</dd></div><div><dt>Source date</dt><dd>{lab.source.reportDate ?? "Not provided"}</dd></div></dl><blockquote>{lab.source.snippet}</blockquote></section>; }
function Clarifications({ questions }: { questions: ReturnType<typeof generateClarificationQuestions> }) { return <section className="quality-card" aria-labelledby="clarification-title"><h2 id="clarification-title">Clarification questions</h2><p>These questions help complete the record for review. They are not medical advice.</p>{questions.length ? <ul>{questions.map((item) => <li key={item.id}><strong>{item.question}</strong><br /><span>{item.reason}</span><br /><small>Related field: {item.relatedField}</small></li>)}</ul> : <p>No additional clarification questions were generated from the available record.</p>}</section>; }
function Scorecard({ metrics }: { metrics: ReturnType<typeof calculateReviewMetrics> }) { return <section className="scorecard" aria-labelledby="score-title"><h2 id="score-title">Record Review Status</h2><dl><div><dt>Patient information captured</dt><dd>{metrics.patientCaptured} / {metrics.patientExpected}</dd></div><div><dt>Extracted laboratory results</dt><dd>{metrics.labs}</dd></div><div><dt>Normalized test labels</dt><dd>{metrics.normalizedLabels} / {metrics.labs}</dd></div><div><dt>Potential inconsistencies</dt><dd>{metrics.potentialConflicts}</dd></div><div><dt>Clarification questions</dt><dd>{metrics.clarificationQuestions}</dd></div><div><dt>Results with source evidence</dt><dd>{metrics.labsWithEvidence} / {metrics.labs}</dd></div><div><dt>Results assessed using source ranges</dt><dd>{metrics.labsAssessed} / {metrics.labs}</dd></div><div><dt>Manually verified items</dt><dd>{metrics.verified}</dd></div></dl><p>These are record-completeness and review metrics, not measures of medical accuracy.</p><p>Normalization, conflict checks, and clarification questions are deterministic record-quality aids. They do not diagnose or establish medical truth.</p></section>; }
function QualityGate({ quality }: { quality: ReturnType<typeof evaluateRecordQuality> }) { return <section className="quality-card" aria-labelledby="quality-title"><h2 id="quality-title">Record Quality Check</h2><p><strong>{quality.readyForReview ? "Record quality check: Ready for human review" : "Record quality check: Review required"}</strong></p>{quality.blockers.length > 0 && <ul>{quality.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}</section>; }
function ReviewActivity({ history }: { history: ReviewHistoryEvent[] }) { const events = sortReviewHistoryNewestFirst(history); return <section className="history" aria-labelledby="history-title"><h2 id="history-title">Review Activity</h2><p>This is a local review history for the active structured record. It is not a permanent clinical audit log.</p>{events.length ? <ol>{events.map((event) => <li key={event.id}><time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time><div><strong>{reviewActionLabel(event.action)}</strong><span>{event.targetLabel}</span>{event.priorDisplayValue && event.updatedDisplayValue && <small>{event.priorDisplayValue} → {event.updatedDisplayValue}</small>}{event.reviewStateTransition && <small>{event.reviewStateTransition}</small>}</div></li>)}</ol> : <p>No local review activity has been recorded yet.</p>}</section>; }
