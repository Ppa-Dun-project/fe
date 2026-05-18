// Rename a saved session — small input + Cancel / Save. Presentation only:
// state and PUT call live in the parent (DraftPage).

type Props = {
  nameInput: string;
  onChangeName: (next: string) => void;
  error: string | null;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function RenameSessionModal({
  nameInput,
  onChangeName,
  error,
  saving,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="fixed inset-0 z-90 grid place-items-center p-4">
      <button
        type="button"
        aria-label="Close rename dialog"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-[#0c1220] p-6 shadow-2xl">
        <div className="text-lg font-black text-white">Rename Session</div>
        <div className="mt-1 text-xs text-white/55">Pick a new name for this draft</div>

        <input
          type="text"
          value={nameInput}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="Session name"
          className="mt-4 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/40 focus:border-white/25"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && nameInput.trim()) onConfirm();
          }}
        />

        {error && <div className="mt-2 text-xs font-bold text-rose-300">{error}</div>}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving || nameInput.trim().length === 0}
            className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
