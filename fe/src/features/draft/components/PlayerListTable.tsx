// Player list table — the main grid showing every available player with
// stats, PPA value, Add / Taken buttons, and the compare toggle.
//
// Pure presentation: state and handlers live in DraftPage. Pagination is
// included so the parent only needs to pass page / totalPages / setPage.

import FadeIn from "../../../components/ui/FadeIn";
import Skeleton from "../../../components/ui/Skeleton";
import Pagination from "../../../features/players/components/Pagination";
import { formatPpa, ppaValueClass } from "../../../utils/playerValue";
import type {
  DraftPick,
  DraftPlayer,
  DraftPlayerPublic,
  DraftTeam,
} from "../../../types/draft";
import {
  getPlayerDraftStatus,
  mlbTeamBadgeClass,
  teamAccentClass,
} from "../utils";
import { isPitcherOnly } from "../draftHelpers";
import { getStatDef } from "../statColumns";

type Props = {
  players: DraftPlayer[];
  picks: DraftPick[];
  teams: DraftTeam[];
  page: number;
  pageSize: number;
  totalPages: number;
  onChangePage: (next: number) => void;
  // Fixed length of 5. null slots render as empty cells / empty headers to prevent horizontal shift.
  statColumnLabels: (string | null)[];
  batterCols: (string | null)[];
  pitcherCols: (string | null)[];
  loading: boolean;
  error: string | null;
  authed: boolean;
  hasDraftConfig: boolean;
  notes: Record<string, string>;
  compareAId: string | null;
  compareBId: string | null;
  onAddPick: (player: DraftPlayerPublic) => void;
  onTakenPick: (player: DraftPlayerPublic) => void;
  onOpenNote: (player: DraftPlayerPublic) => void;
  onOpenPlayerInfo: (id: string, type: DraftPlayerPublic["playerType"]) => void;
  onToggleCompare: (id: string) => void;
};

