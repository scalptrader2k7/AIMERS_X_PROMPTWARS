"use client";

import { useMemo, useState } from "react";
import { applyLabEdit, calculateReviewMetrics, evaluateRecordQuality, getLabStatusRationale, labEditSchema, verifyLab, type LabEdit } from "@/lib/review-utils";
import { detectConflicts } from "@/lib/conflict-detection";
import { generateClarificationQuestions } from "@/lib/clarification-questions";
import type { ExtractionResponse, LabResult, MedicalRecord } from "@/lib/medical-record";

type HistoryEvent = { at: string; label: string };
type Props = { record: MedicalRecord; processing: ExtractionResponse["processing"]; reportText: string | null; history: HistoryEvent[]; onRecordChange: (record: MedicalRecord, event?: string) => void; onClear: () => void };

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
  const [acknowledgedConflicts, setAcknowledgedConflicts] = useState<string[]>([]);
  const selected = record.labs.find((lab) => lab.id === selectedId) ?? record.labs[0];
  const conflicts = useMemo(() => detectConflicts(record), [record]);
  const visibleConflicts = conflicts.filter((conflict) => !acknowledgedConflicts.includes(conflict.id));
  const clarifications = useMemo(() => generateClarificationQuestions(record), [record]);
  const metrics = useMemo(() => calculateReviewMetrics(record, visibleConflicts.length, clarifications.length), [record, visibleConflicts.length, clarifications.length]);
  const quality = useMemo(() => evaluateRecordQuality(record, { conflicts: visibleConflicts.length, clarifications: clarifications.length }), [record, visibleConflicts.length, clarifications.length]);
  const isFallback = processing.mode === "synthetic_fallback";

  function saveEdit() {
    if (!editingId || !edit) return;
    const parsed = labEditSchema.safeParse(edit);
    if (!parsed.success) { setEditError("Check the edited laboratory fields. A test name, reported value, and source evidence are required."); return; }
    onRecordChange(applyLabEdit(record, editingId, parsed.data), "Laboratory result edited");
    setEditingId(null); setEdit(null); setEditError(""); setNotice("Laboratory result updated. It still needs human review.");
  }

  function markVerified(lab: LabResult) {
    const timestamp = new Date().toISOString();
    onRecordChange(verifyLab(record, lab.id, timestamp), `${lab.testName} verified`);
    setNotice(`${lab.testName} marked verified. Verified indicates user review; it does not indicate clinical accuracy.`);
  }

  function exportJson() {
    const payload = { record, processing, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "medlens-structured-record.json"; anchor.click(); URL.revokeObjectURL(url);
    setNotice("Structured record JSON download started.");
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
        <Profile patient={record.patient} />
        <section className="review-section" aria-labelledby="labs-title"><div className="section-heading"><div><h2 id="labs-title">Laboratory results</h2><p>All extracted results remain reviewable. Status is calculated only from a supplied source range.</p></div></div><LabTable labs={record.labs} selectedId={selectedId} onSelect={setSelectedId} onEdit={(lab) => { setEditingId(lab.id); setEdit(editFromLab(lab)); setEditError(""); }} onVerify={markVerified} />
          {editingId && edit && <EditLab edit={edit} onChange={setEdit} error={editError} onSave={saveEdit} onCancel={() => { setEditingId(null); setEdit(null); setEditError(""); }} />}
        </section>
        <section className="review-section" aria-labelledby="observations-title"><h2 id="observations-title">Report observations</h2>{record.observations.length ? <ul className="observation-list">{record.observations.map((item) => <li key={item.id}><p>{item.text}</p><MetaTags provenance={item.provenance} confidence={item.confidence} state={item.verificationState} /></li>)}</ul> : <p>No report observations were extracted.</p>}</section>
        <section className="overview-card" aria-labelledby="overview-title"><h2 id="overview-title">Patient-friendly overview</h2><p className="summary-meta">AI-generated · Informational — not clinical advice</p><p>{record.summary.text}</p></section>
        {visibleConflicts.length > 0 && <section className="quality-card" aria-labelledby="conflicts-title"><h2 id="conflicts-title">Possible information inconsistency</h2>{visibleConflicts.map((conflict) => <article className="conflict-item" key={conflict.id}><p><strong>{label(conflict.category)}</strong></p><p>Patient-provided: {conflict.intakeValue}</p><p>AI-extracted: {conflict.reportValue}</p><p>Please review the sources. MedLens does not determine which value is correct.</p><div className="row-actions"><button className="text-button" type="button" onClick={() => { setAcknowledgedConflicts((items) => [...items, conflict.id]); onRecordChange(record, `${label(conflict.category)} inconsistency acknowledged for this session`); setNotice("Possible inconsistency acknowledged for this session."); }}>Acknowledge for this session</button><button className="text-button" type="button" onClick={() => { if (record.labs[0]) setSelectedId(record.labs[0].id); setNotice("Source & Provenance is ready to review."); }}>Review source evidence</button></div></article>)}</section>}
        <Clarifications questions={clarifications} />
        <Scorecard metrics={metrics} />
        <QualityGate quality={quality} />
        <History history={history} />
      </div>
      <aside className="source-panel" aria-labelledby="source-title"><h2 id="source-title">Source &amp; Provenance</h2><p className="source-retention">The pasted report text remains available in the active browser session for source review. When you create a structured record, it is sent to MedLens’s processing route for validation and, when configured, optional AI processing. It is not stored in browser localStorage, included in exports, uploaded as a file, or retained by MedLens as a permanent clinical record.</p>{selected && <Evidence lab={selected} isFallback={isFallback} />}<div className="source-viewer"><h3>Original pasted report</h3><pre>{reportText ?? "Source report text is not restored after refresh. The saved structured record, processing metadata, and local review history remain available for demo continuity."}</pre></div><p className="storage-note">The structured record, processing metadata, and local review history are saved locally for demo continuity only, not as a permanent clinical record.</p></aside>
    </div>
    {confirmClear && <div className="dialog-backdrop"><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="clear-title"><h2 id="clear-title">Clear saved record?</h2><p>This removes the structured demo record, processing metadata, and review history from this browser. Raw report text is not stored locally.</p><div><button className="danger-button" type="button" onClick={onClear}>Clear local record</button><button className="quiet-button" type="button" onClick={() => setConfirmClear(false)}>Cancel</button></div></section></div>}
  </main>;
}

function Profile({ patient }: { patient: MedicalRecord["patient"] }) { const fields = [["Age", String(patient.age)], ["Sex", label(patient.sex)], ["Symptoms", patient.symptoms], ["Existing conditions", patient.existingConditions], ["Allergies", patient.allergies], ["Medications", patient.medications], ["Notes", patient.notes]]; return <section className="review-section profile" aria-labelledby="profile-title"><h2 id="profile-title">Patient-provided profile</h2><dl>{fields.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value?.trim() ? value : "Not provided"}</dd><span className="source-label patient">Patient-provided</span></div>)}</dl></section>; }
function MetaTags({ provenance, confidence, state }: { provenance: string; confidence: string; state: string }) { return <div className="meta-tags"><span className="source-label">{label(provenance)}</span><span>{label(confidence)} confidence</span><span>{label(state)}</span></div>; }
function LabTable({ labs, selectedId, onSelect, onEdit, onVerify }: { labs: LabResult[]; selectedId: string; onSelect: (id: string) => void; onEdit: (lab: LabResult) => void; onVerify: (lab: LabResult) => void }) { return <div className="table-scroll"><table><caption className="sr-only">Reviewable laboratory results</caption><thead><tr><th>Test</th><th>Result</th><th>Source-provided range</th><th>Status</th><th>Confidence</th><th>Review</th></tr></thead><tbody>{labs.map((lab) => { const rationale = getLabStatusRationale(lab); return <tr key={lab.id} className={selectedId === lab.id ? "selected-row" : ""}><td><strong>{lab.normalizedName}</strong>{lab.normalizationMethod === "known_alias" && <small>Reported as: {lab.reportedName}<br />Normalized from source label</small>}<small>{lab.source.reportDate ?? "Date not provided"}</small></td><td>{lab.value}{lab.unit ? ` ${lab.unit}` : ""}</td><td>{lab.referenceRange ?? "Range not provided — status not assessed."}</td><td><span className={`status ${rationale.status}`}>{label(rationale.status)}</span><small>{rationale.text}</small></td><td>{label(lab.confidence)}</td><td><MetaTags provenance={lab.provenance} confidence={lab.confidence} state={lab.verificationState} /><div className="row-actions"><button type="button" className="text-button" onClick={() => onSelect(lab.id)}>View evidence</button><button type="button" className="text-button" onClick={() => onEdit(lab)}>Edit</button>{lab.verificationState !== "verified" && <button type="button" className="text-button" onClick={() => onVerify(lab)}>Mark verified</button>}</div></td></tr>; })}</tbody></table></div>; }
function EditLab({ edit, onChange, error, onSave, onCancel }: { edit: LabEdit; onChange: (value: LabEdit) => void; error: string; onSave: () => void; onCancel: () => void }) { const set = (key: keyof LabEdit, value: string) => onChange({ ...edit, [key]: value }); return <section className="edit-panel" aria-labelledby="edit-title"><h3 id="edit-title">Edit laboratory result</h3><div className="field-grid">{(["testName", "value", "unit", "referenceRange", "reportDate", "sourceSnippet"] as const).map((key) => <label key={key}>{key === "referenceRange" ? "Source-provided reference range" : label(key)}{key === "sourceSnippet" ? <textarea value={edit[key]} onChange={(event) => set(key, event.target.value)} rows={3} /> : <input value={edit[key]} onChange={(event) => set(key, event.target.value)} />}{key === "referenceRange" && <span className="field-hint">Enter only wording exactly as stated in the source report.</span>}</label>)}</div>{error && <p className="field-error" role="alert">{error}</p>}<div className="row-actions"><button type="button" className="primary-button" onClick={onSave}>Save review edit</button><button type="button" className="quiet-button" onClick={onCancel}>Cancel</button></div></section>; }
function Evidence({ lab, isFallback }: { lab: LabResult; isFallback: boolean }) { return <section className="evidence-card" aria-live="polite"><h3>Selected evidence</h3><dl><div><dt>Source</dt><dd>{label(lab.provenance)}</dd></div><div><dt>Extraction method</dt><dd>{isFallback ? "Synthetic fallback" : "AI-assisted structured extraction"}</dd></div><div><dt>Evidence confidence</dt><dd>{label(lab.confidence)}</dd></div><div><dt>Review state</dt><dd>{label(lab.verificationState)}</dd></div><div><dt>Source date</dt><dd>{lab.source.reportDate ?? "Not provided"}</dd></div></dl><blockquote>{lab.source.snippet}</blockquote></section>; }
function Clarifications({ questions }: { questions: ReturnType<typeof generateClarificationQuestions> }) { return <section className="quality-card" aria-labelledby="clarification-title"><h2 id="clarification-title">Clarification questions</h2><p>These questions help complete the record for review. They are not medical advice.</p>{questions.length ? <ul>{questions.map((item) => <li key={item.id}><strong>{item.question}</strong><br /><span>{item.reason}</span><br /><small>Related field: {item.relatedField}</small></li>)}</ul> : <p>No additional clarification questions were generated from the available record.</p>}</section>; }
function Scorecard({ metrics }: { metrics: ReturnType<typeof calculateReviewMetrics> }) { return <section className="scorecard" aria-labelledby="score-title"><h2 id="score-title">Record Review Status</h2><dl><div><dt>Patient information captured</dt><dd>{metrics.patientCaptured} / {metrics.patientExpected}</dd></div><div><dt>Extracted laboratory results</dt><dd>{metrics.labs}</dd></div><div><dt>Normalized test labels</dt><dd>{metrics.normalizedLabels} / {metrics.labs}</dd></div><div><dt>Potential inconsistencies</dt><dd>{metrics.potentialConflicts}</dd></div><div><dt>Clarification questions</dt><dd>{metrics.clarificationQuestions}</dd></div><div><dt>Results with source evidence</dt><dd>{metrics.labsWithEvidence} / {metrics.labs}</dd></div><div><dt>Results assessed using source ranges</dt><dd>{metrics.labsAssessed} / {metrics.labs}</dd></div><div><dt>Manually verified items</dt><dd>{metrics.verified}</dd></div></dl><p>These are record-completeness and review metrics, not measures of medical accuracy.</p><p>Normalization, conflict checks, and clarification questions are deterministic record-quality aids. They do not diagnose or establish medical truth.</p></section>; }
function QualityGate({ quality }: { quality: ReturnType<typeof evaluateRecordQuality> }) { return <section className="quality-card" aria-labelledby="quality-title"><h2 id="quality-title">Record Quality Check</h2><p><strong>{quality.readyForReview ? "Record quality check: Ready for human review" : "Record quality check: Review required"}</strong></p>{quality.blockers.length > 0 && <ul>{quality.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}</section>; }
function History({ history }: { history: HistoryEvent[] }) { return <section className="history" aria-labelledby="history-title"><h2 id="history-title">Session review history</h2><p>Local session history — not a permanent clinical audit trail.</p><ol>{history.map((event, index) => <li key={`${event.at}-${index}`}><time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time><span>{event.label}</span></li>)}</ol></section>; }
