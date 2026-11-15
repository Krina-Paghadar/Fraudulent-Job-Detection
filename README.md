# Spotting Fake Job Postings
### A Leakage-Safe Text Classifier with an Interactive Risk Checker

**ES335 — Machine Learning · IIT Gandhinagar · 2026**

| Name | Roll no. |
|---|---|
| Krina Hitendrakumar Paghadar | 24110169 |
| Siya Kothari | 24110167 |

**Website:** https://krina-paghadar.github.io/Fraudulent-Job-Detection/
**Repository:** https://github.com/Krina-Paghadar/Fraudulent-Job-Detection

---

## Contents
1. [Research question](#1-research-question)
2. [Results at a glance](#2-results-at-a-glance)
3. [Repository structure](#3-repository-structure)
4. [Data access](#4-data-access)
5. [Setup](#5-setup)
6. [How to run](#6-how-to-run)
7. [Exact preprocessing](#7-exact-preprocessing)
8. [Data split](#8-data-split)
9. [Results files](#9-results-files)
10. [Extra experiment](#10-extra-experiment)
11. [Known issues and notes](#11-known-issues-and-notes)
12. [AI-use disclosure](#12-ai-use-disclosure)
13. [References](#13-references)

---

## 1. Research question

> Using only information available when a job posting first appears, can we predict which postings carry the fraud label in the EMSCAD dataset?

| | |
|---|---|
| One row | One job posting |
| Target | `fraudulent` (0/1), the dataset's label |
| Prediction time | When the posting is published |
| Final model input | `title`, `company_profile`, `description`, `requirements`, `benefits` |
| Final model | TF-IDF (1–2 grams) + unweighted Linear SVM |
| Decision threshold | τ = −0.3040546139198351, chosen on training out-of-fold scores |

---

## 2. Results at a glance

Held-out test set: 3,576 postings, 173 fraud. It was evaluated once.

| Metric | Test | 95% bootstrap CI |
|---|---:|:---:|
| Precision (fraud) | 0.925 | 0.879 – 0.966 |
| Recall (fraud) | 0.717 | 0.652 – 0.781 |
| F1 (fraud) | 0.808 | 0.760 – 0.852 |
| PR-AUC (average precision) | 0.852 | 0.809 – 0.892 |
| ROC-AUC | 0.978 | 0.968 – 0.986 |
| Accuracy | 0.984 | 0.979 – 0.987 |

| Confusion matrix | Predicted genuine | Predicted fraud |
|---|---:|---:|
| **Actual genuine** | 3,393 | 10 |
| **Actual fraud** | 49 | 124 |

| Baseline (grouped 5-fold CV) | F1 |
|---|---:|
| Majority class | 0.000 |
| Rule: no company profile AND no logo | 0.329 |

**Main limitations**
- Data is from 2012–2014 only.
- The split blocks exact copies only. Recall on test fraud **without** a near-copy in training is 0.60 (see §10).
- The top feature (`profile description`) is a formatting shortcut for an empty company profile.
- There are only 173 test fraud cases, so the intervals are wide.

---

## 3. Repository structure

```
Fraudulent-Job-Detection/
├── notebooks/
│   └── 01_dataset_understanding.ipynb   # full analysis: EDA → split → models → evaluation → export
├── results/                             # every saved output (see §9)
├── src/
│   ├── verify_split.py                  # re-derives the split, checks it against the manifest
│   └── near_duplicate_audit.py          # extra experiment (see §10)
├── website/                             # interactive site (React + Vite), see website/README.md
├── .github/workflows/deploy-pages.yml   # builds and publishes the site to GitHub Pages
├── requirements.txt                     # exact Python versions used
└── README.md
```

### Notebook map

| Cells | What they do |
|---|---|
| 1–21 | Load data, EDA: target, duplicates, missingness by class, text lengths, structured features |
| 22–26 | Duplicate groups, grouped train/test split, split saved |
| 27–35 | Grouped 5-fold CV: majority baseline, Logistic Regression, Linear SVM, Naive Bayes |
| 36–40 | Rule baseline, metadata Gradient Boosting, text + metadata, missing-indicator ablation |
| 41–42 | Out-of-fold scores, threshold selection (training data only) |
| 43 | Final model refit, **single test evaluation** |
| 44 | Corrected scaling for metadata LR, re-run (supersedes cells 38–40's LR numbers) |
| 45–47 | Bootstrap CIs, error analysis, subgroups, SVM coefficients |
| 48–50 | Export model + test scores for the website |

---

## 4. Data access

| | |
|---|---|
| Dataset | EMSCAD — Employment Scam Aegean Dataset (Vidros et al., 2017) |
| File | `fake_job_postings.csv` (17,880 rows × 18 columns, 866 fraudulent) |
| Download | https://www.kaggle.com/datasets/shivamb/real-or-fake-fake-jobposting-prediction (free Kaggle account) |
| In this repo? | **No.** The raw data is not redistributed |

Place the file at this path (the layout the notebook and scripts expect):

```
data/raw/fake_job_postings.csv/fake_job_postings.csv
```

---

## 5. Setup

| Requirement | Version |
|---|---|
| Python | 3.14 (tested on Windows) |
| scikit-learn | 1.9.1 (must be ≥ 1.8; see §11) |
| Node.js | ≥ 22.6 (website only) |

```bash
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

---

## 6. How to run

| Step | Command | Output |
|---|---|---|
| 1. Full analysis | Open `notebooks/01_dataset_understanding.ipynb`, set `DATA_PATH` in cell 1, run all | `results/` |
| 2. Check the split | `python src/verify_split.py --data data/raw/fake_job_postings.csv/fake_job_postings.csv` | `matches manifest: train True, test True` |
| 3. Extra experiment | `python src/near_duplicate_audit.py --data data/raw/fake_job_postings.csv/fake_job_postings.csv` | `results/near_duplicate_audit.json` |
| 4. Website | `cd website` → `npm ci` → `npm run build` → `npm run preview` | site at http://localhost:4173 |
| 5. Website checks | `npm run audit` · `npm run verify-model` | all numbers match `results/`; browser model = scikit-learn |

---

## 7. Exact preprocessing

Every learned step is fitted **inside a scikit-learn `Pipeline` on training folds only**.

| Step | Setting |
|---|---|
| Text input | 5 fields joined with their names: `"title … company profile … description … requirements … benefits …"` |
| Vectoriser | `TfidfVectorizer(lowercase=True, strip_accents="unicode", ngram_range=(1, 2), min_df=2, max_df=0.98, sublinear_tf=True, max_features=100000)` |
| Token pattern / norm | `(?u)\b\w\w+\b` / L2 (defaults) |
| Categorical fields (comparison models) | impute `"Missing"` → `OneHotEncoder(handle_unknown="ignore", min_frequency=20)` |
| Text-length features (comparison models) | `log1p` → median impute → `StandardScaler` |
| Final classifier | `LinearSVC(C=1.0, class_weight=None, random_state=42)` |

| Models compared | Settings |
|---|---|
| Logistic Regression | `C=1.0`, `class_weight` None / balanced, `max_iter=2000` |
| Linear SVM | `C=1.0`, `class_weight` None / balanced |
| Naive Bayes | Multinomial and Complement, `alpha=1.0` |
| Gradient Boosting (metadata) | `n_estimators=120, learning_rate=0.05, max_depth=2, min_samples_leaf=10, subsample=0.8` |

All settings were fixed in advance. No grid search was run.

---

## 8. Data split

| | |
|---|---|
| Method | `StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)`; fold 0 = test |
| Groups | identical text after lower-casing and whitespace normalisation (5 text fields) |
| Train | 14,304 postings (693 fraud) |
| Test | 3,576 postings (173 fraud) |
| Groups on both sides | 0 |
| Model selection | grouped 5-fold CV on training rows only |
| Saved in | `results/final_split_manifest.csv` (every row's assignment), `results/split_metadata.json` |

---

## 9. Results files

| File | Contents |
|---|---|
| `final_split_manifest.csv`, `split_metadata.json`, `candidate_split_indices.csv` | The frozen split |
| `initial_model_comparison.csv`, `all_model_cv_results.csv` | CV results: baselines and text models |
| `corrected_scaled_model_comparison.csv` | **Corrected** metadata / combined LR results |
| `metadata_gradient_boosting_*.csv` | Gradient Boosting folds and summary |
| `combined_text_metadata_*.csv`, `metadata_only_lr_cv_summary.csv`, `combined_without_missing_indicators_cv_summary.csv` | Earlier **unscaled** runs (kept for transparency; superseded) |
| `oof_threshold_selection.csv`, `oof_unweighted_svm_scores.csv` | Threshold selection on training out-of-fold scores |
| `final_svm_test_metrics.csv`, `final_test_scores.csv` | Held-out metrics and per-posting scores |
| `final_test_bootstrap_ci.csv` | 95% bootstrap intervals (2,000 resamples, seed 42) |
| `test_company_profile_breakdown.csv`, `test_country_breakdown.csv` | Subgroup results |
| `top_fraud_svm_features.csv`, `top_legitimate_svm_features.csv` | Largest SVM coefficients |
| `final_svm_model.json` | Frozen model: vocabulary, IDF, coefficients, intercept, threshold |
| `javascript_verification.json` | 20 reference scores used to check the website's model |
| `near_duplicate_audit.json` | Extra experiment (§10) |

`test_error_analysis.csv` (every test row with full text) is regenerated by notebook cell 46. It is not committed because of its size.

---

## 10. Extra experiment

**Near-copies across the split** (`src/near_duplicate_audit.py`), run after the final evaluation. It does not change the model, threshold or reported metrics.

| Near-copy in training if cosine ≥ | Test postings with one | Recall with | Recall without |
|---|---:|---:|---:|
| 0.80 | 1,632 | 1.00 (61/61) | 0.56 (63/112) |
| 0.90 | 1,221 | 1.00 (50/50) | 0.60 (74/123) |
| 0.95 | 990 | 1.00 (42/42) | 0.63 (82/131) |

Recall is likely optimistic for genuinely new postings.

---

## 11. Known issues and notes

- **Data path:** notebook cell 1 uses an absolute Windows path. Change `DATA_PATH` to your own.
- **Cell 48:** uses `inspect` without importing it. Add `import inspect` before a fresh run-all.
- **scikit-learn version:** with 1.6/1.7, `StratifiedGroupKFold` gives a different split. Use ≥ 1.8.
- **Platform:** Linear SVM weights can differ slightly across operating systems. A Linux re-run gives the same split but threshold −0.3127 and 11 false positives. The reported results and website model are the exported run (`results/final_svm_model.json`).
- **Metadata LR:** the first runs (cells 38–40) used unscaled length features. Cell 44 corrects this, and only the corrected numbers are reported.

---

## 12. AI-use disclosure

**Tools used:** ChatGPT (OpenAI), Claude (Anthropic).

| Used for |
|---|
| Project planning and ML methodology discussion |
| Drafting and debugging notebook code |
| Interpreting results |
| Technical review (found the unscaled length-feature bug, fixed in cell 44) |
| Building the website and its in-browser model |
| Writing and editing documentation, including this README |

| Checked by us |
|---|
| Split: zero group overlap, re-derived by `src/verify_split.py` |
| Every number on the website matches `results/` (`npm run audit`) |
| Browser model reproduces scikit-learn's scores (`npm run verify-model`) |

All reported numbers come from code we ran. A full clean-environment re-run of the notebook has not been tested. We are responsible for every result and choice in this project.

---

## 13. References

1. Vidros, S., Kolias, C., Kambourakis, G., & Akoglu, L. (2017). Automatic Detection of Online Recruitment Frauds: Characteristics, Methods, and a Public Dataset. *Future Internet*, 9(1), 6. https://doi.org/10.3390/fi9010006
2. Real / Fake Job Posting Prediction (Kaggle distribution of EMSCAD). https://www.kaggle.com/datasets/shivamb/real-or-fake-fake-jobposting-prediction
3. Pedregosa, F., et al. (2011). Scikit-learn: Machine Learning in Python. *JMLR*, 12, 2825–2830.
4. Saito, T., & Rehmsmeier, M. (2015). The Precision-Recall Plot Is More Informative than the ROC Plot When Evaluating Binary Classifiers on Imbalanced Datasets. *PLOS ONE*, 10(3), e0118432.
5. Website libraries: React, Vite, Framer Motion (MIT licence).
