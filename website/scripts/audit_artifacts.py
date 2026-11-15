"""
Cross-checks every number the website displays against the frozen artifacts in
results/. Read-only: it never modifies results/ or the model.

Run from the website/ directory:
    python scripts/audit_artifacts.py

Exits non-zero if any check fails. Writes a JSON report to
public/data/artifact_audit.json so the site can show what was verified.
"""
import csv
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
REPO = os.path.dirname(WEB)
RES = os.path.join(REPO, "results")

checks = []


def check(name, ok, detail=""):
    checks.append({"check": name, "pass": bool(ok), "detail": str(detail)})
    print(("PASS  " if ok else "FAIL  ") + name + (f"  [{detail}]" if detail else ""))


def rows(name):
    with open(os.path.join(RES, name), encoding="utf-8") as f:
        return list(csv.DictReader(f))


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


close = lambda a, b, tol=1e-12: a is not None and b is not None and abs(float(a) - float(b)) <= tol

research = json.load(open(os.path.join(WEB, "src", "data", "research.json"), encoding="utf-8"))

# ---- 1. listed artifacts exist
listed = [
    "notebooks/01_dataset_understanding.ipynb",
    "results/final_svm_model.json",
    "results/javascript_verification.json",
    "results/final_test_bootstrap_ci.csv",
    "results/oof_threshold_selection.csv",
    "results/final_split_manifest.csv",
    "results/final_test_scores.csv",
    "results/final_svm_test_metrics.csv",
    "results/split_metadata.json",
    "results/oof_unweighted_svm_scores.csv",
    "results/all_model_cv_results.csv",
    "results/corrected_scaled_model_comparison.csv",
]
for p in listed:
    check(f"artifact exists: {p}", os.path.isfile(os.path.join(REPO, p)))
HAVE_ERR = os.path.isfile(os.path.join(RES, "test_error_analysis.csv"))   # git-ignored (full text): local only

# ---- 2. website model / verification files are byte-identical copies of results/
check("website model == results/final_svm_model.json (sha256)",
      sha(os.path.join(WEB, "public", "model", "final_svm_model.json")) == sha(os.path.join(RES, "final_svm_model.json")))
check("website verification set == results/javascript_verification.json (sha256)",
      sha(os.path.join(WEB, "src", "data", "javascript_verification.json")) == sha(os.path.join(RES, "javascript_verification.json")))

model = json.load(open(os.path.join(RES, "final_svm_model.json"), encoding="utf-8"))
THR = -0.3040546139198351
check("model threshold == frozen -0.3040546139198351", model["threshold"] == THR, model["threshold"])
check("model text_fields order", model["text_fields"] == ["title", "company_profile", "description", "requirements", "benefits"], model["text_fields"])
check("model sizes", len(model["vocabulary"]) == len(model["idf"]) == len(model["coefficients"]) == 100000,
      f'{len(model["vocabulary"])}/{len(model["idf"])}/{len(model["coefficients"])}')

# ---- 3. held-out metrics on the site == final_svm_test_metrics.csv
tm = {r["metric"]: float(r["test_value"]) for r in rows("final_svm_test_metrics.csv")}
for k, v in research["finalTest"]["metrics"].items():
    check(f"site test metric {k} == csv", close(v, tm.get(k)), f"{v} vs {tm.get(k)}")

# ---- 4. bootstrap CIs
bc = {r["metric"]: r for r in rows("final_test_bootstrap_ci.csv")}
for k, v in research["finalTest"]["bootstrap"].items():
    r = bc.get(k)
    check(f"site CI {k} == csv", r and close(v["lo"], r["ci_lower"]) and close(v["hi"], r["ci_upper"]) and close(v["est"], r["test_estimate"]))

# ---- 5. confusion matrix recomputed from frozen test scores at the frozen threshold
ts = rows("final_test_scores.csv")
tp = sum(1 for r in ts if r["y_true"] == "1" and float(r["score"]) >= THR)
fp = sum(1 for r in ts if r["y_true"] == "0" and float(r["score"]) >= THR)
tn = sum(1 for r in ts if r["y_true"] == "0" and float(r["score"]) < THR)
fn = sum(1 for r in ts if r["y_true"] == "1" and float(r["score"]) < THR)
c = research["confusion"]
check("CM recomputed from final_test_scores.csv", (tn, fp, fn, tp) == (3393, 10, 49, 124), f"TN{tn} FP{fp} FN{fn} TP{tp}")
check("site CM == recomputed", (c["tn"], c["fp"], c["fn"], c["tp"]) == (tn, fp, fn, tp))
check("site CM threshold == frozen", c["threshold"] == THR)
prec, rec = tp / (tp + fp), tp / (tp + fn)
check("precision/recall from scores == csv", close(prec, tm["precision"]) and close(rec, tm["recall"]), f"{prec:.6f}/{rec:.6f}")

