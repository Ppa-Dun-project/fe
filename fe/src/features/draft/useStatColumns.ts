// Hook backing the user's per-group stat-column selection (exactly 5 slots each).
// 슬롯은 항상 5개로 고정 — 비어 있는 자리는 null. 한 자리를 빼도 다른 컬럼이
// 좌측으로 밀려나지 않도록, X 는 자리를 null 로 만들고 + 는 첫 빈 자리를 채운다.
// Values live in localStorage so the choice persists across reloads on this
// device only — same scope as ppadun_unsaved_draft.

import { useCallback, useState } from "react";
import {
  BATTER_DEFAULT_KEYS,
  PITCHER_DEFAULT_KEYS,
  STAT_COLUMN_COUNT,
  getStatDef,
  getDefaultsForGroup,
  type StatGroup,
} from "./statColumns";

export type StatSlot = string | null;

const BATTER_KEY = "ppadun_batter_stat_columns";
const PITCHER_KEY = "ppadun_pitcher_stat_columns";

function storageKey(group: StatGroup): string {
  return group === "batter" ? BATTER_KEY : PITCHER_KEY;
}

// 항상 길이 5. 짧으면 null 로 패딩, 길면 앞 5개만 취한다.
function normalizeLength(cols: StatSlot[]): StatSlot[] {
  if (cols.length === STAT_COLUMN_COUNT) return cols;
  if (cols.length > STAT_COLUMN_COUNT) return cols.slice(0, STAT_COLUMN_COUNT);
  return [...cols, ...Array<StatSlot>(STAT_COLUMN_COUNT - cols.length).fill(null)];
}

function readCols(group: StatGroup): StatSlot[] {
  const defaults: StatSlot[] = [...getDefaultsForGroup(group)];
  try {
    const raw = localStorage.getItem(storageKey(group));
    if (!raw) return normalizeLength(defaults);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return normalizeLength(defaults);
    // 옛 저장본 호환: 5보다 길면 reset, 짧으면 null 패딩.
    const slots: StatSlot[] = [];
    for (const k of parsed) {
      if (k === null) {
        slots.push(null);
        continue;
      }
      if (typeof k !== "string") return normalizeLength(defaults);
      const def = getStatDef(k);
      // 그룹이 안 맞으면 손상된 데이터로 보고 기본값으로 복귀.
      if (!def || def.group !== group) return normalizeLength(defaults);
      slots.push(k);
    }
    return normalizeLength(slots);
  } catch {
    return normalizeLength(defaults);
  }
}

function writeCols(group: StatGroup, cols: StatSlot[]): void {
  try {
    localStorage.setItem(storageKey(group), JSON.stringify(cols));
  } catch {
    // ignore — quota / privacy mode etc. The in-memory state still wins
    // for the rest of the session.
  }
}

export type UseStatColumns = {
  batterCols: StatSlot[];
  pitcherCols: StatSlot[];
  setBatterCols: (cols: StatSlot[]) => void;
  setPitcherCols: (cols: StatSlot[]) => void;
  resetToDefaults: (group: StatGroup) => void;
};

export function useStatColumns(): UseStatColumns {
  const [batterCols, setBatterColsState] = useState<StatSlot[]>(() => readCols("batter"));
  const [pitcherCols, setPitcherColsState] = useState<StatSlot[]>(() => readCols("pitcher"));

  // 항상 길이 5 유지. 다른 길이가 들어와도 normalize 해서 일관성 보장.
  const setBatterCols = useCallback((cols: StatSlot[]) => {
    const next = normalizeLength(cols);
    writeCols("batter", next);
    setBatterColsState(next);
  }, []);

  const setPitcherCols = useCallback((cols: StatSlot[]) => {
    const next = normalizeLength(cols);
    writeCols("pitcher", next);
    setPitcherColsState(next);
  }, []);

  const resetToDefaults = useCallback((group: StatGroup) => {
    const next: StatSlot[] = normalizeLength([
      ...(group === "batter" ? BATTER_DEFAULT_KEYS : PITCHER_DEFAULT_KEYS),
    ]);
    writeCols(group, next);
    if (group === "batter") setBatterColsState(next);
    else setPitcherColsState(next);
  }, []);

  return { batterCols, pitcherCols, setBatterCols, setPitcherCols, resetToDefaults };
}
