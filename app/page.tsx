"use client";

import { useEffect, useState } from "react";
import { RecordDashboard } from "@/components/record-dashboard";
import { demoPatient, demoReport } from "@/lib/demo-data";
import { extractionResponseSchema, patientIntakeSchema } from "@/lib/medical-record";
import type { ExtractionResponse, MedicalRecord } from "@/lib/medical-record";
import { deserializeReview, RECORD_STORAGE_KEY, serializeReview } from "@/lib/review-utils";

type IntakeField = "age" | "sex" | "symptoms" | "existingConditions" | "allergies" | "medications" | "notes";
type IntakeDraft = Record<IntakeField, string>;
type HistoryEvent = { at: string; label: string };

const emptyDraft: IntakeDraft = {
  age: "",
  sex: "not_specified",
  symptoms: "",
  existingConditions: "",
  allergies: "",
  medications: "",
  notes: "",
};

const fieldLabels: Record<IntakeField, string> = {
  age: "Age",
  sex: "Sex",
  symptoms: "Symptoms",
  existingConditions: "Existing conditions",
  allergies: "Allergies",
  medications: "Medications",
  notes: "Additional notes",
};

function draftFromDemo(): IntakeDraft {
  return {
    age: String(demoPatient.age),
    sex: demoPatient.sex,
    symptoms: demoPatient.symptoms,
    existingConditions: demoPatient.existingConditions,
    allergies: demoPatient.allergies,
    medications: demoPatient.medications,
    notes: demoPatient.notes,
  };
}

function validationErrors(draft: IntakeDraft, reportText: string): Partial<Record<IntakeField | "reportText", string>> {
  const errors: Partial<Record<IntakeField | "reportText", string>> = {};
  if (!draft.age.trim()) errors.age = "Enter an age using whole numbers.";
  const parsed = patientIntakeSchema.safeParse({ ...draft, age: draft.age });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as IntakeField;
      if (!errors[key]) errors[key] = `${fieldLabels[key]} needs a valid entry.`;
    }
  }
  if (!reportText.trim()) errors.reportText = "Paste a synthetic report before creating a structured record.";
  return errors;
}

