import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWriteQueue } from "./write-queue";

/**
 * Each mechanism is proved by being able to break it: remove the merge, the
 * in-flight guard or the `maxDelay` arithmetic and exactly one of these fails.
 * The reveal tests earned that rule the hard way — see the invariant about
 * `fade-script.test.ts`.
 */

type Patch = { rich?: string; colour?: string };

/** A `send` whose promises resolve only when the test says so. */
function deferredSender() {
  const calls: {
    key: string;
    patch: Patch;
    resolve: () => void;
    reject: (why: unknown) => void;
  }[] = [];
  const send = vi.fn((key: string, patch: Patch) => {
    return new Promise<void>((resolve, reject) => {
      calls.push({ key, patch, resolve, reject });
    });
  });
  return { send, calls };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createWriteQueue", () => {
  it("sends nothing until the artist stops typing", async () => {
    const { send } = deferredSender();
    const queue = createWriteQueue<Patch>({ delay: 500, maxDelay: 5000, send });

    for (const rich of ["h", "he", "hel", "hell", "hello"]) {
      queue.push("t1", { rich });
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(send).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("t1", { rich: "hello" });
  });

  it("merges patches for the same key, keeping the newest value per field", async () => {
    const { send } = deferredSender();
    const queue = createWriteQueue<Patch>({ delay: 500, maxDelay: 5000, send });

    queue.push("t1", { rich: "one" });
    queue.push("t1", { colour: "#000000" });
    queue.push("t1", { rich: "two" });
    await vi.advanceTimersByTimeAsync(500);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("t1", { rich: "two", colour: "#000000" });
  });

  it("keeps separate keys separate", async () => {
    const { send } = deferredSender();
    const queue = createWriteQueue<Patch>({ delay: 500, maxDelay: 5000, send });

    queue.push("t1", { rich: "a" });
    queue.push("t2", { rich: "b" });
    await vi.advanceTimersByTimeAsync(500);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith("t1", { rich: "a" });
    expect(send).toHaveBeenCalledWith("t2", { rich: "b" });
  });

  it("never has two writes for one key in flight", async () => {
    const { send, calls } = deferredSender();
    const queue = createWriteQueue<Patch>({ delay: 500, maxDelay: 5000, send });

    queue.push("t1", { rich: "first" });
    await vi.advanceTimersByTimeAsync(500);
    expect(send).toHaveBeenCalledTimes(1);

    // More typing while the first write is still away.
    queue.push("t1", { rich: "second" });
    queue.push("t1", { rich: "third" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(send).toHaveBeenCalledTimes(1);

    // Only once the first lands does the next go, carrying the newest value.
    calls[0].resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(2);
    expect(calls[1].patch).toEqual({ rich: "third" });
  });

  it("bounds how long a change can wait while typing never pauses", async () => {
    const { send } = deferredSender();
    const queue = createWriteQueue<Patch>({ delay: 500, maxDelay: 2000, send });

    // A keystroke every 100ms re-arms the 500ms debounce forever.
    for (let i = 0; i < 30; i++) {
      queue.push("t1", { rich: `x${i}` });
      await vi.advanceTimersByTimeAsync(100);
    }

    expect(send).toHaveBeenCalled();
    // The first write went out at the ceiling, not at 30 x 100ms.
    expect(send.mock.calls[0][1]).toEqual({ rich: "x19" });
  });

  it("flush sends immediately and resolves once everything has landed", async () => {
    const { send, calls } = deferredSender();
    const queue = createWriteQueue<Patch>({ delay: 500, maxDelay: 5000, send });

    queue.push("t1", { rich: "unsaved" });
    let done = false;
    const flushed = queue.flush().then(() => {
      done = true;
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);
    expect(done).toBe(false);

    calls[0].resolve();
    await flushed;
    expect(done).toBe(true);
    expect(queue.busy()).toBe(false);
  });

  it("flush drains a write queued behind one already in flight", async () => {
    const { send, calls } = deferredSender();
    const queue = createWriteQueue<Patch>({ delay: 500, maxDelay: 5000, send });

    queue.push("t1", { rich: "first" });
    await vi.advanceTimersByTimeAsync(500);
    queue.push("t1", { rich: "second" });

    const flushed = queue.flush();
    calls[0].resolve();
    await vi.advanceTimersByTimeAsync(0);
    calls[1].resolve();
    await flushed;

    expect(send).toHaveBeenCalledTimes(2);
    expect(calls[1].patch).toEqual({ rich: "second" });
  });

  it("reports a failure and carries on rather than wedging the queue", async () => {
    const { send, calls } = deferredSender();
    const onError = vi.fn();
    const queue = createWriteQueue<Patch>({ delay: 500, maxDelay: 5000, send, onError });

    queue.push("t1", { rich: "doomed" });
    await vi.advanceTimersByTimeAsync(500);
    calls[0].reject(new Error("offline"));
    await vi.advanceTimersByTimeAsync(0);

    expect(onError).toHaveBeenCalledWith(expect.any(Error), "t1");
    expect(queue.busy()).toBe(false);

    queue.push("t1", { rich: "next" });
    await vi.advanceTimersByTimeAsync(500);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("reports busy from the first push until the last write settles", async () => {
    const { send, calls } = deferredSender();
    const onBusy = vi.fn();
    const queue = createWriteQueue<Patch>({ delay: 500, maxDelay: 5000, send, onBusy });

    expect(queue.busy()).toBe(false);
    queue.push("t1", { rich: "a" });
    expect(onBusy).toHaveBeenLastCalledWith(true);

    await vi.advanceTimersByTimeAsync(500);
    expect(queue.busy()).toBe(true);

    calls[0].resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(onBusy).toHaveBeenLastCalledWith(false);
    expect(queue.busy()).toBe(false);
  });

  it("dispose cancels a pending timer so an unmounted editor writes nothing", async () => {
    const { send } = deferredSender();
    const queue = createWriteQueue<Patch>({ delay: 500, maxDelay: 5000, send });

    queue.push("t1", { rich: "abandoned" });
    queue.dispose();
    await vi.advanceTimersByTimeAsync(5000);

    expect(send).not.toHaveBeenCalled();
  });
});
