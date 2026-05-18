// Hook backing the user's per-group stat-column selection (exactly 5 slots each).
// Slots are always fixed at 5 — empty positions are null. To keep other columns
// from shifting left when one is removed, X sets the slot to null and + fills
// the first empty slot.
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

// Always length 5. Pads with null if shorter; truncates to the first 5 if longer.
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
    // Legacy compatibility: reset if longer than 5, pad with null if shorter.
    const slots: StatSlot[] = [];
    for (const k of parsed) {
      if (k === null) {
        slots.push(null);
        continue;
      }
      if (typeof k !== "string") return normalizeLength(defaults);
      const def = getStatDef(k);
      // If the group doesn't match, treat the data as corrupted and fall back to defaults.
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

  // Always maintain a length of 5. Normalize any other length to guarantee consistency.
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
