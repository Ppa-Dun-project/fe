// Rename-and-copy modal — confirms a name before duplicating a saved session.
// Presentation only: name state and API call live in the parent (DraftPage).

type Props = {
  nameInput: string;
  onChangeName: (next: string) => void;
  error: string | null;
  copying: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function CopySessionModal({
  nameInput,
  onChangeName,
  error,
  copying,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-4">
      <button
        type="button"
        aria-label="Close copy dialog"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-[#0c1220] p-6 shadow-2xl">
        <div className="text-lg font-black text-white">Copy Draft</div>
        <div className="mt-1 text-xs text-white/55">
          Choose a name for the new session
        </div>

        <input
          type="text"
          value={nameInput}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="New session name"
          className="mt-4 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/40 focus:border-white/25"
          autoFocus
        />

        {error && (
          <div className="mt-2 text-xs font-bold text-rose-300">{error}</div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={copying}
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={copying || nameInput.trim().length === 0}
            className="flex-1 rounded-2xl bg-sky-500 px-4 py-3 text-sm font-black text-white transition hover:bg-sky-400 disabled:opacity-50"
          >
            {copying ? "Copying..." : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
