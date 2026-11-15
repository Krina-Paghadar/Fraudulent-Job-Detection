"""
End-to-end browser QA of the BUILT site (website/dist), covering the manual test list:
navigation, risk checker (5 fields, examples, re-analyse, clear, empty, partial, long input),
threshold explorer (both directions, CM/metrics consistency, reset), held-out results unchanged,
console errors, failed requests, horizontal overflow and focus visibility at 4 widths.

Expected scores are computed independently in Python with scikit-learn's TfidfVectorizer loaded
with the frozen vocabulary/IDF + frozen coefficients (no retraining).

Usage (from website/, after `npm run build`):
    python -m http.server 8802 -d dist &
    python scripts/browser_qa.py http://localhost:8802/ qa_out
Needs: playwright (+ a Chromium/Chrome), scikit-learn, numpy.
"""
import json, os, sys, warnings
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from playwright.sync_api import sync_playwright

warnings.filterwarnings("ignore")
URL, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(WEB)
M = json.load(open(os.path.join(WEB, "public/model/final_svm_model.json"), encoding="utf-8"))
FIELDS, THR = M["text_fields"], M["threshold"]
vec = TfidfVectorizer(lowercase=True, strip_accents="unicode", ngram_range=(1, 2), sublinear_tf=True,
                      norm="l2", vocabulary=M["vocabulary"]).fit(["x"])
vec.idf_ = np.asarray(M["idf"]); COEF = np.asarray(M["coefficients"])
def py_score(f):
    s = "".join(" " + c.replace("_", " ") + " " + (f.get(c) or "") for c in FIELDS).strip()
    return float((vec.transform([s]) @ COEF)[0] + M["intercept"])
TS = json.load(open(os.path.join(WEB, "public/data/test_scores.json")))
def py_cm(t):
    tp = fp = tn = fn = 0
    for s, l in zip(TS["scores"], TS["labels"]):
        p = s >= t
        if l: tp += p; fn += not p
        else: fp += p; tn += not p
    return dict(tp=tp, fp=fp, tn=tn, fn=fn)
EXAMPLES = json.load(open(os.path.join(WEB, "src/data/examples.json"), encoding="utf-8"))

results = []
def check(name, ok, detail=""):
    results.append({"check": name, "pass": bool(ok), "detail": str(detail)})
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""))

