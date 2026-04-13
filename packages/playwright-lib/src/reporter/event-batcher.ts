/**
 * Generic batching queue: buffers items and flushes them either when the
 * buffer reaches `chunkSize` or on a periodic interval started via `start()`.
 *
 * Concurrent flushes are serialized — a flush triggered while another is
 * in-flight returns the in-flight promise instead of issuing a parallel call.
 */
export class EventBatcher<T> {
  private buffer: T[] = [];
  private flushing: Promise<void> | null = null;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly chunkSize: number,
    private readonly flushIntervalMs: number,
    private readonly flushFn: (items: T[]) => Promise<void>,
    private readonly onFatal: (err: unknown) => void,
  ) {}

  start(): void {
    this.intervalHandle = setInterval(() => void this.flush(), this.flushIntervalMs);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  push(item: T): void {
    this.buffer.push(item);
    if (this.buffer.length >= this.chunkSize) void this.flush();
  }

  async flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (this.buffer.length === 0) return;
    const items = this.buffer.splice(0, this.buffer.length);
    this.flushing = this.flushFn(items)
      .catch((err) => this.onFatal(err))
      .finally(() => {
        this.flushing = null;
      });
    return this.flushing;
  }
}
