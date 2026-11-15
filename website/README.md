# Website — Spotting Fake Job Postings

Interactive research site for the ES335 project. Static (React + TypeScript + Vite); the frozen
Linear SVM runs **in the browser** (Web Worker), with no server.

> The risk checker predicts the EMSCAD **label** with an uncalibrated SVM decision score.
> It is not a probability and not proof that a posting is fraudulent.

## Commands (run inside `website/`, Node ≥ 22.6)

| Command | What it does |
|---|---|
| `npm ci` | Install dependencies |
| `npm run dev` | Development server — http://localhost:5173 |
| `npm run build` | Type-check + static build into `dist/` |
| `npm run preview` | Serve the production build — http://localhost:4173 |
| `npm run verify-model` | Browser scorer vs scikit-learn (20 held-out + 14 edge cases) |
| `npm run audit` | Every number on the site checked against `../results/` |
| `python scripts/build-data.py` | Regenerate the site's data files from `../results/` (needs the raw CSV) |

## Where the numbers come from

| Site data | Source |
|---|---|
| `src/data/research.json` | Built by `scripts/build-data.py` from `../results/*.csv` and the raw dataset |
| `public/data/test_scores.json` | `../results/final_test_scores.csv` (held-out scores, full precision) |
| `public/model/final_svm_model.json` | Byte-identical copy of `../results/final_svm_model.json` |
| `src/data/javascript_verification.json` | Copy of `../results/javascript_verification.json` |
| `src/data/near_duplicate_audit.json` | Copy of `../results/near_duplicate_audit.json` |

**One exception:** the rule baseline's CV numbers are transcribed from notebook cell 36's output,
because the notebook did not save them to a CSV.

## Deployment

`.github/workflows/deploy-pages.yml` (repository root) runs on every push to `main`:
`npm ci` → `npm run verify-model` → `npm run build` → publish `website/dist` to GitHub Pages.
One-time setting: **Settings → Pages → Source: GitHub Actions**.

## Other files

| File | Contents |
|---|---|
| `AUDIT_REPORT.md` | Bugs found and fixed during the website audit, and the tests run |
| `PROPOSAL_MAPPING.md` | How the implementation maps to (and deviates from) the proposal |
| `scripts/browser_qa.py` | Headless-browser test of the built site |
| `scripts/gen_unicode_tables.py`, `scripts/make_edge_reference.py` | Build the Unicode tables and edge-case references used by the parity check |
