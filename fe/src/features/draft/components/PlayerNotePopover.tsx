// Player note editor popover. We call it inline, but it's actually a fixed-position modal.
// Opens when the note icon on a DraftPage player row is clicked. On Save, it passes the note string back to the parent via callback.
import { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  playerName: string;
  initialNote: string;
  saving?: boolean;
  onSave: (note: string) => void;
  onClose: () => void;
};

const NOTE_MAX_LENGTH = 1000;

export default function PlayerNotePopover({
  open,
  playerName,
  initialNote,
  saving = false,
  onSave,
  onClose,
}: Props) {
  const [draft, setDraft] = useState(initialNote);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Re-sync the input with the server value every time the popover opens — guards against the same component being reused for a different player.
  useEffect(() => {
    if (open) queueMicrotask(() => setDraft(initialNote));
  }, [open, initialNote]);

  // Focus the textarea the moment it opens — so the user can start typing immediately after clicking.
  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const dirty = draft !== initialNote;

  const handleSave = () => {
    if (saving) return;
    onSave(draft);
  };

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-4">
      <button
        type="button"
        aria-label="Close note dialog"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-[#0c1220] p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-extrabold uppercase text-amber-300/80">Player Note</div>
            <div className="mt-1 text-lg font-black text-white">{playerName}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/25 text-sm font-black text-white/80 hover:bg-white/10"
          >
            X
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, NOTE_MAX_LENGTH))}
          placeholder="e.g. Watch his wrist injury. $40 max bid."
          rows={6}
          className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/25"
        />

        <div className="mt-1 flex items-center justify-between text-[11px] text-white/45">
          <span>{draft.length === 0 ? "Save empty to delete this note" : "Save to update"}</span>
          <span>
            {draft.length}/{NOTE_MAX_LENGTH}
          </span>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex-1 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
