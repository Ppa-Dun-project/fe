import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../../lib/api";

type Props = {
  open: boolean;
  playerId: number | null;
  onClose: () => void;
};

type PlayerDetailResponse = {
  id: number;
  name: string;
  age: number;
  height_in: number;
  weight_lb: number;
  bats: string;
  throws: string;
  team: string;
  positions: string[];
  headshotUrl?: string | null;
  stats: {
    g: number;
    pa: number;
    hr: number;
    ops: number;
    ip: number;
  };
};

type PlayerValueResponse = {
  playerId: number;
  name: string;
  valueScore: number;
};

const HITTER_POSITIONS = new Set([
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
  "OF",
  "DH",
  "UTIL",
]);

const PITCHER_POSITIONS = new Set(["P", "SP", "RP", "CP"]);

function formatHeight(heightIn: number) {
  const feet = Math.floor(heightIn / 12);
  const inches = heightIn % 12;
  const cm = Math.round(heightIn * 2.54);
  return `${feet}'${inches}" (${cm}cm)`;
}

function formatWeight(weightLb: number) {
  const kg = Math.round(weightLb * 0.453592);
  return `${weightLb} lb (${kg}kg)`;
}

function isTwoWayPlayer(positions: string[]) {
  const normalized = positions.map((pos) => pos.toUpperCase());
  const hasHitterRole = normalized.some((pos) => HITTER_POSITIONS.has(pos));
  const hasPitcherRole = normalized.some((pos) => PITCHER_POSITIONS.has(pos));
  return hasHitterRole && hasPitcherRole;
}

function initialsOf(name: string) {
  const [first = "", second = ""] = name.trim().split(/\s+/);
  if (!first) return "?";
  if (!second) return first[0].toUpperCase();
  return `${first[0]}${second[0]}`.toUpperCase();
}

export default function PlayerInfoModal({ open, playerId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlayerDetailResponse | null>(null);
  const [valueScore, setValueScore] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || playerId === null) return;

    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });

    Promise.allSettled([
      apiGet<PlayerDetailResponse>(`/api/players/${playerId}`, undefined, controller.signal),
      apiGet<PlayerValueResponse>(`/api/players/${playerId}/value`, undefined, controller.signal),
    ])
      .then((results) => {
        if (controller.signal.aborted) return;

        const detailResult = results[0];
        const valueResult = results[1];

        if (detailResult.status === "fulfilled") {
          setDetail(detailResult.value);
        } else {
          setDetail(null);
          setError(
            detailResult.reason instanceof Error
              ? detailResult.reason.message
              : "Failed to load player detail"
          );
          return;
        }

        if (valueResult.status === "fulfilled") {
          setValueScore(valueResult.value.valueScore);
        } else {
          setValueScore(null);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setDetail(null);
        setValueScore(null);
        setError(err instanceof Error ? err.message : "Failed to load player information");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [open, playerId]);

  const twoWay = useMemo(() => {
    if (!detail) return false;
    return isTwoWayPlayer(detail.positions);
  }, [detail]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close player information"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-[90%] max-h-[82vh] max-w-3xl overflow-y-auto rounded-3xl border border-red-500/30 bg-[#090d1a] shadow-[0_28px_100px_rgba(0,0,0,0.72)]">
        <div className="relative bg-gradient-to-r from-[#8c0f1c] via-[#b01f28] to-[#d94848] px-5 pb-4 pt-7 pr-16">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/20 text-sm font-black text-white/85 transition hover:bg-black/30"
          >
            X
          </button>

          {loading && <div className="h-24 animate-pulse rounded-xl bg-black/25" />}

          {!loading && error && (
            <div className="rounded-2xl border border-red-300/35 bg-red-500/15 p-4 text-sm font-semibold text-red-100">
              Failed to load player information: {error}
            </div>
          )}

          {!loading && !error && detail && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-white/25 bg-black/30">
                  {detail.headshotUrl ? (
                    <img src={detail.headshotUrl} alt={detail.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xl font-black text-white/90">
                      {initialsOf(detail.name)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-lg font-black text-white">{detail.team}</div>
                  <div className="text-xs text-white/70">Major League Baseball</div>
                </div>
              </div>

              <div>
                <div className="text-4xl font-black leading-none text-white">{detail.name}</div>
                <div className="mt-2 text-base font-bold text-white/85">{detail.positions.join(" / ")}</div>
              </div>

              <div className="rounded-2xl border border-white/20 bg-black/20 px-5 py-3 text-center">
                <div className="text-[11px] font-black uppercase tracking-wide text-white/60">PPA-DUN Value</div>
                <div className="mt-1 text-3xl font-black text-emerald-300">
                  {valueScore === null ? "-" : valueScore.toFixed(1)}
                </div>
              </div>
            </div>
          )}
        </div>

        {!loading && !error && detail && (
          <div className="space-y-4 p-5">
            <section>
              <div className="mb-2 text-sm font-black uppercase tracking-wide text-white/55">Personal Info</div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {[
                  { label: "Age", value: String(detail.age) },
                  { label: "Bats / Throws", value: `${detail.bats} / ${detail.throws}` },
                  { label: "Height", value: formatHeight(detail.height_in) },
                  { label: "Weight", value: formatWeight(detail.weight_lb) },
                  { label: "Team", value: detail.team },
                  { label: "Positions", value: detail.positions.join(", ") },
                  { label: "Player ID", value: String(detail.id) },
                  { label: "Nationality", value: "-" },
                ].map((info) => (
                  <div key={info.label} className="rounded-xl border border-white/10 bg-[#111628] p-3">
                    <div className="text-[10px] font-black uppercase tracking-wide text-white/45">{info.label}</div>
                    <div className="mt-1 text-sm font-semibold text-white">{info.value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-2 text-sm font-black uppercase tracking-wide text-white/55">Season Stats (Batting)</div>
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0f1424]">
                <table className="w-full min-w-[640px]">
                  <thead className="border-b border-white/10 bg-white/5 text-[11px] uppercase tracking-wide text-white/45">
                    <tr>
                      {["G", "PA", "HR", "OPS", "IP"].map((col) => (
                        <th key={col} className="px-3 py-2 text-center font-black">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-center text-sm font-semibold text-white">
                      <td className="px-3 py-2">{detail.stats.g}</td>
                      <td className="px-3 py-2">{detail.stats.pa}</td>
                      <td className="px-3 py-2 text-amber-300">{detail.stats.hr}</td>
                      <td className="px-3 py-2 text-amber-300">{detail.stats.ops.toFixed(3)}</td>
                      <td className="px-3 py-2">{detail.stats.ip.toFixed(1)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <div className="mb-2 text-sm font-black uppercase tracking-wide text-white/55">Career History (MLB)</div>
              <div className="rounded-xl border border-white/10 bg-[#0f1424] p-4 text-sm text-white/70">
                Planned for development in V2.
              </div>
            </section>

            {twoWay && (
              <section>
                <div className="mb-2 text-sm font-black uppercase tracking-wide text-white/55">Two-Way Player Profile</div>
                <div className="rounded-2xl border border-white/10 bg-[#10162a] p-4 text-sm text-white/85">
                  <div className="font-semibold text-white">
                    This player has both hitter and pitcher positions: {detail.positions.join(", ")}
                  </div>
                  <div className="mt-2 text-white/75">
                    Pitching workload (IP): {detail.stats.ip.toFixed(1)}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
