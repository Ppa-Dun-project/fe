// Import modal — lists saved sessions with delete buttons. Presentation
// only: list data and handlers come from the parent (DraftPage). Rendered
// conditionally by the parent so no `open` prop here.

import type { SessionSummary } from "../../../types/draft";

type Props = {
  sessions: SessionSummary[];
  loading: boolean;
  onClose: () => void;
  onPick: (id: number) => void;
  onDelete: (id: number) => void;
  // 옛 세션을 새 target_season 으로 복제하는 keeper 흐름 진입점.
  onClone: (session: SessionSummary) => void;
};

export default function ImportSessionsModal({
  sessions,
  loading,
  onClose,
  onPick,
  onDelete,
  onClone,
}: Props) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4">
      <button
        type="button"
        aria-label="Close import dialog"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-3xl border border-white/15 bg-[#0c1220] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="text-lg font-black text-white">Saved Sessions</div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/25 text-sm font-black text-white/80 hover:bg-white/10"
            aria-label="Close"
          >
            X
          </button>
        </div>

        <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/20">
          {loading && (
            <div className="p-4 text-sm text-white/65">Loading sessions...</div>
          )}

          {!loading && sessions.length === 0 && (
            <div className="p-4 text-sm text-white/65">No saved sessions yet.</div>
          )}

          {!loading &&
            sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 border-b border-white/5 px-4 py-3 last:border-b-0 hover:bg-white/5"
              >
                <button
                  type="button"
                  onClick={() => onPick(s.id)}
                  className="flex-1 text-left"
                >
                  <div className="text-sm font-black text-white">{s.name}</div>
                  <div className="mt-0.5 text-xs text-white/55">
                    {s.createdAt.slice(0, 10)}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onClone(s)}
                  aria-label="Clone for new season"
                  title="Clone for new season"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 transition hover:bg-emerald-500/20"
                >
                  ⎘
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(s.id)}
                  aria-label="Delete session"
                  title="Delete session"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-rose-400/30 bg-rose-500/10 text-rose-200 transition hover:bg-rose-500/20"
                >
                  🗑
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
