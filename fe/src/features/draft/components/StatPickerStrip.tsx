// Inline 5-slot stat picker. Placed between the draft page's Compare panel and the PlayerListTable.
// The 5 slots are always fixed; empty slots show a dashed placeholder. X turns a slot into null and
// + fills the first empty slot, so other columns never shift left or right.
// Switches between batter / pitcher catalogs automatically based on the position filter (SP/RP → pitcher).
// Changes are persisted immediately via the useStatColumns hook → localStorage.

import { useState } from "react";
import type { StatSlot } from "../useStatColumns";
import {
  STAT_COLUMN_COUNT,
  getStatDef,
  getStatsForGroup,
  type StatGroup,
} from "../statColumns";

const DRAG_MIME = "application/x-ppadun-statkey";

type Props = {
  group: StatGroup;
  cols: StatSlot[];
  onChange: (next: StatSlot[]) => void;
  onReset: () => void;
};

export default function StatPickerStrip({ group, cols, onChange, onReset }: Props) {
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const slots: StatSlot[] = cols.length === STAT_COLUMN_COUNT
    ? cols
    : [...cols, ...Array<StatSlot>(STAT_COLUMN_COUNT - cols.length).fill(null)].slice(0, STAT_COLUMN_COUNT);
  const filledCount = slots.filter((s) => s !== null).length;

  const allInGroup = getStatsForGroup(group);
  const available = allInGroup.filter((s) => !slots.includes(s.key));

  // X click: replace that slot with null (the slot itself stays in place).
  const clearSlot = (slotIdx: number) => {
    const next = [...slots];
    next[slotIdx] = null;
    onChange(next);
  };

  // Fill the first empty slot.
  const addKey = (key: string) => {
    const firstEmpty = slots.findIndex((s) => s === null);
    if (firstEmpty === -1) return;
    const next = [...slots];
    next[firstEmpty] = key;
    onChange(next);
  };

  // Swap between the 5 slots — even empty ↔ empty is harmless, so we just swap.
  const swap = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    if (from >= slots.length || to >= slots.length) return;
    const next = [...slots];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-wider text-white/55">
          {group === "batter" ? "Batter Stats" : "Pitcher Stats"}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-black text-white/55">
            {filledCount} / {STAT_COLUMN_COUNT} selected
          </div>
          <button
            type="button"
            onClick={onReset}
            title={`Reset ${group === "batter" ? "batter" : "pitcher"} stats to defaults`}
            className="rounded-full border border-white/10 bg-black/30 px-2.5 py-0.5 text-xs font-extrabold text-white/70 transition hover:bg-white/10"
          >
            Reset
          </button>
        </div>
      </div>

      {/* 5 fixed slots — empty slots are dashed placeholders; filled slots are chips. Drag to swap. */}
      <div className="mt-2 flex flex-wrap gap-2">
        {slots.map((key, idx) => {
          const def = key ? getStatDef(key) : null;
          const isHover = hoverIdx === idx && draggingIdx !== null && draggingIdx !== idx;
          const isDragging = draggingIdx === idx;

          const dragHandlers = {
            onDragStart: (e: React.DragEvent) => {
              if (key === null) return;
              e.dataTransfer.setData(DRAG_MIME, String(idx));
              e.dataTransfer.effectAllowed = "move";
              setDraggingIdx(idx);
            },
            onDragEnd: () => {
              setDraggingIdx(null);
              setHoverIdx(null);
            },
            onDragOver: (e: React.DragEvent) => {
              if (draggingIdx === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (hoverIdx !== idx) setHoverIdx(idx);
            },
            onDragLeave: () => {
              if (hoverIdx === idx) setHoverIdx(null);
            },
            onDrop: (e: React.DragEvent) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData(DRAG_MIME);
              setHoverIdx(null);
              setDraggingIdx(null);
              if (!raw) return;
              const from = Number(raw);
              if (Number.isFinite(from)) swap(from, idx);
            },
          };

          if (key === null) {
            return (
              <div
                key={`empty-${idx}`}
                {...dragHandlers}
                className={[
                  "flex min-w-16 items-center justify-center rounded-full border-2 border-dashed px-3 py-1 text-xs font-extrabold text-white/35 transition",
                  isHover ? "border-emerald-300 ring-2 ring-emerald-300/40" : "border-white/15",
                ].join(" ")}
                title="Empty slot — pick a stat below"
              >
                Empty
              </div>
            );
          }

          return (
            <div
              key={`${key}-${idx}`}
              draggable
              {...dragHandlers}
              className={[
                "flex cursor-grab items-center gap-1.5 rounded-full border bg-emerald-500/15 px-3 py-1 text-xs font-extrabold text-emerald-100 transition active:cursor-grabbing",
                isHover ? "border-emerald-300 ring-2 ring-emerald-300/50" : "border-emerald-400/40",
                isDragging ? "opacity-40" : "",
              ].join(" ")}
              title="Drag to reorder"
            >
              <span className="select-none text-emerald-200/60" aria-hidden>⋮⋮</span>
              <span>{def?.label ?? key}</span>
              <button
                type="button"
                onClick={() => clearSlot(idx)}
                aria-label={`Remove ${def?.label ?? key}`}
                title="Remove"
                className="ml-0.5 grid h-4 w-4 place-items-center rounded-full text-[10px] font-black text-emerald-100/80 hover:bg-emerald-400/30"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Remaining available stats — click to fill the first empty slot. */}
      {available.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
          {available.map((s) => {
            const noEmpty = filledCount >= STAT_COLUMN_COUNT;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => addKey(s.key)}
                disabled={noEmpty}
                title={noEmpty ? "Remove one stat first" : `Add ${s.label}`}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-extrabold text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/5"
              >
                + {s.label}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
