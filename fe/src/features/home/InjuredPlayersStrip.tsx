import { useEffect, useState } from "react";

import type { InjuredPlayer } from "../../types/home";
import InjuredPlayerCard from "./InjuredPlayerCard";

/**
 * InjuredPlayersStrip: HomePage의 부상자 섹션
 * - 전체 명단을 한 카드 안에서 세로 스크롤로 표시
 * - Latest News 섹션과 같은 outer container 스타일 + 같은 높이로 stretch
 *
 * 데이터: GET /api/home/injured — limit 없이 한 번에 받아서 그대로 렌더.
 */

export default function InjuredPlayersStrip() {
  const [players, setPlayers] = useState<InjuredPlayer[]>([]);

  useEffect(() => {
    fetch("/api/home/injured")
      .then((r) => r.json())
      .then((data: InjuredPlayer[]) => setPlayers(Array.isArray(data) ? data : []))
      .catch(() => setPlayers([]));
  }, []);

  // 부상자가 0명이면 섹션 자체를 숨김 (빈 박스 보여주는 것보다 깔끔)
  if (players.length === 0) return null;

  return (
    // News 섹션과 동일한 outer container 스타일로 sibling 느낌.
    // 사이즈는 자기 자신의 자연 높이로 두고, 카드가 많아지면 안에서 스크롤.
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

      {/* 카드 리스트 — max-h로 약 3카드 분량 높이만 유지, 그 이상은 세로 스크롤.
          ppadun-dropdown-scroll 클래스로 다른 스크롤 영역과 동일한 얇은 스크롤바 스타일 사용. */}
      <div className="ppadun-dropdown-scroll mt-5 max-h-96 space-y-3 overflow-y-auto pr-1">
        {players.map((p) => (
          <InjuredPlayerCard key={p.player_id} item={p} />
        ))}
      </div>
    </section>
  );
}
