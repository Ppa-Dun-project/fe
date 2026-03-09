import { useEffect, useMemo, useRef, useState } from "react";
import type { DraftPlayer, DraftTeam } from "../../../types/draft";

type Props = {
  open: boolean;
  player: DraftPlayer | null;
  teams: DraftTeam[];
  remainingBudgetByTeam: Record<string, number>;
  onClose: () => void;
  onConfirm: (draftedByTeamId: string, bid: number) => void;
};

export default function TakenBidModal({
  open,
  player,
  teams,
  remainingBudgetByTeam,
  onClose,
  onConfirm,
}: Props) {
  const otherTeams = useMemo(() => teams.filter((t) => !t.isMine), [teams]);

  const initialTeamId = useMemo(() => otherTeams[0]?.id ?? "", [otherTeams]);

  const [draftedByTeamId, setDraftedByTeamId] = useState(initialTeamId);
  const [bid, setBid] = useState("");
  const [minBidErrorOpen, setMinBidErrorOpen] = useState(false);
  const [budgetErrorOpen, setBudgetErrorOpen] = useState(false);
  const minBidTimerRef = useRef<number | null>(null);
  const budgetTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (minBidTimerRef.current !== null) {
        window.clearTimeout(minBidTimerRef.current);
      }
      if (budgetTimerRef.current !== null) {
        window.clearTimeout(budgetTimerRef.current);
      }
    },
    []
  );

  if (!open || !player) return null;

  const selectedTeamBudget = remainingBudgetByTeam[draftedByTeamId] ?? 0;
  const parsedBid = Number(bid);
  const validTeam = Boolean(draftedByTeamId);
  const overBudget = Number.isFinite(parsedBid) && parsedBid > selectedTeamBudget;
  const bidInputErrorOpen = minBidErrorOpen || budgetErrorOpen;

  const teamOptions = otherTeams.map((t) => ({ value: t.id, label: t.name }));

  const openMinBidError = () => {
    setMinBidErrorOpen(true);
    if (minBidTimerRef.current !== null) {
      window.clearTimeout(minBidTimerRef.current);
    }
    minBidTimerRef.current = window.setTimeout(() => {
      setMinBidErrorOpen(false);
      minBidTimerRef.current = null;
    }, 3000);
  };

  const openBudgetError = () => {
    setBudgetErrorOpen(true);
    if (budgetTimerRef.current !== null) {
      window.clearTimeout(budgetTimerRef.current);
    }
    budgetTimerRef.current = window.setTimeout(() => {
      setBudgetErrorOpen(false);
      budgetTimerRef.current = null;
    }, 5000);
  };

  const handleConfirm = () => {
    if (!validTeam) return;
    if (!Number.isFinite(parsedBid) || parsedBid < 1) {
      openMinBidError();
      return;
    }
    if (overBudget) {
      openBudgetError();
      return;
    }
    onConfirm(draftedByTeamId, parsedBid);
  };

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative mx-auto mt-24 w-[92%] max-w-md overflow-visible rounded-3xl border border-rose-400/25 bg-[#1b1112] shadow-2xl">
        <div className="rounded-t-3xl bg-rose-600 px-6 py-3 text-center text-sm font-black text-white">
          Opponent Draft Bid
        </div>

        <div className="p-6">
          <div className="text-center">
            <div className="text-3xl font-black text-white">{player.name}</div>
            <div className="mt-3 flex justify-center gap-2">
              {player.positions.map((pos) => (
                <span
                  key={pos}
                  className="rounded-lg bg-white/10 px-2 py-1 text-xs font-extrabold text-white/70"
                >
                  {pos}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div className="border-t border-white/10 pt-4">
              <div className="text-xs font-extrabold text-white/70">Drafted by</div>
              <select
                value={draftedByTeamId}
                onChange={(e) => setDraftedByTeamId(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-extrabold text-white outline-none transition hover:bg-white/5 focus:border-rose-400/35"
              >
                {teamOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-zinc-950 text-white">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="text-xs font-extrabold text-white/70">Winning Bid</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={bid}
                  onChange={(e) => setBid(e.target.value)}
                  inputMode="numeric"
                  placeholder="Enter winning bid"
                  className={[
                    "w-full rounded-2xl bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35",
                    bidInputErrorOpen
                      ? "border border-rose-500 ring-1 ring-rose-400/80"
                      : "border border-white/10 focus:border-rose-400/35",
                  ].join(" ")}
                />
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-sm font-black text-white/60">
                  $
                </div>
              </div>

              {minBidErrorOpen && (
                <div className="relative mt-2 inline-block rounded-xl bg-rose-500 px-3 py-2 text-xs font-bold text-white shadow-lg">
                  <span className="absolute -top-1 left-4 h-2 w-2 rotate-45 bg-rose-500" />
                  Winning bid must be at least $1.
                </div>
              )}

              {budgetErrorOpen && (
                <div className="relative mt-2 inline-block rounded-xl bg-rose-500 px-3 py-2 text-xs font-bold text-white shadow-lg">
                  <span className="absolute -top-1 left-4 h-2 w-2 rotate-45 bg-rose-500" />
                  Winning bid cannot exceed this team's remaining budget (${selectedTeamBudget}).
                </div>
              )}

              <div className="mt-2 text-xs text-white/35">
                Record the actual winning amount to track opponent budgets.
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white/75 transition hover:bg-white/10"
            >
              Cancel
            </button>

            <button
              onClick={handleConfirm}
              className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-500"
            >
              Finish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
