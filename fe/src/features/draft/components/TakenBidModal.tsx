import { useMemo, useState } from "react";
import Dropdown from "../../../components/ui/Dropdown";
import type { DraftPlayer, DraftTeam } from "../../../types/draft";

type Props = {
  open: boolean;
  player: DraftPlayer | null;
  teams: DraftTeam[];
  allowedPositionsByTeam: Record<string, string[]>;
  onClose: () => void;
  onConfirm: (draftedByTeamId: string, bid: number | null, selectedPos: string) => void;
};

export default function TakenBidModal({
  open,
  player,
  teams,
  allowedPositionsByTeam,
  onClose,
  onConfirm,
}: Props) {
  const otherTeams = useMemo(() => teams.filter((t) => !t.isMine), [teams]);

  const initialTeamId = useMemo(() => otherTeams[0]?.id ?? "", [otherTeams]);
  const initialPositions = useMemo(
    () => allowedPositionsByTeam[initialTeamId] ?? [],
    [allowedPositionsByTeam, initialTeamId]
  );
  const initialPos = useMemo(() => initialPositions[0] ?? "", [initialPositions]);

  const [draftedByTeamId, setDraftedByTeamId] = useState(initialTeamId);
  const [bid, setBid] = useState("");
  const [selectedPos, setSelectedPos] = useState(initialPos);

  const currentPositions = draftedByTeamId
    ? allowedPositionsByTeam[draftedByTeamId] ?? []
    : [];

  if (!open || !player) return null;

  const parsedBid = bid.trim() === "" ? null : Number(bid);
  const validTeam = Boolean(draftedByTeamId);
  const validBid = parsedBid === null || (Number.isFinite(parsedBid) && parsedBid >= 0);
  const validPos = Boolean(selectedPos);

  const teamOptions = otherTeams.map((t) => ({ value: t.id, label: t.name }));

  const handleChangeTeam = (teamId: string) => {
    setDraftedByTeamId(teamId);
    const nextPositions = allowedPositionsByTeam[teamId] ?? [];
    setSelectedPos(nextPositions[0] ?? "");
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
              <Dropdown
                label="Drafted by"
                value={draftedByTeamId}
                options={teamOptions}
                onChange={handleChangeTeam}
              />
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="text-xs font-extrabold text-white/70">Winning Bid</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={bid}
                  onChange={(e) => setBid(e.target.value)}
                  inputMode="numeric"
                  placeholder="Leave blank if unknown"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-rose-400/35"
                />
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-sm font-black text-white/60">
                  $
                </div>
              </div>
              <div className="mt-2 text-xs text-white/35">
                상대 예산 추적을 위해 실제 영입 금액을 기록합니다.
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="text-xs font-extrabold text-white/70">Drafting Position</div>

              {currentPositions.length === 0 ? (
                <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  선택한 팀에 배치 가능한 포지션 슬롯이 없습니다.
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {currentPositions.map((pos) => {
                    const active = selectedPos === pos;
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setSelectedPos(pos)}
                        className={[
                          "rounded-xl px-4 py-2 text-sm font-black transition",
                          active
                            ? "bg-rose-600 text-white"
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
              disabled={!validTeam || !validBid || !validPos}
              onClick={() => onConfirm(draftedByTeamId, parsedBid, selectedPos)}
              className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-500 disabled:opacity-40"
            >
              Finish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}