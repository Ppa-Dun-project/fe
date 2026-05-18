import { useCallback, useState } from "react";

type Stack<T> = {
  past: T[];
  present: T;
  future: T[];
};

type Updater<T> = T | ((prev: T) => T);

const HISTORY_LIMIT = 50;

/**
 * useUndoStack: hook that manages a present value while pushing change
 * history onto past/future stacks.
 *
 *   commit(next)   — replace present with next and push the previous value to past (clears future)
 *   undo()         — roll back to the most recent past entry and move the current value to future
 *   redo()         — step forward to the first future entry and move the current value to past
 *   reset(next)    — clear both past and future and set present to next (e.g. loading a new session)
 *
 * commit/undo/redo have stable function identities, so they can be safely
 * placed in dependency arrays. The past length is capped by HISTORY_LIMIT
 * to prevent unbounded memory growth.
 */
export function useUndoStack<T>(initial: T) {
  const [stack, setStack] = useState<Stack<T>>({
    past: [],
    present: initial,
    future: [],
  });

  const commit = useCallback((updater: Updater<T>) => {
    setStack((prev) => {
      const next =
        typeof updater === "function"
          ? (updater as (p: T) => T)(prev.present)
          : updater;
      if (Object.is(prev.present, next)) return prev;
      const nextPast = [...prev.past, prev.present];
      return {
        past:
          nextPast.length > HISTORY_LIMIT
            ? nextPast.slice(nextPast.length - HISTORY_LIMIT)
            : nextPast,
        present: next,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setStack((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      return {
        past: prev.past.slice(0, -1),
        present: previous,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setStack((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: prev.future.slice(1),
      };
    });
  }, []);

  const reset = useCallback((next: T) => {
    setStack({ past: [], present: next, future: [] });
  }, []);

  return {
    state: stack.present,
    commit,
    undo,
    redo,
    reset,
    canUndo: stack.past.length > 0,
    canRedo: stack.future.length > 0,
  };
}
