// 3-button confirmation dialog used when the user clicks "New" with an
// unsaved draft in progress. The choices are intentionally distinct so
// Cancel = abort (default safe action) and the destructive path
// ("Discard current") needs an explicit click.

import Modal from "../../../components/ui/Modal";

type Props = {
  onSaveFirst: () => void;
  onDiscardCurrent: () => void;
  onCancel: () => void;
};

export default function NewDraftConfirmModal({
  onSaveFirst,
  onDiscardCurrent,
  onCancel,
}: Props) {
  const footer = (
    <>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-black text-white/80 transition hover:bg-white/10"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onDiscardCurrent}
        className="rounded-xl border border-rose-400/30 bg-rose-500/15 px-4 py-2 text-sm font-black text-rose-200 transition hover:bg-rose-500/25"
      >
        Discard current
      </button>
      <button
        type="button"
        onClick={onSaveFirst}
        className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-black text-emerald-200 transition hover:bg-emerald-500/25"
      >
        Save first
      </button>
    </>
  );

  return (
    <Modal open={true} title="Start a new draft?" onClose={onCancel} footer={footer}>
      <p className="text-sm text-white/75">
        You have an unsaved draft in progress. What would you like to do?
      </p>
      <ul className="mt-3 space-y-1 text-xs text-white/60">
        <li>
          <span className="font-black text-emerald-300">Save first</span>
          {" "}— save the current draft as a new session, then open the setup
          screen.
        </li>
        <li>
          <span className="font-black text-rose-300">Discard current</span>
          {" "}— wipe the current local draft and open the setup screen.
          This cannot be undone.
        </li>
        <li>
          <span className="font-black text-white/80">Cancel</span>
          {" "}— close this dialog and return to your draft unchanged.
        </li>
      </ul>
    </Modal>
  );
}
