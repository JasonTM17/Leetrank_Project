/**
 * Worker queue abstraction for asynchronous job processing.
 *
 * Today: in-memory FIFO with a configurable concurrency cap. Good enough
 * for single-replica dev and small production deployments where total
 * throughput stays under what one Node process can do.
 *
 * Tomorrow: same surface backed by Redis Streams (XADD producers,
 * XREADGROUP consumers, XACK on success). The interface here is
 * deliberately narrow so the swap is mechanical: enqueue/process/stats.
 *
 * Why this exists separately from the Go judge scheduler: the scheduler
 * inside the Go service bounds in-flight executions across concurrent
 * HTTP requests. This queue bounds Node-side background work — sending
 * webhooks, recomputing rolling stats, indexing search documents — that
 * shouldn't block request handlers but also shouldn't fan out unbounded
 * setTimeout(0) callbacks.
 */

export interface QueueJob<T = unknown> {
  id: string;
  type: string;
  payload: T;
  enqueuedAt: number;
  attempts: number;
}

type Handler<T = unknown> = (payload: T, job: QueueJob<T>) => Promise<void>;

interface QueueOptions {
  concurrency?: number;
  maxAttempts?: number;
}

export class WorkerQueue {
  private queue: QueueJob[] = [];
  private handlers = new Map<string, Handler>();
  private inflight = 0;
  private pendingRetries = 0;
  private nextId = 1;
  private processed = 0;
  private failed = 0;
  private deadLetter: QueueJob[] = [];
  private readonly concurrency: number;
  private readonly maxAttempts: number;

  constructor(opts: QueueOptions = {}) {
    this.concurrency = Math.max(1, opts.concurrency ?? 4);
    this.maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
  }

  on<T>(type: string, handler: Handler<T>): void {
    this.handlers.set(type, handler as Handler);
  }

  enqueue<T>(type: string, payload: T): string {
    const id = `j_${this.nextId++}`;
    this.queue.push({ id, type, payload, enqueuedAt: Date.now(), attempts: 0 });
    void this.pump();
    return id;
  }

  /** Drain the queue; resolves when no jobs remain in flight. Test helper. */
  async drain(): Promise<void> {
    while (this.queue.length > 0 || this.inflight > 0 || this.pendingRetries > 0) {
      await new Promise((r) => setTimeout(r, 5));
    }
  }

  stats() {
    return {
      pending: this.queue.length,
      inflight: this.inflight,
      processed: this.processed,
      failed: this.failed,
      deadLetterCount: this.deadLetter.length,
      handlers: this.handlers.size,
      concurrency: this.concurrency,
    };
  }

  private async pump(): Promise<void> {
    while (this.inflight < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.inflight++;
      void this.run(job);
    }
  }

  private async run(job: QueueJob): Promise<void> {
    try {
      const handler = this.handlers.get(job.type);
      if (!handler) {
        // No handler registered — silently drop instead of looping. Job
        // types are statically declared in this codebase so a missing
        // handler is a programming error, not a runtime condition.
        this.failed++;
        this.deadLetter.push(job);
        return;
      }
      job.attempts++;
      await handler(job.payload, job);
      this.processed++;
    } catch (err) {
      if (job.attempts < this.maxAttempts) {
        // Retry with simple linear backoff. Tests can override the
        // backoff via concurrency/maxAttempts; the production swap to
        // Redis Streams uses XACK+XCLAIM for proper redelivery.
        const delay = 50 * job.attempts;
        this.pendingRetries++;
        setTimeout(() => {
          this.queue.push(job);
          this.pendingRetries--;
          void this.pump();
        }, delay);
      } else {
        this.failed++;
        this.deadLetter.push({ ...job, payload: { error: String(err), original: job.payload } } as QueueJob);
      }
    } finally {
      this.inflight--;
      void this.pump();
    }
  }
}

export const queue = new WorkerQueue({
  concurrency: parseInt(process.env.QUEUE_CONCURRENCY ?? "4", 10),
});
