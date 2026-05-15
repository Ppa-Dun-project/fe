// Hook backing the user's per-group stat-column selection (5 keys each).
// Values live in localStorage so the choice persists across reloads on
// this device only — same scope as ppadun_unsaved_draft.
//
// Reads validate length and key membership; bad data falls back to
// defaults rather than crashing the page.

import { useCallback, useState } from "react";
import {
  BATTER_DEFAULT_KEYS,
  PITCHER_DEFAULT_KEYS,
  STAT_COLUMN_COUNT,
  getStatDef,
  getDefaultsForGroup,
  type StatGroup,
} from "./statColumns";

const BATTER_KEY = "ppadun_batter_stat_columns";
const PITCHER_KEY = "ppadun_pitcher_stat_columns";

function storageKey(group: StatGroup): string {
  return group === "batter" ? BATTER_KEY : PITCHER_KEY;
}

function readCols(group: StatGroup): string[] {
  const defaults = getDefaultsForGroup(group);
  try {
    const raw = localStorage.getItem(storageKey(group));
    if (!raw) return [...defaults];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...defaults];
    if (parsed.length !== STAT_COLUMN_COUNT) return [...defaults];
    // Every entry must be a known key in the matching group; otherwise
    // the data is stale (e.g. backend renamed a column) and we reset.
    for (const k of parsed) {
      if (typeof k !== "string") return [...defaults];
      const def = getStatDef(k);
      if (!def || def.group !== group) return [...defaults];
    }
    return parsed as string[];
  } catch {
    return [...defaults];
  }
}

function writeCols(group: StatGroup, cols: string[]): void {
  try {
    localStorage.setItem(storageKey(group), JSON.stringify(cols));
  } catch {
    // ignore — quota / privacy mode etc. The in-memory state still wins
    // for the rest of the session.
  }
}

export type UseStatColumns = {
  batterCols: string[];
  pitcherCols: string[];
  setBatterCols: (cols: string[]) => void;
  setPitcherCols: (cols: string[]) => void;
  resetToDefaults: (group: StatGroup) => void;
};

export function useStatColumns(): UseStatColumns {
  const [batterCols, setBatterColsState] = useState<string[]>(() => readCols("batter"));
  const [pitcherCols, setPitcherColsState] = useState<string[]>(() => readCols("pitcher"));

  const setBatterCols = useCallback((cols: string[]) => {
    if (cols.length !== STAT_COLUMN_COUNT) return;
    writeCols("batter", cols);
    setBatterColsState(cols);
  }, []);

  const setPitcherCols = useCallback((cols: string[]) => {
    if (cols.length !== STAT_COLUMN_COUNT) return;
    writeCols("pitcher", cols);
    setPitcherColsState(cols);
  }, []);

  const resetToDefaults = useCallback((group: StatGroup) => {
    if (group === "batter") {
      const next = [...BATTER_DEFAULT_KEYS];
      writeCols("batter", next);
      setBatterColsState(next);
    } else {
      const next = [...PITCHER_DEFAULT_KEYS];
      writeCols("pitcher", next);
      setPitcherColsState(next);
    }
  }, []);

  return { batterCols, pitcherCols, setBatterCols, setPitcherCols, resetToDefaults };
}
