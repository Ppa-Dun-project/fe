import type { Player } from "../../../types/player";
import { formatPpa } from "../../../utils/playerValue";

type Props = {
  player: Player;
  onClick: () => void;
};

export default function PlayerCard({ player, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition hover:bg-white/8 hover:-translate-y-[2px] active:translate-y-0"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-black text-white">{player.name}</div>
          <div className="mt-1 text-xs text-white/60">
            {player.team} • {player.positions.join(", ")}
          </div>
        </div>

        <div className="rounded-xl bg-white/10 px-3 py-1 text-xs font-black text-white">
          {formatPpa(player.valueScore)}
        </div>
      </div>

      <div className="mt-3 text-xs text-white/40 group-hover:text-white/60 transition">
        View details →
      </div>
    </button>
  );
}