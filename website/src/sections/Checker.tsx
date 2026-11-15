import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { isBlankPosting, type ScoreResult } from '../lib/scorer';
import type { ScorerStatus } from '../lib/useScorer';
import { SectionHeader } from '../components/primitives';
import examplesData from '../data/examples.json';

type Example = {
  name: string;
  label: 'genuine' | 'fraudulent';
  outcome: 'clear' | 'flagged' | 'missed';
  note: string;
  score: number;
  fields: Record<string, string>;
};
const EXAMPLES = examplesData as Example[];

const FIELD_META: { key: string; label: string; placeholder: string; rows: number }[] = [
  { key: 'title', label: 'Job title', placeholder: 'e.g. Customer Service Representative', rows: 1 },
  { key: 'company_profile', label: 'Company profile', placeholder: 'What the company says about itself…', rows: 3 },
  { key: 'description', label: 'Description', placeholder: 'The role, responsibilities, day-to-day…', rows: 5 },
  { key: 'requirements', label: 'Requirements', placeholder: 'Skills, experience, qualifications…', rows: 3 },
  { key: 'benefits', label: 'Benefits', placeholder: 'Perks, compensation, offerings…', rows: 2 },
];

const STAGES = [
  'Combining the five text fields',
  'Lowercasing · stripping accents · tokenizing',
  'Building 1–2 gram TF-IDF vector (100k vocab)',
  'Linear SVM decision function · applying threshold',
];

