import { useNavigate } from "react-router-dom";
import type { Player } from "../../../types/player";
import TopPlayerCard from "../../home/TopPlayerCard";

type Props = {
  players: Player[];
};

export default function TopPlayersPanel({ players }: Props) {
  const navigate = useNavigate();

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-black text-white">Top Players</h2>
      <p className="mt-1 text-sm text-white/60">Highest ValueScore right now.</p>

      <div className="mt-5 space-y-3">
        {players.slice(0, 6).map((p) => (
          <TopPlayerCard
            key={p.id}
            player={{
              id: String(p.id),
              name: p.name,
              team: p.team,
              positions: p.positions,
              valueScore: p.valueScore,
            }}
            onClick={() => navigate(`/players/${p.id}`)}
          />
        ))}
      </div>
    </section>
  );
}