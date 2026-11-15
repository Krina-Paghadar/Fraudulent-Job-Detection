import { AUTHORS, COURSE, REPO_URL } from '../config';
import { research } from '../data/research';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <div className="nav-brand" style={{ marginBottom: 12 }}>
            <span className="nav-dot" /> Signal<span style={{ color: 'var(--fg-dim)', fontWeight: 400 }}>/fraud</span>
          </div>
          <small>
            Detecting Fraudulent Job Postings with a<br />Leakage-Aware Text Classifier · {COURSE}
          </small>
        </div>
        <div>
          <small>
            <strong style={{ color: 'var(--fg-muted)' }}>Authors</strong><br />
            {AUTHORS.map((a) => (
              <span key={a.id}>{a.name} ({a.id})<br /></span>
            ))}
          </small>
        </div>
        <div>
          <small>
            <strong style={{ color: 'var(--fg-muted)' }}>Built on</strong><br />
            EMSCAD · {research.dataset.total.toLocaleString()} postings<br />
            Frozen {research.model.name}<br />
            <a href={REPO_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)' }}>Repository ↗</a>
          </small>
        </div>
      </div>
      <div className="container" style={{ marginTop: 28 }}>
        <small style={{ color: 'var(--fg-faint)' }}>
          The risk score predicts the dataset’s fraud label and is not a calibrated probability or
          proof of fraud. Research artifact — not a hiring or safety tool.
        </small>
      </div>
    </footer>
  );
}
