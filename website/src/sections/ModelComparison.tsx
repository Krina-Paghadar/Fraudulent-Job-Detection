import { useState } from 'react';
import { research, type ModelRow } from '../data/research';
import { SectionHeader, Reveal } from '../components/primitives';
import { HBars } from '../components/charts';
import { num } from '../lib/format';

const METRICS: { key: keyof ModelRow; label: string }[] = [
  { key: 'pr_auc', label: 'PR-AUC' },
  { key: 'f1', label: 'F1' },
  { key: 'recall', label: 'Recall' },
  { key: 'precision', label: 'Precision' },
  { key: 'balanced_accuracy', label: 'Balanced acc.' },
  { key: 'roc_auc', label: 'ROC-AUC' },
];

const FAMILY_COLOR: Record<string, string> = {
  baseline: 'linear-gradient(90deg, #4a5168, #6f7890)',
  text: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
  metadata: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
  combined: 'linear-gradient(90deg, #2dd4bf, #22d3ee)',
};
const FAMILY_DOT: Record<string, string> = {
  baseline: '#6f7890', text: '#8b5cf6', metadata: '#fbbf24', combined: '#22d3ee',
};

// Fundamentals of every method compared (settings exactly as in the notebook, cells 28-37).
const METHODS: [string, string, string, string][] = [
  ['Majority class', 'Always predicts the most common class (genuine).', '—', 'The floor: 95.2% accuracy but 0 fraud caught, showing why accuracy is not used.'],
  ['Rule baseline', 'Flag if the company profile is empty AND there is no logo.', 'One visible signal is enough.', 'Tests whether a simple human rule already solves the problem (it catches ~66% of fraud, at 22% precision).'],
  ['Logistic Regression', 'Models the log-odds of fraud as a weighted sum of TF-IDF features; minimises log-loss + L2 penalty (C = 1).', 'Feature effects add up linearly in log-odds.', 'Standard, interpretable model for sparse high-dimensional text; gives probabilities.'],
  ['Linear SVM', 'Finds the separating hyperplane with the widest margin; minimises squared hinge loss + L2 penalty (C = 1).', 'Classes are (roughly) linearly separable in TF-IDF space.', 'Strong on sparse text; focuses on hard, near-boundary postings. Outputs a distance, not a probability.'],
  ['Naive Bayes (Multinomial, Complement)', 'Bayes’ rule with per-class word frequencies (Laplace smoothing α = 1); Complement NB learns from the other class, built for imbalance.', 'Words are independent given the class.', 'Fast generative reference point; the independence assumption is clearly wrong for phrases, which is part of what we test.'],
  ['Gradient Boosting (metadata)', 'Adds 120 shallow trees (depth 2, learning rate 0.05, 80% subsampling), each fitting the errors of the ones before.', 'Signal lies in interactions of structured fields.', 'Captures non-linear patterns in location, salary, flags etc. without scaling; tests how far metadata goes without text.'],
  ['class_weight = balanced', 'Reweights the loss so each fraud error counts ≈ 20× a genuine one.', '—', 'One way to handle the 4.8% fraud rate; compared against no weighting + a tuned threshold.'],
];

