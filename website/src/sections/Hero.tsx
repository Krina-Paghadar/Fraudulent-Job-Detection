import { motion } from 'framer-motion';
import { research } from '../data/research';
import { pct, int } from '../lib/format';
import type { ScorerStatus } from '../lib/useScorer';

export function Hero({ status }: { status: ScorerStatus }) {
  const m = research.finalTest.metrics;
  return (
    <section className="hero container" id="top">
      <div className="hero-grid">
        <div>
          <motion.div
            className="hero-badge"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="pill pill-teal">
              <span className="nav-dot" style={{ width: 7, height: 7 }} />
              {status.state === 'ready' ? 'Model live in your browser' : 'Loading model…'}
            </span>
            <span className="pill">ES 335 · research</span>
          </motion.div>

          <h1>
            {['Can the words', 'of a job post', 'reveal a scam?'].map((line, i) => (
              <motion.span
                className="line"
                key={line}
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, delay: 0.1 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                {i === 2 ? <span className="gradient-text">{line}</span> : line}
              </motion.span>
            ))}
          </h1>

          <motion.p
            className="hero-sub"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
          >
            A leakage-aware text classifier trained and evaluated on {int(research.dataset.total)} real
            2012–2014 postings from the EMSCAD dataset. Paste a posting and the <em>actual</em> frozen
            Linear SVM scores it — right here, no server.
          </motion.p>

          <motion.div
            className="hero-ctas"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55 }}
          >
            <a href="#checker" className="btn btn-primary">Analyze a posting</a>
            <a href="#methodology" className="btn btn-ghost">See the method</a>
          </motion.div>

          <motion.div
            className="hero-metrics"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.7 }}
          >
            <div className="hero-metric">
              <div className="v">{m.pr_auc.toFixed(3)}</div>
              <div className="k">PR-AUC (held-out)</div>
            </div>
            <div className="hero-metric">
              <div className="v">{pct(m.precision, 0)}</div>
              <div className="k">fraud precision</div>
            </div>
            <div className="hero-metric">
              <div className="v">{pct(m.recall, 0)}</div>
              <div className="k">fraud recall</div>
            </div>
            <div className="hero-metric">
              <div className="v">{m.f1.toFixed(3)}</div>
              <div className="k">fraud F1 (held-out)</div>
            </div>
          </motion.div>
        </div>

        <motion.div
          className="preview-wrap"
          initial={{ opacity: 0, x: 40, rotateY: -16 }}
          animate={{ opacity: 1, x: 0, rotateY: -9 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <HeroPreview />
        </motion.div>
      </div>
    </section>
  );
}

function HeroPreview() {
  return (
    <div className="preview-card">
      <div className="preview-glow" aria-hidden />
      <div className="preview-head">
        <div className="preview-dots"><i /><i /><i /></div>
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-dim)' }}>risk-checker</span>
      </div>
      {['Job title', 'Company profile', 'Description', 'Requirements'].map((f, i) => (
        <motion.div
          className="preview-row"
          key={f}
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9 + i * 0.12, duration: 0.5 }}
        >
          <span style={{ width: 86, color: 'var(--fg-dim)' }}>{f}</span>
          <span className="preview-bar" style={{ opacity: 0.4 + i * 0.12 }} />
        </motion.div>
      ))}
      <motion.div
        className="preview-score"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.6 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: 12, color: 'var(--fg-dim)' }}>decision score</span>
          <span className="pill pill-safe">likely genuine</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
          <span className="mono" style={{ fontSize: 30, color: 'var(--safe)', fontWeight: 600 }}>−1.01</span>
          <span className="mono" style={{ fontSize: 12, color: 'var(--fg-dim)' }}>vs τ = −0.304</span>
        </div>
      </motion.div>
    </div>
  );
}
