import { motion } from 'framer-motion';
import { research } from '../data/research';
import { SectionHeader, Reveal } from '../components/primitives';
import { int, pct } from '../lib/format';

interface Step {
  n: string;
  title: string;
  body: string;
  stat: string;
  statLabel: string;
  tone: 'violet' | 'teal';
}

const CHOICES: [string, string, string][] = [
  ['Duplicates', 'kept; grouped by identical normalised text', 'Deleting them would change the class balance; grouping still keeps exact copies out of the test set.'],
  ['Text input', '5 fields joined with their names', 'One document per posting. Side effect: an empty field leaves its name behind (see Errors).'],
  ['Normalisation', 'lower-case, strip accents', 'Treat “Café”/“cafe”, “DATA”/“data” as the same word.'],
  ['N-grams', 'unigrams + bigrams', 'Phrases such as “data entry” or “below link” carry signal single words miss.'],
  ['Vocabulary', 'min_df=2, max_df=0.98, 100,000 terms', 'Drop one-off and near-universal terms; bound the model size.'],
  ['Weighting', 'TF-IDF, sublinear tf, L2 norm', 'Rare, specific words count more; long repetitive ads don’t dominate.'],
  ['Stop words', 'not removed', 'Short words are part of telling phrases (“using below”, “our clients”).'],
  ['Metadata (comparison models)', 'categorical: impute “Missing” + one-hot (min_frequency=20); lengths: log1p + median impute + standardise', 'Rare categories pooled; skewed character counts made comparable before logistic regression.'],
  ['Class imbalance', 'class_weight none vs balanced (both tried); threshold tuned on OOF scores', 'Handles the 4.8% fraud rate without resampling the data.'],
];

export function Methodology() {
  const d = research;
  const steps: Step[] = [
    {
      n: '01', title: 'The dataset', tone: 'violet',
      body: `EMSCAD — ${int(d.dataset.total)} real postings (2012–2014). Only ${pct(d.dataset.fraudRate, 1)} are fraudulent, so accuracy alone is meaningless.`,
      stat: `${d.dataset.fraud}`, statLabel: 'fraudulent postings',
    },
    {
      n: '02', title: 'Inspect, don’t discard', tone: 'teal',
      body: `Heavy missingness and many repeated templates. Rather than delete duplicates, rows were kept and grouped by identical normalized combined text.`,
      stat: `${int(d.duplicates.multiRowGroups)}`, statLabel: 'multi-row text groups',
    },
    {
      n: '03', title: 'Group-aware split', tone: 'violet',
      body: `StratifiedGroupKFold keeps every identical-text group on one side of the split, so an exact copy can’t appear in both train and test. Near-duplicates (lightly edited copies) are not grouped and can still cross.`,
      stat: `${d.split.group_overlap}`, statLabel: 'groups crossing the split',
    },
    {
      n: '04', title: 'TF-IDF features', tone: 'teal',
      body: `Five text fields are combined (with their field labels) and vectorized into 1–2 gram TF-IDF features with sublinear term frequency and L2 norm.`,
      stat: '100k', statLabel: 'vocabulary terms',
    },
    {
      n: '05', title: 'Group-aware CV', tone: 'violet',
      body: `Models are compared with 5-fold group-aware cross-validation on the training split only. The TF-IDF vocabulary is fit per fold.`,
      stat: '5', statLabel: 'folds, train-only',
    },
    {
      n: '06', title: 'Out-of-fold threshold', tone: 'teal',
      body: `The operating threshold is chosen from training out-of-fold scores — never from the test set — then frozen before final evaluation.`,
      stat: d.model.threshold.toFixed(3), statLabel: 'frozen threshold τ',
    },
    {
      n: '07', title: 'Freeze the model', tone: 'violet',
      body: `An unweighted Linear SVM is refit on all training data and frozen. This exact model file is what the risk checker below runs in your browser.`,
      stat: 'LinearSVC', statLabel: 'final estimator',
    },
    {
      n: '08', title: 'Evaluate once', tone: 'teal',
      body: `The held-out test set is scored a single time. Bootstrap resampling gives 95% confidence intervals on every metric. PR-AUC here is average precision.`,
      stat: d.finalTest.metrics.pr_auc.toFixed(3), statLabel: 'held-out PR-AUC',
    },
  ];

  return (
    <section className="section" id="methodology">
      <div className="container">
        <SectionHeader
          eyebrow="Methodology"
          title={<>Eight steps, <span className="gradient-text">test set kept out</span></>}
          lead="The whole pipeline is built so that nothing the test set knows can sneak into training — the usual way fraud detectors look better than they are."
        />
        <div className="pipeline">
          <div className="pipeline-spine" aria-hidden>
            <motion.div
              className="pipeline-spine-fill"
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 1.8, ease: 'easeInOut' }}
            />
          </div>
          {steps.map((s, i) => (
            <Reveal className="pipeline-step" key={s.n} delay={i * 0.04} as="div">
              <div className={`pipeline-node node-${s.tone}`}>{s.n}</div>
              <div className="card card-hover pipeline-card">
                <div className="pipeline-card-inner">
                  <div>
                    <h3 className="pipeline-title">{s.title}</h3>
                    <p className="pipeline-body">{s.body}</p>
                  </div>
                  <div className={`pipeline-stat stat-${s.tone}`}>
                    <span className="pipeline-stat-v mono">{s.stat}</span>
                    <span className="pipeline-stat-k">{s.statLabel}</span>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="card" as="div" delay={0.05}>
          <h3 className="card-h">Preprocessing choices, and why</h3>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="data compact choices">
              <caption className="table-caption">Every learned step (vocabulary, IDF, imputers, encoders, scalers) is fitted inside a scikit-learn Pipeline on training folds only.</caption>
              <thead><tr><th scope="col">Choice</th><th scope="col">Setting</th><th scope="col">Why</th></tr></thead>
              <tbody>
                {CHOICES.map(([c, s, w]) => (
                  <tr key={c}><th scope="row">{c}</th><td className="mono">{s}</td><td>{w}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
