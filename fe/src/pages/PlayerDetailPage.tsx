import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { mockPlayers } from "../features/players/mock";

export default function PlayerDetailPage() {
  const { id } = useParams();
  const playerId = Number(id);

  const player = useMemo(() => {
    if (!Number.isFinite(playerId)) {
      return undefined;
    }
    return mockPlayers.find((p) => p.id === playerId);
  }, [playerId]);

  if (!player) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-lg font-black text-white">Player not found</div>
        <Link to="/players" className="mt-4 inline-block text-sm font-black text-white/70 hover:text-white">
          Back to Players {"->"}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-black text-white">{player.name}</div>
          <div className="mt-1 text-sm text-white/60">
            {player.team} - {player.positions.join(", ")}
          </div>
        </div>
        <div className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-black text-white">
          ValueScore {player.valueScore.toFixed(1)}
        </div>
      </div>

      <div className="mt-6 text-sm text-white/70">
        (MVP Stub) Stats + breakdown will be implemented here.
      </div>

      <Link to="/players" className="mt-6 inline-block text-sm font-black text-white/70 hover:text-white">
        Back to Players
      </Link>
    </div>
  );
}