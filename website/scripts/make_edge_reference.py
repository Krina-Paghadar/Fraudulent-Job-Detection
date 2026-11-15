"""
Build exact scikit-learn reference scores for edge-case inputs using the FROZEN
model (no retraining): the frozen vocabulary + IDF are loaded into a
TfidfVectorizer configured exactly like the notebook, and the frozen
coefficients/intercept give the LinearSVC decision function.

Run from website/:  python scripts/make_edge_reference.py
Writes: src/data/edge_reference.json
"""
import json, os
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
m = json.load(open(os.path.join(WEB, "public", "model", "final_svm_model.json"), encoding="utf-8"))
FIELDS = m["text_fields"]

vec = TfidfVectorizer(lowercase=True, strip_accents="unicode", ngram_range=(1, 2),
                      sublinear_tf=True, norm="l2", vocabulary=m["vocabulary"])
vec.fit(["x"])                      # sets up the fixed vocabulary; idf is overwritten next
vec.idf_ = np.asarray(m["idf"])
coef, b = np.asarray(m["coefficients"]), m["intercept"]


def combine(f):  # identical to the notebook's combine_text_features for one row
    s = ""
    for c in FIELDS:
        s += " " + c.replace("_", " ") + " " + str(f.get(c, "") or "")
    return s.strip()


E = lambda **kw: {c: kw.get(c, "") for c in FIELDS}
cases = {
    "title_only": E(title="Data Entry Clerk - Work From Home"),
    "description_only": E(description="Earn money from home! Simple data entry and clerical work. Apply using below link."),
    "accents_latin": E(title="Café Manager — Zürich", company_profile="Ñandú Ltd. naïve résumé façade crème brûlée"),
    "punctuation": E(description="Earn $$$ fast!!! Data-entry/clerical work; e-mail: x@y.com... (no experience) [urgent] #hiring @once"),
    "smart_quotes_dashes": E(description="We’re “hiring” now – it’s a ‘great’ role…  —  apply today"),
    "fullwidth_ligatures": E(title="ＦＵＬＬ ＷＩＤＴＨ ｔｅｘｔ", description="ﬁnance ﬂow office ﬀ"),
    "german_turkish": E(description="straße İstanbul ǅemal STRASSE Ångström"),
    "greek_cyrillic": E(description="Ελληνικά ΟΔΥΣΣΕΥΣ работа на дому заработок"),
    "cjk_arabic_devanagari": E(description="日本語 テキスト 中文 العمل من المنزل नौकरी घर से"),
    "digits_underscores": E(description="call 555_1234 or 9876543210 ref_id A1 b2 3c __init__"),
    "combining_marks_rare": E(description="é ä Z̶ x⃗ q᪰"),
    "emoji_symbols": E(description="💰💰 Earn ₹50,000/week 🚀 ✔ work™ from home ©"),
    "whitespace_mix": E(title="\t  Admin Assistant \n", description="line1\r\nline2 line3　end"),
    "very_long": E(title="Customer service", description=("data entry from home earn money weekly " * 3000)),
}
out = []
for name, f in cases.items():
    x = vec.transform([combine(f)])
    out.append({"case": name, "fields": f, "expected_score": float((x @ coef)[0] + b), "nnz": int(x.nnz)})
json.dump({"source": "sklearn TfidfVectorizer with frozen vocabulary/idf + frozen coefficients", "examples": out},
          open(os.path.join(WEB, "src", "data", "edge_reference.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for o in out: print(f'{o["case"]:24s} {o["expected_score"]: .6f} nnz={o["nnz"]}')
