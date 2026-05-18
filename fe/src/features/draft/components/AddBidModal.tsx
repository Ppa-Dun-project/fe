import { useEffect, useMemo, useRef, useState } from "react";
import type { ContractCode, DraftPlayer } from "../../../types/draft";

type Props = {
  open: boolean;
  player: DraftPlayer | null;
  remainingBudget: number;
  // The recommended bid the parent fetches with a single call when the modal opens (null + bidLoading=true while in flight).
  recommendedBid: number | null;
  bidLoading: boolean;
  onClose: () => void;
  onConfirm: (bid: number, contractCode: ContractCode) => void;
};

// Mirrors the "implementation view" column from the spec image. Shown via hover tooltip (title attr).
// LX/X are excluded from the picker because they don't make sense as initial acquisition codes (natural expiration / unprotected state) — they only appear as rollover results.
const CONTRACT_OPTIONS: { code: ContractCode; label: string; tooltip: string }[] = [
  { code: "F3", label: "F3", tooltip: "Free Agent contract, year 3 begins / 3 years remaining. Default starting value for a newly-signed long-term FA." },
  { code: "F2", label: "F2", tooltip: "Free Agent contract, 2 years remaining. F3 → F2 after one season passes." },
  { code: "F1", label: "F1", tooltip: "Free Agent contract, final year. Re-sign / extend / release decision is required next offseason." },
  { code: "S1", label: "S1", tooltip: "Short / single-year contract. Used for short-term signings, fill-ins, and draft replacement players." },
  { code: "L2", label: "L2", tooltip: "Long-term contract with 2 years remaining. An existing player who was extended." },
];

export default function AddBidModal({
  open,
  player,
  remainingBudget,
  recommendedBid,
  bidLoading,
  onClose,
  onConfirm,
}: Props) {
  const initialBid = useMemo(() => {
    if (!player || typeof player.recommendedBid !== "number") return "";
    return String(player.recommendedBid);
  }, [player]);

  const [bid, setBid] = useState(initialBid);
  // Default to F3 — the most common case for a new FA signing. Users pick manually for any other case.
  const [contractCode, setContractCode] = useState<ContractCode>("F3");
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

  const parsedBid = Number(bid);
  const overBudget = Number.isFinite(parsedBid) && parsedBid > remainingBudget;
  const bidInputErrorOpen = minBidErrorOpen || budgetErrorOpen;

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
    if (!Number.isFinite(parsedBid) || parsedBid < 1) {
      openMinBidError();
      return;
    }
    if (overBudget) {
      openBudgetError();
      return;
    }
    onConfirm(parsedBid, contractCode);
  };

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative mx-auto mt-24 w-[92%] max-w-md overflow-visible rounded-3xl border border-emerald-400/25 bg-[#101723] shadow-2xl">
        <div className="rounded-t-3xl bg-emerald-500 px-6 py-3 text-center text-sm font-black text-white">
          My Draft Bid
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
            <div>
              <div className="text-xs font-extrabold text-white/70">Winning Bid</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={bid}
                  onChange={(e) => setBid(e.target.value)}
                  inputMode="numeric"
                  placeholder={
                    bidLoading
                      ? "Loading recommendation..."
                      : recommendedBid !== null
                        ? `Recommended: $${recommendedBid}`
                        : "Enter winning bid"
                  }
                  className={[
                    "w-full rounded-2xl bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35",
                    bidInputErrorOpen
                      ? "border border-rose-500 ring-1 ring-rose-400/80"
                      : "border border-white/10 focus:border-emerald-400/35",
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
                  Winning bid cannot exceed your remaining budget (${remainingBudget}).
                </div>
              )}

              <div className="mt-2 text-xs text-white/35">
                Record the actual winning amount to track your remaining budget.
              </div>
            </div>

            <div>
              <div className="text-xs font-extrabold text-white/70">Contract</div>
              <div className="mt-2 grid grid-cols-5 gap-1.5">
                {CONTRACT_OPTIONS.map((opt) => {
                  const active = contractCode === opt.code;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => setContractCode(opt.code)}
                      title={opt.tooltip}
                      className={[
                        "rounded-xl border px-2 py-2 text-xs font-black transition",
                        active
                          ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                          : "border-white/10 bg-black/30 text-white/70 hover:bg-white/5",
                      ].join(" ")}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-xs text-white/35">
                Keeper contract status. Hover for details.
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="text-xs font-extrabold text-white/70">Draft cost</div>
              <div className="mt-2 text-3xl font-black text-emerald-400">
                {bidLoading ? "..." : recommendedBid !== null ? `$${recommendedBid}` : "—"}
              </div>
              <div className="mt-1 text-xs text-white/35">
                This is the recommended draft cost baseline.
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
              className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-400"
            >
              Finish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
