"""
Post-hoc check (extra experiment, run AFTER the final evaluation; changes no model,
threshold or reported metric).

Question: grouping by *identical* normalised text keeps exact copies out of the test
set, but how many test postings still have a *near*-copy in the training set, and is
the frozen model's recall different on those?

Inputs (all frozen artifacts, nothing is re-fit except the similarity vectoriser):
  data/raw/.../fake_job_postings.csv      the EMSCAD CSV
  results/final_split_manifest.csv         official train/test assignment
  results/final_test_scores.csv            official frozen SVM test scores

Near-copy = TF-IDF cosine similarity >= 0.9 (unigrams, sublinear tf, min_df=2,
fitted on TRAINING rows only) between a test posting and its most similar training
posting. 0.9 is a judgement call, so 0.8 and 0.95 are reported as well.

Usage:
  python src/near_duplicate_audit.py --data data/raw/fake_job_postings.csv/fake_job_postings.csv
Writes results/near_duplicate_audit.json
"""
import argparse, json
from pathlib import Path
import numpy as np, pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import precision_score, recall_score

THRESHOLD = -0.3040546139198351
TEXT = ["title", "company_profile", "description", "requirements", "benefits"]
ROOT = Path(__file__).resolve().parents[1]


def combine(d):  # same as combine_text_features in the notebook
    out = pd.Series("", index=d.index, dtype="object")
    for c in TEXT:
        out += " " + c.replace("_", " ") + " " + d[c].fillna("").astype(str)
    return out.str.strip()


ap = argparse.ArgumentParser()
ap.add_argument("--data", required=True)
args = ap.parse_args()

df = pd.read_csv(args.data)
man = pd.read_csv(ROOT / "results/final_split_manifest.csv")
idx_col = "row_index" if "row_index" in man else man.columns[0]
tr = man.loc[man.split == "train", idx_col].to_numpy()
te_scores = pd.read_csv(ROOT / "results/final_test_scores.csv")
te = te_scores.row_index.to_numpy()
assert set(te) == set(man.loc[man.split == "test", idx_col]), "scores do not match the test split"

vec = TfidfVectorizer(min_df=2, sublinear_tf=True).fit(combine(df.iloc[tr]))
A, B = vec.transform(combine(df.iloc[tr])), vec.transform(combine(df.iloc[te]))
best = np.zeros(B.shape[0])
for s in range(0, B.shape[0], 500):
    best[s:s + 500] = (B[s:s + 500] @ A.T).max(axis=1).toarray().ravel()

y = te_scores.y_true.to_numpy()
pred = (te_scores.score.to_numpy() >= THRESHOLD).astype(int)
out = {"note": "post-hoc; no model/threshold/metric changed", "test_rows": int(len(te)),
       "test_fraud": int(y.sum()), "cutoffs": {}}
for cut in (0.8, 0.9, 0.95):
    m = best >= cut
    out["cutoffs"][str(cut)] = {
        "test_rows_with_near_copy": int(m.sum()),
        "fraud_with": int(y[m].sum()), "fraud_without": int(y[~m].sum()),
        "recall_with": round(recall_score(y[m], pred[m], zero_division=0), 4),
        "recall_without": round(recall_score(y[~m], pred[~m], zero_division=0), 4),
        "caught_with": int((pred[m] & y[m]).sum()), "caught_without": int((pred[~m] & y[~m]).sum()),
    }
(ROOT / "results/near_duplicate_audit.json").write_text(json.dumps(out, indent=1))
print(json.dumps(out, indent=1))
