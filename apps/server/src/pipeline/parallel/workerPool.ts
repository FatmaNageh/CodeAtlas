import { Worker } from "node:worker_threads";

type Pending = {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
};

export type WorkerPoolOptions = {
  /** Number of workers in the pool. */
  size: number;
  /**
   * Extra Node exec arguments for the worker process.
   * Useful to enable TS loaders (e.g., tsx) when workers load .ts files.
   */
  execArgv?: string[];
};

/**
 * Very small Worker Thread pool.
 *
 * - Fixed-size.
 * - FIFO queue.
 * - Correlates requests with an id.
 */
export class WorkerPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Array<{ id: number; payload: any }> = [];
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private closed = false;

  constructor(private workerUrl: URL, opts: WorkerPoolOptions) {
    const size = Math.max(1, Math.floor(opts.size));

    // Node v18.19+ / v20.6+ deprecated --loader for userland loaders.
    // `tsx` works via: node --import tsx
    const execArgv = opts.execArgv ?? ["--import", "tsx"];

    for (let i = 0; i < size; i++) {
      const w = new Worker(workerUrl, { execArgv });

      w.on("message", (msg) => this.onMessage(w, msg));
      w.on("error", (err) => this.onWorkerError(w, err));
      w.on("exit", (code) => {
        if (code !== 0) this.onWorkerError(w, new Error(`Worker exited with code ${code}`));
      });

      this.workers.push(w);
      this.idle.push(w);
    }
  }

  run<T = any>(payload: any): Promise<T> {
    if (this.closed) return Promise.reject(new Error("WorkerPool is closed"));

    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.queue.push({ id, payload });
      this.drain();
    });
  }

  private drain() {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const w = this.idle.pop()!;
      const job = this.queue.shift()!;
      w.postMessage(job);
    }
  }

  private onMessage(w: Worker, msg: any) {
    const { id, ok, result, error } = msg ?? {};
    const p = this.pending.get(id);
    if (!p) return;

    this.pending.delete(id);
    this.idle.push(w);
    this.drain();

    if (ok) p.resolve(result);
    else p.reject(new Error(error ?? "Worker error"));
  }

  private onWorkerError(_w: Worker, err: any) {
    // Fail everything fast. This keeps behavior simple and predictable.
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers = [];
    this.idle = [];
    this.queue = [];
    this.pending.clear();
  }
}
