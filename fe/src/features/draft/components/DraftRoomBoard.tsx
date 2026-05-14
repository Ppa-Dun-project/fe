import { useMemo, useRef, useState } from "react";
import type { DraftPick, DraftPlayer, DraftTeam } from "../../../types/draft";
import { isEligibleForSlot, teamAccentClass } from "../utils";

type Props = {
  teams: DraftTeam[];
  slotTemplate: string[];
  picks: DraftPick[];
  playersById: Record<string, DraftPlayer>;
  currentRound: number;
  totalRounds: number;
  authed: boolean;
  myTeamId: string | null;
  onRemovePick: (pick: DraftPick) => void;
  // 내 팀 안에서 드래그-드롭으로 슬롯 인덱스를 바꿀 때 호출.
  onSlotReassign?: (fromIndex: number, toIndex: number) => void;
};

// Drag payload: 자기 팀의 어떤 슬롯에서 출발했는지.
const DRAG_MIME = "application/x-ppadun-slot";

export default function DraftRoomBoard({
  teams,
  slotTemplate,
  picks,
  playersById,
  currentRound,
  totalRounds,
  authed,
  myTeamId,
  onRemovePick,
  onSlotReassign,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 드래그 진행 중인 출발 슬롯 (내 팀 한정).
  const [draggingFrom, setDraggingFrom] = useState<number | null>(null);
  // 드래그가 hover 중인 슬롯 — 자격 여부에 따라 테두리 색을 다르게 칠한다.
  const [hoverTarget, setHoverTarget] = useState<{ index: number; ok: boolean } | null>(null);

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

  // 출발 슬롯의 player 가 target 슬롯에 자격이 있는지 확인 (드래그 hover 시각화 용).
  const isHoverEligible = (toIndex: number): boolean => {
    if (draggingFrom === null || !myTeamId) return false;
    if (draggingFrom === toIndex) return true;
    const fromPick = (picksByTeam.get(myTeamId) ?? []).find(
      (p) => p.slotIndex === draggingFrom
    );
    if (!fromPick) return false;
    const player = playersById[fromPick.playerId];
    if (!player) return false;
    const toSlotPos = slotTemplate[toIndex];
    if (!toSlotPos) return false;
    return isEligibleForSlot(player.positions, toSlotPos);
  };

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
              const isMyTeam = team.id === myTeamId;

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
                    {team.name}
                  </div>

                  <div className="space-y-2">
                    {slotTemplate.map((slotPos, slotIndex) => {
                      const pick = teamPicks.find((p) => p.slotIndex === slotIndex);
                      const player = pick ? playersById[pick.playerId] : null;

                      // 자기 팀 슬롯만 DnD 활성.
                      const hovered = hoverTarget?.index === slotIndex;
                      const hoverOk = hovered && hoverTarget?.ok === true;
                      const hoverBad = hovered && hoverTarget?.ok === false;
                      const hoverRingClass = hoverOk
                        ? "ring-2 ring-emerald-400/60"
                        : hoverBad
                        ? "ring-2 ring-rose-400/60"
                        : "";

                      const dndProps = isMyTeam
                        ? {
                            onDragOver: (e: React.DragEvent) => {
                              if (draggingFrom === null) return;
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                              const ok = isHoverEligible(slotIndex);
                              if (hoverTarget?.index !== slotIndex || hoverTarget?.ok !== ok) {
                                setHoverTarget({ index: slotIndex, ok });
                              }
                            },
                            onDragLeave: () => {
                              if (hoverTarget?.index === slotIndex) {
                                setHoverTarget(null);
                              }
                            },
                            onDrop: (e: React.DragEvent) => {
                              e.preventDefault();
                              const raw = e.dataTransfer.getData(DRAG_MIME);
                              setHoverTarget(null);
                              setDraggingFrom(null);
                              if (!raw) return;
                              const fromIndex = Number(raw);
                              if (Number.isFinite(fromIndex)) {
                                onSlotReassign?.(fromIndex, slotIndex);
                              }
                            },
                          }
                        : {};

                      if (pick && player) {
                        return (
                          <div
                            key={`${team.id}-${slotIndex}`}
                            draggable={isMyTeam}
                            onDragStart={
                              isMyTeam
                                ? (e: React.DragEvent) => {
                                    e.dataTransfer.setData(DRAG_MIME, String(slotIndex));
                                    e.dataTransfer.effectAllowed = "move";
                                    setDraggingFrom(slotIndex);
                                  }
                                : undefined
                            }
                            onDragEnd={
                              isMyTeam
                                ? () => {
                                    setDraggingFrom(null);
                                    setHoverTarget(null);
                                  }
                                : undefined
                            }
                            {...dndProps}
                            className={[
                              "relative rounded-xl border px-3 py-2 text-left transition",
                              pick.type === "mine"
                                ? "border-sky-400/30 bg-sky-500/10"
                                : "border-rose-400/25 bg-rose-500/8",
                              isMyTeam ? "cursor-grab active:cursor-grabbing" : "",
                              hoverRingClass,
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

                            <div className="text-[9px] font-extrabold uppercase tracking-wide text-white/40">
                              {slotPos}
                            </div>
                            <div className="pr-5 text-[11px] font-black text-white">
                              {slotIndex + 1}. {player.name}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-white/55">
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
                          {...dndProps}
                          className={[
                            "rounded-xl border border-dashed border-white/10 bg-black/15 px-3 py-2 text-[11px] text-white/25 transition",
                            hoverRingClass,
                          ].join(" ")}
                        >
                          <div className="text-[9px] font-extrabold uppercase tracking-wide text-white/40">
                            {slotPos}
                          </div>
                          <div className="mt-0.5 text-white/30">Empty</div>
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
