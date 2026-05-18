import { useMemo, useRef, useState } from "react";
import type { DraftPick, DraftPickKind, DraftPlayer, DraftTeam } from "../../../types/draft";
import { MINOR_TAXI_SLOT_COUNT, isEligibleForSlot, teamAccentClass } from "../utils";

type Props = {
  teams: DraftTeam[];
  slotTemplate: string[];                 // Main board slots (minor/taxi slots are generated internally by the component)
  picks: DraftPick[];                     // All kinds combined — the component filters by view
  playersById: Record<string, DraftPlayer>;
  currentRound: number;
  totalRounds: number;
  authed: boolean;
  view: DraftPickKind;                    // The board currently being viewed
  onViewChange: (next: DraftPickKind) => void;
  onRemovePick: (pick: DraftPick) => void;
  // Called when slots/teams are swapped via drag-and-drop.
  //  - fromTeamId === toTeamId: reorder within the same team (main allows swap, minor/taxi is a pure reorder)
  //  - Otherwise: cross-team move. Main board checks eligibility + empty slot; minor/taxi just requires an empty slot.
  onSlotReassign?: (
    fromTeamId: string,
    fromIndex: number,
    toTeamId: string,
    toIndex: number,
    kind: DraftPickKind,
  ) => void;
  // Callback to open the Ordered Draft History modal. Only shown on the main board.
  onOpenHistory?: () => void;
};

// Drag payload: { teamId, slotIndex } JSON. Drops are only allowed when teamId matches.
const DRAG_MIME = "application/x-ppadun-slot";

// Board tabs. All three are always shown; only the current view is highlighted.
const ALL_TABS: { key: DraftPickKind; label: string }[] = [
  { key: "minor", label: "Minor" },
  { key: "main", label: "Main" },
  { key: "taxi", label: "Taxi" },
];

// Header text per board.
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
  view,
  onViewChange,
  onRemovePick,
  onSlotReassign,
  onOpenHistory,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // The source slot of the active drag — we also track teamId since reordering is scoped to a team.
  const [draggingFrom, setDraggingFrom] = useState<{ teamId: string; index: number } | null>(null);
  // The slot currently hovered during a drag — the border color depends on whether the drop is eligible.
  const [hoverTarget, setHoverTarget] = useState<{
    teamId: string;
    index: number;
    ok: boolean;
  } | null>(null);

  // Filter picks to the current board and group them by team.
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

  // Pick the slot template based on view. Minor/taxi are 8 flat slots with no labels.
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

  // Check whether the source slot's player is eligible for the target slot.
  //  - Same team: main checks eligibility (occupied slots can also swap, so OK is shown); minor/taxi is always OK.
  //  - Different team: must be an empty slot + eligible (main) or just an empty slot (minor/taxi).
  const isHoverEligible = (toTeamId: string, toIndex: number): boolean => {
    if (draggingFrom === null) return false;
    if (draggingFrom.teamId === toTeamId && draggingFrom.index === toIndex) return true;

    const fromPick = (picksByTeam.get(draggingFrom.teamId) ?? []).find(
      (p) => p.slotIndex === draggingFrom.index
    );
    if (!fromPick) return false;
    const player = playersById[fromPick.playerId];
    if (!player) return false;

    const isCrossTeam = draggingFrom.teamId !== toTeamId;
    if (isCrossTeam) {
      const targetOccupied = (picksByTeam.get(toTeamId) ?? []).some(
        (p) => p.slotIndex === toIndex
      );
      if (targetOccupied) return false;
    }

    if (view !== "main") return true;
    const toSlotPos = effectiveSlotTemplate[toIndex];
    if (!toSlotPos) return false;
    return isEligibleForSlot(player.positions, toSlotPos);
  };

  const header = BOARD_HEADER[view];
  const isMainView = view === "main";

  return (
    <section className="relative mt-10 rounded-3xl border border-white/10 bg-white/5 p-4">
      {/* Tabs pinned to the top center — all 3 are always visible; the active tab visually merges with the box */}
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
                  ? // Active: use the same opaque color as the box interior (#000 composited with white/5) to fully hide the border. A subtle top inset highlight adds a 3D feel.
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
          <div className="flex items-center gap-3">
            {onOpenHistory && (
              <button
                type="button"
                onClick={onOpenHistory}
                className="rounded-xl border border-white/15 bg-black/25 px-3 py-1.5 text-xs font-black text-white/80 transition hover:bg-white/10"
                title="View ordered draft history"
              >
                History
              </button>
            )}
            <div className="text-sm font-black text-emerald-400">
              Round {currentRound} / {totalRounds}
            </div>
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

                      // DnD is active for every team. However, drops are only allowed when source and target teams match.
                      const hovered =
                        hoverTarget?.teamId === team.id && hoverTarget?.index === slotIndex;
                      const hoverOk = hovered && hoverTarget?.ok === true;
                      const hoverBad = hovered && hoverTarget?.ok === false;
                      const hoverRingClass = hoverOk
                        ? "ring-2 ring-emerald-400/60"
                        : hoverBad
                        ? "ring-2 ring-rose-400/60"
                        : "";

                      const dndProps = {
                        onDragOver: (e: React.DragEvent) => {
                          if (draggingFrom === null) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          const ok = isHoverEligible(team.id, slotIndex);
                          if (
                            hoverTarget?.teamId !== team.id ||
                            hoverTarget?.index !== slotIndex ||
                            hoverTarget?.ok !== ok
                          ) {
                            setHoverTarget({ teamId: team.id, index: slotIndex, ok });
                          }
                        },
                        onDragLeave: () => {
                          if (
                            hoverTarget?.teamId === team.id &&
                            hoverTarget?.index === slotIndex
                          ) {
                            setHoverTarget(null);
                          }
                        },
                        onDrop: (e: React.DragEvent) => {
                          e.preventDefault();
                          const raw = e.dataTransfer.getData(DRAG_MIME);
                          setHoverTarget(null);
                          setDraggingFrom(null);
                          if (!raw) return;
                          try {
                            const parsed = JSON.parse(raw) as {
                              teamId?: unknown;
                              slotIndex?: unknown;
                            };
                            if (typeof parsed.teamId !== "string") return;
                            if (typeof parsed.slotIndex !== "number") return;
                            if (!Number.isFinite(parsed.slotIndex)) return;
                            onSlotReassign?.(
                              parsed.teamId,
                              parsed.slotIndex,
                              team.id,
                              slotIndex,
                              view,
                            );
                          } catch {
                            // ignore malformed payload
                          }
                        },
                      };

                      if (pick && player) {
                        return (
                          <div
                            key={`${team.id}-${slotIndex}`}
                            draggable
                            onDragStart={(e: React.DragEvent) => {
                              e.dataTransfer.setData(
                                DRAG_MIME,
                                JSON.stringify({ teamId: team.id, slotIndex }),
                              );
                              e.dataTransfer.effectAllowed = "move";
                              setDraggingFrom({ teamId: team.id, index: slotIndex });
                            }}
                            onDragEnd={() => {
                              setDraggingFrom(null);
                              setHoverTarget(null);
                            }}
                            {...dndProps}
                            className={[
                              // Pick card colors follow the owning team's accent — my team (sky) / each opponent's unique color.
                              "relative rounded-xl border px-3 py-2 text-left transition",
                              accent.slot,
                              "cursor-grab active:cursor-grabbing",
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

                            {/* Minor/taxi show only the slot number without a position label */}
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
                              {player.name}
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
