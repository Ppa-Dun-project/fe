// Stat-column registry for the draft page player list.
//
// Each stat has a key (used as the localStorage value and lookup id),
// a display label, a group (batter / pitcher), an accessor that reads
// the value from a player object, and a formatter that renders it.
//
// Some field names (h / r / hr / bb) appear in both batter and pitcher
// stat lists but mean different things (e.g. HR = home runs hit vs
// home runs allowed). To keep the registry's key→def lookup unique,
// the pitcher versions get a `P_` key prefix internally while the
// user-facing label stays "H" / "R" / "HR" / "BB".

import type { DraftPlayerPublic } from "../../types/draft";
import { formatAvg } from "./utils";

export type StatGroup = "batter" | "pitcher";

export type StatDef = {
  key: string;
  label: string;
  group: StatGroup;
  accessor: (p: DraftPlayerPublic) => number | null | undefined;
  format: (v: number | null | undefined) => string;
  // For pitcher rate stats (ERA / WHIP / FIP / runs allowed, etc.), lower values are better.
  // When sorting "best first", these need the comparator direction flipped.
  lowerIsBetter?: boolean;
};

const formatInt = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : String(v);

const formatDecimal = (digits: number) => (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : v.toFixed(digits);

// AVG-style: strip leading 0 → ".280"
const formatRate3 = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : formatAvg(v);

export const STAT_DEFS: readonly StatDef[] = [
  // ── Batter (15) ────────────────────────────────────────────────────
  { key: "AB",  label: "AB",  group: "batter", accessor: (p) => p.ab,     format: formatInt },
  { key: "R",   label: "R",   group: "batter", accessor: (p) => p.r,      format: formatInt },
  { key: "H",   label: "H",   group: "batter", accessor: (p) => p.h,      format: formatInt },
  { key: "1B",  label: "1B",  group: "batter", accessor: (p) => p.single, format: formatInt },
  { key: "2B",  label: "2B",  group: "batter", accessor: (p) => p.double, format: formatInt },
  { key: "3B",  label: "3B",  group: "batter", accessor: (p) => p.triple, format: formatInt },
  { key: "HR",  label: "HR",  group: "batter", accessor: (p) => p.hr,     format: formatInt },
  { key: "RBI", label: "RBI", group: "batter", accessor: (p) => p.rbi,    format: formatInt },
  { key: "BB",  label: "BB",  group: "batter", accessor: (p) => p.bb,     format: formatInt },
  { key: "K",   label: "K",   group: "batter", accessor: (p) => p.k,      format: formatInt },
  { key: "SB",  label: "SB",  group: "batter", accessor: (p) => p.sb,     format: formatInt },
  { key: "CS",  label: "CS",  group: "batter", accessor: (p) => p.cs,     format: formatInt },
  { key: "AVG", label: "AVG", group: "batter", accessor: (p) => p.avg,    format: formatRate3 },
  { key: "OBP", label: "OBP", group: "batter", accessor: (p) => p.obp,    format: formatRate3 },
  { key: "SLG", label: "SLG", group: "batter", accessor: (p) => p.slg,    format: formatRate3 },

  // ── Pitcher (24) ───────────────────────────────────────────────────
  { key: "W",        label: "W",     group: "pitcher", accessor: (p) => p.w,        format: formatInt },
  { key: "L",        label: "L",     group: "pitcher", accessor: (p) => p.l,        format: formatInt, lowerIsBetter: true },
  { key: "SV",       label: "SV",    group: "pitcher", accessor: (p) => p.sv,       format: formatInt },
  { key: "SO",       label: "SO",    group: "pitcher", accessor: (p) => p.so,       format: formatInt },
  { key: "ERA",      label: "ERA",   group: "pitcher", accessor: (p) => p.era,      format: formatDecimal(2), lowerIsBetter: true },
  { key: "WHIP",     label: "WHIP",  group: "pitcher", accessor: (p) => p.whip,     format: formatDecimal(2), lowerIsBetter: true },
  { key: "IP",       label: "IP",    group: "pitcher", accessor: (p) => p.ip,       format: formatDecimal(1) },
  { key: "G",        label: "G",     group: "pitcher", accessor: (p) => p.g,        format: formatInt },
  { key: "GS",       label: "GS",    group: "pitcher", accessor: (p) => p.gs,       format: formatInt },
  { key: "WAR",      label: "WAR",   group: "pitcher", accessor: (p) => p.war,      format: formatDecimal(1) },
  { key: "FIP",      label: "FIP",   group: "pitcher", accessor: (p) => p.fip,      format: formatDecimal(2), lowerIsBetter: true },
  // 4 overlapping field names — internal key prefixed to stay unique,
  // user-facing label stays as the simple stat abbreviation.
  { key: "P_H",      label: "H",     group: "pitcher", accessor: (p) => p.h,        format: formatInt, lowerIsBetter: true },
  { key: "P_R",      label: "R",     group: "pitcher", accessor: (p) => p.r,        format: formatInt, lowerIsBetter: true },
  { key: "ER",       label: "ER",    group: "pitcher", accessor: (p) => p.er,       format: formatInt, lowerIsBetter: true },
  { key: "P_HR",     label: "HR",    group: "pitcher", accessor: (p) => p.hr,       format: formatInt, lowerIsBetter: true },
  { key: "P_BB",     label: "BB",    group: "pitcher", accessor: (p) => p.bb,       format: formatInt, lowerIsBetter: true },
  { key: "HBP",      label: "HBP",   group: "pitcher", accessor: (p) => p.hbp,      format: formatInt, lowerIsBetter: true },
  { key: "BF",       label: "BF",    group: "pitcher", accessor: (p) => p.bf,       format: formatInt },
  { key: "ERA_PLUS", label: "ERA+",  group: "pitcher", accessor: (p) => p.era_plus, format: formatInt },
  { key: "H9",       label: "H/9",   group: "pitcher", accessor: (p) => p.h9,       format: formatDecimal(2), lowerIsBetter: true },
  { key: "HR9",      label: "HR/9",  group: "pitcher", accessor: (p) => p.hr9,      format: formatDecimal(2), lowerIsBetter: true },
  { key: "BB9",      label: "BB/9",  group: "pitcher", accessor: (p) => p.bb9,      format: formatDecimal(2), lowerIsBetter: true },
  { key: "SO9",      label: "SO/9",  group: "pitcher", accessor: (p) => p.so9,      format: formatDecimal(2) },
  { key: "SO_BB",    label: "SO/BB", group: "pitcher", accessor: (p) => p.so_bb,    format: formatDecimal(2) },
];

export const BATTER_DEFAULT_KEYS: readonly string[] = ["AVG", "HR", "RBI", "SB", "AB"];
export const PITCHER_DEFAULT_KEYS: readonly string[] = ["ERA", "SO", "W", "SV", "IP"];

export const STAT_COLUMN_COUNT = 5;

const STAT_BY_KEY: Map<string, StatDef> = new Map(STAT_DEFS.map((s) => [s.key, s]));

export function getStatDef(key: string): StatDef | undefined {
  return STAT_BY_KEY.get(key);
}

export function getStatsForGroup(group: StatGroup): readonly StatDef[] {
  return STAT_DEFS.filter((s) => s.group === group);
}

export function getDefaultsForGroup(group: StatGroup): readonly string[] {
  return group === "batter" ? BATTER_DEFAULT_KEYS : PITCHER_DEFAULT_KEYS;
}
