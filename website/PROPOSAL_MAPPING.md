# Proposal → Implementation Mapping

**Project:** Detecting Fraudulent Job Postings with a Leakage-Aware Text Classifier (ES 335)
**Members:** Siya Kothari (24110167), Krina Hitendrakumar Paghadar (24110169)

This document maps the **submitted proposal (Revision 2)** to what was **actually implemented**, and explicitly records every deviation. Every number below was verified against the files in `results/` — not transcribed from memory. Where the proposal and the implementation disagree, the implementation is described as-is; the proposal is **not** rewritten to match.

---

## A. Faithful to the proposal (verified ✓)

| Proposal commitment | Implementation | Evidence |
|---|---|---|
| EMSCAD dataset, 17,880 postings, 866 fraud / 17,014 genuine (~5%) | Exactly these counts | `data/raw/...csv` → 17,880 / 866 / 17,014 (rate 0.0484) |
| Use text fields + structured fields; combine text into one column; add missing indicators | `combine_text_features` concatenates `title, company_profile, description, requirements, benefits` with field labels; missing-indicator ablation run | notebook cells 29, 40 |
| Target = dataset's own fraud label; use only info visible at posting time | `fraudulent` column; no post-hoc fields used | notebook |
| Baselines: majority (all genuine) + rule (no company profile & no logo) | Both implemented | majority in `initial_model_comparison.csv`; rule in notebook cell 36 (CV means) |
| Candidate models: LR on TF-IDF (1–2 grams), Linear SVM, metadata GBM; text-only vs metadata-only vs combined; + no-missing-indicator ablation | All implemented | `all_model_cv_results.csv`, `metadata_*`, `combined_*` CSVs |
| Tuning / model choice / threshold on training only; TF-IDF fit per-fold; test used once | Threshold chosen from training **out-of-fold** scores; held-out test scored once | `oof_threshold_selection.csv`, `final_svm_test_metrics.csv` |
| PR-AUC primary; report fraud-class precision/recall/F1; accuracy for context | Reported | `final_svm_test_metrics.csv` |
| Bootstrap confidence intervals | 95% CIs on all held-out metrics | `final_test_bootstrap_ci.csv` |
| Error analysis: FP/FN, by country, by company-profile presence | All present | `test_error_analysis.csv`, `test_country_breakdown.csv`, `test_company_profile_breakdown.csv` |
| Static site + risk checker + threshold explorer on held-out test; fixed operating threshold | Built in this website (model runs in-browser, Web Worker) | `website/` |

---

## B. Deviations from the proposal (explicitly documented)

These are the implementation facts the proposal flagged for verification. **All confirmed against files.**

| # | Proposal said | Implementation did | Why it matters | Verified against |
|---|---|---|---|---|
| D1 | "Remove duplicate postings first… postings with identical combined text will be removed before we split." | **Duplicate rows were retained.** Instead of dropping them, identical **normalized combined-text** rows were grouped. | Keeps all data while still preventing leakage. | manifest: 17,880 rows retained |
| D2 | "Stratified 80/20 train/test split (fixed seed)." | **`StratifiedGroupKFold`** (seed 42, 5 splits, fold 0 held out) with **normalized-text groups**, so no group spans train & test. | Stronger than a plain stratified split: **exact** copies cannot straddle the boundary. Near-duplicates are not grouped and can (1,221 test postings have a training near-copy at cosine ≥ 0.9 — see `results/near_duplicate_audit.json`). | `split_metadata.json`; **group overlap = 0** confirmed |
| D3 | Implied ~80/20 → ~14,304 / 3,576 | **Train 14,304 (693 fraud) / Test 3,576 (173 fraud)** | 80.0 / 20.0 split; matches proposal's stated numbers. | manifest counts |
| D4 | Main model: **Logistic Regression (balanced)** on TF-IDF | **Final frozen model: unweighted `LinearSVC`** on TF-IDF (1–2 grams, sublinear-tf, L2) | SVM (unweighted) gave the best out-of-fold F1 at the selected threshold. | `final_svm_model.json` → "Unweighted Linear SVM" |
| D5 | "recall at a fixed precision chosen from CV" | Operating point chosen via **OOF threshold selection**: τ ≈ **−0.3040546139** | Threshold fixed from training OOF only; test never used to pick it. | `oof_threshold_selection.csv`, `final_svm_model.json` |
| D6 | Test has "about 140 fraud cases" | Actual held-out test has **173 fraud cases** | The ~140 estimate predated the final group-aware split; the site reports the true 173. | manifest |

> Note: the proposal's **balanced LR** remains in the site's model-comparison table (it was a real experiment), clearly distinguished from the **frozen unweighted SVM** that the live checker actually runs.

---

## C. Evidence gaps / honesty notes

- **Rule baseline** has no standalone CSV; its numbers are the **5-fold CV means from notebook cell 36** (accuracy 0.869, precision 0.219, recall 0.662, F1 0.329). Labeled as such on the site.
- **Missingness & duplicate-group statistics** shown on the site are **recomputed** from the raw dataset and the split manifest (the notebook computed equivalents but did not export every table). They are derived from the same frozen inputs, not invented.
- The site **never** presents the decision score as a calibrated probability, and shows the required disclaimer.

---

## D. Browser-side scoring parity (verified ✓)

The live checker reproduces the Python pipeline exactly: `combine_text_features` → lowercase → `strip_accents='unicode'` → `\b\w\w+\b` tokens → 1–2 grams → sublinear-tf × idf → L2 norm → `coef·x + intercept`.

`npm run verify-model` scores all 20 held-out examples in `results/javascript_verification.json` and matches the Python `expected_score` to a **max absolute error of 9.1 × 10⁻¹⁵**. The checker therefore runs the frozen model in the browser with **no Python backend**. The same check also covers 14 Unicode / punctuation / long-input edge cases scored by scikit-learn.

---

## E. Preserved artifacts (non-negotiable rules honored)

`results/final_svm_model.json`, `results/javascript_verification.json`, the notebook, and all experiment CSVs are **unchanged**. The model is **not** retrained. All website code lives under `website/` on branch `feat/website`.