export default function Home() {
  const [draft, setDraft] = useState<IntakeDraft>(emptyDraft);
  const [reportText, setReportText] = useState("");
  const [errors, setErrors] = useState<Partial<Record<IntakeField | "reportText", string>>>({});
  const [announcement, setAnnouncement] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [processing, setProcessing] = useState<ExtractionResponse["processing"] | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [savedReview, setSavedReview] = useState<{ record: MedicalRecord; processing: ExtractionResponse["processing"]; history: HistoryEvent[] } | null>(null);

  useEffect(() => {
    const saved = deserializeReview(window.localStorage.getItem(RECORD_STORAGE_KEY));
    if (saved) setSavedReview(saved);
  }, []);

  useEffect(() => {
    if (record && processing) window.localStorage.setItem(RECORD_STORAGE_KEY, serializeReview({ record, processing, history }));
  }, [record, processing, history]);

  function updateField(field: IntakeField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function loadDemo() {
    setDraft(draftFromDemo());
    setReportText(demoReport);
    setErrors({});
    setAnnouncement("Synthetic patient details and report text loaded. Review or edit them before continuing.");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validationErrors(draft, reportText);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setAnnouncement("Some information needs attention. Review the messages beside each field.");
      return;
    }
    setIsProcessing(true);
    setAnnouncement("Creating a structured record. Please wait.");
    try {
      const patient = patientIntakeSchema.parse({ ...draft, age: draft.age });
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patient, reportText, isSyntheticDemo: true }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        setAnnouncement("The record could not be created. Your entered information is still available to review.");
        return;
      }
      const parsedResponse = extractionResponseSchema.safeParse(payload);
      if (!parsedResponse.success) {
        setAnnouncement("The processing response could not be safely reviewed. Your entered information is still available.");
        return;
      }
      const now = new Date().toISOString();
      setRecord(parsedResponse.data.record);
      setProcessing(parsedResponse.data.processing);
      setHistory([{ at: now, label: "Intake captured" }, { at: now, label: "Structured record generated" }]);
    } catch {
      setAnnouncement("The record could not be created. Your entered information is still available to review.");
    } finally {
      setIsProcessing(false);
    }
  }

  function updateRecord(nextRecord: MedicalRecord, event?: string) {
    setRecord(nextRecord);
    if (event) setHistory((current) => [...current, { at: new Date().toISOString(), label: event }]);
  }

  function clearRecord() {
    window.localStorage.removeItem(RECORD_STORAGE_KEY);
    setRecord(null); setProcessing(null); setHistory([]); setSavedReview(null);
    setAnnouncement("Saved structured record cleared from this browser.");
  }

  if (record && processing) return <RecordDashboard record={record} processing={processing} reportText={reportText || null} history={history} onRecordChange={updateRecord} onClear={clearRecord} />;

  return (
    <main className="app-shell">
      <header className="masthead" aria-label="MedLens">
        <a className="brand" href="#main-content" aria-label="MedLens home">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>MedLens</span>
        </a>
        <span className="synthetic-badge">Synthetic demo data only</span>
      </header>

      <section className="intro" id="main-content" aria-labelledby="intake-title">
        <h1 id="intake-title">Transform medical reports into a structured, traceable record for review.</h1>
        <p className="lede">Start with synthetic patient information and a supplied report. You can review every detail before any record is created.</p>
        <aside className="safety-notice" aria-label="Medical safety notice">
          <strong>Important safety notice</strong>
          <p>
            MedLens organizes medical information for review and does not provide medical
            diagnosis, treatment, or emergency guidance. Consult a qualified healthcare
            professional for medical decisions.
          </p>
        </aside>
      </section>

      <section className="privacy-note" aria-label="Privacy notice">
        <strong>Privacy for this demo</strong>
        <p>For this demo, use synthetic information only. The pasted report text remains available in the active browser session for source review. When you create a structured record, it is sent to MedLens’s processing route for validation and, when configured, optional AI processing. It is not stored in browser localStorage, included in exports, uploaded as a file, or retained by MedLens as a permanent clinical record.</p>
      </section>

      <div className="intake-layout">
        <form className="intake-form" onSubmit={submit} noValidate aria-describedby="form-feedback">
          <div className="section-heading">
            <div>
              <h2>Patient information</h2>
              <p>Enter the details exactly as they should appear for review.</p>
            </div>
            <button className="quiet-button" type="button" onClick={loadDemo}>Load Demo Report</button>
          </div>

          <div className="field-grid">
            <Field label="Age" field="age" error={errors.age} hint="Whole years; this is a basic format check only.">
              <input id="age" name="age" inputMode="numeric" type="number" min="0" max="130" value={draft.age} onChange={(event) => updateField("age", event.target.value)} aria-invalid={Boolean(errors.age)} aria-describedby={errors.age ? "age-hint age-error" : "age-hint"} />
            </Field>
            <Field label="Sex" field="sex" error={errors.sex}>
              <select id="sex" name="sex" value={draft.sex} onChange={(event) => updateField("sex", event.target.value)} aria-invalid={Boolean(errors.sex)} aria-describedby={errors.sex ? "sex-error" : undefined}>
                <option value="not_specified">Not specified</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="intersex">Intersex</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </Field>
          </div>

          <div className="field-grid text-fields">
            <TextField field="symptoms" label="Symptoms" value={draft.symptoms} error={errors.symptoms} onChange={updateField} placeholder="For example: tiredness, headache, or other patient-entered notes" />
            <TextField field="existingConditions" label="Existing conditions" value={draft.existingConditions} error={errors.existingConditions} onChange={updateField} placeholder="List conditions as entered, or write “None reported”" />
            <TextField field="allergies" label="Allergies" value={draft.allergies} error={errors.allergies} onChange={updateField} placeholder="List allergies as entered, or write “None reported”" />
            <TextField field="medications" label="Medications" value={draft.medications} error={errors.medications} onChange={updateField} placeholder="List medications as entered, or write “None reported”" />
          </div>
          <TextField field="notes" label="Additional notes" value={draft.notes} error={errors.notes} onChange={updateField} placeholder="Optional context for the review record" required={false} />

          <div className="report-section">
            <div className="section-heading compact">
              <div>
                <h2>Source report</h2>
                <p>Paste synthetic report text. This is the guaranteed report-processing path for the demo.</p>
              </div>
              <span className="source-chip">Active session source view</span>
            </div>
            <label htmlFor="reportText">Medical-report text</label>
            <textarea id="reportText" name="reportText" rows={13} value={reportText} onChange={(event) => { setReportText(event.target.value); setErrors((current) => ({ ...current, reportText: undefined })); }} placeholder="Paste a synthetic report including its date, laboratory values, units, and any report-provided reference ranges." aria-invalid={Boolean(errors.reportText)} aria-describedby={errors.reportText ? "report-help reportText-error" : "report-help"} />
            <p className="field-hint" id="report-help">Uploaded files and OCR are not part of this demo flow. Keep source ranges exactly as they appear in the report.</p>
            {errors.reportText && <p className="field-error" id="reportText-error" role="alert">{errors.reportText}</p>}
          </div>

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={isProcessing}>{isProcessing ? "Creating record…" : "Create Structured Record"}</button>
            <p>Results are prepared securely and will be displayed for review in the next phase.</p>
          </div>
          <p id="form-feedback" className="sr-only" aria-live="polite">{announcement}</p>
          {announcement && <p className="visible-feedback" role="status">{announcement}</p>}
        </form>

        <aside className="evidence-panel" aria-labelledby="evidence-title">
          <h2 id="evidence-title">Built for review</h2>
          <ul>
            <li>Source-aware extraction</li>
            <li>Reference ranges assessed only when supplied in the report</li>
            <li>Human review required</li>
          </ul>
          <p>Any future extracted detail will remain clearly labeled and reviewable.</p>
        </aside>
      </div>
      {savedReview && <section className="saved-record-prompt" aria-labelledby="saved-title"><h2 id="saved-title">A saved structured demo record is available</h2><p>The structured record, processing metadata, and local review history are available for demo continuity. The original report text is not restored after refresh.</p><button className="primary-button" type="button" onClick={() => { setRecord(savedReview.record); setProcessing(savedReview.processing); setHistory(savedReview.history); }}>Open saved record</button><button className="quiet-button" type="button" onClick={() => { window.localStorage.removeItem(RECORD_STORAGE_KEY); setSavedReview(null); }}>Discard saved record</button></section>}
    </main>
  );
}

function Field({ label, field, error, hint, children }: { label: string; field: IntakeField; error?: string; hint?: string; children: React.ReactNode }) {
  return <div className="field"><label htmlFor={field}>{label}</label>{children}{hint && <p className="field-hint" id={`${field}-hint`}>{hint}</p>}{error && <p className="field-error" id={`${field}-error`} role="alert">{error}</p>}</div>;
}

function TextField({ field, label, value, error, onChange, placeholder, required = true }: { field: Exclude<IntakeField, "age" | "sex">; label: string; value: string; error?: string; onChange: (field: IntakeField, value: string) => void; placeholder: string; required?: boolean }) {
  return <Field label={label} field={field} error={error}><textarea id={field} name={field} rows={3} value={value} onChange={(event) => onChange(field, event.target.value)} placeholder={placeholder} aria-invalid={Boolean(error)} aria-describedby={error ? `${field}-error` : undefined} required={required} /></Field>;
}
