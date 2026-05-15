// Stat-column registry for the draft page player list.
//
// Each stat has a key (used as the localStorage value and lookup id),
// a display label, a group (batter / pitcher), an accessor that reads
// the value from a player object, and a formatter that renders it.
//
// As the backend grows to expose more stat columns, append to STAT_DEFS;
// no other code in this directory needs to change.

import type { DraftPlayerPublic } from "../../types/draft";
import { formatAvg } from "./utils";

export type StatGroup = "batter" | "pitcher";

export type StatDef = {
  key: string;
  label: string;
  group: StatGroup;
  accessor: (p: DraftPlayerPublic) => number | null | undefined;
  format: (v: number | null | undefined) => string;
};

const formatInt = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : String(v);

const formatDecimal = (digits: number) => (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : v.toFixed(digits);

export const STAT_DEFS: readonly StatDef[] = [
  // Batter — keys currently exposed by the backend
  { key: "AVG", label: "AVG", group: "batter", accessor: (p) => p.avg, format: (v) => (v == null ? "—" : formatAvg(v)) },
  { key: "HR",  label: "HR",  group: "batter", accessor: (p) => p.hr,  format: formatInt },
  { key: "RBI", label: "RBI", group: "batter", accessor: (p) => p.rbi, format: formatInt },
  { key: "SB",  label: "SB",  group: "batter", accessor: (p) => p.sb,  format: formatInt },
  { key: "AB",  label: "AB",  group: "batter", accessor: (p) => p.ab,  format: formatInt },

  // Pitcher — keys currently exposed by the backend
  { key: "ERA",  label: "ERA",  group: "pitcher", accessor: (p) => p.era,  format: formatDecimal(2) },
  { key: "SO",   label: "SO",   group: "pitcher", accessor: (p) => p.so,   format: formatInt },
  { key: "W",    label: "W",    group: "pitcher", accessor: (p) => p.w,    format: formatInt },
  { key: "SV",   label: "SV",   group: "pitcher", accessor: (p) => p.sv,   format: formatInt },
  { key: "IP",   label: "IP",   group: "pitcher", accessor: (p) => p.ip,   format: formatDecimal(1) },
  { key: "WHIP", label: "WHIP", group: "pitcher", accessor: (p) => p.whip, format: formatDecimal(2) },
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
