import type { TopPlayer } from "../../types/home";

type Props = {
  player: TopPlayer;
  onClick: () => void;
};

export default function TopPlayerCard({ player, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/8 hover:-translate-y-[2px] active:translate-y-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{player.name}</div>
          <div className="mt-1 text-xs text-white/60">
            {player.team} • {player.positions.join(", ")}
          </div>
        </div>

        <div className="rounded-xl bg-white/10 px-3 py-1 text-xs font-semibold text-white">
          {player.valueScore.toFixed(1)}
        </div>
      </div>
    </button>
  );
}