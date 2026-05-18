// Inline 스탯 5종 선택기. 드래프트 페이지의 Compare 패널과 PlayerListTable 사이에 배치.
// 포지션 필터에 따라 batter / pitcher 카탈로그를 자동 전환 (SP/RP → pitcher).
//   - 좌측: 현재 선택된 5개 칩 — 드래그로 순서 변경 / X 로 제거
//   - 우측: 카탈로그에서 아직 안 고른 칩들 — 클릭으로 추가 (5개 다 차면 비활성)
// 변경은 즉시 useStatColumns 훅 → localStorage 로 반영된다 (별도 Save 없음).

import { useState } from "react";
import {
  STAT_COLUMN_COUNT,
  getStatDef,
  getStatsForGroup,
  type StatGroup,
} from "../statColumns";

const DRAG_MIME = "application/x-ppadun-statkey";

type Props = {
  group: StatGroup;
  cols: string[];
  onChange: (next: string[]) => void;
};

export default function StatPickerStrip({ group, cols, onChange }: Props) {
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const allInGroup = getStatsForGroup(group);
  const available = allInGroup.filter((s) => !cols.includes(s.key));
  const isFull = cols.length >= STAT_COLUMN_COUNT;

  const addKey = (key: string) => {
    if (isFull) return;
    onChange([...cols, key]);
  };
  const removeKey = (key: string) => onChange(cols.filter((k) => k !== key));
  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    if (from >= cols.length || to >= cols.length) return;
    const next = [...cols];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-wider text-white/55">
          {group === "batter" ? "Batter Stats" : "Pitcher Stats"}
        </div>
        <div className="text-xs font-black text-white/55">
          {cols.length} / {STAT_COLUMN_COUNT} selected
        </div>
      </div>

      {/* 선택된 5개 — 드래그로 순서 변경 */}
      <div className="mt-2 flex flex-wrap gap-2">
        {cols.map((key, idx) => {
          const def = getStatDef(key);
          const isHover = hoverIdx === idx && draggingIdx !== null && draggingIdx !== idx;
          const isDragging = draggingIdx === idx;
          return (
            <div
              key={key}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME, String(idx));
                e.dataTransfer.effectAllowed = "move";
                setDraggingIdx(idx);
              }}
              onDragEnd={() => {
                setDraggingIdx(null);
                setHoverIdx(null);
              }}
              onDragOver={(e) => {
                if (draggingIdx === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (hoverIdx !== idx) setHoverIdx(idx);
              }}
              onDragLeave={() => {
                if (hoverIdx === idx) setHoverIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const raw = e.dataTransfer.getData(DRAG_MIME);
                setHoverIdx(null);
                setDraggingIdx(null);
                if (!raw) return;
                const from = Number(raw);
                if (Number.isFinite(from)) reorder(from, idx);
              }}
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
                onClick={() => removeKey(key)}
                aria-label={`Remove ${def?.label ?? key}`}
                title="Remove"
                className="ml-0.5 grid h-4 w-4 place-items-center rounded-full text-[10px] font-black text-emerald-100/80 hover:bg-emerald-400/30"
              >
                ✕
              </button>
            </div>
          );
        })}
        {cols.length === 0 && (
          <div className="text-xs text-white/50">Pick {STAT_COLUMN_COUNT} stats below.</div>
        )}
      </div>

      {/* 사용 가능한 나머지 — 클릭으로 추가 */}
      {available.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
          {available.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => addKey(s.key)}
              disabled={isFull}
              title={isFull ? "Remove one stat first" : `Add ${s.label}`}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-extrabold text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/5"
            >
              + {s.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
