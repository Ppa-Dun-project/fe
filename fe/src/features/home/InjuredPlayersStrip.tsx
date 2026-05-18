import { useEffect, useState } from "react";

import type { InjuredPlayer } from "../../types/home";
import InjuredPlayerCard from "./InjuredPlayerCard";

/**
 * InjuredPlayersStrip: the injured-players section on HomePage
 * - Displays the full list inside a single card with vertical scrolling
 * - Uses the same outer container styling as the Latest News section and stretches to the same height
 *
 * Data: GET /api/home/injured — fetched all at once without a limit and rendered as-is.
 */

export default function InjuredPlayersStrip() {
  const [players, setPlayers] = useState<InjuredPlayer[]>([]);

  useEffect(() => {
    fetch("/api/home/injured")
      .then((r) => r.json())
      .then((data: InjuredPlayer[]) => setPlayers(Array.isArray(data) ? data : []))
      .catch(() => setPlayers([]));
  }, []);

  // If there are no injured players, hide the section entirely (cleaner than showing an empty box).
  if (players.length === 0) return null;

  return (
    // Uses the same outer container styling as the News section to feel like a sibling.
    // Lets the section grow to its natural height, with internal scrolling once there are many cards.
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Injured Players</h2>
          <p className="mt-1 text-xs text-white/50">
            Updated every 30 minutes · sorted by player value
          </p>
        </div>
        <span className="text-xs font-bold text-white/40">{players.length} listed</span>
      </div>

      {/* Card list — max-h keeps the height to roughly 3 cards; anything more scrolls vertically.
          The ppadun-dropdown-scroll class applies the same thin scrollbar styling used by other scrollable regions. */}
      <div className="ppadun-dropdown-scroll mt-5 max-h-96 space-y-3 overflow-y-auto pr-1">
        {players.map((p) => (
          <InjuredPlayerCard key={p.player_id} item={p} />
        ))}
      </div>
    </section>
  );
}
