import { useMemo, useState } from "react";
import type { DraftPlayer } from "../../../types/draft";

type DraftPosition = DraftPlayer["positions"][number];

type Props = {
  open: boolean;
  player: DraftPlayer | null;
  allowedPositions: DraftPosition[];
  onClose: () => void;
  onConfirm: (bid: number, selectedPos: DraftPosition) => void;
};

export default function AddBidModal({
  open,
  player,
  allowedPositions,
  onClose,
  onConfirm,
}: Props) {
  const initialBid = useMemo(() => {
    if (!player) return "";
    return String(player.recommendedBid);
  }, [player]);

  const initialPos = useMemo(() => {
    return allowedPositions[0] ?? "";
  }, [allowedPositions]);

  const [bid, setBid] = useState(initialBid);
  const [selectedPos, setSelectedPos] = useState<DraftPosition | "">(initialPos);

  if (!open || !player) return null;

  const parsedBid = Number(bid);
  const valid = Number.isFinite(parsedBid) && parsedBid > 0 && selectedPos !== "";

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
                  placeholder="Enter winning bid"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-emerald-400/35"
                />
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-sm font-black text-white/60">
                  $
                </div>
              </div>
              <div className="mt-2 text-xs text-white/35">
                Record the actual winning amount to track your remaining budget.
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="text-xs font-extrabold text-white/70">Draft cost</div>
              <div className="mt-2 text-3xl font-black text-emerald-400">
                ${player.recommendedBid}
              </div>
              <div className="mt-1 text-xs text-white/35">
                This is the recommended draft cost baseline.
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="text-xs font-extrabold text-white/70">Drafting Position</div>

              {allowedPositions.length === 0 ? (
                <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  No eligible position is available.
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {allowedPositions.map((pos) => {
                    const active = selectedPos === pos;
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setSelectedPos(pos)}
                        className={[
                          "rounded-xl px-4 py-2 text-sm font-black transition",
                          active
                            ? "bg-emerald-500 text-white"
                            : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                        ].join(" ")}
                      >
                        {pos}
                      </button>
                    );
                  })}
                </div>
              )}
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
              disabled={!valid}
              onClick={() => {
                if (selectedPos === "") return;
                onConfirm(parsedBid, selectedPos);
              }}
              className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-400 disabled:opacity-40"
            >
              Finish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
