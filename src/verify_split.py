"""
Re-derive the frozen train/test split from the raw CSV and check it against
results/final_split_manifest.csv (row by row). Same code as notebook cells 22-23.

Usage:
  python src/verify_split.py --data data/raw/fake_job_postings.csv/fake_job_postings.csv
Needs scikit-learn >= 1.8 (StratifiedGroupKFold behaved differently in 1.6/1.7).
"""
import argparse
from pathlib import Path
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold

TEXT = ["title", "company_profile", "description", "requirements", "benefits"]
ROOT = Path(__file__).resolve().parents[1]

ap = argparse.ArgumentParser()
ap.add_argument("--data", required=True)
df = pd.read_csv(ap.parse_args().data)
y = df["fraudulent"].astype(int)

# groups: identical lower-cased, whitespace-normalised text across the five fields
g = df[TEXT].copy()
for c in TEXT:
    g[c] = g[c].fillna("").astype(str).str.lower().str.replace(r"\s+", " ", regex=True).str.strip()
groups = pd.util.hash_pandas_object(g, index=False)

tr, te = next(StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42).split(df, y, groups))
man = pd.read_csv(ROOT / "results/final_split_manifest.csv")
ok_train = set(tr) == set(man.loc[man.split == "train", "row_index"])
ok_test = set(te) == set(man.loc[man.split == "test", "row_index"])
overlap = set(groups.iloc[tr]) & set(groups.iloc[te])

print(f"rows {len(df)} | fraud {int(y.sum())} | train {len(tr)} ({int(y.iloc[tr].sum())} fraud) | test {len(te)} ({int(y.iloc[te].sum())} fraud)")
print(f"unique text groups {groups.nunique()} | groups on both sides: {len(overlap)}")
print(f"matches manifest: train {ok_train}, test {ok_test}")
raise SystemExit(0 if (ok_train and ok_test and not overlap) else 1)
