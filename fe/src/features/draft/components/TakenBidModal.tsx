import { useEffect, useMemo, useState } from "react";
import type { DraftPlayer, DraftPosition, DraftTeam } from "../../../types/draft";

type Props = {
  open: boolean;
  player: DraftPlayer | null;
  teams: DraftTeam[];
  allowedPositionsByTeam: Record<string, DraftPosition[]>;
  onClose: () => void;
  onConfirm: (draftedByTeamId: string, bid: number | null, selectedPos: DraftPosition) => void;
};

export default function TakenBidModal({
  open,
  player,
  teams,
  allowedPositionsByTeam,
  onClose,
  onConfirm,
}: Props) {
  const targetTeams = useMemo(() => teams.filter((team) => !team.isMine), [teams]);

  const initialTeamId = useMemo(() => {
    for (const team of targetTeams) {
      if ((allowedPositionsByTeam[team.id] ?? []).length > 0) return team.id;
    }
    return targetTeams[0]?.id ?? "";
  }, [allowedPositionsByTeam, targetTeams]);

  const [selectedTeamId, setSelectedTeamId] = useState(initialTeamId);
  const [bid, setBid] = useState("");
  const [selectedPos, setSelectedPos] = useState<DraftPosition | "">("");

  useEffect(() => {
    if (!open) return;
    setSelectedTeamId(initialTeamId);
  }, [open, initialTeamId]);

  useEffect(() => {
    const pos = allowedPositionsByTeam[selectedTeamId]?.[0] ?? "";
    setSelectedPos(pos);
  }, [allowedPositionsByTeam, selectedTeamId]);

  if (!open || !player) return null;

  const allowedForTeam = allowedPositionsByTeam[selectedTeamId] ?? [];
  const parsedBid = Number(bid);
  const bidValid = bid.trim() === "" || (Number.isFinite(parsedBid) && parsedBid > 0);
  const canSubmit = selectedTeamId && selectedPos !== "" && bidValid;

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative mx-auto mt-24 w-[92%] max-w-md overflow-visible rounded-3xl border border-rose-400/25 bg-[#101723] shadow-2xl">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="text-xs font-black text-rose-200/80">Marked as Taken</div>
          <div className="mt-1 text-xl font-black text-white">{player.name}</div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <div className="text-xs font-extrabold text-white/70">Drafted By Team</div>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-white/25"
            >
              {targetTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs font-extrabold text-white/70">Draft Position</div>
            <select
              value={selectedPos}
              onChange={(e) => setSelectedPos(e.target.value as DraftPosition)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-white/25"
            >
              {allowedForTeam.length === 0 && <option value="">No slot available</option>}
              {allowedForTeam.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs font-extrabold text-white/70">Bid (Optional)</div>
            <input
              value={bid}
              onChange={(e) => setBid(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="Leave empty if unknown"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/40 focus:border-white/25"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-black text-white/80"
          >
            Cancel
          </button>
          <button
            disabled={!canSubmit}
            onClick={() => {
              if (selectedPos === "") return;
              onConfirm(selectedTeamId, bid.trim() ? parsedBid : null, selectedPos);
            }}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-500 disabled:opacity-40"
          >
            Finish
          </button>
        </div>
      </div>
    </div>
  );
}