export function ModelComparison() {
  const [metric, setMetric] = useState<keyof ModelRow>('pr_auc');
  const [sortKey, setSortKey] = useState<keyof ModelRow>('pr_auc');
  const [sortDir, setSortDir] = useState<-1 | 1>(-1);

  const models = research.modelComparison.models;
  const barData = models
    .map((m) => ({
      label: m.name,
      value: (m[metric] as number) ?? 0,
      display: m[metric] == null ? '—' : num(m[metric] as number, 3),
      color: FAMILY_COLOR[m.family],
      highlight: m.note.includes('selected model'),
    }))
    .sort((a, b) => b.value - a.value);

  const sorted = [...models].sort((a, b) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name) * sortDir;
    const av = (a[sortKey] as number) ?? -1;
    const bv = (b[sortKey] as number) ?? -1;
    return (av - bv) * sortDir;
  });
  const ariaSort = (k: keyof ModelRow) => (sortKey === k ? (sortDir === -1 ? 'descending' : 'ascending') : 'none') as 'descending' | 'ascending' | 'none';

  const setSort = (k: keyof ModelRow) => {
    if (k === sortKey) setSortDir((d) => (d === -1 ? 1 : -1));
    else { setSortKey(k); setSortDir(-1); }
  };

  const cols: { key: keyof ModelRow; label: string }[] = [
    { key: 'pr_auc', label: 'PR-AUC' },
    { key: 'roc_auc', label: 'ROC-AUC' },
    { key: 'f1', label: 'F1' },
    { key: 'precision', label: 'Prec.' },
    { key: 'recall', label: 'Recall' },
    { key: 'balanced_accuracy', label: 'Bal. acc.' },
    { key: 'accuracy', label: 'Acc.' },
  ];

  return (
    <section className="section" id="models">
      <div className="container">
        <SectionHeader
          eyebrow="Model comparison"
          title={<>What actually <span className="gradient-text">beats the baselines</span></>}
          lead={<>Every number in this section is a <strong>mean over grouped 5-fold cross-validation on the training split</strong> (14,304 postings). The held-out test set is not used here — its results are in the next sections.</>}
        />

        <Reveal className="card" as="div">
          <h3 className="card-h">Methods: core idea, assumptions, and why each is here</h3>
          <p className="muted small" style={{ marginTop: -4 }}>
            Text models share the same TF-IDF input; only the classifier changes, so differences come from the method.
            Settings are fixed in advance (no grid search). Naive Bayes goes beyond the course syllabus; it is included as a simple generative reference point.
          </p>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="data compact choices">
              <thead><tr><th scope="col">Method</th><th scope="col">Core idea / objective</th><th scope="col">Key assumption</th><th scope="col">Why it is in the comparison</th></tr></thead>
              <tbody>
                {METHODS.map(([m, idea, a, why]) => (
                  <tr key={m}><th scope="row">{m}</th><td>{idea}</td><td>{a}</td><td>{why}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        <Reveal className="card" as="div">
          <h3 className="card-h" id="cv-title" style={{ marginTop: 0 }}>Model comparison — 5-fold cross-validation</h3>
          <p className="muted small" style={{ marginTop: -4 }}>
            Mean across the five training folds, each model at its <em>default</em> decision threshold
            (0.5 for probabilities, 0 for SVM scores). Selected model: <strong>Unweighted Linear SVM</strong>.
          </p>
          <div className="metric-switch">
            <span className="metric-switch-label">Rank by</span>
            {METRICS.map((m) => (
              <button
                key={String(m.key)}
                className={`seg ${metric === m.key ? 'seg-active' : ''}`}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <HBars data={barData} max={1} />
          <div className="fam-legend">
            {Object.entries(FAMILY_DOT).map(([fam, c]) => (
              <span key={fam}><i className="legend-dot" style={{ background: c }} /> {fam}</span>
            ))}
            <span className="fam-legend-note">— glow marks the selected model (Unweighted Linear SVM)</span>
          </div>
        </Reveal>

        <Reveal as="div" delay={0.06} className="models-table-wrap">
          <div className="table-wrap">
            <table className="data" aria-describedby="cv-table-note">
              <caption className="table-caption">Model comparison — 5-fold cross-validation (training split, mean across folds). Click a column to sort.</caption>
              <thead>
                <tr>
                  <th scope="col" aria-sort={ariaSort('name')}>
                    <button type="button" className="th-sort" onClick={() => setSort('name')}>
                      Model{sortKey === 'name' ? (sortDir === -1 ? ' ↓' : ' ↑') : ''}
                    </button>
                  </th>
                  {cols.map((c) => (
                    <th scope="col" key={String(c.key)} aria-sort={ariaSort(c.key)}>
                      <button type="button" className="th-sort" onClick={() => setSort(c.key)}>
                        {c.label}{sortKey === c.key ? (sortDir === -1 ? ' ↓' : ' ↑') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((m) => (
                  <tr key={m.name} className={m.note.includes('selected model') ? 'row-final' : ''}>
                    <td>
                      <span className="fam-dot" style={{ background: FAMILY_DOT[m.family] }} />
                      {m.name}
                      {m.note && <span className="row-note"> · {m.note}</span>}
                    </td>
                    {cols.map((c) => (
                      <td className="num" key={String(c.key)}>{num(m[c.key] as number, 3)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small" id="cv-table-note" style={{ marginTop: 12 }}>
            <strong>These are cross-validation results, not final test results.</strong> PR-AUC here is
            average precision (scikit-learn <span className="mono">average_precision_score</span>); its
            chance level is the fraud rate, 0.048, which is what the majority baseline scores. The rule
            baseline’s values are the 5-fold CV means printed in the notebook (no CSV was saved); its
            PR-AUC/ROC-AUC come from a two-valued score. Rows marked “corrected scaling” use the
            log1p + median-impute + standardise pipeline (notebook cell 44); the earlier unscaled runs
            are superseded and not shown. The selected model’s F1 here (0.794) is at the default
            threshold; with the threshold chosen on out-of-fold scores it reaches 0.874 (OOF) —
            see <a href="#results">held-out results</a>, where it is evaluated once on the test set.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
