import { research } from '../data/research';
import { SectionHeader, Reveal } from '../components/primitives';
import { num } from '../lib/format';

/* Conclusion — answers the research question using only numbers from research.json. */
export function Conclusion() {
  const t = research.finalTest;
  const byName = (n: string) => research.modelComparison.models.find((m) => m.name === n);
  const rule = byName('Rule baseline (no profile & no logo)');
  const text = byName('Logistic Regression (balanced)');
  const comb = byName('Combined text + metadata LR (scaled)');
  const missing = research.companyProfile.find((c) => c.status === 'Missing');
  const present = research.companyProfile.find((c) => c.status === 'Present');

  return (
    <section className="section" id="conclusion">
      <div className="container">
        <SectionHeader
          eyebrow="Conclusion"
          title={<>What the evidence <span className="gradient-text">supports</span></>}
          lead="Research question: using only information available when a posting first appears, can we predict which postings carry the fraud label in EMSCAD?"
        />
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <Reveal className="card" as="div">
            <h3 className="card-h">Answer: yes, largely from the text — within this dataset</h3>
            <ul className="concl-list">
              <li>
                On the held-out test set, evaluated once, the frozen TF-IDF + Linear SVM reaches F1{' '}
                <strong>{num(t.metrics.f1, 3)}</strong> (95% CI {num(t.bootstrap.f1.lo, 2)}–{num(t.bootstrap.f1.hi, 2)}),
                precision <strong>{num(t.metrics.precision, 3)}</strong> and recall <strong>{num(t.metrics.recall, 3)}</strong>.
              </li>
              <li>
                That is far above the baselines: predicting “genuine” for everything gives F1 0, and the
                no-profile-and-no-logo rule gives CV F1 {num(rule?.f1 ?? 0, 3)}.
              </li>
              <li>
                Text alone beat text + metadata under the same classifier (CV F1 {num(text?.f1 ?? 0, 3)} vs{' '}
                {num(comb?.f1 ?? 0, 3)}): adding more features did not help.
              </li>
              <li>
                Most errors are missed fraud ({research.confusion.fn} false negatives vs {research.confusion.fp} false
                positives), and recall is much lower when the company profile is missing
                ({num(missing?.recall ?? 0, 2)} vs {num(present?.recall ?? 0, 2)}).
              </li>
            </ul>
          </Reveal>
          <Reveal className="card" as="div" delay={0.06}>
            <h3 className="card-h">How far the claim goes</h3>
            <ul className="concl-list">
              <li>The model reproduces the <strong>EMSCAD label</strong> on 2012–2014 postings; it does not verify whether a real job or employer is fraudulent.</li>
              <li>Grouping blocks exact copies only, so near-duplicate templates may make the test score optimistic for genuinely new postings.</li>
              <li>Part of the signal is a shortcut: the field-name template turns a missing company profile into the top fraud feature.</li>
              <li>With {research.split.testFraud} test fraud cases the intervals are wide, and the OOF estimate (F1 0.874) was optimistic relative to test.</li>
              <li><strong>Next steps:</strong> remove field names from the input and retrain, group near-duplicates (e.g. cosine ≥ 0.9) before splitting, and test on newer postings.</li>
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
