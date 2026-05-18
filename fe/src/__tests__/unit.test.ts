// Unit tests — verify pure functions and hooks in isolation.
// Each module gets its own describe block so it's clear at a glance which area is covered.
//
//   1. features/draft/utils         — roster slots / eligibility / budget / round calculations
//   2. features/draft/draftHelpers  — position filter / batter-vs-pitcher classification / formatters
//   3. hooks/useUndoStack           — push, undo, redo, and reset behavior of the undo/redo stack
//   4. features/draft/useStatColumns — fixed length-5 policy + localStorage round-trip

import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

import {
  DEFAULT_ROSTER_SLOTS,
  buildSlotTemplateFromCounts,
  calculateCurrentRound,
  calculateRemainingBudget,
  clampRosterSize,
  findEligibleSlotIndex,
  findFirstEmptySlot,
  isEligibleForSlot,
  sumRosterSlots,
} from "../features/draft/utils";

import {
  arePlayersComparable,
  formatNumber,
  isPitcherOnly,
  isPitcherPositionFilter,
  matchesPositionFilter,
} from "../features/draft/draftHelpers";

import { useUndoStack } from "../hooks/useUndoStack";
import { useStatColumns } from "../features/draft/useStatColumns";

import type { DraftPick, DraftPlayerPublic } from "../types/draft";

// ───────────────────────────────────────────────────────────────────────
// 1. features/draft/utils
// ───────────────────────────────────────────────────────────────────────
describe("features/draft/utils", () => {
  it("sumRosterSlots sums the counts across every position", () => {
    expect(sumRosterSlots(DEFAULT_ROSTER_SLOTS)).toBe(16);
  });

  it("clampRosterSize clamps the value to the 1..25 range", () => {
    expect(clampRosterSize(0)).toBe(1);
    expect(clampRosterSize(30)).toBe(25);
    expect(clampRosterSize(14)).toBe(14);
    expect(clampRosterSize(undefined)).toBe(12); // default fallback
  });

  it("buildSlotTemplateFromCounts expands in the order SP→RP→C…BENCH", () => {
    const tmpl = buildSlotTemplateFromCounts({
      C: 1, "1B": 1, "2B": 0, "3B": 0, SS: 0,
      OF: 2, UTIL: 0, SP: 1, RP: 1, BENCH: 1,
    });
    expect(tmpl).toEqual(["SP", "RP", "C", "1B", "OF", "OF", "BENCH"]);
  });

  describe("isEligibleForSlot", () => {
    it("BENCH accepts anyone", () => {
      expect(isEligibleForSlot(["SP"], "BENCH")).toBe(true);
      expect(isEligibleForSlot([], "BENCH")).toBe(true);
    });
    it("UTIL accepts only non-pitchers", () => {
      expect(isEligibleForSlot(["OF"], "UTIL")).toBe(true);
      expect(isEligibleForSlot(["SP"], "UTIL")).toBe(false);
      expect(isEligibleForSlot(["SP", "RP"], "UTIL")).toBe(false);
    });
    it("Regular slots require an exact match", () => {
      expect(isEligibleForSlot(["OF"], "OF")).toBe(true);
      expect(isEligibleForSlot(["1B"], "OF")).toBe(false);
    });
  });

  it("findEligibleSlotIndex returns the first eligible slot, or -1 if none", () => {
    const tmpl = ["SP", "C", "BENCH"];
    expect(findEligibleSlotIndex(["C"], tmpl, new Set())).toBe(1);
    expect(findEligibleSlotIndex(["C"], tmpl, new Set([1]))).toBe(2); // falls back to BENCH
    expect(findEligibleSlotIndex(["C"], tmpl, new Set([1, 2]))).toBe(-1);
  });

  it("findFirstEmptySlot returns the first non-occupied index", () => {
    expect(findFirstEmptySlot(new Set(), 8)).toBe(0);
    expect(findFirstEmptySlot(new Set([0, 1]), 8)).toBe(2);
    expect(findFirstEmptySlot(new Set([0, 1, 2, 3, 4, 5, 6, 7]), 8)).toBe(-1);
  });

  it("calculateRemainingBudget guards against negative values (Math.max 0)", () => {
    const picks: DraftPick[] = [
      { playerId: "1", draftedByTeamId: "team-0", slotIndex: 0, slotPos: "OF", bid: 100, type: "mine", kind: "main" },
      { playerId: "2", draftedByTeamId: "team-0", slotIndex: 1, slotPos: "OF", bid: 30, type: "mine", kind: "main" },
      { playerId: "3", draftedByTeamId: "team-1", slotIndex: 0, slotPos: "OF", bid: 50, type: "taken", kind: "main" },
    ];
    expect(calculateRemainingBudget(260, "team-0", picks)).toBe(130);
    expect(calculateRemainingBudget(50, "team-0", picks)).toBe(0); // overspent → 0
  });

  it("calculateCurrentRound counts only main picks and caps at totalRounds", () => {
    const main = (n: number): DraftPick[] =>
      Array.from({ length: n }, (_, i) => ({
        playerId: String(i),
        draftedByTeamId: `team-${i % 4}`,
        slotIndex: 0,
        slotPos: "OF",
        bid: 10,
        type: "mine" as const,
        kind: "main" as const,
      }));
    expect(calculateCurrentRound(4, 16, [])).toBe(1);
    expect(calculateCurrentRound(4, 16, main(5))).toBe(2); // floor(5/4)+1
    expect(calculateCurrentRound(4, 5, main(40))).toBe(5); // capped at rosterSlots
    // Minor/taxi picks are excluded from the count
    const mixed: DraftPick[] = [
      ...main(3),
      { playerId: "x", draftedByTeamId: "team-0", slotIndex: 0, slotPos: null, bid: null, type: "mine", kind: "minor" },
      { playerId: "y", draftedByTeamId: "team-0", slotIndex: 0, slotPos: null, bid: null, type: "mine", kind: "taxi" },
    ];
    expect(calculateCurrentRound(4, 16, mixed)).toBe(1);
  });
});

