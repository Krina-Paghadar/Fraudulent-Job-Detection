"""
Generate the website's data files DIRECTLY from the frozen result artifacts so
that every number on the site is traceable to a file in results/ (integrity
rule: never fabricate metrics). Run from the website/ directory:

    python scripts/build-data.py

Outputs:
    src/data/research.json         -- all static research numbers
    public/data/test_scores.json   -- held-out decision scores + labels
                                      (powers the live threshold explorer)
"""
import csv
import json
import os
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
REPO = os.path.dirname(WEB)
RES = os.path.join(REPO, "results")
RAW = os.path.join(REPO, "data", "raw", "fake_job_postings.csv", "fake_job_postings.csv")


def read_csv(name):
    with open(os.path.join(RES, name), encoding="utf-8") as f:
        return list(csv.DictReader(f))


def f(x):
    try:
        return float(x)
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------- dataset stats
with open(RAW, encoding="utf-8") as fh:
    raw = list(csv.DictReader(fh))

TEXT_FIELDS = ["title", "company_profile", "description", "requirements", "benefits"]
ALL_FIELDS = [
    "title", "location", "department", "salary_range", "company_profile",
    "description", "requirements", "benefits", "employment_type",
    "required_experience", "required_education", "industry", "function",
]

total = len(raw)
fraud = sum(1 for r in raw if r["fraudulent"] == "1")
genuine = total - fraud


def missing(r, col):
    v = (r.get(col) or "").strip()
    return v == ""


missingness = []
for col in ALL_FIELDS:
    m_all = sum(1 for r in raw if missing(r, col))
    m_fraud = sum(1 for r in raw if r["fraudulent"] == "1" and missing(r, col))
    m_gen = sum(1 for r in raw if r["fraudulent"] == "0" and missing(r, col))
    missingness.append({
        "field": col,
        "pctAll": 100 * m_all / total,
        "pctFraud": 100 * m_fraud / fraud,
        "pctGenuine": 100 * m_gen / genuine,
    })

# structured binary flags by class
flags = []
for col in ["telecommuting", "has_company_logo", "has_questions"]:
    one_fraud = sum(1 for r in raw if r["fraudulent"] == "1" and r.get(col) == "1")
    one_gen = sum(1 for r in raw if r["fraudulent"] == "0" and r.get(col) == "1")
    flags.append({
        "flag": col,
        "pctFraud": 100 * one_fraud / fraud,
        "pctGenuine": 100 * one_gen / genuine,
    })

# ------------------------------------------------------------- duplicate groups
manifest = read_csv("final_split_manifest.csv")
group_sizes = Counter(r["group_id"] for r in manifest)
size_hist = Counter(group_sizes.values())
dup_rows = sum(sz for sz in group_sizes.values() if sz > 1)
dup_groups = sum(1 for sz in group_sizes.values() if sz > 1)
largest = max(group_sizes.values())

duplicates = {
    "totalRows": len(manifest),
    "uniqueGroups": len(group_sizes),
    "singletonGroups": sum(1 for sz in group_sizes.values() if sz == 1),
    "multiRowGroups": dup_groups,
    "rowsInMultiGroups": dup_rows,
    "largestGroupSize": largest,
    "sizeHistogram": sorted(
        [{"size": s, "groups": c} for s, c in size_hist.items()],
        key=lambda d: d["size"],
    ),
}

# ------------------------------------------------------------------------ split
with open(os.path.join(RES, "split_metadata.json"), encoding="utf-8") as fh:
    split_meta = json.load(fh)

train = [r for r in manifest if r["split"] == "train"]
test = [r for r in manifest if r["split"] == "test"]
split = {
    **split_meta,
    "trainFraud": sum(1 for r in train if r["fraudulent"] == "1"),
    "trainTotal": len(train),
    "testFraud": sum(1 for r in test if r["fraudulent"] == "1"),
    "testTotal": len(test),
}

# ------------------------------------------------------- model comparison table
# CV results (group-aware 5-fold) for text models
cv = read_csv("all_model_cv_results.csv")
cv_models = {r["Model"]: r for r in cv}


def cvrow(name, label, family, note=""):
    r = cv_models[name]
    return {
        "name": label, "family": family, "note": note,
        "accuracy": f(r["accuracy"]), "balanced_accuracy": f(r["balanced_accuracy"]),
        "precision": f(r["precision"]), "recall": f(r["recall"]),
        "f1": f(r["f1"]), "pr_auc": f(r["pr_auc"]), "roc_auc": f(r["roc_auc"]),
        "pr_auc_std": f(r.get("pr_auc_std")), "f1_std": f(r.get("f1_std")),
    }


# majority baseline from initial comparison
initial = {r["Model"]: r for r in read_csv("initial_model_comparison.csv")}
maj = initial["Majority Baseline"]

# summaries (metric,mean,std)
def summary(name):
    rows = read_csv(name)
    return {r["metric"]: {"mean": f(r["mean"]), "std": f(r["std"])} for r in rows}


