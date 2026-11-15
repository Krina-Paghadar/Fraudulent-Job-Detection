# Website audit — 14 Nov 2026

Scope: the `website/` React + Vite site on branch `feat/website`. The original source is backed up in
`_backups/website_src_before_audit_2026-11-14.tgz` at the repository root.

The model, threshold, split, test labels, predictions and every file in `results/` were **not modified**.

## Bugs found and fixed

| # | Problem | Fix |
|---|---|---|
| 1 | **Built site could not load the model.** With `base: './'`, the relative model URL was resolved by the Web Worker against `assets/` → `404 assets/model/final_svm_model.json`; the checker stayed on "Loading model…" forever on GitHub Pages (dev server hid this). | `useScorer.ts` resolves the URL against `document.baseURI` before passing it to the worker. Verified on `dist/`. |
| 2 | **`.gitignore` ignored the site's data.** `data/` matched `website/src/data/` and `website/public/data/`, so `research.json`, `examples.json`, `test_scores.json` would not be committed and the deployed build would fail. | Changed to `/data/` (top-level dataset folder only). |
| 3 | **Superseded results in the model table.** Metadata-only LR (F1 0.395, AP 0.490), Combined LR (0.533 / 0.680) and Combined-no-indicators (0.533 / 0.691) came from the pre-fix *unscaled* runs. | `build-data.py` now reads `results/corrected_scaled_model_comparison.csv` (0.428/0.509, 0.716/0.846, 0.725/0.850). |
| 4 | Confusion matrix layout broken (extra grid column, rotated axis label, cells misplaced). | Semantic `<table>`: predicted Genuine/Fraud columns × actual Genuine/Fraud rows, four equal cells, used for both the frozen and the live (slider-driven) matrix. |
| 5 | Unweighted SVM CV row labelled "FINAL frozen model". | Table titled "Model comparison — 5-fold cross-validation"; row marked "selected model"; CV vs test separated in text. |
| 6 | Empty input could be scored (field-name template alone scores **+0.064**, above τ, i.e. "flagged"). | `isBlankPosting()` guard before scoring + validation message; also whitespace-only. |
| 7 | Scorer not exact for non-Latin text (JS `\w` is ASCII; only U+0300–036F stripped): Greek/Cyrillic off by 0.25, CJK/Arabic by 0.044. | Generated Python-exact Unicode `\w` and combining-mark tables (`src/lib/unicodeTables.ts`). |
| 8 | `verify-model` tested a hand-copied mirror, not the shipped scorer. | It now imports `src/lib/scorer.ts`, adds 14 sklearn edge-case references, checks the model file hash and the blank guard. |
| 9 | Worker scoring errors never resolved the promise → UI stuck on "Analysing…". | Errors reject with the request id; worker crash handled. |
| 10 | Old result stayed on screen after edits. | Stale-result banner + "Analyse again". |
| 11 | Error analysis showed 3 of 10 FP / 3 of 49 FN with no indication. | "Examples from 10 false positives / 49 false negatives", Show-all control with every record from `test_error_analysis.csv`. |
| 12 | Anchor links landed headings under the fixed nav. | `scroll-padding-top`. |
| 13 | Repo link was `#`; "branch: feat/website" label did not match GitHub (`main` only). | Real repo URL; branch label removed. |
| 14 | Overclaims: "no leakage", "0 train/test leakage", "duplicates can't leak", "no number typed by hand". | Reworded: exact-text groups only; near-duplicates can cross; rule-baseline numbers are transcribed from notebook output. |
| 16 | No Conclusion section (required by the ES335 brief). | Added `Conclusion.tsx`: answers the research question with numbers from `research.json`, states limits and next steps. |
| 17 | No GitHub Pages workflow (a Vite site must be built before Pages can serve it). | Added `.github/workflows/deploy-pages.yml`: npm ci → verify-model → build → deploy `website/dist`. |
| 15 | Column-sort headers not keyboard-operable; sort by Model gave NaN. | `<button>`s with `aria-sort`; string sort. |

## Verification (run in `website/`)

- `npm run audit` → `scripts/audit_artifacts.py`: **71/71 PASS** (metrics, CIs, CM recomputed from `final_test_scores.csv`, split manifest, OOF table, every comparison value traced to a CV CSV, model/verification files byte-identical to `results/`).
- `npm run verify-model`: **PASS** — 20 held-out + 14 edge cases, max |Δscore| 9.1e-15, 0 classification disagreements.
- `npm run build`: PASS (tsc + vite).
- `python scripts/browser_qa.py http://localhost:8802/ qa_out` on the built `dist/`: **41/41 PASS** (navigation, checker flows, slider at 5 thresholds vs Python, reset, results unchanged, no console errors / failed requests, no horizontal scroll at 1920/1366/820/375).

## Not verified here

- The deployed GitHub Pages site (not pushed, as requested).
- Real-device mobile browsers (tested with headless Chrome at mobile widths only).
- Google Fonts loading (blocked in the test sandbox; the system-font fallback was used).
- Unicode tables come from Python 3.13 (Unicode 15.1). Your notebook used Python 3.14 (Unicode 16.0), so only characters newly added in Unicode 16 could differ.
