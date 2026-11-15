import { research } from '../data/research';
import { SectionHeader, Reveal } from '../components/primitives';
import { MetricMeter, ConfusionMatrix } from '../components/charts';
import { num } from '../lib/format';

const ORDER: { key: string; label: string }[] = [
  { key: 'pr_auc', label: 'PR-AUC' },
  { key: 'roc_auc', label: 'ROC-AUC' },
  { key: 'f1', label: 'F1 (fraud)' },
  { key: 'precision', label: 'Precision (fraud)' },
  { key: 'recall', label: 'Recall (fraud)' },
  { key: 'balanced_accuracy', label: 'Balanced accuracy' },
  { key: 'accuracy', label: 'Accuracy' },
];

export function Results() {
  const boot = research.finalTest.bootstrap;
  const c = research.confusion;
  const oof = research.oofThresholds;
  const sel = oof.find((o) => Math.abs(o.threshold - c.threshold) < 1e-12);
  const m = research.finalTest.metrics;
  return (
    <section className="section" id="results">
      <div className="container">
        <SectionHeader
          eyebrow="Held-out results"
          title={<>Scored <span className="gradient-text">once</span>, with honest error bars</>}
          lead="The frozen model on the untouched test set. 95% confidence intervals come from bootstrap resampling — with only 173 fraud cases, the intervals matter."
        />

        {/* the three evaluation stages, kept separate */}
        <Reveal className="stage-strip" as="div">
          <div className="stage"><span className="stage-n mono">1</span><div><strong>Model comparison</strong><span>grouped 5-fold CV on the training split · <a href="#models">table above</a></span></div></div>
          <div className="stage"><span className="stage-n mono">2</span><div><strong>Threshold selection</strong><span>out-of-fold scores on the training split only · F1-maximising</span></div></div>
          <div className="stage stage-final"><span className="stage-n mono">3</span><div><strong>Held-out evaluation</strong><span>refit on all training rows · test set scored once</span></div></div>
        </Reveal>

        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <Reveal className="card" as="div">
            <h3 className="card-h">Step 2 · Threshold chosen on training out-of-fold scores</h3>
            <p className="muted small" style={{ marginTop: -4 }}>
              Each training posting was scored by a model that never saw it; the threshold maximising F1 was then
              frozen. Logistic-regression thresholds are probabilities, SVM thresholds are decision-function values.
            </p>
            <div className="table-wrap">
              <table className="data compact">
                <caption className="table-caption">Out-of-fold threshold selection (training split only)</caption>
                <thead><tr><th scope="col">Model (OOF)</th><th scope="col">Threshold</th><th scope="col">Prec.</th><th scope="col">Recall</th><th scope="col">F1</th></tr></thead>
                <tbody>
                  {oof.map((o) => (
                    <tr key={o.model} className={o === sel ? 'row-final' : ''}>
                      <th scope="row">{o.model}{o === sel && <span className="row-note"> · selected</span>}</th>
                      <td className="num">{o.threshold.toFixed(4)}</td>
                      <td className="num">{num(o.precision, 3)}</td>
                      <td className="num">{num(o.recall, 3)}</td>
                      <td className="num">{num(o.f1, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">
              The two SVMs differ in OOF F1 by only {sel ? num(Math.abs(sel.f1 - (oof.find((o) => o.model === 'Balanced Linear SVM')?.f1 ?? sel.f1)), 4) : '—'} — within
              fold-to-fold variation. The unweighted SVM was chosen by the pre-stated “highest OOF F1” rule, not because it is
              demonstrably better. Frozen threshold: <span className="mono">τ = {c.threshold}</span>.
            </p>
          </Reveal>

          <Reveal className="card" as="div" delay={0.06}>
            <h3 className="card-h">Step 3 · Held-out confusion matrix (frozen)</h3>
            <ConfusionMatrix tp={c.tp} fp={c.fp} tn={c.tn} fn={c.fn} caption={`Test set · τ = ${c.threshold.toFixed(4)}`} />
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="data compact">
                <caption className="table-caption">Out-of-fold (training) vs held-out test, at the frozen threshold</caption>
                <thead><tr><th scope="col">Metric</th><th scope="col">OOF</th><th scope="col">Test</th><th scope="col">Δ</th></tr></thead>
                <tbody>
                  {sel && (['precision', 'recall', 'f1'] as const).map((k) => (
                    <tr key={k}>
                      <th scope="row">{k === 'f1' ? 'F1' : k[0].toUpperCase() + k.slice(1)}</th>
                      <td className="num">{num(sel[k], 3)}</td>
                      <td className="num">{num(m[k], 3)}</td>
                      <td className="num">{m[k] - sel[k] >= 0 ? '+' : ''}{num(m[k] - sel[k], 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">
              Test recall is about ten points below the OOF estimate used to pick the threshold — the expected optimism of
              tuning and estimating on the same data, which is exactly what the untouched test set exposes.
            </p>
          </Reveal>
        </div>

        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <Reveal className="card" as="div">
            <h3 className="card-h">Held-out metrics with 95% bootstrap CIs</h3>
            <p className="muted small" style={{ marginTop: -4 }}>2,000 resamples of the 3,576 test rows (seed 42), percentile intervals. PR-AUC = average precision.</p>
            {ORDER.map(({ key, label }) => (
              <MetricMeter key={key} label={label} value={boot[key].est} lo={boot[key].lo} hi={boot[key].hi} />
            ))}
          </Reveal>

          <Reveal className="card" as="div" delay={0.08}>
            <h3 className="card-h">What this says</h3>
            <p className="muted-body">
              At the fixed threshold the model catches <strong>{c.tp}</strong> of {c.tp + c.fn}{' '}
              fraudulent postings while raising only <strong>{c.fp}</strong> false alarms across{' '}
              {(c.tp + c.fp + c.tn + c.fn).toLocaleString()} test postings.
            </p>
            <div className="result-callouts">
              <div className="callout">
                <span className="callout-v mono v-teal">{num(research.finalTest.metrics.pr_auc, 3)}</span>
                <span className="callout-k">PR-AUC vs {num(research.dataset.fraudRate, 3)} baseline — about {(research.finalTest.metrics.pr_auc / research.dataset.fraudRate).toFixed(0)}× the prevalence</span>
              </div>
              <div className="callout">
                <span className="callout-v mono v-violet">{(research.finalTest.metrics.precision * 100).toFixed(0)}%</span>
                <span className="callout-k">of flagged test postings carry the fraud label (precision)</span>
              </div>
              <div className="callout">
                <span className="callout-v mono v-danger">{c.fn}</span>
                <span className="callout-k">fraudulent postings still slipped through (false negatives)</span>
              </div>
            </div>
            <p className="muted small" style={{ marginTop: 16 }}>
              The wide recall interval — [{num(boot.recall.lo, 2)}, {num(boot.recall.hi, 2)}] — is a
              direct consequence of the small fraud count (173 test cases). These intervals cover test-set
              sampling noise only; they do not include model-selection uncertainty or how the model would
              behave on newer postings.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