export default function PlayerListTable({
  players,
  picks,
  teams,
  page,
  pageSize,
  totalPages,
  onChangePage,
  statColumnLabels,
  batterCols,
  pitcherCols,
  loading,
  error,
  authed,
  hasDraftConfig,
  notes,
  compareAId,
  compareBId,
  onAddPick,
  onTakenPick,
  onOpenNote,
  onOpenPlayerInfo,
  onToggleCompare,
}: Props) {
  return (
    <FadeIn delayMs={140}>
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <div className="grid grid-cols-[.4fr_1.8fr_.6fr_.8fr_.8fr_.8fr_.8fr_.8fr_.8fr_1.3fr_1.1fr_.9fr] bg-black/40 px-4 py-3 text-xs font-extrabold text-white/60">
          <div className="text-center">#</div>
          <div>Player</div>
          <div className="text-center">Pos</div>
          <div className="text-center">Team</div>
          <div className="text-center">{statColumnLabels[0] ?? ""}</div>
          <div className="text-center">{statColumnLabels[1] ?? ""}</div>
          <div className="text-center">{statColumnLabels[2] ?? ""}</div>
          <div className="text-center">{statColumnLabels[3] ?? ""}</div>
          <div className="text-center">{statColumnLabels[4] ?? ""}</div>
          <div className="text-center">PPA-Value</div>
          <div className="text-center">Action</div>
          <div className="text-center">Compare</div>
        </div>

        <div className="bg-black/20">
          {loading && (
            <div className="p-4">
              <Skeleton className="h-24" />
            </div>
          )}

          {!loading && error && (
            <div className="p-4 text-sm text-red-200">Failed to load players: {error}</div>
          )}

          {!loading && !error && players.length === 0 && (
            <div className="p-4 text-sm text-white/70">No results. Try another search or filter.</div>
          )}

          {!loading &&
            !error &&
            players.map((player, idx) => {
              const status = getPlayerDraftStatus(player.id, picks, teams);
              // If picked, use that team's accent color — badge color stays consistent per team.
              const pickedByTeamIdx =
                status.kind !== "available"
                  ? teams.findIndex((t) => t.id === status.teamId)
                  : -1;
              const pickedAccent =
                pickedByTeamIdx >= 0
                  ? teamAccentClass(teams[pickedByTeamIdx], pickedByTeamIdx)
                  : null;
              const compareAActive = compareAId === player.id;
              const compareBActive = compareBId === player.id;
              const compareRole = compareAActive ? "A" : compareBActive ? "B" : null;
              const compareActive = Boolean(compareRole);

              return (
                <div
                  key={player.id}
                  className={[
                    "grid grid-cols-[.4fr_1.8fr_.6fr_.8fr_.8fr_.8fr_.8fr_.8fr_.8fr_1.3fr_1.1fr_.9fr] items-center px-4 py-3 text-sm text-white/85 transition tabular-nums",
                    compareActive
                      ? "relative z-[1] my-1 rounded-xl border border-emerald-400/75 bg-emerald-500/10 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
                      : "hover:bg-white/5",
                  ].join(" ")}
                >
                  <div className="text-center text-white/45">{(page - 1) * pageSize + idx + 1}</div>

                  <div className="min-w-0 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenPlayerInfo(player.id, player.playerType)}
                      className="block w-full truncate rounded-md border border-transparent px-2 py-1 -mx-2 -my-1 text-left font-semibold text-white transition hover:border-white/35 hover:bg-white/5 hover:text-amber-200 focus-visible:border-white/45 focus-visible:bg-white/10 focus-visible:outline-none"
                      title={player.name}
                    >
                      {player.name}
                    </button>
                    <button
                      type="button"
                      disabled={!authed}
                      onClick={() => onOpenNote(player)}
                      aria-label={notes[player.id] ? "Edit note" : "Add note"}
                      title={
                        !authed
                          ? "Sign in required"
                          : notes[player.id]
                          ? "Edit note"
                          : "Add note"
                      }
                      className={[
                        "grid h-7 w-7 place-items-center rounded-md border transition",
                        notes[player.id]
                          ? "border-amber-400/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                          : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80",
                        !authed && "cursor-not-allowed opacity-40 hover:bg-white/5",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                        <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
                        <path d="M9 9h1" />
                        <path d="M9 13h6" />
                        <path d="M9 17h6" />
                      </svg>
                    </button>
                  </div>

                  <div className="text-center">
                    <span className="inline-block rounded-lg bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/80">
                      {player.positions[0]}
                    </span>
                  </div>

                  <div className="text-center">
                    <span
                      className={[
                        "inline-flex items-center rounded-lg border px-2 py-1 text-[11px] font-extrabold",
                        mlbTeamBadgeClass(player.team),
                      ].join(" ")}
                    >
                      {player.team}
                    </span>
                  </div>

                  {(isPitcherOnly(player) ? pitcherCols : batterCols).map((key, colIdx) => {
                    const def = key ? getStatDef(key) : null;
                    const value = def ? def.accessor(player) : null;
                    const display = key === null ? "" : def ? def.format(value) : "—";
                    // Even columns get a faint white; odd columns are highlighted amber — guides the eye.
                    const cellClass =
                      colIdx % 2 === 0
                        ? "text-center text-white/70"
                        : "text-center font-semibold text-amber-300";
                    return (
                      <div key={`stat-${colIdx}`} className={cellClass}>
                        {display}
                      </div>
                    );
                  })}

                  <div className={`text-center font-black ${ppaValueClass(player.ppaValue, { authed })}`}>
                    {formatPpa(player.ppaValue)}
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    {status.kind !== "available" ? (
                      <div className={`rounded-xl border px-3 py-2 text-xs font-black ${pickedAccent?.header ?? ""}`}>
                        {status.label}
                      </div>
                    ) : !authed ? (
                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/40 blur-[1px]">
                        Sign in required
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={!hasDraftConfig}
                          onClick={() => onAddPick(player)}
                          title={hasDraftConfig ? "Add to my team" : "Start a draft to make picks"}
                          className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-200 ring-1 ring-emerald-400/20 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-500/15"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          disabled={!hasDraftConfig}
                          onClick={() => onTakenPick(player)}
                          title={hasDraftConfig ? "Mark as drafted by another team" : "Start a draft to make picks"}
                          className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-black text-rose-200 ring-1 ring-rose-400/20 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-rose-500/15"
                        >
                          Taken
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      disabled={!authed}
                      onClick={() => onToggleCompare(player.id)}
                      className={[
                        "relative h-6 w-14 rounded-full border transition",
                        compareActive
                          ? "border-emerald-300/70 bg-emerald-500/70 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                          : "border-white/10 bg-white/5 hover:bg-white/10",
                        !authed ? "opacity-40" : "",
                      ].join(" ")}
                      title={!authed ? "Sign in required" : compareRole ? `Selected ${compareRole}` : "Select for compare"}
                    >
                      <span
                        className={[
                          "absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform duration-200",
                          compareActive ? "translate-x-8" : "translate-x-0",
                        ].join(" ")}
                      />
                      {compareRole && (
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-950">
                          {compareRole}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
        </div>

        <div className="border-t border-white/10 px-4 py-3 text-xs text-white/45">
          Players and draft picks are loaded from backend APIs.
        </div>
      </section>

      <Pagination page={page} totalPages={totalPages} onChange={onChangePage} />
    </FadeIn>
  );
}
