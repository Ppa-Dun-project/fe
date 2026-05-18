import { useCallback, useState } from "react";

type Stack<T> = {
  past: T[];
  present: T;
  future: T[];
};

type Updater<T> = T | ((prev: T) => T);

const HISTORY_LIMIT = 50;

/**
 * useUndoStack: present 값을 관리하면서 변경 이력을 past/future 스택에 쌓는 hook.
 *
 *   commit(next)   — present 를 next 로 바꾸고 이전 값을 past 에 push (future 는 비움)
 *   undo()         — past 의 가장 최근 항목으로 되돌리고 현재 값을 future 로 보냄
 *   redo()         — future 의 가장 앞 항목으로 전진하고 현재 값을 past 로 보냄
 *   reset(next)    — past/future 를 모두 비우고 present 를 next 로 설정 (예: 새 세션 로드)
 *
 * commit/undo/redo 는 안정된 함수 참조라 deps 에 안전하게 넣을 수 있다.
 * past 길이는 HISTORY_LIMIT 으로 제한해 메모리 폭주 방지.
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