// ───────────────────────────────────────────────────────────────────────
// 2. features/draft/draftHelpers
// ───────────────────────────────────────────────────────────────────────
describe("features/draft/draftHelpers", () => {
  const makeBatter = (positions: string[]): DraftPlayerPublic =>
    ({
      id: "1",
      name: "Test",
      playerType: "batter",
      team: "NYY",
      positions,
    } as DraftPlayerPublic);
  const makePitcher = (positions: string[] = ["SP"]): DraftPlayerPublic =>
    ({
      id: "2",
      name: "P",
      playerType: "pitcher",
      team: "LAD",
      positions,
    } as DraftPlayerPublic);

  it("matchesPositionFilter is case-insensitive and returns false for an empty array", () => {
    expect(matchesPositionFilter(["of"], "OF")).toBe(true);
    expect(matchesPositionFilter(["1B"], "OF")).toBe(false);
    expect(matchesPositionFilter([], "OF")).toBe(false);
    expect(matchesPositionFilter(undefined, "OF")).toBe(false);
  });

  it("isPitcherOnly / isPitcherPositionFilter", () => {
    expect(isPitcherOnly(makePitcher())).toBe(true);
    expect(isPitcherOnly(makeBatter(["OF"]))).toBe(false);
    expect(isPitcherPositionFilter("SP")).toBe(true);
    expect(isPitcherPositionFilter("RP")).toBe(true);
    expect(isPitcherPositionFilter("OF")).toBe(false);
  });

  it("arePlayersComparable is true only for the same group (batter-vs-batter or pitcher-vs-pitcher)", () => {
    expect(arePlayersComparable(makeBatter(["OF"]), makeBatter(["1B"]))).toBe(true);
    expect(arePlayersComparable(makePitcher(), makePitcher(["RP"]))).toBe(true);
    expect(arePlayersComparable(makeBatter(["OF"]), makePitcher())).toBe(false);
  });

  it("formatNumber renders null/undefined as '-'", () => {
    expect(formatNumber(0.123, 3)).toBe("0.123");
    expect(formatNumber(null, 3)).toBe("-");
    expect(formatNumber(undefined, 2)).toBe("-");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 3. hooks/useUndoStack
// ───────────────────────────────────────────────────────────────────────
describe("hooks/useUndoStack", () => {
  it("initial state has canUndo/canRedo both false", () => {
    const { result } = renderHook(() => useUndoStack<number[]>([]));
    expect(result.current.state).toEqual([]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("commit → undo → redo round-trips the present value correctly", () => {
    const { result } = renderHook(() => useUndoStack<number>(0));
    act(() => result.current.commit(1));
    act(() => result.current.commit(2));
    expect(result.current.state).toBe(2);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.undo());
    expect(result.current.state).toBe(1);
    act(() => result.current.undo());
    expect(result.current.state).toBe(0);
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.redo());
    expect(result.current.state).toBe(1);
    act(() => result.current.redo());
    expect(result.current.state).toBe(2);
  });

  it("future is cleared after commit (blocks branching)", () => {
    const { result } = renderHook(() => useUndoStack<number>(0));
    act(() => result.current.commit(1));
    act(() => result.current.commit(2));
    act(() => result.current.undo()); // present = 1, future = [2]
    act(() => result.current.commit(99));
    expect(result.current.state).toBe(99);
    expect(result.current.canRedo).toBe(false);
  });

  it("reset clears both past and future", () => {
    const { result } = renderHook(() => useUndoStack<number>(0));
    act(() => result.current.commit(1));
    act(() => result.current.commit(2));
    act(() => result.current.reset(42));
    expect(result.current.state).toBe(42);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("commit with the same value is ignored (Object.is)", () => {
    const { result } = renderHook(() => useUndoStack<number>(5));
    act(() => result.current.commit(5));
    expect(result.current.canUndo).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────
// 4. features/draft/useStatColumns
// ───────────────────────────────────────────────────────────────────────
describe("features/draft/useStatColumns", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initial state has length-5 batter/pitcher defaults", () => {
    const { result } = renderHook(() => useStatColumns());
    expect(result.current.batterCols).toHaveLength(5);
    expect(result.current.pitcherCols).toHaveLength(5);
    expect(result.current.batterCols.every((s) => typeof s === "string")).toBe(true);
  });

  it("setBatterCols normalizes the length to 5 (pads with null if shorter)", () => {
    const { result } = renderHook(() => useStatColumns());
    act(() => result.current.setBatterCols(["AVG", "HR"]));
    expect(result.current.batterCols).toHaveLength(5);
    expect(result.current.batterCols.slice(0, 2)).toEqual(["AVG", "HR"]);
    expect(result.current.batterCols.slice(2)).toEqual([null, null, null]);
  });

  it("setBatterCols truncates anything beyond length 5", () => {
    const { result } = renderHook(() => useStatColumns());
    act(() =>
      result.current.setBatterCols(["AVG", "HR", "RBI", "SB", "AB", "OBP", "SLG"]),
    );
    expect(result.current.batterCols).toHaveLength(5);
  });

  it("persists to localStorage immediately on change", () => {
    const { result } = renderHook(() => useStatColumns());
    act(() => result.current.setBatterCols(["AVG", null, "RBI", null, "SB"]));
    const raw = localStorage.getItem("ppadun_batter_stat_columns");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual(["AVG", null, "RBI", null, "SB"]);
  });

  it("resetToDefaults restores only the targeted group to its defaults", () => {
    const { result } = renderHook(() => useStatColumns());
    act(() => result.current.setBatterCols(["HR", null, null, null, null]));
    act(() => result.current.resetToDefaults("batter"));
    expect(result.current.batterCols.filter((s) => s !== null)).toHaveLength(5);
  });
});