meta_gb = summary("metadata_gradient_boosting_summary.csv")

# Logistic-regression rows that use length features MUST come from the corrected
# (log1p + median impute + StandardScaler, all inside the CV pipeline) results.
# The older *_summary.csv files for these models were produced before that fix
# (raw character counts fed unscaled into LR) and are superseded -- see notebook cell 44.
corrected = {r["model"]: r for r in read_csv("corrected_scaled_model_comparison.csv")}


def corrow(key, label, family, note=""):
    r = corrected[key]
    return {
        "name": label, "family": family, "note": note,
        "accuracy": f(r["accuracy"]), "balanced_accuracy": f(r["balanced_accuracy"]),
        "precision": f(r["precision"]), "recall": f(r["recall"]), "f1": f(r["f1"]),
        "pr_auc": f(r["pr_auc"]), "roc_auc": f(r["roc_auc"]),
        "pr_auc_std": None, "f1_std": None,   # corrected file stores fold means only
    }


def srow(label, family, s, note=""):
    def g(m):
        return s[m]["mean"] if m in s else None
    return {
        "name": label, "family": family, "note": note,
        "accuracy": g("accuracy"), "balanced_accuracy": g("balanced_accuracy"),
        "precision": g("precision"), "recall": g("recall"), "f1": g("f1"),
        "pr_auc": g("pr_auc"), "roc_auc": g("roc_auc"),
        "pr_auc_std": s.get("pr_auc", {}).get("std"), "f1_std": s.get("f1", {}).get("std"),
    }


# rule baseline: 5-fold CV means taken from notebook cell 36 output (no CSV exists)
rule_baseline = {
    "name": "Rule baseline (no profile & no logo)", "family": "baseline",
    "note": "5-fold CV mean; notebook output (no artifact CSV)",
    "accuracy": 0.8692, "balanced_accuracy": 0.7711, "precision": 0.2188,
    "recall": 0.6624, "f1": 0.3287, "pr_auc": 0.1616, "roc_auc": 0.7711,
    "pr_auc_std": 0.0155, "f1_std": 0.0170,
}

model_comparison = {
    "cvNote": "Group-aware 5-fold cross-validation on the training split (mean across folds). Text models use TF-IDF (1-2 grams).",
    "models": [
        {
            "name": "Majority baseline (all genuine)", "family": "baseline",
            "note": "predicts every posting genuine",
            "accuracy": f(maj["accuracy"]), "balanced_accuracy": f(maj["balanced_accuracy"]),
            "precision": f(maj["precision"]), "recall": f(maj["recall"]), "f1": f(maj["f1"]),
            "pr_auc": f(maj["pr_auc"]), "roc_auc": f(maj["roc_auc"]) if maj["roc_auc"] else None,
            "pr_auc_std": None, "f1_std": None,
        },
        rule_baseline,
        cvrow("LR_Unweighted", "Logistic Regression (unweighted)", "text"),
        cvrow("LR_Balanced", "Logistic Regression (balanced)", "text", "proposal's main model"),
        cvrow("LinearSVM_Unweighted", "Linear SVM (unweighted)", "text", "selected model"),
        cvrow("LinearSVM_Balanced", "Linear SVM (balanced)", "text"),
        cvrow("MultinomialNB", "Multinomial Naive Bayes", "text"),
        cvrow("ComplementNB", "Complement Naive Bayes", "text"),
        corrow("Metadata LR (scaled)", "Metadata-only LR (scaled)", "metadata", "structured fields only · corrected scaling"),
        srow("Metadata GBM", "metadata", meta_gb, "gradient boosting on structured fields"),
        corrow("Combined LR (scaled)", "Combined text + metadata LR (scaled)", "combined", "corrected scaling"),
        corrow("Combined LR without missing indicators (scaled)", "Combined LR, no missing indicators (scaled)", "combined", "shortcut ablation · corrected scaling"),
    ],
}

# ------------------------------------------------------- OOF threshold selection
oof = read_csv("oof_threshold_selection.csv")
oof_thresholds = [
    {"model": r["model"], "threshold": f(r["threshold"]), "precision": f(r["precision"]),
     "recall": f(r["recall"]), "f1": f(r["f1"])}
    for r in oof
]

# -------------------------------------------------------- final held-out metrics
ftm = {r["metric"]: f(r["test_value"]) for r in read_csv("final_svm_test_metrics.csv")}
boot = {r["metric"]: {"est": f(r["test_estimate"]), "lo": f(r["ci_lower"]), "hi": f(r["ci_upper"])}
        for r in read_csv("final_test_bootstrap_ci.csv")}
final_test = {"metrics": ftm, "bootstrap": boot}

# ------------------------------------------------------- confusion matrix @ fixed
scores_rows = read_csv("final_test_scores.csv")
THR = split_meta.get("threshold") or -0.3040546139198351
# use the frozen model threshold from the model json
with open(os.path.join(RES, "final_svm_model.json"), encoding="utf-8") as fh:
    THR = json.load(fh)["threshold"]

