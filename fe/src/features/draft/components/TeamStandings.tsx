// Team Standings — a sortable tabular comparison of all fantasy teams in the
// current draft session.
//
// Columns:
//   Rank       — order under the current sort (auto-updates when sort changes)
//   Team       — team name (my team is highlighted)
//   Spent      — Σ bid on main-board picks
//   Remaining  — budget − Spent
//   Players    — n / rosterPlayers (main-board picks only)
//   Roster Value (Σ PPA-Dun)  — Σ ppaValue across that team's main-board picks
//   $/PPA      — Spent / Roster Value (cost efficiency; "—" when either side is 0)
//
// Minor / taxi picks are excluded because they are free and do not consume the
// roster slot count tracked here.
//
// Default sort is Roster Value desc — i.e. the "rank" column reflects total
// PPA-Dun value. Clicking any column header re-sorts; clicking the same column
// twice flips direction.
import { useMemo, useState } from "react";

import type { DraftPick, DraftPlayerValue, DraftTeam } from "../../../types/draft";

type SortKey =
  | "team"
  | "spent"
  | "remaining"
  | "players"
  | "rosterValue"
  | "costPerPpa";

type SortDir = "asc" | "desc";

type Props = {
  teams: DraftTeam[];
  picks: DraftPick[];
  playerValues: DraftPlayerValue[] | null;
  budget: number;
  rosterPlayers: number;
};

type Row = {
  teamId: string;
  teamName: string;
  isMine: boolean;
  spent: number;
  remaining: number;
  playersCount: number;
  rosterValue: number;
  costPerPpa: number | null;  // null when undefined (spent=0 or value=0)
};

const formatMoney = (v: number) => `$${v.toFixed(0)}`;
const formatPpa = (v: number) => v.toFixed(1);
const formatCostPerPpa = (v: number | null) => (v === null ? "—" : v.toFixed(2));

export default function TeamStandings({
  teams,
  picks,
  playerValues,
  budget,
  rosterPlayers,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("rosterValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const valueByPlayerId = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of playerValues ?? []) {
      if (typeof v.ppaValue === "number") m.set(v.playerId, v.ppaValue);
    }
    return m;
  }, [playerValues]);

  const rows: Row[] = useMemo(() => {
    return teams.map((team) => {
      // Only main-board picks count toward Spent / Players / Roster Value.
      // Minor / taxi picks are free and live on separate boards.
      const mainPicks = picks.filter(
        (p) => p.draftedByTeamId === team.id && p.kind === "main"
      );
      const spent = mainPicks.reduce((acc, p) => acc + (p.bid ?? 0), 0);
      const remaining = Math.max(0, budget - spent);
      const playersCount = mainPicks.length;
      const rosterValue = mainPicks.reduce(
        (acc, p) => acc + (valueByPlayerId.get(p.playerId) ?? 0),
        0
      );
      const costPerPpa = spent > 0 && rosterValue > 0 ? spent / rosterValue : null;
      return {
        teamId: team.id,
        teamName: team.name,
        isMine: Boolean(team.isMine),
        spent,
        remaining,
        playersCount,
        rosterValue,
        costPerPpa,
      };
    });
  }, [teams, picks, valueByPlayerId, budget]);

  const sortedRows: Row[] = useMemo(() => {
    const sign = sortDir === "asc" ? 1 : -1;
    const sortValue = (r: Row): number | string => {
      switch (sortKey) {
        case "team": return r.teamName.toLowerCase();
        case "spent": return r.spent;
        case "remaining": return r.remaining;
        case "players": return r.playersCount;
        case "rosterValue": return r.rosterValue;
        case "costPerPpa": return r.costPerPpa ?? Number.POSITIVE_INFINITY; // "—" lands last on asc, first on desc
      }
    };
    return [...rows].sort((a, b) => {
      const av = sortValue(a);
      const bv = sortValue(b);
      if (typeof av === "string" || typeof bv === "string") {
        return sign * String(av).localeCompare(String(bv));
      }
      return sign * (av - bv);
    });
  }, [rows, sortKey, sortDir]);

  const handleSortClick = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      // First click on a new column defaults to desc — usually you want the
      // "best" team at the top for monetary / value columns.
      setSortDir(key === "team" ? "asc" : "desc");
    }
  };

  const sortIndicator = (key: SortKey): string =>
    key === sortKey ? (sortDir === "desc" ? " ▼" : " ▲") : "";

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition hover:bg-white/5"
      >
        <div>
          <h2 className="text-lg font-bold text-white">Team Standings</h2>
          <p className="mt-0.5 text-xs text-white/50">
            Ranked by total <span className="font-semibold text-white/70">PPA-Dun Value</span>
            {" "}across each team's main-board picks · click any column to re-sort
          </p>
        </div>
        <span className="text-xs font-semibold text-white/50">
          {collapsed ? "Expand ▾" : "Collapse ▴"}
        </span>
      </button>

      {!collapsed && (
        <div className="border-t border-white/10 px-6 pb-6 pt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-xs uppercase tracking-wide text-white/50">
              <tr>
                <th className="px-2 py-2 text-left font-semibold">Rank</th>
                <SortableTh label="Team" sortKey="team" current={sortKey} onClick={handleSortClick} indicator={sortIndicator} align="left" />
                <SortableTh label="Spent" sortKey="spent" current={sortKey} onClick={handleSortClick} indicator={sortIndicator} />
                <SortableTh label="Remaining" sortKey="remaining" current={sortKey} onClick={handleSortClick} indicator={sortIndicator} />
                <SortableTh label="Players" sortKey="players" current={sortKey} onClick={handleSortClick} indicator={sortIndicator} />
                <SortableTh label="Roster Value (Σ PPA)" sortKey="rosterValue" current={sortKey} onClick={handleSortClick} indicator={sortIndicator} />
                <SortableTh label="$/PPA" sortKey="costPerPpa" current={sortKey} onClick={handleSortClick} indicator={sortIndicator} />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r, idx) => (
                <tr
                  key={r.teamId}
                  className={[
                    "border-t border-white/5",
                    r.isMine ? "bg-amber-500/10" : "hover:bg-white/5",
                  ].join(" ")}
                >
                  <td className="px-2 py-2 font-bold text-white/80">
                    {r.isMine ? "►" : " "} {idx + 1}
                  </td>
                  <td className="px-2 py-2 font-semibold text-white">
                    {r.teamName}{r.isMine && <span className="ml-2 text-xs font-medium text-amber-300">(Me)</span>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-white/90">{formatMoney(r.spent)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-white/90">{formatMoney(r.remaining)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-white/80">{r.playersCount}/{rosterPlayers}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold text-white">{formatPpa(r.rosterValue)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-white/70">{formatCostPerPpa(r.costPerPpa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type SortableThProps = {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  onClick: (key: SortKey) => void;
  indicator: (key: SortKey) => string;
  align?: "left" | "right";
};

function SortableTh({ label, sortKey, current, onClick, indicator, align = "right" }: SortableThProps) {
  return (
    <th
      onClick={() => onClick(sortKey)}
      className={[
        "cursor-pointer select-none px-2 py-2 font-semibold transition hover:text-white",
        align === "right" ? "text-right" : "text-left",
        sortKey === current ? "text-white" : "",
      ].join(" ")}
    >
      {label}{indicator(sortKey)}
    </th>
  );
}