with sync_playwright() as p:
    exe = "/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None
    br = p.chromium.launch(executable_path=exe, args=["--no-sandbox"])
    pg = br.new_page(viewport={"width": 1366, "height": 900})
    errors, failed = [], []
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    EXTERNAL = ("fonts.googleapis.com", "fonts.gstatic.com")   # web fonts: blocked in the offline test sandbox only
    pg.on("response", lambda r: failed.append(f"{r.status} {r.url}") if r.status >= 400 else None)
    pg.on("requestfailed", lambda r: None if any(x in r.url for x in EXTERNAL) else failed.append(f"failed {r.url}"))
    pg.goto(URL, wait_until="networkidle")

    # ---------- 1. navigation: every link lands with its section heading below the fixed nav
    nav_bottom = pg.eval_on_selector(".nav-inner", "e => e.getBoundingClientRect().bottom")
    hrefs = pg.eval_on_selector_all(".nav-links a", "els => els.map(e => e.getAttribute('href'))")
    for h in hrefs:
        pg.click(f".nav-links a[href='{h}']"); pg.wait_for_timeout(2500)   # smooth scroll
        top = pg.eval_on_selector(h, "e => e.getBoundingClientRect().top")
        head = pg.eval_on_selector(h, "e => { const x = e.querySelector('h2,h1,.eyebrow,[class*=eyebrow]'); return x ? x.getBoundingClientRect().top : e.getBoundingClientRect().top }")
        check(f"nav {h}: section reached, heading not under nav", -2 <= top <= 140 and head >= nav_bottom - 1, f"section top {top:.0f}, heading {head:.0f}, nav bottom {nav_bottom:.0f}")

    # ---------- 2. risk checker
    pg.locator("#checker").scroll_into_view_if_needed()
    pg.wait_for_function("() => document.querySelector('.checker-actions .btn-primary').textContent.includes('Analyse')", timeout=30000)
    check("model loads (button enabled)", True)
    def analyse():
        pg.click(".checker-actions .btn-primary")
        # fresh result = result shown, no stale banner, button back to "Analyse posting"
        pg.wait_for_function("""() => document.querySelector('.result-score-num') && !document.querySelector('.result-stale')
            && document.querySelector('.checker-actions .btn-primary').textContent.trim() === 'Analyse posting'""", timeout=10000)
        pg.wait_for_timeout(700)   # let the enter animation finish
    shown = lambda: float(pg.inner_text(".result-score-num"))
    fill = lambda f: [pg.fill(f"#checker [name={k}]", f.get(k, "")) for k in FIELDS]

    # 2a. empty + whitespace-only must NOT be scored
    for label, f in (("empty", {}), ("whitespace-only", {k: "  \n\t " for k in FIELDS})):
        fill(f); pg.click(".checker-actions .btn-primary"); pg.wait_for_timeout(400)
        msg = pg.inner_text("#checker-msg")
        check(f"{label} input: validation shown, no score", "Enter a job posting" in msg and pg.locator(".result-score-num").count() == 0, msg[:60])

    # 2b. all five fields typed manually (a held-out reference posting)
    ref = json.load(open(os.path.join(REPO, "results/javascript_verification.json")))["examples"][3]
    fill(ref["fields"]); analyse()
    check("5 fields manual: score == Python", abs(shown() - ref["expected_score"]) < 6e-4, f"{shown()} vs {ref['expected_score']:.4f}")
    check("decision score + threshold displayed", "τ = -0.304" in pg.inner_text(".result-explain") and "not a probability" in pg.inner_text(".result-explain"))
    # 2c. change one field -> stale state -> analyse again -> fresh score
    f2 = dict(ref["fields"]); f2["title"] = "Data entry clerk earn money from home"
    pg.fill("#checker [name=title]", f2["title"]); pg.wait_for_timeout(200)
    check("edit after result: stale banner + 'Analyse again'", pg.locator(".result-stale").count() == 1 and "again" in pg.inner_text(".checker-actions .btn-primary"))
    analyse()
    check("re-analyse: new score == Python", abs(shown() - py_score(f2)) < 6e-4 and pg.locator(".result-stale").count() == 0, f"{shown()} vs {py_score(f2):.4f}")
    # 2d. every example button fills all five fields correctly and scores as stored
    for i, ex in enumerate(EXAMPLES):
        pg.locator(".chip").nth(i).click(); pg.wait_for_timeout(150)
        vals = {k: pg.input_value(f"#checker [name={k}]") for k in FIELDS}
        same = all(vals[k] == (ex["fields"].get(k) or "") for k in FIELDS)
        analyse()
        check(f"example '{ex['name'][:28]}': all 5 fields filled, score ok", same and abs(shown() - py_score(ex["fields"])) < 6e-4 and abs(shown() - ex["score"]) < 6e-4,
              f"score {shown()} (stored {ex['score']})")
    # 2e. clear all
    pg.click(".checker-actions .btn-ghost"); pg.wait_for_timeout(900)    # exit animation
    check("clear all empties fields and result", all(pg.input_value(f"#checker [name={k}]") == "" for k in FIELDS) and pg.locator(".result-score-num").count() == 0)
    # 2f. partial input
    part = {"title": "Data Entry Clerk - Work From Home"}
    fill(part); analyse()
    check("partial input: score == Python + partial notice", abs(shown() - py_score(part)) < 6e-4 and pg.locator(".result-partial").count() == 1, f"{shown()}")
    # 2g. long input (under the cap) + over-cap trimming
    long = {"title": "Customer service", "description": "data entry from home earn money weekly " * 480}
    fill(long); analyse()
    w = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check("long input (~18k chars): score == Python, no overflow", abs(shown() - py_score(long)) < 6e-4 and w <= 1, f"{len(long['description'])} chars, overflow {w}px")
    pg.fill("#checker [name=description]", "x " * 12000); pg.wait_for_timeout(200)
    check("over-length field trimmed to 20,000 with message", len(pg.input_value("#checker [name=description]")) == 20000 and "trimmed" in pg.inner_text("#checker-msg"))
    pg.click(".checker-actions .btn-ghost")
    pg.screenshot(path=os.path.join(OUT, "checker_1366.png"))

    # ---------- 3. threshold explorer
    pg.locator("#lab").scroll_into_view_if_needed(); pg.wait_for_selector(".lab-slider")
    def lab_cm():
        txt = pg.eval_on_selector_all(".lab-side .cm .cm-val", "e => e.map(x => x.textContent.replace(/,/g, ''))")
        tn, fp, fn, tp = map(int, txt)
        return dict(tp=tp, fp=fp, tn=tn, fn=fn)
    check("explorer starts at frozen CM", lab_cm() == dict(tp=124, fp=10, tn=3393, fn=49), lab_cm())
    for t in (0.5, 1.2, -1.0, -2.0, -0.6):
        pg.eval_on_selector(".lab-slider", f"(e) => {{ const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(e, '{t}'); e.dispatchEvent(new Event('input', {{bubbles: true}})); }}")
        pg.wait_for_timeout(250)
        exp = py_cm(t); got = lab_cm()
        mets = pg.eval_on_selector_all(".lab-metric-v", "e => e.map(x => parseFloat(x.textContent))")
        prec = exp["tp"] / (exp["tp"] + exp["fp"]) if exp["tp"] + exp["fp"] else 0
        rec = exp["tp"] / (exp["tp"] + exp["fn"]); f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0
        ok_m = abs(mets[0] - 100 * prec) < 0.06 and abs(mets[1] - 100 * rec) < 0.06 and abs(mets[2] - 100 * f1) < 0.06
        check(f"slider τ={t}: CM + precision/recall/F1 == Python", got == exp and ok_m, f"{got} | P/R/F1 {mets[:3]}")
    check("explorer flags exploratory state", "not a reported operating point" in pg.inner_text(".lab-banner"))
    res_cm = pg.eval_on_selector_all("#results .cm .cm-val", "e => e.map(x => x.textContent)")
    check("held-out CM unchanged while exploring", res_cm == ["3,393", "10", "49", "124"], res_cm)
    pg.click(".lab-slider-row button"); pg.wait_for_timeout(250)
    check("reset to frozen threshold", lab_cm() == dict(tp=124, fp=10, tn=3393, fn=49) and "fixed operating threshold" in pg.inner_text(".lab-banner"))

    # ---------- 4. model table labelling
    t = pg.inner_text("#models")
    check("comparison titled '5-fold cross-validation', no 'FINAL' label", "Model comparison — 5-fold cross-validation" in t and "FINAL" not in t and "selected model" in t)
    check("no superseded unscaled values in table", "0.533" not in t and "0.680" not in t)

    # ---------- 5. error analysis expand
    pg.locator("#errors").scroll_into_view_if_needed()
    btns = pg.locator(".err-more")
    btns.nth(1).click(); pg.wait_for_timeout(200)
    n_fn = pg.eval_on_selector("#err-list-fn", "e => e.children.length")
    check("error analysis: 'Examples from …' + show all 49 FN", "Examples from 49 false negatives" in pg.inner_text("#errors") and n_fn == 49, n_fn)

    # ---------- 6. keyboard focus visible
    pg.goto(URL, wait_until="networkidle"); pg.keyboard.press("Tab"); pg.keyboard.press("Tab")
    ring = pg.evaluate("() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle + ' ' + s.outlineWidth + ' | ' + s.boxShadow }")
    check("keyboard focus is visible", "none 0px | none" not in ring, ring[:80])
    check("no console errors", not errors, errors[:3])
    check("no failed network requests", not failed, failed[:3])

    # ---------- 7. responsive: overflow + screenshots at 4 widths
    for w_, h_ in ((1920, 1080), (1366, 768), (820, 1180), (375, 812)):
        q = br.new_page(viewport={"width": w_, "height": h_})
        q.goto(URL, wait_until="networkidle")
        for _ in range(40):  # scroll through so reveal animations fire
            q.mouse.wheel(0, 900); q.wait_for_timeout(60)
        ov = q.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        check(f"{w_}px: no horizontal page scroll", ov <= 1, f"{ov}px")
        q.locator("#lab").scroll_into_view_if_needed(); q.wait_for_timeout(500)
        q.locator(".lab-side").screenshot(path=os.path.join(OUT, f"lab_cm_{w_}.png"))
        q.locator("#results").screenshot(path=os.path.join(OUT, f"results_{w_}.png"))
        q.screenshot(path=os.path.join(OUT, f"full_{w_}.png"), full_page=True)
        q.close()
    br.close()

ok = all(r["pass"] for r in results)
json.dump({"result": "PASS" if ok else "FAIL", "checks": results}, open(os.path.join(OUT, "browser_qa_report.json"), "w"), indent=1)
print(f"\n{sum(r['pass'] for r in results)}/{len(results)} checks passed -> {'PASS' if ok else 'FAIL'}")
sys.exit(0 if ok else 1)
