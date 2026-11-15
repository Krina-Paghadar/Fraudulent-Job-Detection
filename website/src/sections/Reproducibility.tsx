import { research } from '../data/research';
import { SectionHeader, Reveal } from '../components/primitives';
import { REPO_URL } from '../config';
import parity from '../../public/data/parity_report.json';
import audit from '../../public/data/artifact_audit.json';

/* Each stage of the work, what produced it, and the file that holds it.
   Kept separate on purpose: CV, threshold selection and the held-out test are different steps. */
const STAGES = [
  {
    n: '01', h: 'Research pipeline',
    p: 'EDA, duplicate audit, grouped split, all model comparisons and the final evaluation run top-to-bottom in one notebook.',
    files: ['notebooks/01_dataset_understanding.ipynb', 'results/final_split_manifest.csv', 'results/split_metadata.json'],
  },
  {
    n: '02', h: 'Model comparison (CV)',
    p: 'Grouped 5-fold cross-validation on the 14,304 training postings only. LR rows with length features use the corrected log1p + scaling pipeline.',
    files: ['results/all_model_cv_results.csv', 'results/corrected_scaled_model_comparison.csv', 'results/metadata_gradient_boosting_summary.csv'],
  },
  {
    n: '03', h: 'Threshold selection (training OOF)',
    p: 'Out-of-fold decision scores on the training split; the F1-maximising threshold τ = −0.3041 was frozen before the test set was scored.',
    files: ['results/oof_threshold_selection.csv', 'results/oof_unweighted_svm_scores.csv'],
  },
  {
    n: '07', h: 'Extra experiment (post-hoc)',
    p: 'Near-copy check: how similar each test posting is to its closest training posting, and recall with/without one. Run after the final evaluation; nothing was re-tuned.',
    files: ['src/near_duplicate_audit.py', 'results/near_duplicate_audit.json'],
  },
  {
    n: '04', h: 'Frozen model artifact',
    p: 'The refit unweighted LinearSVC exported once: 100,000-term vocabulary, IDF weights, coefficients, intercept, threshold, field order. The site loads this exact file.',
    files: ['results/final_svm_model.json'],
  },
  {
    n: '05', h: 'Held-out evaluation',
    p: 'The 3,576-posting test set scored a single time at the frozen threshold, with 2,000-resample bootstrap intervals and error analysis.',
    files: ['results/final_test_scores.csv', 'results/final_svm_test_metrics.csv', 'results/final_test_bootstrap_ci.csv'],
  },
  {
    n: '06', h: 'Python ↔ JavaScript parity',
    p: 'npm run verify-model imports the scorer this site ships and compares it with scikit-learn on held-out postings and Unicode / punctuation / long-input edge cases.',
    files: ['results/javascript_verification.json', 'website/src/data/edge_reference.json', 'website/scripts/verify-model.mjs'],
  },
];

