import { useMemo } from "react";
import type { DraftPick, DraftPlayer, DraftPosition, DraftTeam } from "../../../types/draft";

type Props = {
  teams: DraftTeam[];
  slotTemplate: DraftPosition[];
  picks: DraftPick[];
  playersById: Record<string, DraftPlayer>;
  currentRound: number;
  totalRounds: number;
  authed: boolean;
  onRemovePick: (pick: DraftPick) => void;
};

export default function DraftRoomBoard({
  teams,
  slotTemplate,
  picks,
  playersById,
  currentRound,
  totalRounds,
  authed,
  onRemovePick,
}: Props) {
  const byTeamAndSlot = useMemo(() => {
    return new Map(picks.map((pick) => [`${pick.draftedByTeamId}:${pick.slotIndex}`, pick] as const));
  }, [picks]);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold text-white/60">Draft Room Board</div>
          <div className="mt-1 text-lg font-black text-white">
            Round {currentRound} / {totalRounds}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-auto rounded-2xl border border-white/10">
        <div
          className="min-w-[780px]"
          style={{ display: "grid", gridTemplateColumns: `120px repeat(${teams.length}, minmax(170px, 1fr))` }}
        >
          <div className="border-b border-r border-white/10 bg-black/30 px-3 py-2 text-xs font-black text-white/60">
            Slot
          </div>

          {teams.map((team) => (
            <div
              key={team.id}
              className="border-b border-r border-white/10 bg-black/30 px-3 py-2 text-xs font-black text-white/80 last:border-r-0"
            >
              {team.name}
              {team.isMine && <span className="ml-2 text-emerald-300">(You)</span>}
            </div>
          ))}

          {slotTemplate.map((slotPos, slotIndex) => (
            <Row
              key={`${slotPos}-${slotIndex}`}
              slotPos={slotPos}
              slotIndex={slotIndex}
              teams={teams}
              byTeamAndSlot={byTeamAndSlot}
              playersById={playersById}
              authed={authed}
              onRemovePick={onRemovePick}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

type RowProps = {
  slotPos: DraftPosition;
  slotIndex: number;
  teams: DraftTeam[];
  byTeamAndSlot: Map<string, DraftPick>;
  playersById: Record<string, DraftPlayer>;
  authed: boolean;
  onRemovePick: (pick: DraftPick) => void;
};

function Row({
  slotPos,
  slotIndex,
  teams,
  byTeamAndSlot,
  playersById,
  authed,
  onRemovePick,
}: RowProps) {
  return (
    <>
      <div className="border-b border-r border-white/10 px-3 py-2 text-xs font-extrabold text-white/70">
        {slotPos} #{slotIndex + 1}
      </div>

      {teams.map((team) => {
        const pick = byTeamAndSlot.get(`${team.id}:${slotIndex}`);
        const player = pick ? playersById[pick.playerId] : null;

        if (!pick || !player) {
          return (
            <div
              key={`${team.id}:${slotIndex}:empty`}
              className="border-b border-r border-white/10 px-3 py-2 text-xs text-white/30 last:border-r-0"
            >
              —
            </div>
          );
        }

        return (
          <div
            key={`${team.id}:${slotIndex}:filled`}
            className="border-b border-r border-white/10 px-3 py-2 text-xs text-white/85 last:border-r-0"
          >
            <div className="font-bold text-white">{player.name}</div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-white/60">
              <span>{pick.slotPos}</span>
              <span>{pick.bid === null ? "—" : `$${pick.bid}`}</span>
            </div>
            {team.isMine && authed && (
              <button
                type="button"
                onClick={() => onRemovePick(pick)}
                className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-[11px] font-black text-rose-200 hover:bg-rose-500/20"
              >
                Remove
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
