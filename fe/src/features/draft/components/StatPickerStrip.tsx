// Inline 스탯 5칸 선택기. 드래프트 페이지의 Compare 패널과 PlayerListTable 사이 배치.
// 항상 5칸이 고정되어 있고, 빈 칸은 점선 placeholder. X 는 자리를 null 로 만들고
// + 는 첫 빈 자리를 채우므로 다른 컬럼이 좌우로 밀려나지 않는다.
// 포지션 필터에 따라 batter / pitcher 카탈로그 자동 전환 (SP/RP → pitcher).
// 변경은 즉시 useStatColumns 훅 → localStorage 로 반영된다.

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

  // X 클릭: 해당 슬롯을 null 로 바꿈 (자리는 유지).
  const clearSlot = (slotIdx: number) => {
    const next = [...slots];
    next[slotIdx] = null;
    onChange(next);
  };

  // 첫 빈 슬롯에 채워 넣음.
  const addKey = (key: string) => {
    const firstEmpty = slots.findIndex((s) => s === null);
    if (firstEmpty === -1) return;
    const next = [...slots];
    next[firstEmpty] = key;
    onChange(next);
  };

  // 5칸 사이 swap — 빈 칸 ↔ 빈 칸도 의미 없으니 그냥 swap.
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

      {/* 5 fixed slots — 빈 칸은 점선 placeholder, 채워진 칸은 chip. 드래그로 swap. */}
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

      {/* 사용 가능한 나머지 — 클릭으로 첫 빈 슬롯 채움. */}
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
