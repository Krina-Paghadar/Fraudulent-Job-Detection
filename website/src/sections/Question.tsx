import { research } from '../data/research';
import { SectionHeader, Reveal } from '../components/primitives';
import { int, pct } from '../lib/format';

/* Problem framing: the question, what one row is, when a prediction is made, and why
   these metrics. Every number comes from research.json. */
export function Question() {
  const d = research;
  const majority = d.modelComparison.models.find((m) => m.name.startsWith('Majority'));
  const spec: [string, React.ReactNode][] = [
    ['Question', <>Using only information available when a posting first appears, can we predict which postings carry the fraud label in EMSCAD?</>],
    ['One row', <>One job posting ({int(d.dataset.total)} rows, 18 columns).</>],
    ['Target', <><span className="mono">fraudulent</span> ∈ {'{0, 1}'} — the label assigned in the dataset, not an independent check of the employer.</>],
    ['Prediction time', <>When the posting is published, before anyone applies. Nothing that happens later (applications, reports) is used.</>],
    ['Inputs', <>Final model: the five text fields (title, company profile, description, requirements, benefits). Structured fields are used only in comparison models.</>],
    ['Output', <>An uncalibrated SVM decision score; a posting is <em>flagged</em> when the score ≥ the frozen threshold τ = {d.model.threshold.toFixed(4)}.</>],
    ['Not claimed', <>Causation, calibrated probabilities, or performance on postings after 2014.</>],
  ];
  return (
    <section className="section" id="question">
      <div className="container">
        <SectionHeader
          eyebrow="The question"
          title={<>What exactly is <span className="gradient-text">being predicted</span></>}
          lead="The scope is deliberately narrow, so that every result below can be checked against it."
        />
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <Reveal className="card" as="div">
            <dl className="spec-list">
              {spec.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          </Reveal>
          <Reveal className="card" as="div" delay={0.06}>
            <h3 className="card-h">Why these metrics</h3>
            <p className="muted-body">
              Only {pct(d.dataset.fraudRate, 1)} of postings are fraudulent. Predicting “genuine” for every posting already
              scores {majority ? pct(majority.accuracy ?? 0, 1) : '95.2%'} accuracy while catching no fraud — so accuracy is
              reported but never used to choose a model.
            </p>
            <ul className="metric-why">
              <li><strong>Precision</strong> — of the postings we flag, how many carry the fraud label (cost: genuine employers wrongly flagged).</li>
              <li><strong>Recall</strong> — of the fraud-labelled postings, how many we flag (cost: scams missed).</li>
              <li><strong>F1</strong> — balances the two; used to pick the threshold on training out-of-fold scores.</li>
              <li><strong>PR-AUC</strong> (average precision) — ranking quality across all thresholds; chance level equals the fraud rate, {d.dataset.fraudRate.toFixed(3)}.</li>
              <li><strong>ROC-AUC</strong> — reported for completeness; it looks optimistic when one class is this rare.</li>
            </ul>
            <p className="muted small" style={{ marginBottom: 0 }}>
              Uncertainty: 95% bootstrap intervals on the test set. No significance test is used — the question is how
              well the model works, not whether two close models differ.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
