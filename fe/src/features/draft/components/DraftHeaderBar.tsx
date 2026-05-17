// Header bar across the top of the draft page — title + subtitle,
// undo/redo/discard/save/import buttons, and the remaining-budget chip.
// Presentation only: every action is a callback, every value a prop.

import FadeIn from "../../../components/ui/FadeIn";
import type { DraftConfigServer } from "../../../types/draft";

type Props = {
  sessionName: string | null;
  config: DraftConfigServer | null;
  hasDraftConfig: boolean;
  isLoadedMode: boolean;
  rosterSize: number;
  remainingBudget: number;
  authed: boolean;
  canUndoPicks: boolean;
  canRedoPicks: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDiscard: () => void;
  // New = wipe current local state and start a fresh setup. The parent
  // decides whether to prompt for a save first.
  onNew: () => void;
  onSave: () => void;
  onImport: () => void;
  // Start Draft = open the setup modal (or login modal if not authed).
  // Only rendered when there is no draft in progress.
  onStartDraft: () => void;
};

export default function DraftHeaderBar({
  sessionName,
  config,
  hasDraftConfig,
  isLoadedMode,
  rosterSize,
  remainingBudget,
  authed,
  canUndoPicks,
  canRedoPicks,
  onUndo,
  onRedo,
  onDiscard,
  onNew,
  onSave,
  onImport,
  onStartDraft,
}: Props) {
  return (
    <FadeIn>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-black text-white/70">PPA-DUN</div>
          <h1 className="mt-1 text-3xl font-black text-white">
            {sessionName ?? "Draft Room"}
          </h1>
          {hasDraftConfig && config ? (
            <p className="mt-2 text-sm text-white/60">
              {String(config.leagueType ?? "AL").toUpperCase()} - ${config.budget} Budget - {rosterSize} Players
            </p>
          ) : (
            <p className="mt-2 text-sm text-white/60">
              Browse players without starting a draft.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasDraftConfig && (
            <>
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndoPicks}
                aria-label="Undo"
                className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-black/25 text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black/25"
                title="Undo the last pick change"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M9 14l-4-4 4-4" />
                  <path d="M5 10h11a4 4 0 0 1 0 8h-2" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedoPicks}
                aria-label="Redo"
                className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-black/25 text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black/25"
                title="Redo the last undone change"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M15 14l4-4-4-4" />
                  <path d="M19 10H8a4 4 0 0 0 0 8h2" />
                </svg>
              </button>
            </>
          )}
          {hasDraftConfig && (
            <button
              type="button"
              onClick={onDiscard}
              className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-200 transition hover:bg-rose-500/20"
              title={
                isLoadedMode
                  ? "Clear all picks of the current saved session"
                  : "Discard the current unsaved draft and start over"
              }
            >
              Discard
            </button>
          )}
          {hasDraftConfig && (
            <button
              type="button"
              onClick={onNew}
              className="rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm font-black text-sky-200 transition hover:bg-sky-500/20"
              title="Start a fresh draft session (re-configure budget / teams / roster)"
            >
              New
            </button>
          )}
          {authed && (
            <>
              {hasDraftConfig && (
                <button
                  type="button"
                  onClick={onSave}
                  className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-200 transition hover:bg-emerald-500/20"
                  title="Save current draft as a session"
                >
                  Save
                </button>
              )}
              <button
                type="button"
                onClick={onImport}
                className="rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/10"
                title="Import a saved session"
              >
                Import
              </button>
            </>
          )}

          {!hasDraftConfig && (
            <button
              type="button"
              onClick={onStartDraft}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-black transition hover:bg-zinc-100"
              title={
                authed
                  ? "Configure budget / teams and start a live draft"
                  : "Sign in to start a draft"
              }
            >
              Start Draft
            </button>
          )}

          {hasDraftConfig && (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
              <div className="text-xs font-extrabold text-white/60">Remaining Budget</div>
              <div className="mt-1 text-2xl font-black text-emerald-400">${remainingBudget}</div>
            </div>
          )}
        </div>
      </div>
    </FadeIn>
  );
}
