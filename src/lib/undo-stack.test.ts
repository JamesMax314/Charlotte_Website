import { describe, expect, it, vi } from "vitest";
import { createUndoStack, type UndoEntry } from "./undo-stack";

/** An entry that records the order in which its two halves ran. */
const spyEntry = (label: string, log: string[]): UndoEntry => ({
  label,
  undo: () => {
    log.push(`undo:${label}`);
  },
  redo: () => {
    log.push(`redo:${label}`);
  },
});

describe("createUndoStack", () => {
  it("undoes the most recent entry first", async () => {
    const log: string[] = [];
    const stack = createUndoStack();
    stack.record(spyEntry("a", log));
    stack.record(spyEntry("b", log));

    await stack.undo();
    await stack.undo();

    expect(log).toEqual(["undo:b", "undo:a"]);
  });

  it("moves undone entries onto the redo side and back again", async () => {
    const log: string[] = [];
    const stack = createUndoStack();
    stack.record(spyEntry("a", log));

    expect(stack.depth()).toEqual({ undo: 1, redo: 0 });
    await stack.undo();
    expect(stack.depth()).toEqual({ undo: 0, redo: 1 });
    await stack.redo();
    expect(stack.depth()).toEqual({ undo: 1, redo: 0 });
    expect(log).toEqual(["undo:a", "redo:a"]);
  });

  it("reports nothing to do rather than throwing on an empty stack", async () => {
    const stack = createUndoStack();
    expect(await stack.undo()).toBe(false);
    expect(await stack.redo()).toBe(false);
  });

  it("drops the redo history when a new action is recorded", async () => {
    const log: string[] = [];
    const stack = createUndoStack();
    stack.record(spyEntry("a", log));
    await stack.undo();
    stack.record(spyEntry("b", log));

    expect(stack.depth()).toEqual({ undo: 1, redo: 0 });
    expect(await stack.redo()).toBe(false);
  });

  /*
    The re-entrancy guard. An entry's undo puts the surface back through the
    same path the artist's gesture takes, and that path records — so without
    this the stack grows as it is consumed.
  */
  it("ignores anything recorded while an entry is being applied", async () => {
    const log: string[] = [];
    const stack = createUndoStack();
    stack.record({
      label: "a",
      undo: () => {
        log.push("undo:a");
        stack.record(spyEntry("echo", log));
      },
      redo: () => {
        log.push("redo:a");
      },
    });

    await stack.undo();

    expect(stack.depth()).toEqual({ undo: 0, redo: 1 });
    expect(log).toEqual(["undo:a"]);
  });

  /*
    Every entry fires a server action, and two updates to one row racing let
    the earlier land second — the ordering fault write-queue.ts exists for.
  */
  it("serialises overlapping applications", async () => {
    const log: string[] = [];
    const release: Array<() => void> = [];
    const slow = (label: string): UndoEntry => ({
      label,
      undo: () =>
        new Promise<void>((resolve) => {
          log.push(`start:${label}`);
          release.push(() => {
            log.push(`end:${label}`);
            resolve();
          });
        }),
      redo: () => {},
    });

    const stack = createUndoStack();
    stack.record(slow("a"));
    stack.record(slow("b"));

    const first = stack.undo();
    const second = stack.undo();

    // Only b has begun: a is queued behind it rather than running alongside.
    await vi.waitFor(() => expect(release).toHaveLength(1));
    expect(log).toEqual(["start:b"]);

    release[0]();
    await first;
    await vi.waitFor(() => expect(release).toHaveLength(2));
    release[1]();
    await second;

    expect(log).toEqual(["start:b", "end:b", "start:a", "end:a"]);
  });

  /*
    A failed entry means the entries beneath it were recorded against a state
    the site is no longer in, so the whole history goes rather than leaving one
    that will do something confident and wrong.
  */
  it("clears the whole history when an entry fails, and reports it", async () => {
    const onError = vi.fn();
    const stack = createUndoStack({ onError });
    stack.record(spyEntry("a", []));
    stack.record({
      label: "b",
      undo: () => Promise.reject(new Error("D1 said no")),
      redo: () => {},
    });

    expect(await stack.undo()).toBe(false);

    expect(stack.depth()).toEqual({ undo: 0, redo: 0 });
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "b");
  });

  it("does not let a failure poison the entries queued behind it", async () => {
    const log: string[] = [];
    const stack = createUndoStack();
    stack.record({
      label: "boom",
      undo: () => Promise.reject(new Error("no")),
      redo: () => {},
    });

    await stack.undo();
    stack.record(spyEntry("after", log));
    await stack.undo();

    expect(log).toEqual(["undo:after"]);
  });

  it("keeps at most `limit` entries, dropping the oldest", () => {
    const stack = createUndoStack({ limit: 2 });
    stack.record(spyEntry("a", []));
    stack.record(spyEntry("b", []));
    stack.record(spyEntry("c", []));

    expect(stack.depth()).toEqual({ undo: 2, redo: 0 });
  });

  it("forgets everything on clear", async () => {
    const stack = createUndoStack();
    stack.record(spyEntry("a", []));
    await stack.undo();

    stack.clear();

    expect(stack.depth()).toEqual({ undo: 0, redo: 0 });
  });

  /*
    Navigation clears the history; an entry already in flight belongs to the
    history that was cleared and must not land in the one that replaced it.
  */
  it("does not return an in-flight entry to a history that was cleared", async () => {
    let release = () => {};
    const stack = createUndoStack();
    stack.record({
      label: "a",
      undo: () => new Promise<void>((resolve) => (release = resolve)),
      redo: () => {},
    });

    const applying = stack.undo();
    stack.clear();
    release();
    await applying;

    expect(stack.depth()).toEqual({ undo: 0, redo: 0 });
  });
});