tp = fp = tn = fn = 0
for r in scores_rows:
    yt = int(r["y_true"]); pred = 1 if f(r["score"]) >= THR else 0
    if yt == 1 and pred == 1: tp += 1
    elif yt == 0 and pred == 1: fp += 1
    elif yt == 0 and pred == 0: tn += 1
    else: fn += 1
confusion = {"tp": tp, "fp": fp, "tn": tn, "fn": fn, "threshold": THR}

# --------------------------------------------------------------- SVM top features
def feats(name, limit=20):
    rows = read_csv(name)[:limit]
    return [{"feature": r["feature"], "coef": f(r["coefficient"])} for r in rows]


features = {"fraud": feats("top_fraud_svm_features.csv"), "legit": feats("top_legitimate_svm_features.csv")}

# --------------------------------------------------------------- country / subgroup
country = []
for r in read_csv("test_country_breakdown.csv"):
    country.append({
        "code": r["country_code"], "postings": int(f(r["postings"])),
        "fraud": int(f(r["fraud_cases"])), "fraudRate": f(r["fraud_rate"]),
        "recall": f(r["fraud_recall"]), "precision": f(r["precision"]),
    })

company_profile = []
for r in read_csv("test_company_profile_breakdown.csv"):
    company_profile.append({
        "status": r["company_profile_status"], "postings": int(f(r["postings"])),
        "fraud": int(f(r["fraud_cases"])), "fraudRate": f(r["fraud_rate"]),
        "recall": f(r["fraud_recall"]), "precision": f(r["precision"]),
    })

# --------------------------------------------------------------- error examples
err = read_csv("test_error_analysis.csv")
err_counts = Counter(r["error_type"] for r in err)


def snippet(text, n=220):
    t = " ".join((text or "").replace("&amp;", "&").split())
    return t if len(t) <= n else t[:n].rsplit(" ", 1)[0] + "…"


def example(error_type):
    """ALL rows of this error type from test_error_analysis.csv (no sampling),
    most confident mistakes first. Text is a short excerpt of the public posting."""
    out = []
    for r in err:
        if r["error_type"] == error_type:
            out.append({
                "title": r["title"].strip(), "location": r["location"].strip(),
                "score": f(r["decision_score"]),
                "profile": r["company_profile_status"],
                "snippet": snippet(r["description"]),
            })
    rev = error_type == "False Positive"   # FP: highest score first; FN: lowest score first
    return sorted(out, key=lambda e: e["score"], reverse=rev)


errors = {
    "counts": dict(err_counts),
    "falsePositives": example("False Positive"),
    "falseNegatives": example("False Negative"),
}

# ----------------------------------------------------------------- write outputs
research = {
    "dataset": {
        "name": "EMSCAD (Employment Scam Aegean Dataset)",
        "source": "Vidros et al., 2017 — University of the Aegean",
        "years": "2012-2014",
        "total": total, "fraud": fraud, "genuine": genuine,
        "fraudRate": fraud / total,
        "textFields": TEXT_FIELDS,
        "missingness": missingness,
        "flags": flags,
    },
    "duplicates": duplicates,
    "split": split,
    "modelComparison": model_comparison,
    "oofThresholds": oof_thresholds,
    "finalTest": final_test,
    "confusion": confusion,
    "features": features,
    "country": country,
    "companyProfile": company_profile,
    "errors": errors,
    "model": {"name": "Unweighted Linear SVM", "threshold": THR, "vocab": 100000},
}

os.makedirs(os.path.join(WEB, "src", "data"), exist_ok=True)
os.makedirs(os.path.join(WEB, "public", "data"), exist_ok=True)

with open(os.path.join(WEB, "src", "data", "research.json"), "w", encoding="utf-8") as fh:
    json.dump(research, fh, ensure_ascii=False, indent=1)

# compact held-out scores for the interactive threshold explorer
scores = [f(r["score"]) for r in scores_rows]   # full precision: identical to results/final_test_scores.csv
labels = [int(r["y_true"]) for r in scores_rows]
with open(os.path.join(WEB, "public", "data", "test_scores.json"), "w", encoding="utf-8") as fh:
    json.dump({"threshold": THR, "scores": scores, "labels": labels}, fh)

print("research.json  ->", len(json.dumps(research)), "bytes")
print("test_scores.json ->", len(scores), "rows")
print("confusion @ frozen threshold:", confusion)
print("dataset:", total, "fraud", fraud, "rate", round(fraud / total, 4))

# ---- Post-hoc near-duplicate check (src/near_duplicate_audit.py), shown in Errors ----
nd_path = os.path.join(RES, "near_duplicate_audit.json")
if os.path.exists(nd_path):
    with open(nd_path, encoding="utf-8") as fh:
        nd = json.load(fh)
    with open(os.path.join(WEB, "src", "data", "near_duplicate_audit.json"), "w", encoding="utf-8") as fh:
        json.dump(nd, fh, indent=1)
    print("Wrote", os.path.join(WEB, "src", "data", "near_duplicate_audit.json"))
