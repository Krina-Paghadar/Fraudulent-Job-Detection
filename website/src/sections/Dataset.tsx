import { motion } from 'framer-motion';
import { research } from '../data/research';
import { SectionHeader, Reveal } from '../components/primitives';
import { ImbalanceDonut } from '../components/charts';
import { int, pct } from '../lib/format';

export function Dataset() {
  const d = research;
  // most class-separating missing fields
  const miss = [...d.dataset.missingness]
    .filter((m) => m.pctAll > 1)
    .sort((a, b) => Math.abs(b.pctFraud - b.pctGenuine) - Math.abs(a.pctFraud - a.pctGenuine))
    .slice(0, 6);
  const maxMiss = Math.max(...miss.flatMap((m) => [m.pctFraud, m.pctGenuine]), 1);

  return (
    <section className="section" id="data">
      <div className="container">
        <SectionHeader
          eyebrow="The data"
          title={<>A rare signal in a <span className="gradient-text">noisy, leaky</span> dataset</>}
          lead="Before any modelling: how imbalanced is it, what’s missing, and how many postings are really just copies of each other?"
        />

        {/* imbalance + duplicates */}
        <div className="grid grid-2" style={{ marginBottom: 18 }}>
          <Reveal className="card" as="div">
            <div className="data-imbalance">
              <ImbalanceDonut fraud={d.dataset.fraud} genuine={d.dataset.genuine} />
              <div>
                <h3 className="card-h">Class imbalance</h3>
                <p className="muted-body">
                  Only <strong>{int(d.dataset.fraud)}</strong> of {int(d.dataset.total)} postings
                  are fraudulent. A model that predicts “genuine” every time already scores{' '}
                  {pct(d.dataset.genuine / d.dataset.total, 1)} accuracy — and catches zero fraud.
                  That’s why PR-AUC and fraud-class recall, not accuracy, drive the research.
                </p>
                <div className="legend">
                  <span><i className="legend-dot" style={{ background: 'var(--danger)' }} /> Fraudulent · {int(d.dataset.fraud)}</span>
                  <span><i className="legend-dot" style={{ background: 'var(--glass-border-strong)' }} /> Genuine · {int(d.dataset.genuine)}</span>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal className="card" as="div" delay={0.08}>
            <h3 className="card-h">Duplicates — kept, not deleted</h3>
            <p className="muted-body">
              Many postings are near-identical templates. Instead of dropping them, identical
              normalized text was grouped so exact duplicates can’t straddle the split. (Near-duplicates are not grouped — see limitations.)
            </p>
            <div className="dup-tiles">
              <div className="dup-tile">
                <span className="dup-v v-teal mono">{int(d.duplicates.uniqueGroups)}</span>
                <span className="dup-k">unique text groups</span>
              </div>
              <div className="dup-tile">
                <span className="dup-v v-violet mono">{int(d.duplicates.multiRowGroups)}</span>
                <span className="dup-k">groups with duplicates</span>
              </div>
              <div className="dup-tile">
                <span className="dup-v v-danger mono">{int(d.duplicates.largestGroupSize)}</span>
                <span className="dup-k">rows in the largest group</span>
              </div>
            </div>
          </Reveal>
        </div>

        {/* missingness */}
        <Reveal className="card" as="div">
          <div className="miss-head">
            <h3 className="card-h" style={{ margin: 0 }}>Missingness is itself a clue</h3>
            <div className="legend">
              <span><i className="legend-dot" style={{ background: 'var(--danger)' }} /> missing in fraud</span>
              <span><i className="legend-dot" style={{ background: '#6366f1' }} /> missing in genuine</span>
            </div>
          </div>
          <p className="muted-body" style={{ maxWidth: '64ch' }}>
            Fraudulent postings skip fields far more often — a missing company profile is the
            clearest tell. Explicit missing-field indicators were tested in an ablation (removing them changed CV F1 by under 0.01),
            but the text model still sees missingness through the field-name template — see the
            {' '}<a href="#errors">error analysis</a>.
          </p>
          <div className="miss-list">
            {miss.map((m, i) => (
              <div className="miss-row" key={m.field}>
                <span className="miss-field">{m.field.replace(/_/g, ' ')}</span>
                <div className="miss-bars">
                  <div className="miss-bar-track">
                    <motion.div
                      className="miss-bar fraud"
                      initial={{ width: 0 }} whileInView={{ width: `${(m.pctFraud / maxMiss) * 100}%` }}
                      viewport={{ once: true }} transition={{ duration: 0.8, delay: i * 0.05 }}
                    />
                    <span className="miss-pct">{pct(m.pctFraud / 100, 0)}</span>
                  </div>
                  <div className="miss-bar-track">
                    <motion.div
                      className="miss-bar genuine"
                      initial={{ width: 0 }} whileInView={{ width: `${(m.pctGenuine / maxMiss) * 100}%` }}
                      viewport={{ once: true }} transition={{ duration: 0.8, delay: i * 0.05 }}
                    />
                    <span className="miss-pct">{pct(m.pctGenuine / 100, 0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* key variables + data-quality issues */}
        <div className="grid grid-2" style={{ margin: '18px 0', alignItems: 'start' }}>
          <Reveal className="card" as="div">
            <h3 className="card-h">Key variables (18 columns)</h3>
            <dl className="spec-list compact">
              <div><dt>Free text</dt><dd><span className="mono">title, company_profile, description, requirements, benefits</span> — the final model’s only input</dd></div>
              <div><dt>Categorical</dt><dd><span className="mono">location, department, salary_range, employment_type, required_experience, required_education, industry, function</span></dd></div>
              <div><dt>Binary flags</dt><dd><span className="mono">telecommuting, has_company_logo, has_questions</span></dd></div>
              <div><dt>Target</dt><dd><span className="mono">fraudulent</span> (866 = 1)</dd></div>
              <div><dt>Not used</dt><dd><span className="mono">job_id</span> (an identifier)</dd></div>
            </dl>
            <p className="muted small" style={{ marginBottom: 0 }}>
              Source: Vidros et al. (2017), Employment Scam Aegean Dataset, 2012–2014 postings, manually labelled; public CSV
              distributed on Kaggle. The raw file is not redistributed in the repository.
            </p>
          </Reveal>
          <Reveal className="card" as="div" delay={0.05}>
            <h3 className="card-h">Data-quality issues that shaped the design</h3>
            <ul className="metric-why">
              <li><strong>Severe imbalance</strong> (4.84% fraud) → fraud-class metrics, not accuracy; stratified splits.</li>
              <li><strong>Exact duplicates</strong> (2,755 rows in 747 repeated groups) → grouped split so a copy can’t sit on both sides.</li>
              <li><strong>Missing fields</strong>, unevenly by class (company profile missing in 68% of fraud vs 16% of genuine) → informative, but a shortcut risk.</li>
              <li><strong>Messy text</strong>: HTML remnants and words glued together (e.g. “full timejob”) → kept as-is; tokens such as <span className="mono">timejob</span> appear among the learned features.</li>
              <li><strong>No usable posting date</strong> → no time-based test; results describe this 2012–2014 sample only.</li>
            </ul>
          </Reveal>
        </div>

        {/* split */}
        <Reveal className="card" as="div" delay={0.05}>
          <h3 className="card-h">The frozen split</h3>
          <div className="split-viz">
            <div className="split-bar">
              <div className="split-train" style={{ width: `${(d.split.trainTotal / (d.split.trainTotal + d.split.testTotal)) * 100}%` }}>
                <span className="split-label">Train</span>
                <span className="split-num mono">{int(d.split.trainTotal)}</span>
                <span className="split-sub">{d.split.trainFraud} fraud</span>
              </div>
              <div className="split-test" style={{ width: `${(d.split.testTotal / (d.split.trainTotal + d.split.testTotal)) * 100}%` }}>
                <span className="split-label">Test</span>
                <span className="split-num mono">{int(d.split.testTotal)}</span>
                <span className="split-sub">{d.split.testFraud} fraud</span>
              </div>
            </div>
            <div className="split-meta">
              <span className="pill pill-teal">{d.split.split_method}</span>
              <span className="pill">seed {d.split.random_state}</span>
              <span className="pill pill-safe">group overlap: {d.split.group_overlap}</span>
              <span className="pill">{int(d.split.unique_text_groups)} text groups</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
