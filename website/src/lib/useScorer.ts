import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScoreResult } from './scorer';

export interface ScorerStatus {
  state: 'loading' | 'ready' | 'error';
  modelName?: string;
  threshold?: number;
  vocabSize?: number;
  textFields?: string[];
  error?: string;
}

// Resolved against the PAGE (document.baseURI) on the main thread. A relative URL handed to the
// worker would be resolved against the worker script in assets/, which 404s on the static build.
const MODEL_URL = new URL(`${import.meta.env.BASE_URL}model/final_svm_model.json`, document.baseURI).href;

/**
 * Boots the scorer Web Worker, loads the frozen model once, and exposes an
 * async `score(fields)` that resolves with the genuine decision score.
 */
export function useScorer() {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<ScorerStatus>({ state: 'loading' });
  const pending = useRef(new Map<number, { resolve: (r: ScoreResult) => void; reject: (e: Error) => void }>());
  const nextId = useRef(1);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/scorer.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'ready') {
        setStatus({
          state: 'ready',
          modelName: msg.modelName,
          threshold: msg.threshold,
          vocabSize: msg.vocabSize,
          textFields: msg.textFields,
        });
      } else if (msg.type === 'result') {
        pending.current.get(msg.id)?.resolve(msg.result);
        pending.current.delete(msg.id);
      } else if (msg.type === 'error') {
        if (msg.id != null && pending.current.has(msg.id)) {
          // a scoring request failed: reject it so the UI never waits forever
          pending.current.get(msg.id)!.reject(new Error(msg.message));
          pending.current.delete(msg.id);
        } else {
          setStatus((s) => (s.state === 'ready' ? s : { state: 'error', error: msg.message }));
        }
      }
    };
    worker.onerror = (ev) => {
      setStatus((s) => (s.state === 'ready' ? s : { state: 'error', error: ev.message || 'Model worker failed to start' }));
      pending.current.forEach((p) => p.reject(new Error('Model worker crashed')));
      pending.current.clear();
    };

    worker.postMessage({ type: 'load', url: MODEL_URL });
    return () => worker.terminate();
  }, []);

  const score = useCallback((fields: Record<string, string>): Promise<ScoreResult> => {
    return new Promise((resolve, reject) => {
      const worker = workerRef.current;
      if (!worker) return reject(new Error('Worker not ready'));
      const id = nextId.current++;
      pending.current.set(id, { resolve, reject });
      worker.postMessage({ type: 'score', id, fields });
    });
  }, []);

  return { status, score };
}
