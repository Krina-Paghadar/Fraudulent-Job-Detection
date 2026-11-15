import { motion } from 'framer-motion';
import { pct } from '../lib/format';

/* ---------------- Horizontal bars ---------------- */
export interface HBarDatum {
  label: string;
  value: number; // 0..1 fraction OR absolute (set max)
  display?: string;
  color?: string;
  highlight?: boolean;
}
export function HBars({
  data,
  max = 1,
  format = (v: number) => pct(v, 1),
}: {
  data: HBarDatum[];
  max?: number;
  format?: (v: number) => string;
}) {
  return (
    <div className="hbars">
      {data.map((d) => {
        const w = Math.max(0, Math.min(100, (d.value / max) * 100));
        return (
          <div className="hbar" key={d.label}>
            <div className="hbar-label" title={d.label}>{d.label}</div>
            <div className="hbar-track">
              <motion.div
                className="hbar-fill"
                style={{
                  background: d.color ?? 'var(--grad-brand)',
                  boxShadow: d.highlight ? '0 0 18px -4px var(--violet-glow)' : 'none',
                }}
                initial={{ width: 0 }}
                whileInView={{ width: `${w}%` }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="hbar-value mono">{d.display ?? format(d.value)}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Class-imbalance donut ---------------- */
export function ImbalanceDonut({
  fraud,
  genuine,
  size = 180,
}: {
  fraud: number;
  genuine: number;
  size?: number;
}) {
  const total = fraud + genuine;
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const fraudFrac = fraud / total;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
        aria-label={`Class imbalance: ${pct(fraudFrac)} fraudulent`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--glass-border)" strokeWidth="14" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--danger)" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - fraudFrac) }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: 'drop-shadow(0 0 6px var(--danger-glow))' }}
        />
        <text x="50%" y="46%" textAnchor="middle" className="donut-big">{pct(fraudFrac)}</text>
        <text x="50%" y="60%" textAnchor="middle" className="donut-small">fraudulent</text>
      </svg>
    </div>
  );
}

/* ---------------- Confusion matrix ----------------
   A real 2×2 table: rows = actual class, columns = predicted class.
   Counts are passed in, so the same component is used for the frozen result
   and for the threshold explorer (which recomputes them on every slider move). */
export function ConfusionMatrix({
  tp, fp, tn, fn, animateKey, caption = 'Confusion matrix · held-out test set',
}: {
  tp: number; fp: number; tn: number; fn: number; animateKey?: string | number; caption?: string;
}) {
  const total = tp + fp + tn + fn;
  const cell = (label: string, v: number, cls: string, desc: string) => (
    <td className={`cm-cell ${cls}`} aria-label={`${label}: ${v.toLocaleString()} (${desc})`}>
      <motion.span
        className="cm-val mono"
        key={`${label}-${animateKey}-${v}`}
        initial={{ opacity: 0.35 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        {v.toLocaleString()}
      </motion.span>
      <span className="cm-label">{label}</span>
    </td>
  );
  return (
    <div className="cm-wrap">
      <table className="cm" aria-live="polite">
        <caption>{caption}</caption>
        <colgroup><col className="cm-col-head" /><col /><col /></colgroup>
        <thead>
          <tr>
            <td aria-hidden="true" />
            <th scope="col"><small>Predicted</small>Genuine</th>
            <th scope="col"><small>Predicted</small>Fraud</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row"><small>Actual</small>Genuine</th>
            {cell('True negatives', tn, 'cm-tn', 'genuine, correctly not flagged')}
            {cell('False positives', fp, 'cm-fp', 'genuine, wrongly flagged')}
          </tr>
          <tr>
            <th scope="row"><small>Actual</small>Fraud</th>
            {cell('False negatives', fn, 'cm-fn', 'fraud, missed')}
            {cell('True positives', tp, 'cm-tp', 'fraud, correctly flagged')}
          </tr>
        </tbody>
      </table>
      <p className="cm-total">n = {total.toLocaleString()} · {(tp + fn).toLocaleString()} actual fraud · {(tp + fp).toLocaleString()} flagged</p>
    </div>
  );
}

/* ---------------- Metric meter with bootstrap CI ----------------
   Slim track (0–1 scale) + fill to the point estimate. The 95% bootstrap interval is
   drawn as a bracket with end ticks, and the estimate as a short marker, so the
   bar reads like an error bar rather than a slider. */
export function MetricMeter({
  label, value, lo, hi,
}: {
  label: string; value: number; lo?: number; hi?: number;
}) {
  const pct = (v: number) => Math.max(0, Math.min(100, v * 100));
  const hasCI = lo != null && hi != null;
  return (
    <div className="meter" role="img"
      aria-label={`${label}: ${value.toFixed(3)}${hasCI ? `, 95% CI ${lo!.toFixed(3)} to ${hi!.toFixed(3)}` : ''}`}>
      <div className="meter-top">
        <span className="meter-label">{label}</span>
        <span className="meter-value mono">{value.toFixed(3)}</span>
      </div>
      <div className="meter-track" aria-hidden="true">
        <motion.div
          className="meter-fill"
          initial={{ width: 0 }}
          whileInView={{ width: `${pct(value)}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        {hasCI && <div className="meter-ci" style={{ left: `${pct(lo!)}%`, width: `${pct(hi!) - pct(lo!)}%` }} />}
        <div className="meter-mark" style={{ left: `${pct(value)}%` }} />
      </div>
      {hasCI && (
        <div className="meter-cilabel mono">95% CI [{lo!.toFixed(3)}, {hi!.toFixed(3)}]</div>
      )}
    </div>
  );
}
