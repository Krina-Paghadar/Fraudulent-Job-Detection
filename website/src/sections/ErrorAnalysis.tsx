import { useState } from 'react';
import { research } from '../data/research';
import nearDup from '../data/near_duplicate_audit.json';
import { SectionHeader, Reveal } from '../components/primitives';
import { num, pct, int } from '../lib/format';

// Top-coefficient terms that straddle a field-name label inserted by combine_text_features
// (e.g. empty company profile -> "... company profile description ..."), identified by inspection.
const TEMPLATE_TERMS = new Set(['profile description', 'description apply', 'line requirements', 'title administrative', 'description our']);
const isTemplateTerm = (t: string) => TEMPLATE_TERMS.has(t);

type Err = { title: string; location: string; score: number; profile: string; snippet?: string };
function ErrorList({ items, total, kind }: { items: Err[]; total: number; kind: 'fp' | 'fn' }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 3);
  const id = `err-list-${kind}`;
  return (
    <div>
      <div className={`err-tag err-tag-${kind}`}>
        {kind === 'fp' ? `Examples from ${total} false positives — genuine, wrongly flagged` : `Examples from ${total} false negatives — fraud, missed`}
      </div>
      <ul className="err-list" id={id}>
        {shown.map((e, i) => (
          <li className="err-ex" key={i}>
            <span className="err-ex-title">{e.title || '(untitled)'}</span>
            <span className="err-ex-meta mono">
              {e.location || 'no location'} · score {num(e.score, 2)} · profile {e.profile.toLowerCase()}
            </span>
            {e.snippet && <span className="err-ex-snippet">{e.snippet}</span>}
          </li>
        ))}
      </ul>
      {items.length > 3 && (
        <button type="button" className="btn btn-ghost btn-sm err-more" aria-expanded={all} aria-controls={id} onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}

export function ErrorAnalysis() {
  const d = research;
  const fraudFeats = d.features.fraud.slice(0, 10);
  const legitFeats = d.features.legit.slice(0, 10);
  const maxFraud = Math.max(...fraudFeats.map((f) => f.coef));
  const maxLegit = Math.max(...legitFeats.map((f) => Math.abs(f.coef)));

  // countries with at least a few fraud cases → recall is meaningful
  const countries = d.country.filter((c) => c.fraud >= 3).sort((a, b) => b.postings - a.postings).slice(0, 8);

  return (
    <section className="section" id="errors">
      <div className="container">
        <SectionHeader
          eyebrow="Error analysis & limits"
          title={<>Where it works, and <span className="gradient-text">where it breaks</span></>}
          lead="A credible model has to own its mistakes. Here are the terms it leans on, the subgroups where it behaves differently, and the postings it got wrong."
        />

        {/* influential features */}
        <Reveal className="card" as="div">
          <h3 className="card-h">What the model reads as fraud vs genuine</h3>
          <p className="muted-body" style={{ maxWidth: '66ch' }}>
            The ten largest Linear SVM coefficients in each direction — associations in this dataset, not causes.
            Content terms such as “data entry”, “clerical” and “below link” push toward the fraud label. But the
            top term, “profile description”, is not something posters write: the input joins fields with their
            names, so an <em>empty</em> company profile leaves “company profile” next to “description”. Terms
            marked <span className="tmpl-tag">template</span> come from that formatting, i.e. a learned
            shortcut for missing fields.
          </p>
          <div className="feat-cols">
            <div>
              <div className="feat-head toward-fraud">Pushes toward fraud ↑</div>
              {fraudFeats.map((f) => (
                <div className="feat-row" key={f.feature}>
                  <span className="feat-term">{f.feature}{isTemplateTerm(f.feature) && <span className="tmpl-tag">template</span>}</span>
                  <span className="feat-bar-wrap">
                    <span className="feat-bar fraud" style={{ width: `${(f.coef / maxFraud) * 100}%` }} />
                  </span>
                  <span className="feat-coef mono">+{num(f.coef, 2)}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="feat-head toward-legit">Pushes toward genuine ↓</div>
              {legitFeats.map((f) => (
                <div className="feat-row" key={f.feature}>
                  <span className="feat-term">{f.feature}{isTemplateTerm(f.feature) && <span className="tmpl-tag">template</span>}</span>
                  <span className="feat-bar-wrap">
                    <span className="feat-bar legit" style={{ width: `${(Math.abs(f.coef) / maxLegit) * 100}%` }} />
                  </span>
                  <span className="feat-coef mono">{num(f.coef, 2)}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="grid grid-2" style={{ marginTop: 18, alignItems: 'start' }}>
          {/* company profile subgroup */}
          <Reveal className="card" as="div">
            <h3 className="card-h">The company-profile shortcut, measured <span className="muted small">(held-out test set)</span></h3>
            <p className="muted-body">
              Fraud is {pct(d.companyProfile.find((c) => c.status === 'Missing')!.fraudRate, 0)} likely
              when the company profile is missing vs{' '}
              {pct(d.companyProfile.find((c) => c.status === 'Present')!.fraudRate, 0)} when present —
              yet the model’s recall is much <em>lower</em> when the profile is missing. Without a profile there is
              less text to separate terse genuine ads from fraudulent ones.
            </p>
            <div className="subgroup">
              {d.companyProfile.map((c) => (
                <div className="subgroup-row" key={c.status}>
                  <span className="subgroup-name">Profile {c.status.toLowerCase()}</span>
                  <span className="subgroup-stat"><b>{int(c.postings)}</b> posts</span>
                  <span className="subgroup-stat"><b>{int(c.fraud)}</b> fraud</span>
                  <span className="subgroup-stat">recall <b className="mono">{c.recall != null ? num(c.recall, 2) : '—'}</b></span>
                  <span className="subgroup-stat">prec. <b className="mono">{c.precision != null ? num(c.precision, 2) : '—'}</b></span>
                </div>
              ))}
            </div>
          </Reveal>

          {/* country breakdown */}
          <Reveal className="card" as="div" delay={0.08}>
            <h3 className="card-h">By country <span className="muted small">(held-out test set · countries with ≥3 fraud cases)</span></h3>
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="data" style={{ minWidth: 0 }}>
                <thead>
                  <tr><th scope="col">Country</th><th scope="col">Posts</th><th scope="col">Fraud</th><th scope="col">Recall (caught / fraud)</th><th scope="col">Prec.</th></tr>
                </thead>
                <tbody>
                  {countries.map((c) => (
                    <tr key={c.code}>
                      <td>{c.code}</td>
                      <td className="num">{int(c.postings)}</td>
                      <td className="num">{int(c.fraud)}</td>
                      <td className="num">{c.recall != null ? <>{num(c.recall, 2)} <span className="muted">({Math.round(c.recall * c.fraud)}/{c.fraud})</span></> : '—'}</td>
                      <td className="num">{c.precision != null ? num(c.precision, 2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small" style={{ marginTop: 10 }}>
              Apart from the US (142 fraud cases), each country has fewer than ten — a single posting moves recall by
              10–30 points. These rows are descriptive only; no country ranking or fairness claim is made.
            </p>
          </Reveal>
        </div>

        {/* FP / FN examples */}
        <Reveal className="card" as="div" delay={0.05} >
          <h3 className="card-h">Misclassified test postings</h3>
          <p className="muted small" style={{ marginTop: -4 }}>
            The frozen model made {d.errors.counts['False Positive']} false positives and {d.errors.counts['False Negative']} false
            negatives on 3,576 test postings. Each list starts with the most confident mistakes; expand to see every one
            (from <span className="mono">results/test_error_analysis.csv</span>; text truncated). Patterns noted here describe
            these examples only: missed fraud includes repeated templates such as “Cruise Staff Wanted *URGENT*”, and
            false alarms are mostly administrative or data-entry roles with no company profile.
          </p>
          <div className="err-examples">
            <ErrorList items={d.errors.falsePositives} total={d.errors.counts['False Positive']} kind="fp" />
            <ErrorList items={d.errors.falseNegatives} total={d.errors.counts['False Negative']} kind="fn" />
          </div>
        </Reveal>

        {/* limitations */}
        <Reveal className="card neardup-card" as="div">
          <h3 className="card-h">Extra check: near-copies across the split <span className="muted small">(post-hoc · held-out test set)</span></h3>
          <p className="muted-body">
            Grouping removes <em>exact</em> copies only. After the final evaluation, we measured how similar each test posting
            is to its closest training posting (TF-IDF cosine, vectoriser fitted on training rows only). Nothing about the
            model, threshold or reported metrics was changed.
          </p>
          <div className="table-wrap">
            <table className="data compact">
              <caption className="table-caption">Recall of the frozen model on test fraud, split by whether a near-copy exists in training</caption>
              <thead><tr><th scope="col">Near-copy if cosine ≥</th><th scope="col">Test postings with one</th><th scope="col">Recall · with</th><th scope="col">Recall · without</th></tr></thead>
              <tbody>
                {Object.entries(nearDup.cutoffs).map(([cut, r]) => (
                  <tr key={cut} className={cut === '0.9' ? 'row-final' : ''}>
                    <th scope="row">{cut}</th>
                    <td className="num">{r.test_rows_with_near_copy.toLocaleString()}</td>
                    <td className="num">{num(r.recall_with, 2)} <span className="muted">({r.caught_with}/{r.fraud_with})</span></td>
                    <td className="num">{num(r.recall_without, 2)} <span className="muted">({r.caught_without}/{r.fraud_without})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small" style={{ marginBottom: 0 }}>
            Every fraud posting with a close training neighbour was caught; on fraud without one, recall falls to about 0.6.
            The headline test recall (0.717) is therefore partly helped by near-copies and is likely optimistic for genuinely
            new postings. Code: <span className="mono">src/near_duplicate_audit.py</span>.
          </p>
        </Reveal>

        <Reveal className="card limitations" as="div" delay={0.05}>
          <h3 className="card-h">Limitations we don’t hide</h3>
          <ul className="limit-list">
            <li><strong>Label, not truth.</strong> The model predicts the EMSCAD <em>label</em>; it doesn’t prove a posting is a scam, and label errors become model errors.</li>
            <li><strong>Not a probability.</strong> The decision score is an uncalibrated SVM value — a score of 0.5 is not “50% fraud”.</li>
            <li><strong>Shortcut learning.</strong> The top feature encodes a missing company profile via the field-name template; partial postings are pushed toward “flagged”, and recall drops to {num(d.companyProfile.find((c) => c.status === 'Missing')!.recall ?? 0, 2)} when the profile is missing.</li>
            <li><strong>Near-duplicates remain.</strong> Grouping blocks <em>exact</em> copies only; {nearDup.cutoffs['0.9'].test_rows_with_near_copy.toLocaleString()} test postings have a near-copy in training (cosine ≥ 0.9), and recall without one is {num(nearDup.cutoffs['0.9'].recall_without, 2)}.</li>
            <li><strong>Small positive class.</strong> Only {d.split.testFraud} fraud cases in the test set (4.8%), so metrics are noisy — hence the confidence intervals.</li>
            <li><strong>Historical data.</strong> EMSCAD covers 2012–2014, is mostly US and English; no usable posting date exists for a time-based test, so newer or non-English scams may look different.</li>
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
