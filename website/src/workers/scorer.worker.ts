/// <reference lib="webworker" />
/**
 * Runs the frozen model off the main thread so loading the 6 MB model and
 * scoring never janks the UI. Loads the model once, then answers score requests.
 */
import { Scorer, type ModelData, type ScoreResult } from '../lib/scorer';

type InMsg =
  | { type: 'load'; url: string }
  | { type: 'score'; id: number; fields: Record<string, string> };

type OutMsg =
  | { type: 'ready'; modelName: string; threshold: number; vocabSize: number; textFields: string[] }
  | { type: 'error'; message: string; id?: number }
  | { type: 'result'; id: number; result: ScoreResult };

let scorer: Scorer | null = null;

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  try {
    if (msg.type === 'load') {
      const res = await fetch(msg.url);
      if (!res.ok) throw new Error(`Failed to load model (${res.status})`);
      const model = (await res.json()) as ModelData;
      scorer = new Scorer(model);
      const out: OutMsg = {
        type: 'ready',
        modelName: model.model_name,
        threshold: model.threshold,
        vocabSize: Object.keys(model.vocabulary).length,
        textFields: model.text_fields,
      };
      (self as DedicatedWorkerGlobalScope).postMessage(out);
    } else if (msg.type === 'score') {
      if (!scorer) throw new Error('Model not loaded yet');
      const result = scorer.score(msg.fields);
      const out: OutMsg = { type: 'result', id: msg.id, result };
      (self as DedicatedWorkerGlobalScope).postMessage(out);
    }
  } catch (err) {
    const out: OutMsg = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
      id: msg.type === 'score' ? msg.id : undefined,
    };
    (self as DedicatedWorkerGlobalScope).postMessage(out);
  }
};
