import { useMemo, useRef, useState } from "react";
import type { DraftPick, DraftPickKind, DraftPlayer, DraftTeam } from "../../../types/draft";
import { MINOR_TAXI_SLOT_COUNT, isEligibleForSlot, teamAccentClass } from "../utils";

type Props = {
  teams: DraftTeam[];
  slotTemplate: string[];                 // 메인 보드 슬롯 (마이너/택시는 컴포넌트가 자체 생성)
  picks: DraftPick[];                     // 모든 kind 통합 — 컴포넌트가 view 로 필터
  playersById: Record<string, DraftPlayer>;
  currentRound: number;
  totalRounds: number;
  authed: boolean;
  myTeamId: string | null;
  view: DraftPickKind;                    // 현재 보고 있는 보드
  onViewChange: (next: DraftPickKind) => void;
  onRemovePick: (pick: DraftPick) => void;
  // 내 팀 안에서 드래그-드롭으로 슬롯 인덱스를 바꿀 때 호출.
  // 마이너/택시는 자격 검사 없이 순수 재정렬.
  onSlotReassign?: (fromIndex: number, toIndex: number, kind: DraftPickKind) => void;
};

// Drag payload: 자기 팀의 어떤 슬롯에서 출발했는지.
const DRAG_MIME = "application/x-ppadun-slot";

// 보드 탭. 항상 3개 모두 노출하고 현재 view 만 강조.
const ALL_TABS: { key: DraftPickKind; label: string }[] = [
  { key: "minor", label: "Minor" },
  { key: "main", label: "Main" },
  { key: "taxi", label: "Taxi" },
];

// 보드별 헤더 텍스트.
const BOARD_HEADER: Record<DraftPickKind, { title: string; subtitle: string }> = {
  main: { title: "Draft Room", subtitle: "Live draft status by team" },
  minor: { title: "Minor Draft", subtitle: "Free picks before main draft" },
  taxi: { title: "Taxi Draft", subtitle: "Free taxi-squad picks" },
};

export default function DraftRoomBoard({
  teams,
  slotTemplate,
  picks,
  playersById,
  currentRound,
  totalRounds,
  authed,
  myTeamId,
  view,
  onViewChange,
  onRemovePick,
  onSlotReassign,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 드래그 진행 중인 출발 슬롯 (내 팀 한정).
  const [draggingFrom, setDraggingFrom] = useState<number | null>(null);
  // 드래그가 hover 중인 슬롯 — 자격 여부에 따라 테두리 색을 다르게 칠한다.
  const [hoverTarget, setHoverTarget] = useState<{ index: number; ok: boolean } | null>(null);

  // 현재 보드에 해당하는 픽만 추려서 팀별로 정렬.
  const picksByTeam = useMemo(() => {
    const map = new Map<string, DraftPick[]>();
    for (const team of teams) map.set(team.id, []);
    for (const pick of picks) {
      if (pick.kind !== view) continue;
      const arr = map.get(pick.draftedByTeamId);
      if (arr) arr.push(pick);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.slotIndex - b.slotIndex);
    }
    return map;
  }, [teams, picks, view]);

  // view 에 따라 슬롯 템플릿 선택. 마이너/택시는 8개 평면 슬롯 (라벨 없음).
  const effectiveSlotTemplate = useMemo(
    () =>
      view === "main"
        ? slotTemplate
        : Array(MINOR_TAXI_SLOT_COUNT).fill("") as string[],
    [view, slotTemplate]
  );

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

  // 출발 슬롯의 player 가 target 슬롯에 자격이 있는지 확인 (메인만 의미 있음).
  // 마이너/택시는 슬롯 자격 자체가 없으니 항상 OK.
  const isHoverEligible = (toIndex: number): boolean => {
    if (draggingFrom === null || !myTeamId) return false;
    if (draggingFrom === toIndex) return true;
    if (view !== "main") return true;

    const fromPick = (picksByTeam.get(myTeamId) ?? []).find(
      (p) => p.slotIndex === draggingFrom
    );
    if (!fromPick) return false;
    const player = playersById[fromPick.playerId];
    if (!player) return false;
    const toSlotPos = effectiveSlotTemplate[toIndex];
    if (!toSlotPos) return false;
    return isEligibleForSlot(player.positions, toSlotPos);
  };

  const header = BOARD_HEADER[view];
  const isMainView = view === "main";

  return (
    <section className="relative mt-10 rounded-3xl border border-white/10 bg-white/5 p-4">
      {/* 상단 중앙에 붙은 탭 — 항상 3개 노출, 활성 탭은 박스와 한 면처럼 이어진다 */}
      <div className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 -translate-y-full">
        {ALL_TABS.map((tab) => {
          const isActive = tab.key === view;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onViewChange(tab.key)}
              className={[
                "rounded-t-xl border border-white/10 px-5 py-1.5 text-xs font-black uppercase tracking-wider transition",
                isActive
                  ? // 활성: 박스 내부와 동일한 불투명 색(#000 위 white/5 합성값)으로 보더를 완전 가림. 안쪽 위 하이라이트로 살짝 입체.
                    "relative z-10 translate-y-px border-b-0 bg-[#0d0d0d] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]"
                  : "border-b-0 bg-white/[0.02] text-white/45 hover:bg-white/[0.05] hover:text-white/75",
              ].join(" ")}
              title={`Switch to ${tab.label} draft`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-white">{header.title}</div>
          <div className="mt-1 text-xs text-white/55">
            {header.subtitle}
            {isMainView
              ? ` | ${totalRounds} roster slots each`
              : ` | ${MINOR_TAXI_SLOT_COUNT} slots each`}
          </div>
        </div>

        {isMainView && (
          <div className="text-sm font-black text-emerald-400">
            Round {currentRound} / {totalRounds}
          </div>
        )}
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
                    {effectiveSlotTemplate.map((slotPos, slotIndex) => {
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
                                onSlotReassign?.(fromIndex, slotIndex, view);
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

                            {/* 마이너/택시는 포지션 라벨 없이 슬롯 번호만 */}
                            {isMainView ? (
                              <div className="text-[9px] font-extrabold uppercase tracking-wide text-white/40">
                                {slotPos}
                              </div>
                            ) : (
                              <div className="text-[9px] font-extrabold uppercase tracking-wide text-white/40">
                                Slot {slotIndex + 1}
                              </div>
                            )}
                            <div className="pr-5 text-[11px] font-black text-white">
                              {slotIndex + 1}. {player.name}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-white/55">
                              <span>{player.team}</span>
                              {isMainView && (
                                <>
                                  <span>|</span>
                                  <span>${pick.bid ?? "?"}</span>
                                </>
                              )}
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
                          {isMainView ? (
                            <div className="text-[9px] font-extrabold uppercase tracking-wide text-white/40">
                              {slotPos}
                            </div>
                          ) : (
                            <div className="text-[9px] font-extrabold uppercase tracking-wide text-white/40">
                              Slot {slotIndex + 1}
                            </div>
                          )}
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
