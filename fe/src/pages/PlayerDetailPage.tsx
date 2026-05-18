// Player detail page — accessed via /draft/:id.
// Fetches full player info (bio + stats) from GET /api/players/:id.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../lib/api";
import { formatPpa } from "../utils/playerValue";

type PlayerDetailResponse = {
  id: number;
  playerType: "batter" | "pitcher";
  name: string;
  age: number;
  height_in: number;
  weight_lb: number;
  bats?: string | null;
  throws: string;
  team: string;
  positions: string[];
  valueScore: number;
  headshotUrl?: string | null;
  batterStats?: {
    avg: number;
    pa: number;
    hr: number;
    ops: number;
    rbi: number;
  } | null;
  pitcherStats?: {
    era: number;
    whip: number;
    ip: number;
    so: number;
    sv: number;
  } | null;
};

export default function PlayerDetailPage() {
  const { id } = useParams();
  const playerId = Number(id);
  const invalidPlayerId = !Number.isFinite(playerId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [player, setPlayer] = useState<PlayerDetailResponse | null>(null);

  useEffect(() => {
    if (invalidPlayerId) return;

    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });

    apiGet<PlayerDetailResponse>(`/api/players/${playerId}`, undefined, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setPlayer(data);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setPlayer(null);
        setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [playerId, invalidPlayerId]);

  if (invalidPlayerId) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-lg font-black text-white">Player not found</div>
        <div className="mt-2 text-sm text-red-200">Invalid player id</div>
        <Link to="/draft" className="mt-4 inline-block text-sm font-black text-white/70 hover:text-white">
          Back to Draft {"->"}
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
        Loading player...
      </div>
    );
  }

  if (!player) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-lg font-black text-white">Player not found</div>
        {error && <div className="mt-2 text-sm text-red-200">{error}</div>}
        <Link to="/draft" className="mt-4 inline-block text-sm font-black text-white/70 hover:text-white">
          Back to Draft {"->"}
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
          ValueScore {formatPpa(player.valueScore)}
        </div>
      </div>

      <div className="mt-6 grid gap-3 text-sm text-white/80 md:grid-cols-2">
        <div>Age: {player.age}</div>
        <div>{player.bats ? `B/T: ${player.bats}/${player.throws}` : `Throws: ${player.throws}`}</div>
        <div>Height: {player.height_in} in</div>
        <div>Weight: {player.weight_lb} lb</div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/80 md:grid-cols-5">
        {player.playerType === "pitcher" && player.pitcherStats ? (
          <>
            <div>ERA: {player.pitcherStats.era.toFixed(2)}</div>
            <div>WHIP: {player.pitcherStats.whip.toFixed(3)}</div>
            <div>IP: {player.pitcherStats.ip.toFixed(1)}</div>
            <div>SO: {player.pitcherStats.so}</div>
            <div>SV: {player.pitcherStats.sv}</div>
          </>
        ) : player.batterStats ? (
          <>
            <div>AVG: {player.batterStats.avg.toFixed(3)}</div>
            <div>PA: {player.batterStats.pa}</div>
            <div>HR: {player.batterStats.hr}</div>
            <div>OPS: {player.batterStats.ops.toFixed(3)}</div>
            <div>RBI: {player.batterStats.rbi}</div>
          </>
        ) : null}
      </div>

      <Link to="/draft" className="mt-6 inline-block text-sm font-black text-white/70 hover:text-white">
        Back to Draft
      </Link>
    </div>
  );
}
