import { useMemo, useRef } from "react";
import type { DraftPick, DraftPlayer, DraftTeam } from "../../../types/draft";
import { teamAccentClass } from "../utils";

type Props = {
  teams: DraftTeam[];
  slotTemplate: string[];
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
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const picksByTeam = useMemo(() => {
    const map = new Map<string, DraftPick[]>();
    for (const team of teams) map.set(team.id, []);
    for (const pick of picks) {
      const arr = map.get(pick.draftedByTeamId);
      if (arr) arr.push(pick);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.slotIndex - b.slotIndex);
    }
    return map;
  }, [teams, picks]);

  const canScroll = teams.length > 7;

  const scrollByAmount = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir === "left" ? -1400 : 1400,
      behavior: "smooth",
    });
  };

  if (!authed) return null;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-white">Draft Room</div>
          <div className="mt-1 text-xs text-white/55">
            Live draft status by team | {totalRounds} roster slots each
          </div>
        </div>

        <div className="text-sm font-black text-emerald-400">
          Round {currentRound} / {totalRounds}
        </div>
      </div>

      <div className="relative">
        {canScroll && (
          <>
            <button
              onClick={() => scrollByAmount("left")}
              className="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-black/70 p-2 text-white/80 backdrop-blur hover:bg-white/10"
              aria-label="Scroll left"
            >
              &lt;
            </button>

            <button
              onClick={() => scrollByAmount("right")}
              className="absolute right-0 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-black/70 p-2 text-white/80 backdrop-blur hover:bg-white/10"
              aria-label="Scroll right"
            >
              &gt;
            </button>
          </>
        )}

        <div
          ref={scrollRef}
          className="scroll-smooth overflow-x-auto pb-2"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="flex min-w-max gap-3 pr-10">
            {teams.map((team, idx) => {
              const accent = teamAccentClass(team, idx);
              const teamPicks = picksByTeam.get(team.id) ?? [];

              return (
                <div
                  key={team.id}
                  className="w-[185px] shrink-0 rounded-2xl border border-white/10 bg-black/25 p-2"
                >
                  <div
                    className={[
                      "mb-2 rounded-xl border px-3 py-2 text-xs font-black",
                      accent.header,
                    ].join(" ")}
                  >
                    {team.isMine ? `My | ${team.name}` : team.name}
                  </div>

                  <div className="space-y-2">
                    {slotTemplate.map((slotPos, slotIndex) => {
                      const pick = teamPicks.find((p) => p.slotIndex === slotIndex);
                      const player = pick ? playersById[pick.playerId] : null;

                      if (pick && player) {
                        return (
                          <div
                            key={`${team.id}-${slotIndex}`}
                            className={[
                              "relative rounded-xl border px-3 py-2 text-left",
                              pick.type === "mine"
                                ? "border-sky-400/30 bg-sky-500/10"
                                : "border-rose-400/25 bg-rose-500/8",
                            ].join(" ")}
                          >
                            <button
                              onClick={() => onRemovePick(pick)}
                              className="absolute right-2 top-2 text-[10px] text-white/55 hover:text-white"
                              aria-label="Remove pick"
                              title="Remove pick"
                            >
                              x
                            </button>

                            <div className="pr-5 text-[11px] font-black text-white">
                              {slotIndex + 1}. {player.name}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-white/55">
                              <span>{slotPos}</span>
                              <span>|</span>
                              <span>{player.team}</span>
                              <span>|</span>
                              <span>${pick.bid ?? "?"}</span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`${team.id}-${slotIndex}`}
                          className="rounded-xl border border-dashed border-white/10 bg-black/15 px-3 py-2 text-[11px] text-white/25"
                        >
                          {slotPos}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
