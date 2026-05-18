import { useEffect, useMemo, useRef, useState } from "react";
import type { DraftPlayer, DraftTeam } from "../../../types/draft";

type Props = {
  open: boolean;
  player: DraftPlayer | null;
  teams: DraftTeam[];
  remainingBudget: number;
  // 부모가 모달이 열릴 때 단건 호출로 채워 넣는 추천 bid (in-flight 동안 null + bidLoading=true).
  recommendedBid: number | null;
  bidLoading: boolean;
  onClose: () => void;
  onConfirm: (bid: number, broughtUpByTeamId: string) => void;
};

export default function AddBidModal({
  open,
  player,
  teams,
  remainingBudget,
  recommendedBid,
  bidLoading,
  onClose,
  onConfirm,
}: Props) {
  const myTeam = useMemo(() => teams.find((t) => t.isMine) ?? teams[0], [teams]);

  // 부모가 player.id 로 `key` 를 지정해 모달을 remount → useState 초기값이 매번 새로 평가됨.
  // bid input 은 항상 빈 문자열로 시작 — 추천값은 placeholder 로만 안내.
  const [bid, setBid] = useState("");
  const [broughtUpByTeamId, setBroughtUpByTeamId] = useState(myTeam?.id ?? "");
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
    if (!broughtUpByTeamId) return;
    onConfirm(parsedBid, broughtUpByTeamId);
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
              <div className="text-xs font-extrabold text-white/70">Brought Up by</div>
              <select
                value={broughtUpByTeamId}
                onChange={(e) => setBroughtUpByTeamId(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-extrabold text-white outline-none transition hover:bg-white/5 focus:border-emerald-400/35"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id} className="bg-zinc-950 text-white">
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

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
