import { useEffect, useMemo, useState } from 'react';
import { research } from '../data/research';
import { SectionHeader, Reveal } from '../components/primitives';
import { ConfusionMatrix } from '../components/charts';
import { num, pct } from '../lib/format';

interface TestScores { threshold: number; scores: number[]; labels: number[]; }

const BASE = import.meta.env.BASE_URL;
const HIST_MIN = -2.5;
const HIST_MAX = 1.5;
const BINS = 48;

export function Lab() {
  const [data, setData] = useState<TestScores | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const operating = research.confusion.threshold;
  const [thr, setThr] = useState(operating);

  useEffect(() => {
    fetch(`${BASE}data/test_scores.json`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);

  const hist = useMemo(() => {
    if (!data) return null;
    const g = new Array(BINS).fill(0);
    const f = new Array(BINS).fill(0);
    const bw = (HIST_MAX - HIST_MIN) / BINS;
    for (let i = 0; i < data.scores.length; i++) {
      const b = Math.max(0, Math.min(BINS - 1, Math.floor((data.scores[i] - HIST_MIN) / bw)));
      if (data.labels[i] === 1) f[b]++; else g[b]++;
    }
    return { g, f, gMax: Math.max(...g), fMax: Math.max(...f), bw };
  }, [data]);

  const m = useMemo(() => {
    if (!data) return null;
    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (let i = 0; i < data.scores.length; i++) {
      const pred = data.scores[i] >= thr ? 1 : 0;
      const y = data.labels[i];
      if (y === 1 && pred === 1) tp++;
      else if (y === 0 && pred === 1) fp++;
      else if (y === 0 && pred === 0) tn++;
      else fn++;
    }
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    const accuracy = (tp + tn) / data.scores.length;
    return { tp, fp, tn, fn, precision, recall, f1, accuracy };
  }, [data, thr]);

  const atOperating = Math.abs(thr - operating) < 1e-9;
  const toX = (v: number) => ((v - HIST_MIN) / (HIST_MAX - HIST_MIN)) * 100;

  return (
    <section className="section" id="lab">
      <div className="container">
        <SectionHeader
          eyebrow="Model laboratory"
          title={<>Move the threshold, <span className="gradient-text">watch the trade-off</span></>}
          lead="This uses the real held-out decision scores. Drag the threshold to see precision, recall and the confusion matrix change — the classic fraud-detection trade-off."
        />

        {err && <div className="card"><p className="v-danger">Couldn’t load test scores: {err}</p></div>}

        {data && hist && m && (
          <div className="lab-grid">
            {/* histogram + slider */}
            <Reveal className="card lab-main" as="div">
              <div className="lab-hist-head">
                <h3 className="card-h" style={{ margin: 0 }}>Held-out decision scores</h3>
                <div className="legend">
                  <span><i className="legend-dot" style={{ background: '#6366f1' }} /> genuine</span>
                  <span><i className="legend-dot" style={{ background: 'var(--danger)' }} /> fraud</span>
                </div>
              </div>
              <p className="muted small" style={{ marginTop: 0 }}>
                Each class scaled to its own peak so the rare fraud class stays visible.
              </p>

              <div className="hist">
                <svg viewBox="0 0 100 42" preserveAspectRatio="none" className="hist-svg">
                  {hist.g.map((c, i) => (
                    <rect key={`g${i}`} x={(i / BINS) * 100} y={42 - (c / hist.gMax) * 40}
                      width={100 / BINS - 0.2} height={(c / hist.gMax) * 40}
                      fill="rgba(99,102,241,0.45)" />
                  ))}
                  {hist.f.map((c, i) => (
                    <rect key={`f${i}`} x={(i / BINS) * 100} y={42 - (c / hist.fMax) * 40}
                      width={100 / BINS - 0.2} height={(c / hist.fMax) * 40}
                      fill="rgba(251,106,106,0.6)" />
                  ))}
                </svg>
                {/* operating + current threshold markers */}
                <div className="hist-line hist-line-op" style={{ left: `${toX(operating)}%` }} title="fixed operating threshold" />
                <div className="hist-line hist-line-cur" style={{ left: `${toX(thr)}%` }} />
              </div>

              <input
                className="lab-slider"
                type="range" min={HIST_MIN} max={HIST_MAX} step={0.01}
                value={thr} onChange={(e) => setThr(parseFloat(e.target.value))}
                aria-label="Decision threshold (exploratory)"
                aria-valuetext={`threshold ${thr.toFixed(3)}: ${m.tp} fraud caught, ${m.fp} genuine flagged, ${m.fn} fraud missed`}
              />
              <div className="lab-slider-row">
                <span className="mono lab-thr-val">threshold τ = {thr.toFixed(3)}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setThr(operating)} disabled={atOperating}>
                  Reset to frozen threshold
                </button>
              </div>

              <div role="status" aria-live="polite" className={`lab-banner ${atOperating ? 'lab-banner-op' : 'lab-banner-explore'}`}>
                {atOperating ? (
                  <>You’re at the <strong>fixed operating threshold</strong> (τ = {operating.toFixed(3)}), chosen from training out-of-fold scores before the test set was ever touched.</>
                ) : (
                  <>Exploring — <strong>this is not a reported operating point.</strong> The operating threshold was fixed in advance from training out-of-fold scores; picking a new one by looking at test results would leak test information. The held-out results above stay as reported.</>
                )}
              </div>
            </Reveal>

            {/* metrics + confusion */}
            <Reveal className="card lab-side" as="div" delay={0.08}>
              <ConfusionMatrix
                tp={m.tp} fp={m.fp} tn={m.tn} fn={m.fn} animateKey={thr.toFixed(3)}
                caption={atOperating ? `Test set · frozen τ = ${operating.toFixed(4)}` : `Exploratory · τ = ${thr.toFixed(3)} (not a reported result)`}
              />
              <div className="lab-metrics">
                {[
                  { k: 'Precision', v: m.precision }, { k: 'Recall', v: m.recall },
                  { k: 'F1', v: m.f1 }, { k: 'Accuracy', v: m.accuracy },
                ].map((x) => (
                  <div className="lab-metric" key={x.k}>
                    <span className="lab-metric-v mono">{pct(x.v, 1)}</span>
                    <span className="lab-metric-k">{x.k}</span>
                  </div>
                ))}
              </div>
              <p className="muted small" aria-live="polite">
                {atOperating ? 'These are the reported held-out values.' : 'Exploratory values.'} Frozen operating point: precision {num(research.finalTest.metrics.precision, 3)},
                recall {num(research.finalTest.metrics.recall, 3)}, F1 {num(research.finalTest.metrics.f1, 3)}.
              </p>
            </Reveal>
          </div>
        )}

        {!data && !err && <div className="card"><p className="muted">Loading held-out scores…</p></div>}
      </div>
    </section>
  );
}
