// Ordered draft history — main-board picks in chronological order.
// Columns: Pick # | Brought Up | Player | Position | MLB Team | Won | Bid.
// 옛 세션은 broughtUpByTeamId 가 null 일 수 있어 "—" 로 표시.

import Modal from "../../../components/ui/Modal";
import type { DraftPick, DraftPlayer, DraftTeam } from "../../../types/draft";

type Props = {
  open: boolean;
  picks: DraftPick[];
  teams: DraftTeam[];
  playersById: Record<string, DraftPlayer>;
  onClose: () => void;
};

export default function OrderedDraftHistoryModal({
  open,
  picks,
  teams,
  playersById,
  onClose,
}: Props) {
  const teamNameById: Record<string, string> = Object.fromEntries(
    teams.map((t) => [t.id, t.name]),
  );

  const mainPicks = picks.filter((p) => p.kind === "main");

  return (
    <Modal
      open={open}
      title={`Draft History (${mainPicks.length} picks)`}
      onClose={onClose}
      size="large"
    >
      {mainPicks.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/65">
          No picks yet.
        </div>
      ) : (
        <div className="ppadun-dropdown-scroll max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/20">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#0c1220] text-xs font-black uppercase tracking-wider text-white/55">
              <tr>
                <th className="px-3 py-2.5 font-black">Pick #</th>
                <th className="px-3 py-2.5 font-black">Brought Up</th>
                <th className="px-3 py-2.5 font-black">Player</th>
                <th className="px-3 py-2.5 font-black">Position</th>
                <th className="px-3 py-2.5 font-black">MLB Team</th>
                <th className="px-3 py-2.5 font-black">Won</th>
                <th className="px-3 py-2.5 text-right font-black">Bid</th>
              </tr>
            </thead>
            <tbody>
              {mainPicks.map((pick, idx) => {
                const player = playersById[pick.playerId];
                const brought = pick.broughtUpByTeamId
                  ? teamNameById[pick.broughtUpByTeamId] ?? "—"
                  : "—";
                const won = teamNameById[pick.draftedByTeamId] ?? "—";
                const positions = player?.positions?.join("/") ?? pick.slotPos ?? "—";
                return (
                  <tr
                    key={`${pick.playerId}-${idx}`}
                    className="border-t border-white/5 hover:bg-white/[0.04]"
                  >
                    <td className="px-3 py-2 font-black text-white/80">{idx + 1}</td>
                    <td className="px-3 py-2 text-white/70">{brought}</td>
                    <td className="px-3 py-2 font-black text-white">
                      {player?.name ?? pick.playerId}
                    </td>
                    <td className="px-3 py-2 text-white/70">{positions}</td>
                    <td className="px-3 py-2 text-white/70">{player?.team ?? "—"}</td>
                    <td className="px-3 py-2 font-bold text-white/80">{won}</td>
                    <td className="px-3 py-2 text-right font-black text-emerald-300">
                      {typeof pick.bid === "number" ? `$${pick.bid}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
