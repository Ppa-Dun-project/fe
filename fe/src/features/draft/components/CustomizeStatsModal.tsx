// Modal that lets the user pick which 5 stat columns appear in the
// draft page player list, separately for batters and pitchers.
//
// Save stays disabled until exactly 5 are selected. Picks are kept in
// local draft state until the user clicks Save; cancelling reverts.
//
// Reorder uses native HTML5 drag-and-drop on the Selected list: drag
// any item over another item to drop it into that position.

import { useState } from "react";
import Modal from "../../../components/ui/Modal";
import {
  STAT_COLUMN_COUNT,
  getDefaultsForGroup,
  getStatDef,
  getStatsForGroup,
  type StatGroup,
} from "../statColumns";

const DRAG_MIME = "application/x-ppadun-statkey";

type Props = {
  onClose: () => void;
  batterCols: string[];
  pitcherCols: string[];
  onSave: (group: StatGroup, cols: string[]) => void;
};

// Parent renders this conditionally (`{open && <CustomizeStatsModal ... />}`)
// so each open creates a fresh component instance — local draft state starts
// from the saved selection without needing a useEffect sync.
export default function CustomizeStatsModal({
  onClose,
  batterCols,
  pitcherCols,
  onSave,
}: Props) {
  const [tab, setTab] = useState<StatGroup>("batter");
  const [draftBatter, setDraftBatter] = useState<string[]>(batterCols);
  const [draftPitcher, setDraftPitcher] = useState<string[]>(pitcherCols);
  // Drag-and-drop: source index in the Selected list, and current hover index.
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const selected = tab === "batter" ? draftBatter : draftPitcher;
  const setSelected = (next: string[]) => {
    if (tab === "batter") setDraftBatter(next);
    else setDraftPitcher(next);
  };

  const allInGroup = getStatsForGroup(tab);
  const available = allInGroup.filter((s) => !selected.includes(s.key));
  const isFull = selected.length === STAT_COLUMN_COUNT;
  const canSave =
    draftBatter.length === STAT_COLUMN_COUNT &&
    draftPitcher.length === STAT_COLUMN_COUNT;

  const addKey = (key: string) => {
    if (isFull) return;
    setSelected([...selected, key]);
  };
  const removeKey = (key: string) => setSelected(selected.filter((k) => k !== key));

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    if (from >= selected.length || to >= selected.length) return;
    const next = [...selected];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setSelected(next);
  };

  const handleSave = () => {
    if (!canSave) return;
    onSave("batter", draftBatter);
    onSave("pitcher", draftPitcher);
    onClose();
  };

  const handleReset = () => {
    // Local-only — actual persistence happens on Save, so Reset is
    // safely undoable via Cancel.
    setSelected([...getDefaultsForGroup(tab)]);
  };

  const counter = `${selected.length} / ${STAT_COLUMN_COUNT} selected`;
  const counterColor = isFull ? "text-emerald-300" : "text-amber-300";
  const helper = isFull
    ? "Ready to save."
    : `Pick ${STAT_COLUMN_COUNT - selected.length} more to save.`;

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-black text-white/80 transition hover:bg-white/5"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-black text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-500/15"
      >
        Save
      </button>
    </>
  );

  return (
    <Modal size="large" title="Customize Stats" onClose={onClose} footer={footer} open={true}>
      {/* Tab switcher */}
      <div className="mb-5 flex gap-2">
        {(["batter", "pitcher"] as const).map((g) => {
          const active = tab === g;
          const count = (g === "batter" ? draftBatter : draftPitcher).length;
          return (
            <button
              key={g}
              type="button"
              onClick={() => setTab(g)}
              className={[
                "rounded-full px-5 py-2 text-sm font-extrabold transition",
                active
                  ? "bg-white text-black"
                  : "border border-white/10 bg-white/5 text-white/75 hover:bg-white/10",
              ].join(" ")}
            >
              {g === "batter" ? "Batter" : "Pitcher"} ({count}/{STAT_COLUMN_COUNT})
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Available */}
        <div>
          <div className="mb-2 text-xs font-black uppercase tracking-wide text-white/55">
            Available ({available.length})
          </div>
          <div className="flex max-h-96 min-h-56 flex-wrap content-start gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-4">
            {available.length === 0 && (
              <div className="text-sm text-white/50">All stats in this group are selected.</div>
            )}
            {available.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => addKey(s.key)}
                disabled={isFull}
                title={isFull ? "Remove one stat first" : `Add ${s.label}`}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-extrabold text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/5"
              >
                + {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selected — drag to reorder */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-wide text-white/55">
              Selected
            </span>
            <span className={`text-xs font-extrabold ${counterColor}`}>{counter}</span>
          </div>
          <ol className="flex max-h-96 min-h-56 flex-col gap-1.5 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-3">
            {selected.length === 0 && (
              <li className="p-2 text-sm text-white/50">No stats selected.</li>
            )}
            {selected.map((key, idx) => {
              const def = getStatDef(key);
              const isHover = hoverIdx === idx && draggingIdx !== null && draggingIdx !== idx;
              const isDragging = draggingIdx === idx;
              return (
                <li
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
                    "flex cursor-grab items-center gap-3 rounded-xl border bg-white/5 px-3 py-2 transition active:cursor-grabbing",
                    isHover
                      ? "border-emerald-400/60 ring-2 ring-emerald-400/40"
                      : "border-white/10",
                    isDragging ? "opacity-40" : "",
                  ].join(" ")}
                >
                  <span className="select-none text-white/40" title="Drag to reorder" aria-hidden>
                    ⋮⋮
                  </span>
                  <span className="w-5 text-center text-xs font-black text-white/45">
                    {idx + 1}
                  </span>
                  <span className="flex-1 text-sm font-extrabold text-white">
                    {def?.label ?? key}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeKey(key)}
                    aria-label={`Remove ${def?.label ?? key}`}
                    title="Remove"
                    className="grid h-7 w-7 place-items-center rounded-md border border-rose-400/30 bg-rose-500/10 text-rose-200 transition hover:bg-rose-500/20"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className={`text-sm ${isFull ? "text-white/55" : "text-amber-200"}`}>{helper}</p>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-black text-white/70 transition hover:bg-white/5"
          title={`Reset ${tab === "batter" ? "batter" : "pitcher"} selection to defaults`}
        >
          Reset to defaults
        </button>
      </div>
    </Modal>
  );
}
