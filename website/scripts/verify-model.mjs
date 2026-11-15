/**
 * Python <-> JavaScript parity check for the live risk checker.
 *
 * Imports the REAL browser scorer (src/lib/scorer.ts — the same file the site
 * ships), not a copy, and compares its decision scores with scikit-learn's on:
 *   1. results/javascript_verification.json — 20 held-out postings scored by the
 *      frozen pipeline in the notebook (decision_function);
 *   2. src/data/edge_reference.json — Unicode / punctuation / partial / very long
 *      inputs scored by sklearn's TfidfVectorizer loaded with the frozen
 *      vocabulary + IDF (scripts/make_edge_reference.py; no retraining).
 *
 * Reports: number of examples, max |score difference|, classification
 * disagreements at the frozen threshold. Exits 1 on any failure.
 * Also asserts the website model file is the frozen results/ artifact.
 *
 * Run:  npm run verify-model     (Node >= 22.6)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Scorer, isBlankPosting } from '../src/lib/scorer.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '..');
const repo = path.resolve(web, '..');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf-8'));
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const FROZEN_THRESHOLD = -0.3040546139198351;
const TOL = 1e-9;
let failed = false;
const report = { generated: new Date().toISOString(), node: process.version, tolerance: TOL, suites: [] };

const modelPath = path.join(web, 'public/model/final_svm_model.json');
const frozenPath = path.join(repo, 'results/final_svm_model.json');
if (fs.existsSync(frozenPath)) {
  const same = sha(modelPath) === sha(frozenPath);
  console.log(`model file identical to results/final_svm_model.json: ${same ? 'yes' : 'NO'}`);
  if (!same) failed = true;
  report.model_matches_results = same;
}
const model = read(modelPath);
if (model.threshold !== FROZEN_THRESHOLD) { console.error(`threshold changed: ${model.threshold}`); failed = true; }
const scorer = new Scorer(model);

function suite(name, file) {
  if (!fs.existsSync(file)) { console.error(`missing ${file}`); failed = true; return; }
  const ex = read(file).examples;
  let maxErr = 0, disagree = 0;
  ex.forEach((e, i) => {
    const got = scorer.score(e.fields).decisionScore;
    const err = Math.abs(got - e.expected_score);
    maxErr = Math.max(maxErr, err);
    if ((got >= FROZEN_THRESHOLD) !== (e.expected_score >= FROZEN_THRESHOLD)) disagree++;
    if (err > TOL) console.error(`  FAIL ${name}[${e.case ?? i}]: python ${e.expected_score} js ${got}`);
  });
  const pass = maxErr <= TOL && disagree === 0;
  if (!pass) failed = true;
  console.log(`${name}: ${ex.length} examples | max |diff| ${maxErr.toExponential(2)} | classification disagreements ${disagree} | ${pass ? 'PASS' : 'FAIL'}`);
  report.suites.push({ name, examples: ex.length, max_abs_diff: maxErr, disagreements: disagree, pass });
}

suite('held-out reference (results/javascript_verification.json)', path.join(repo, 'results/javascript_verification.json'));
suite('edge cases (src/data/edge_reference.json)', path.join(web, 'src/data/edge_reference.json'));

// Empty input must be caught BEFORE scoring (the field-name template alone scores above the threshold).
const blank = { title: '', company_profile: ' ', description: '\n\t', requirements: '', benefits: ' ' };
const blankOk = isBlankPosting(blank) && !isBlankPosting({ ...blank, title: 'x' });
console.log(`blank-input guard: ${blankOk ? 'PASS' : 'FAIL'} (template-only score would be ${scorer.score(blank).decisionScore.toFixed(4)})`);
if (!blankOk) failed = true;
report.blank_guard = blankOk;

report.result = failed ? 'FAIL' : 'PASS';
fs.writeFileSync(path.join(web, 'public/data/parity_report.json'), JSON.stringify(report, null, 1));
console.log(failed ? '\nverify-model: FAIL' : '\nverify-model: PASS — the shipped scorer reproduces the frozen sklearn model.');
process.exit(failed ? 1 : 0);
