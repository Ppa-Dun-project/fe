import { useEffect, useState } from "react";

import Modal from "../../components/ui/Modal";
import type { InjuredPlayer } from "../../types/home";
import InjuredPlayerCard from "./InjuredPlayerCard";

/**
 * InjuredPlayersStrip: HomePage의 부상자 섹션
 * - 상위 3명 가로 카드 (Latest News 섹션과 같은 outer container 스타일)
 * - "View all →" 클릭 시 전체 명단 popup
 *
 * 데이터: GET /api/players/injured (limit 없음 = 전체).
 * - strip은 처음 3명만 slice
 * - popup은 전체 리스트
 * - 한 번만 fetch해서 두 곳 다 사용 (popup 클릭 시 추가 호출 없음)
 */

export default function InjuredPlayersStrip() {
  const [players, setPlayers] = useState<InjuredPlayer[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/home/injured")
      .then((r) => r.json())
      .then((data: InjuredPlayer[]) => setPlayers(Array.isArray(data) ? data : []))
      .catch(() => setPlayers([]));
  }, []);

  // 부상자가 0명이면 섹션 자체를 숨김 (빈 박스 보여주는 것보다 깔끔)
  if (players.length === 0) return null;

  const top3 = players.slice(0, 3);

  return (
    <>
      {/* News 섹션과 동일한 outer container 스타일로 sibling 느낌 */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Injured Players</h2>
            <p className="mt-1 text-xs text-white/50">
              Updated daily · sorted by player value
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="text-xs font-bold text-white/60 hover:text-white transition"
          >
            View all →
          </button>
        </div>

        {/* 우측 1/3 컬럼에 들어가므로 항상 세로 1열 stack */}
        <div className="mt-5 grid grid-cols-1 gap-4">
          {top3.map((p) => (
            <InjuredPlayerCard key={p.player_id} item={p} />
          ))}
        </div>
      </section>

      {/* View All popup — 같은 카드 컴포넌트로 전체 표시, 스크롤 가능 */}
      <Modal
        open={open}
        title={`Injured Players (${players.length})`}
        onClose={() => setOpen(false)}
      >
        <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {players.map((p) => (
            <InjuredPlayerCard key={p.player_id} item={p} />
          ))}
        </div>
      </Modal>
    </>
  );
}