// Held-out test scores (same file the Lab uses), loaded once, used to put a user's score in context.
let testScoresPromise: Promise<{ scores: number[]; labels: number[] } | null> | null = null;
function loadTestScores() {
  if (!testScoresPromise) {
    testScoresPromise = fetch(new URL(`${import.meta.env.BASE_URL}data/test_scores.json`, document.baseURI).href)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return testScoresPromise;
}

/** Empirical context from the held-out test set (no new modelling):
 *  - 'window': test postings whose score is within ±0.25 of this one;
 *  - 'tail'  : if fewer than 10 are that close (extreme scores), all test postings at least this extreme.
 *  The label (clear / moderate / borderline) is read from the share of fraud-labelled postings in that set. */
type Ctx = { kind: 'window' | 'tail'; n: number; fraud: number; strength: 'clear' | 'moderate' | 'borderline' };
function useScoreContext(score: number, flagged: boolean, threshold: number) {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  useEffect(() => {
    let live = true;
    loadTestScores().then((d) => {
      if (!live || !d) return;
      let n = 0, fraud = 0, kind: Ctx['kind'] = 'window';
      d.scores.forEach((s, i) => { if (Math.abs(s - score) <= 0.25) { n++; fraud += d.labels[i]; } });
      if (n < 10) {
        kind = 'tail'; n = 0; fraud = 0;
        d.scores.forEach((s, i) => { if (flagged ? s >= score : s <= score) { n++; fraud += d.labels[i]; } });
      }
      const share = n ? fraud / n : 0;
      const far = Math.abs(score - threshold) >= 1;
      let strength: Ctx['strength'];
      if (Math.abs(score - threshold) < 0.15) strength = 'borderline';
      else if (n < 5) strength = far ? 'clear' : 'borderline';
      else if (flagged) strength = share >= 0.85 ? 'clear' : share >= 0.5 ? 'moderate' : 'borderline';
      else strength = share <= 0.02 ? 'clear' : share <= 0.15 ? 'moderate' : 'borderline';
      setCtx({ kind, n, fraud, strength });
    });
    return () => { live = false; };
  }, [score, flagged, threshold]);
  return ctx;
}

const EMPTY_FIELDS = { title: '', company_profile: '', description: '', requirements: '', benefits: '' };
const MAX_CHARS_PER_FIELD = 20000;     // a real posting field is far shorter; keeps the UI responsive
const sameFields = (a: Record<string, string>, b: Record<string, string>) =>
  FIELD_META.every((f) => (a[f.key] ?? '') === (b[f.key] ?? ''));

const DISPLAY_MIN = -2.2;
const DISPLAY_MAX = 1.3;

export function Checker({
  status,
  score,
}: {
  status: ScorerStatus;
  score: (f: Record<string, string>) => Promise<ScoreResult>;
}) {
  const [fields, setFields] = useState<Record<string, string>>({ ...EMPTY_FIELDS });
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [activeExample, setActiveExample] = useState<Example | null>(null);
  const [scoredFields, setScoredFields] = useState<Record<string, string> | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const blank = isBlankPosting(fields);
  const stale = result != null && scoredFields != null && !sameFields(fields, scoredFields);
  const emptyFields = FIELD_META.filter((f) => !(scoredFields ?? fields)[f.key]?.trim()).map((f) => f.label.toLowerCase());

  const edit = (key: string, value: string) => {
    setFields((s) => ({ ...s, [key]: value.slice(0, MAX_CHARS_PER_FIELD) }));
    setActiveExample(null);
    if (message?.kind === 'error') setMessage(null);
    if (value.length > MAX_CHARS_PER_FIELD) {
      setMessage({ kind: 'info', text: `That field was trimmed to ${MAX_CHARS_PER_FIELD.toLocaleString()} characters.` });
    }
  };

  const loadExample = (ex: Example) => {
    // every one of the five fields is overwritten, so nothing from a previous posting leaks in
    setFields({ ...EMPTY_FIELDS, ...ex.fields });
    setActiveExample(ex);
    setResult(null);
    setScoredFields(null);
    setMessage({ kind: 'info', text: `Loaded “${ex.name}” into all five fields. Press Analyse posting to score it.` });
  };

  const clearAll = () => {
    setFields({ ...EMPTY_FIELDS });
    setResult(null);
    setScoredFields(null);
    setActiveExample(null);
    setMessage(null);
    firstFieldRef.current?.focus();
  };

  const analyze = async () => {
    if (status.state !== 'ready' || busy) return;
    // Guard BEFORE scoring: the field-name template alone ("title company profile description …")
    // produces in-vocabulary tokens, so an empty posting would otherwise get a non-neutral score.
    if (blank) {
      setResult(null);
      setScoredFields(null);
      setMessage({ kind: 'error', text: 'Enter a job posting first — at least one of the five fields must contain text.' });
      firstFieldRef.current?.focus();
      return;
    }
    const snapshot = { ...fields };
    setMessage(null);
    setBusy(true);
    setResult(null);
    try {
      const realResult = await score(snapshot);
      // short staged display so the steps are readable; the score itself is already computed
      for (let i = 0; i < STAGES.length; i++) {
        setStage(i);
        await new Promise((r) => setTimeout(r, 180));
      }
      setResult(realResult);
      setScoredFields(snapshot);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
    } catch (e) {
      setMessage({ kind: 'error', text: `Scoring failed: ${e instanceof Error ? e.message : String(e)}. Please reload the page.` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section" id="checker">
      <div className="container">
        <SectionHeader
          eyebrow="Live analyzer"
          title={<>Score a posting with the <span className="gradient-text">real model</span></>}
          lead={
            <>
              This runs the frozen Linear SVM in your browser, with scikit-learn’s preprocessing re-implemented
              in JavaScript and checked against Python on held-out and Unicode edge-case postings (largest score
              difference below 10⁻¹⁴). Nothing you type is sent to a server or stored.
            </>
          }
        />

        <div className="checker-grid">
          {/* -------- input panel -------- */}
          <div className="card checker-input">
            <div className="checker-examples">
              <span className="checker-examples-label">Try a real posting:</span>
              {EXAMPLES.map((ex) => (
                <button
                  aria-pressed={activeExample?.name === ex.name}
                  title={`Real EMSCAD test posting labelled ${ex.label} — fills all five fields`}
                  key={ex.name}
                  className={`chip ${activeExample?.name === ex.name ? 'chip-active' : ''}`}
                  onClick={() => loadExample(ex)}
                  type="button"
                >
                  <span className={`chip-dot ${ex.label === 'fraudulent' ? 'dot-danger' : 'dot-safe'}`} />
                  {ex.name}
                </button>
              ))}
            </div>

            {FIELD_META.map((f) => (
              <label className="field" key={f.key}>
                <span className="field-label">
                  {f.label}
                  {fields[f.key].length > 2000 && (
                    <span className="field-count mono"> · {fields[f.key].length.toLocaleString()} chars</span>
                  )}
                </span>
                {f.rows === 1 ? (
                  <input
                    ref={firstFieldRef}
                    className="field-input"
                    name={f.key}
                    autoComplete="off"
                    value={fields[f.key]}
                    placeholder={f.placeholder}
                    aria-invalid={message?.kind === 'error' && blank}
                    aria-describedby="checker-msg"
                    onChange={(e) => edit(f.key, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); analyze(); } }}
                  />
                ) : (
                  <textarea
                    className="field-input"
                    name={f.key}
                    rows={f.rows}
                    value={fields[f.key]}
                    placeholder={f.placeholder}
                    aria-describedby="checker-msg"
                    onChange={(e) => edit(f.key, e.target.value)}
                  />
                )}
              </label>
            ))}

            <div className="checker-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={analyze}
                disabled={busy || status.state !== 'ready'}
                aria-busy={busy}
              >
                {status.state === 'loading' ? 'Loading model…' : status.state === 'error' ? 'Model unavailable' : busy ? 'Analysing…' : stale ? 'Analyse again' : 'Analyse posting'}
              </button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={clearAll} disabled={busy}>Clear all</button>
            </div>
            <p id="checker-msg" className={`checker-msg ${message?.kind === 'error' ? 'is-error' : ''}`} role={message?.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
              {status.state === 'error'
                ? `The model file could not be loaded (${status.error}). The rest of the site still works — try reloading.`
                : status.state === 'loading'
                  ? 'Loading the 6 MB frozen model into your browser…'
                  : message?.text ?? ''}
            </p>
          </div>

          {/* -------- output panel -------- */}
          <div className="checker-output" ref={resultRef}>
            <AnimatePresence mode="wait">
              {busy ? (
                <Processing key="proc" stage={stage} />
              ) : result ? (
                <ResultPanel key="res" result={result} example={activeExample} stale={stale} emptyFields={emptyFields} />
              ) : (
                <EmptyState key="empty" />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <motion.div
      className="card checker-empty"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="empty-ring" aria-hidden>
        <svg viewBox="0 0 100 100" width="92" height="92">
          <circle cx="50" cy="50" r="38" fill="none" stroke="var(--glass-border-strong)" strokeWidth="1.5" strokeDasharray="4 6" />
          <circle cx="50" cy="50" r="22" fill="none" stroke="var(--cyan)" strokeWidth="1.5" opacity="0.5" />
        </svg>
      </div>
      <p>Paste a posting or load an example, then <strong>Analyze</strong>.</p>
      <p className="muted">You'll get the decision score, a genuine-vs-flagged call at the fixed threshold, and the terms that moved the score most.</p>
    </motion.div>
  );
}

function Processing({ stage }: { stage: number }) {
  return (
    <motion.div
      className="card checker-processing"
      initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
    >
      <div className="proc-pulse" aria-hidden>
        <span /><span /><span />
      </div>
      <div className="proc-stages">
        {STAGES.map((s, i) => (
          <div key={s} className={`proc-stage ${i < stage ? 'done' : i === stage ? 'active' : ''}`}>
            <span className="proc-tick">{i < stage ? '✓' : i === stage ? '' : ''}</span>
            <span>{s}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function ResultPanel({ result, example, stale, emptyFields }: { result: ScoreResult; example: Example | null; stale: boolean; emptyFields: string[] }) {
  const fraud = result.isFraud;
  const ctx = useScoreContext(result.decisionScore, fraud, result.threshold);
  const strength = ctx?.strength ?? (Math.abs(result.margin) < 0.15 ? 'borderline' : 'moderate');
  const scorePos = ((result.decisionScore - DISPLAY_MIN) / (DISPLAY_MAX - DISPLAY_MIN)) * 100;
  const thrPos = ((result.threshold - DISPLAY_MIN) / (DISPLAY_MAX - DISPLAY_MIN)) * 100;
  const clamp = (x: number) => Math.max(1, Math.min(99, x));

  return (
    <motion.div
      className="result"
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {stale && (
        <div className="card result-stale" role="status">
          You have edited the fields since this result was computed — it describes the <strong>previous</strong> text.
          Press <strong>Analyse again</strong> to update it.
        </div>
      )}
      <div className={`card result-head ${fraud ? 'result-fraud' : 'result-safe'} ${stale ? 'is-stale' : ''}`}>
        <div className="result-verdict">
          <span className={`pill ${fraud ? 'pill-danger' : 'pill-safe'}`}>
            {fraud ? '⚑ Flagged — resembles fraud-labelled postings' : '✓ Not flagged — resembles genuine postings'}
          </span>
          <div className="result-score">
            <span className="mono result-score-num">{result.decisionScore.toFixed(3)}</span>
            <span className="result-score-cap">SVM decision score</span>
          </div>
        </div>

        {/* score gauge */}
        <div className="gauge" role="img" aria-label={`Decision score ${result.decisionScore.toFixed(3)} versus threshold ${result.threshold.toFixed(3)}`}>
          <div className="gauge-track">
            <div className="gauge-zone-safe" style={{ width: `${clamp(thrPos)}%` }} />
            <div className="gauge-zone-fraud" style={{ left: `${clamp(thrPos)}%`, right: 0 }} />
            <div className="gauge-threshold" style={{ left: `${clamp(thrPos)}%` }}>
              <span className="gauge-threshold-flag mono">τ = {result.threshold.toFixed(3)}</span>
            </div>
            <motion.div
              className={`gauge-dot ${fraud ? 'dot-fraud' : 'dot-safe'}`}
              initial={{ left: `${clamp(thrPos)}%`, opacity: 0 }}
              animate={{ left: `${clamp(scorePos)}%`, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            />
          </div>
          <div className="gauge-ends mono">
            <span>← genuine</span><span>fraud →</span>
          </div>
        </div>

        <p className={`result-reading reading-${strength}`}>
          <strong>
            {strength === 'borderline'
              ? 'Borderline — the score is close to the threshold.'
              : strength === 'moderate'
                ? (fraud ? 'Moderately on the fraud-label side.' : 'Moderately on the genuine side.')
                : (fraud ? 'Clearly on the fraud-label side.' : 'Clearly on the genuine side.')}
          </strong>{' '}
          {strength === 'borderline' && 'Small changes to the wording could flip the result. '}
          {ctx && ctx.n > 0 && (ctx.kind === 'window'
            ? <>Among the {ctx.n.toLocaleString()} held-out test postings with similar scores (±0.25),{' '}
                {ctx.fraud === 0 ? 'none carry' : `${ctx.fraud.toLocaleString()} (${(100 * ctx.fraud / ctx.n).toFixed(ctx.fraud / ctx.n < 0.1 ? 1 : 0)}%) carry`} the fraud label.</>
            : <>Only {ctx.n.toLocaleString()} held-out test {ctx.n === 1 ? 'posting' : 'postings'} scored {fraud ? 'this high or higher' : 'this low or lower'};{' '}
                {ctx.fraud === 0 ? 'none carry' : `${ctx.fraud} of ${ctx.n} carry`} the fraud label.</>)}
          {ctx && ctx.n === 0 && <>No held-out test posting scored {fraud ? 'this high' : 'this low'}.</>}
        </p>
        <p className="result-explain">
          The posting scores <strong className="mono">{result.decisionScore.toFixed(3)}</strong>,{' '}
          {fraud ? 'above' : 'below'} the fixed operating threshold{' '}
          <strong className="mono">τ = {result.threshold.toFixed(3)}</strong>{' '}
          (a margin of <strong className="mono">{result.margin >= 0 ? '+' : ''}{result.margin.toFixed(3)}</strong>).
          {fraud
            ? ' Scores at or above τ are flagged: its wording resembles postings labelled fraudulent in EMSCAD.'
            : ' Scores below τ are not flagged: its wording resembles postings labelled genuine in EMSCAD.'}
          {' '}The score is an uncalibrated SVM decision value (a signed distance from the decision boundary), not a probability.
        </p>
        {emptyFields.length > 0 && (
          <p className="result-partial">
            <strong>Partial posting:</strong> {emptyFields.join(', ')} {emptyFields.length === 1 ? 'was' : 'were'} empty.
            Exactly as in the Python pipeline, empty fields still contribute their field names
            {emptyFields.includes('company profile') && <>; an empty company profile creates the term <span className="mono">profile description</span>, the model’s strongest fraud-leaning feature, so this result leans toward “flagged”</>}.
          </p>
        )}
      </div>

      {example && (
        <div className={`card result-truth ${example.outcome === 'missed' ? 'truth-warn' : ''}`}>
          <span className="mono truth-tag">ground truth</span>{' '}
          This EMSCAD posting is actually labelled <strong>{example.label}</strong>.{' '}
          {example.outcome === 'missed' && 'The model misses it — a false negative, and exactly the kind of error the research measures.'}
          {example.outcome === 'flagged' && 'The model correctly flags it.'}
          {example.outcome === 'clear' && 'The model correctly clears it.'}
        </div>
      )}

      <Contribs result={result} />

      <div className="disclaimer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
        <span>
          This is a <strong>decision score, not a calibrated probability</strong>, and it predicts
          the EMSCAD <em>label</em> — it does not prove a posting is fraudulent. Use it as a signal,
          not a verdict.
        </span>
      </div>
    </motion.div>
  );
}

function Contribs({ result }: { result: ScoreResult }) {
  const all = [...result.towardFraud, ...result.towardLegit];
  const maxAbs = Math.max(...all.map((c) => Math.abs(c.contribution)), 1e-6);
  const bar = (v: number) => `${(Math.abs(v) / maxAbs) * 100}%`;
  return (
    <div className="card contribs">
      <div className="contribs-head">
        <span>Terms that moved the score</span>
        <span className="muted mono">{result.activeFeatures.toLocaleString()} features fired</span>
      </div>
      <p className="contribs-note">
        Individual words can lean either way — the decision comes from their total. These weights reflect patterns in
        EMSCAD (2012–2014), not reasons a posting is fraudulent: e.g. “engineering” leans slightly toward fraud only
        because many fake Oil &amp; Energy engineering ads were in the data.
      </p>
      <div className="contribs-cols">
        <div>
          <div className="contribs-colhead toward-fraud">↑ toward fraud</div>
          {result.towardFraud.length === 0 && <p className="muted small">none</p>}
          {result.towardFraud.map((c) => (
            <div className="contrib" key={c.term}>
              <span className="contrib-term" title={c.term}>{c.term}</span>
              <span className="contrib-bar-wrap">
                <span className="contrib-bar fraud" style={{ width: bar(c.contribution) }} />
              </span>
            </div>
          ))}
        </div>
        <div>
          <div className="contribs-colhead toward-legit">↓ toward genuine</div>
          {result.towardLegit.length === 0 && <p className="muted small">none</p>}
          {result.towardLegit.map((c) => (
            <div className="contrib" key={c.term}>
              <span className="contrib-term" title={c.term}>{c.term}</span>
              <span className="contrib-bar-wrap">
                <span className="contrib-bar legit" style={{ width: bar(c.contribution) }} />
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="muted small contribs-foot">
        Contribution = model coefficient × the term's normalized TF-IDF weight in this posting.
        Field labels (e.g. “company profile”) are part of the text, so a <em>missing</em> field can itself shift the score.
      </p>
    </div>
  );
}