export function Reproducibility() {
  const held = parity.suites.find((s) => s.name.startsWith('held-out'));
  const edge = parity.suites.find((s) => s.name.startsWith('edge'));
  const maxDiff = Math.max(...parity.suites.map((s) => s.max_abs_diff));
  return (
    <section className="section" id="reproduce">
      <div className="container">
        <SectionHeader
          eyebrow="Reproducibility"
          title={<>Every result is <span className="gradient-text">traceable to a file</span></>}
          lead={<>The site’s numbers are generated from the frozen files in <span className="mono">results/</span> by
            <span className="mono"> website/scripts/build-data.py</span>, and checked against them by
            <span className="mono"> scripts/audit_artifacts.py</span>. One exception is stated below.</>}
        />

        <div className="grid grid-3 repro-stages" style={{ marginBottom: 18 }}>
          {[...STAGES].sort((a, b) => a.n.localeCompare(b.n)).map((s, i) => (
            <Reveal className="card" as="div" delay={0.04 * i} key={s.n}>
              <span className="repro-step mono">{s.n}</span>
              <h3 className="card-h">{s.h}</h3>
              <p className="muted-body">{s.p}</p>
              <ul className="repro-files">
                {s.files.map((f) => (
                  <li key={f}>
                    <a className="artifact-link" href={`${REPO_URL}/blob/main/${f}`} target="_blank" rel="noreferrer">
                      <code className="artifact-f">{f}</code>
                    </a>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>

        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <Reveal className="card" as="div">
            <h3 className="card-h">Verification results</h3>
            <ul className="verify-list">
              <li>
                <strong className={parity.result === 'PASS' ? 'v-teal' : 'v-danger'}>{parity.result}</strong> · model parity:
                {held && <> {held.examples} held-out postings</>}{edge && <> + {edge.examples} edge cases</>}, max |score difference|{' '}
                <span className="mono">{maxDiff.toExponential(1)}</span>,{' '}
                {parity.suites.reduce((a, s) => a + s.disagreements, 0)} flag disagreements. The website model file is byte-identical to{' '}
                <span className="mono">results/final_svm_model.json</span>.
              </li>
              <li>
                <strong className={audit.result === 'PASS' ? 'v-teal' : 'v-danger'}>{audit.result}</strong> · artifact audit:
                {' '}{audit.checks.filter((c) => c.pass).length}/{audit.n_checks} checks — metrics, bootstrap CIs, confusion matrix
                (recomputed from the saved test scores), split manifest (zero group overlap), OOF thresholds and every
                comparison-table value traced to its CSV.
              </li>
              <li>
                <strong>Stated exception:</strong> the rule baseline’s CV numbers are transcribed from the notebook’s printed
                output — the notebook did not save them to a CSV.
              </li>
              <li>
                <strong>Platform note:</strong> the split is reproducible exactly with scikit-learn ≥ 1.8; LinearSVC weights can
                differ in the last digits across operating systems, so the shipped model is the exported file, not a re-fit.
              </li>
            </ul>
          </Reveal>

          <Reveal className="card" as="div" delay={0.06}>
            <h3 className="card-h">Rerun it</h3>
            <ol className="repro-cmds">
              <li>Get <span className="mono">fake_job_postings.csv</span> (EMSCAD, {research.dataset.years}; Vidros et al., 2017) from Kaggle — it is not committed to the repository.</li>
              <li>Run <span className="mono">notebooks/01_dataset_understanding.ipynb</span> top to bottom (seed 42).</li>
              <li><code className="code">python src/verify_split.py --data …</code> — re-derives the split and checks it row by row against the manifest.</li>
              <li><code className="code">python website/scripts/build-data.py</code> — regenerates the site’s data files.</li>
              <li><code className="code">npm run audit</code> and <code className="code">npm run verify-model</code> (in <span className="mono">website/</span>).</li>
              <li><code className="code">npm run build</code> — static output in <span className="mono">website/dist/</span>.</li>
            </ol>
            <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a className="btn btn-ghost btn-sm" href={REPO_URL} target="_blank" rel="noreferrer">View the repository →</a>
            </div>
          </Reveal>
        </div>

        <div className="grid grid-2" style={{ alignItems: 'start', marginTop: 18 }}>
          <Reveal className="card" as="div">
            <h3 className="card-h">References</h3>
            <ul className="ref-list">
              <li>Vidros, S., Kolias, C., Kambourakis, G., &amp; Akoglu, L. (2017). Automatic detection of online recruitment frauds: characteristics, methods, and a public dataset. <em>Future Internet</em>, 9(1), 6. <a href="https://doi.org/10.3390/fi9010006" target="_blank" rel="noreferrer">doi:10.3390/fi9010006</a></li>
              <li>Real / Fake Job Posting Prediction (CSV distribution of EMSCAD), Kaggle. <a href="https://www.kaggle.com/datasets/shivamb/real-or-fake-fake-jobposting-prediction" target="_blank" rel="noreferrer">kaggle.com/datasets/shivamb/real-or-fake-fake-jobposting-prediction</a></li>
              <li>Pedregosa, F. et al. (2011). Scikit-learn: Machine learning in Python. <em>JMLR</em>, 12, 2825–2830.</li>
              <li>Saito, T., &amp; Rehmsmeier, M. (2015). The precision-recall plot is more informative than the ROC plot when evaluating binary classifiers on imbalanced datasets. <em>PLOS ONE</em>, 10(3).</li>
              <li>Website built with React, Vite and Framer Motion (MIT licences).</li>
            </ul>
          </Reveal>
          <Reveal className="card" as="div" delay={0.05}>
            <h3 className="card-h">AI-use disclosure</h3>
            <p className="muted-body">
              We used ChatGPT and Claude for project planning, discussing ML methodology, drafting and debugging code,
              interpreting results, technical review (including catching the unscaled length-feature bug, fixed in notebook
              cell 44), building this website and its JavaScript scorer, and editing documentation.
            </p>
            <p className="muted-body" style={{ marginBottom: 0 }}>
              Every reported number comes from code we ran. Checked independently: the split (zero group overlap), that every
              figure on this site matches <span className="mono">results/</span> (<span className="mono">npm run audit</span>),
              and that the browser model reproduces scikit-learn’s scores (<span className="mono">npm run verify-model</span>).
              We are responsible for all results and choices. Full statement in the repository README.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