# ---- 6. explorer data == final_test_scores.csv
tj = json.load(open(os.path.join(WEB, "public", "data", "test_scores.json"), encoding="utf-8"))
same = len(tj["scores"]) == len(ts) and all(
    close(a, float(r["score"]), 1e-9) and int(b) == int(r["y_true"]) for a, b, r in zip(tj["scores"], tj["labels"], ts))
check("explorer test_scores.json == final_test_scores.csv", same, f"n={len(tj['scores'])}")
check("explorer threshold == frozen", tj["threshold"] == THR)

# ---- 7. error analysis counts == test_error_analysis.csv
er = research["errors"]
if HAVE_ERR:
    ea = rows("test_error_analysis.csv")
    nfp = sum(1 for r in ea if r["error_type"] == "False Positive")
    nfn = sum(1 for r in ea if r["error_type"] == "False Negative")
    check("error csv FP/FN == CM", (nfp, nfn) == (fp, fn), f"FP{nfp} FN{nfn}")
else:
    nfp, nfn = fp, fn
    print("note: results/test_error_analysis.csv not present (git-ignored); checking site lists against the CM")
check("site error list sizes == csv", len(er["falsePositives"]) == nfp and len(er["falseNegatives"]) == nfn,
      f'{len(er["falsePositives"])}/{len(er["falseNegatives"])}')

# ---- 8. OOF thresholds
oo = {r["model"]: r for r in rows("oof_threshold_selection.csv")}
for r in research["oofThresholds"]:
    o = oo.get(r["model"])
    check(f"OOF row {r['model']} == csv", o and close(r["threshold"], o["threshold"]) and close(r["f1"], o["f1"]))

# ---- 9. split
sm = json.load(open(os.path.join(RES, "split_metadata.json")))
man = rows("final_split_manifest.csv")
tr_g = {r["group_id"] for r in man if r["split"] == "train"}
te_g = {r["group_id"] for r in man if r["split"] == "test"}
check("manifest: 14,304 train / 3,576 test", (sum(r["split"] == "train" for r in man), sum(r["split"] == "test" for r in man)) == (14304, 3576))
check("manifest: zero group overlap", not (tr_g & te_g), len(tr_g & te_g))
check("manifest: 693 / 173 fraud", (sum(r["split"] == "train" and r["fraudulent"] == "1" for r in man),
                                     sum(r["split"] == "test" and r["fraudulent"] == "1" for r in man)) == (693, 173))
check("site split == split_metadata.json", all(research["split"][k] == v for k, v in sm.items()))

# ---- 10. model comparison table values come from CV files (not the test set)
cv = {r["Model"]: r for r in rows("all_model_cv_results.csv")}
for m in research["modelComparison"]["models"]:
    for k in ("f1", "pr_auc"):
        v = m.get(k)
        if v is None:
            continue
        match = any(close(v, r.get(k), 1e-9) for r in cv.values()) or any(
            close(v, r.get(k), 1e-9) for r in rows("corrected_scaled_model_comparison.csv")) or any(
            r["metric"] == k and close(v, r["mean"], 1e-9) for r in rows("metadata_gradient_boosting_summary.csv")) or any(
            close(v, r.get(k), 1e-9) for r in rows("initial_model_comparison.csv") if r.get("Model") == "Majority Baseline")
        is_test = close(v, tm.get(k), 1e-9)
        check(f"CV table {m['name']} {k} traced to a CV file (not the test set)",
              (match and not is_test) or (not match and m["name"].startswith("Rule baseline")),
              "rule baseline: notebook cell output, no CSV" if not match else "")
# superseded unscaled LR results must not appear on the site
stale = [r for r in research["modelComparison"]["models"] if any(close(r.get("f1"), x, 1e-9) for x in (0.395111665151393, 0.5330083697623722, 0.5334687610819983))]
check("no superseded (unscaled) LR results on site", not stale, [r["name"] for r in stale])

ok = all(c["pass"] for c in checks)
json.dump({"result": "PASS" if ok else "FAIL", "n_checks": len(checks), "checks": checks},
          open(os.path.join(WEB, "public", "data", "artifact_audit.json"), "w"), indent=1)
print(f"\n{sum(c['pass'] for c in checks)}/{len(checks)} checks passed -> {'PASS' if ok else 'FAIL'}")
sys.exit(0 if ok else 1)
