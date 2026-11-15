import { WORD_RANGES, COMBINING_RANGES } from './unicodeTables.ts';

/**
 * Exact browser reimplementation of the frozen sklearn pipeline:
 *   combine_text_features -> TfidfVectorizer(lowercase, strip_accents='unicode',
 *   ngram_range=(1,2), sublinear_tf=True, norm='l2') -> LinearSVC.decision_function
 *
 * Verified against results/javascript_verification.json (20 held-out postings) and
 * src/data/edge_reference.json (Unicode/punctuation/long-input cases scored by sklearn
 * with the frozen vocabulary) -- see scripts/verify-model.mjs.
 * This is the genuine frozen model — no simulation, no random values.
 */

export interface ModelData {
  model_name: string;
  threshold: number;
  intercept: number;
  vocabulary: Record<string, number>;
  idf: number[];
  coefficients: number[];
  vectorizer: {
    lowercase: boolean;
    strip_accents: string;
    ngram_range: [number, number];
    min_df: number;
    max_df: number;
    sublinear_tf: boolean;
    norm: string;
    token_pattern: string;
  };
  text_fields: string[];
}

export interface TermContribution {
  term: string;
  /** signed contribution to the decision score (coef * normalized tf-idf weight) */
  contribution: number;
  coefficient: number;
}

export interface ScoreResult {
  /** raw LinearSVC decision_function output */
  decisionScore: number;
  threshold: number;
  /** decisionScore - threshold; >= 0 means flagged fraudulent */
  margin: number;
  isFraud: boolean;
  /** number of in-vocabulary n-gram features that fired */
  activeFeatures: number;
  /** tokens produced after preprocessing (for transparency) */
  tokenCount: number;
  /** strongest terms pushing the score toward fraud */
  towardFraud: TermContribution[];
  /** strongest terms pulling the score toward legitimate */
  towardLegit: TermContribution[];
}

/* ---- Unicode-exact preprocessing ------------------------------------------
 * JavaScript's `\w` is ASCII-only, but sklearn's token_pattern (?u)\b\w\w+\b uses
 * Python's Unicode `\w`, and strip_accents='unicode' removes every character with
 * unicodedata.combining(c) != 0 (not just U+0300–U+036F). Both sets are generated
 * from Python into unicodeTables.ts, so non-Latin text (Greek, Cyrillic, CJK,
 * Arabic, Devanagari, …) scores identically to Python.
 */
function makeLookup(ranges: [number, number][]): (cp: number) => boolean {
  const ascii = new Uint8Array(128);
  for (const [a, b] of ranges) for (let c = a; c <= Math.min(b, 127); c++) ascii[c] = 1;
  return (cp: number) => {
    if (cp < 128) return ascii[cp] === 1;
    let lo = 0, hi = ranges.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cp < ranges[mid][0]) hi = mid - 1;
      else if (cp > ranges[mid][1]) lo = mid + 1;
      else return true;
    }
    return false;
  };
}
const isWord = makeLookup(WORD_RANGES);
const isCombining = makeLookup(COMBINING_RANGES);

/** sklearn order: lowercase FIRST, then strip_accents_unicode (skipped for pure-ASCII, as in sklearn). */
function preprocess(s: string): string {
  const lower = s.toLowerCase();
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7f]*$/.test(lower)) return lower;
  let out = '';
  for (const ch of lower.normalize('NFKD')) if (!isCombining(ch.codePointAt(0)!)) out += ch;
  return out;
}

/** Equivalent of re.findall(r"(?u)\b\w\w+\b", s): maximal runs of >= 2 word characters. */
function tokenize(s: string): string[] {
  const toks: string[] = [];
  let cur = '';
  let n = 0;
  for (const ch of s) {               // iterates by code point (handles astral characters)
    if (isWord(ch.codePointAt(0)!)) { cur += ch; n++; }
    else { if (n >= 2) toks.push(cur); cur = ''; n = 0; }
  }
  if (n >= 2) toks.push(cur);
  return toks;
}

/** True when every field is empty or whitespace-only (Python str.strip() semantics). */
export function isBlankPosting(fields: Record<string, string>): boolean {
  return Object.values(fields).every((v) => (v ?? '').toString().replace(/[\s\u001c-\u001f\u0085]/g, '') === '');
}

export class Scorer {
  private model: ModelData;

  constructor(model: ModelData) {
    this.model = model;
  }

  get textFields(): string[] {
    return this.model.text_fields;
  }

  get threshold(): number {
    return this.model.threshold;
  }

  /** Replicates combine_text_features: " " + field-label + " " + value, per field, then trim. */
  private combine(fields: Record<string, string>): string {
    let combined = '';
    for (const col of this.model.text_fields) {
      const val = (fields[col] ?? '').toString();
      combined += ' ' + col.replace(/_/g, ' ') + ' ' + val;
    }
    return combined.trim();
  }

  score(fields: Record<string, string>): ScoreResult {
    const { vocabulary, idf, coefficients, intercept, threshold } = this.model;
    const toks = tokenize(preprocess(this.combine(fields)));

    // term counts for unigrams + bigrams (ngram_range = 1..2)
    const counts = new Map<string, number>();
    for (const t of toks) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (let i = 0; i + 1 < toks.length; i++) {
      const bg = toks[i] + ' ' + toks[i + 1];
      counts.set(bg, (counts.get(bg) ?? 0) + 1);
    }

    // sublinear tf-idf weights for in-vocabulary terms, then L2 normalize
    const terms: string[] = [];
    const idxs: number[] = [];
    const weights: number[] = [];
    let norm2 = 0;
    for (const [term, c] of counts) {
      const j = vocabulary[term];
      if (j === undefined) continue;
      const w = (1 + Math.log(c)) * idf[j];
      terms.push(term);
      idxs.push(j);
      weights.push(w);
      norm2 += w * w;
    }
    const inv = norm2 > 0 ? 1 / Math.sqrt(norm2) : 0;

    let decisionScore = intercept;
    const contribs: TermContribution[] = [];
    for (let k = 0; k < idxs.length; k++) {
      const coef = coefficients[idxs[k]];
      const contribution = coef * (weights[k] * inv);
      decisionScore += contribution;
      if (contribution !== 0) {
        contribs.push({ term: terms[k], contribution, coefficient: coef });
      }
    }

    const towardFraud = contribs
      .filter((c) => c.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 8);
    const towardLegit = contribs
      .filter((c) => c.contribution < 0)
      .sort((a, b) => a.contribution - b.contribution)
      .slice(0, 8);

    return {
      decisionScore,
      threshold,
      margin: decisionScore - threshold,
      isFraud: decisionScore >= threshold,
      activeFeatures: idxs.length,
      tokenCount: toks.length,
      towardFraud,
      towardLegit,
    };
  }
}
