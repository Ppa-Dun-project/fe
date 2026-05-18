import { useCallback, useEffect, useMemo, useState } from "react";
import { apiPost } from "../../../lib/api";
import type { DraftPlayer } from "../../../types/draft";
import { formatPpa } from "../../../utils/playerValue";

type Props = {
  open: boolean;
  playerA: DraftPlayer | null;
  playerB: DraftPlayer | null;
  onClose: () => void;
};

type MetricDef = {
  key: string;
  label: string;
  getValue: (player: DraftPlayer) => number | null;
  formatValue: (value: number | null) => string;
  deltaDigits: number;
  lowerIsBetter?: boolean;
  comparable?: boolean;
};

type Trend = "up" | "down" | "equal" | "na";

const BATTER_METRICS: MetricDef[] = [
  {
    key: "avg",
    label: "AVG",
    getValue: (player) => player.avg,
    formatValue: (value) => {
      if (value === null) return "-";
      const text = value.toFixed(3);
      return text.startsWith("0") ? text.slice(1) : text;
    },
    deltaDigits: 3,
  },
  {
    key: "hr",
    label: "HR",
    getValue: (player) => player.hr,
    formatValue: (value) => (value === null ? "-" : String(value)),
    deltaDigits: 0,
  },
  {
    key: "rbi",
    label: "RBI",
    getValue: (player) => player.rbi,
    formatValue: (value) => (value === null ? "-" : String(value)),
    deltaDigits: 0,
  },
  {
    key: "sb",
    label: "SB",
    getValue: (player) => player.sb,
    formatValue: (value) => (value === null ? "-" : String(value)),
    deltaDigits: 0,
  },
];

const PITCHER_METRICS: MetricDef[] = [
  {
    key: "era",
    label: "ERA",
    getValue: (player) => player.era ?? null,
    formatValue: (value) => (value === null ? "-" : value.toFixed(2)),
    deltaDigits: 2,
    lowerIsBetter: true,
  },
  {
    key: "whip",
    label: "WHIP",
    getValue: (player) => player.whip ?? null,
    formatValue: (value) => (value === null ? "-" : value.toFixed(3)),
    deltaDigits: 3,
    lowerIsBetter: true,
  },
  {
    key: "ip",
    label: "IP",
    getValue: (player) => player.ip ?? null,
    formatValue: (value) => (value === null ? "-" : value.toFixed(1)),
    deltaDigits: 1,
  },
  {
    key: "so",
    label: "SO",
    getValue: (player) => player.so ?? null,
    formatValue: (value) => (value === null ? "-" : String(value)),
    deltaDigits: 0,
  },
  {
    key: "sv",
    label: "SV",
    getValue: (player) => player.sv ?? null,
    formatValue: (value) => (value === null ? "-" : String(value)),
    deltaDigits: 0,
  },
];

const VALUE_METRICS: MetricDef[] = [
  {
    key: "ppa",
    label: "PPA-DUN Value",
    getValue: (player) => player.ppaValue ?? null,
    formatValue: (value) => (value === null ? "-" : value.toFixed(1)),
    deltaDigits: 1,
  },
  {
    key: "cost",
    label: "Draft Cost",
    getValue: (player) => player.recommendedBid ?? null,
    formatValue: (value) => (value === null ? "-" : `$${Math.round(value)}`),
    deltaDigits: 0,
  },
];

function isPitcher(player: DraftPlayer) {
  return player.playerType === "pitcher";
}

function metricsFor(playerA: DraftPlayer, playerB: DraftPlayer): MetricDef[] {
  const aPitcher = isPitcher(playerA);
  const bPitcher = isPitcher(playerB);
  if (aPitcher && bPitcher) return [...PITCHER_METRICS, ...VALUE_METRICS];
  if (!aPitcher && !bPitcher) return [...BATTER_METRICS, ...VALUE_METRICS];
  return VALUE_METRICS;
}

function getTrend(value: number | null, opposite: number | null, lowerIsBetter = false): Trend {
  if (value === null || opposite === null) return "na";
  if (value > opposite) return lowerIsBetter ? "down" : "up";
  if (value < opposite) return lowerIsBetter ? "up" : "down";
  return "equal";
}

function formatSignedDelta(value: number | null, opposite: number | null, digits: number) {
  if (value === null || opposite === null) return "N/A";
  const delta = value - opposite;
  if (Math.abs(delta) < Number.EPSILON) return "0";
  const rounded = delta.toFixed(digits);
  return delta > 0 ? `+${rounded}` : rounded;
}

function trendIcon(trend: Trend) {
  switch (trend) {
    case "up":
      return "▲";
    case "down":
      return "▼";
    case "equal":
      return "=";
    default:
      return "•";
  }
}

function trendClass(trend: Trend) {
  switch (trend) {
    case "up":
      return "text-emerald-300";
    case "down":
      return "text-rose-300";
    case "equal":
      return "text-white/60";
    default:
      return "text-white/40";
  }
}

function normalizedWidth(value: number | null, other: number | null) {
  if (value === null) return 0;
  const max = Math.max(Math.abs(value), Math.abs(other ?? 0), 1);
  const ratio = (Math.abs(value) / max) * 100;
  return Math.max(10, ratio);
}

// ppaValue / recommendedBid 가 반드시 유효한 숫자로 존재함을 보장하는 좁힌 타입.
// 인증된 사용자에게만 해당 값이 제공되므로, AI 추천 호출 전에 가드가 필수.
type DraftPlayerWithValues = DraftPlayer & { ppaValue: number; recommendedBid: number };

function valuePerDollar(player: DraftPlayer) {
  const ppa = player.ppaValue;
  const bid = player.recommendedBid;
  if (typeof bid !== "number" || !Number.isFinite(bid) || bid <= 0) return null;
  if (typeof ppa !== "number" || !Number.isFinite(ppa)) return null;
  return ppa / bid;
}

// 타입 프레디케이트 — true 인 경우 호출부에서 player 가 DraftPlayerWithValues 로 좁혀진다.
function hasValidAiInputs(player: DraftPlayer): player is DraftPlayerWithValues {
  const ppa = player.ppaValue;
  const bid = player.recommendedBid;
  return (
    typeof ppa === "number" && Number.isFinite(ppa) && ppa > 0 &&
    typeof bid === "number" && Number.isFinite(bid) && bid > 0
  );
}

type AiRecommendRequest = {
  playerA: {
    name: string;
    playerType: "batter" | "pitcher" | "two_way";
    team: string;
    positions: string[];
    ppaValue: number;
    recommendedBid: number;
    stats: Record<string, number | null>;
  };
  playerB: AiRecommendRequest["playerA"];
};

type AiRecommendResponse = {
  recommendation: string;
};

function toAiPayload(player: DraftPlayerWithValues): AiRecommendRequest["playerA"] {
  const stats: Record<string, number | null> = isPitcher(player)
    ? {
        era: player.era ?? null,
        whip: player.whip ?? null,
        ip: player.ip ?? null,
        so: player.so ?? null,
        sv: player.sv ?? null,
        w: player.w ?? null,
      }
    : {
        avg: player.avg ?? null,
        hr: player.hr ?? null,
        rbi: player.rbi ?? null,
        sb: player.sb ?? null,
      };

  return {
    name: player.name,
    playerType: player.playerType,
    team: player.team,
    positions: player.positions,
    ppaValue: player.ppaValue,
    recommendedBid: player.recommendedBid,
    stats,
  };
}

export default function PlayerComparisonModal({ open, playerA, playerB, onClose }: Props) {
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Valid-input guard for AI call. Derived so UI can show a hint without firing the request.
  const aiInputsValid = useMemo(() => {
    if (!playerA || !playerB) return false;
    if (playerA.id === playerB.id) return false;
    return hasValidAiInputs(playerA) && hasValidAiInputs(playerB);
  }, [playerA, playerB]);

  const fetchRecommendation = useCallback(
    (signal?: AbortSignal) => {
      if (!playerA || !playerB || !aiInputsValid) return;
      // aiInputsValid 는 memo 라서 TS 가 좁혀주지 못함 — 인라인 가드로 재확인해 타입을 좁힘.
      if (!hasValidAiInputs(playerA) || !hasValidAiInputs(playerB)) return;

      setAiLoading(true);
      setAiError(null);
      setRecommendation(null);

      const payload: AiRecommendRequest = {
        playerA: toAiPayload(playerA),
        playerB: toAiPayload(playerB),
      };

      apiPost<AiRecommendResponse, AiRecommendRequest>(
        "/api/compare/ai-recommend",
        payload,
        undefined,
        signal
      )
        .then((data) => {
          if (signal?.aborted) return;
          const text = data?.recommendation?.trim();
          if (!text) {
            setAiError("Empty response from AI service.");
            return;
          }
          setRecommendation(text);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setAiError(err instanceof Error ? err.message : "Failed to fetch recommendation");
        })
        .finally(() => {
          if (!signal?.aborted) setAiLoading(false);
        });
    },
    [playerA, playerB, aiInputsValid]
  );

  // Auto-fetch when modal opens or selected players change; abort previous in-flight.
  // When inputs are invalid, the render guard shows a hint — no need to clear state here.
  useEffect(() => {
    if (!open || !aiInputsValid) return;
    const controller = new AbortController();
    // Defer to microtask so the effect body itself doesn't synchronously setState.
    queueMicrotask(() => {
      if (!controller.signal.aborted) fetchRecommendation(controller.signal);
    });
    return () => controller.abort();
  }, [open, aiInputsValid, fetchRecommendation]);

  const rows = useMemo(() => {
    if (!playerA || !playerB) return [];

    return metricsFor(playerA, playerB).map((metric) => {
      const valueA = metric.getValue(playerA);
      const valueB = metric.getValue(playerB);
      const comparable = metric.comparable ?? true;
      return {
        key: metric.key,
        label: metric.label,
        valueA,
        valueB,
        displayA: metric.formatValue(valueA),
        displayB: metric.formatValue(valueB),
        deltaA: comparable ? formatSignedDelta(valueA, valueB, metric.deltaDigits) : "N/A",
        deltaB: comparable ? formatSignedDelta(valueB, valueA, metric.deltaDigits) : "N/A",
        trendA: comparable ? getTrend(valueA, valueB, metric.lowerIsBetter) : "na",
        trendB: comparable ? getTrend(valueB, valueA, metric.lowerIsBetter) : "na",
        barA: comparable ? normalizedWidth(valueA, valueB) : 100,
        barB: comparable ? normalizedWidth(valueB, valueA) : 100,
      };
    });
  }, [playerA, playerB]);

  const valuePerDollarA = playerA ? valuePerDollar(playerA) : null;
  const valuePerDollarB = playerB ? valuePerDollar(playerB) : null;

  // Determine efficiency winner + percentage difference
  const vpdWinner: "A" | "B" | "tie" | null = (() => {
    if (valuePerDollarA === null || valuePerDollarB === null) return null;
    if (Math.abs(valuePerDollarA - valuePerDollarB) < 1e-6) return "tie";
    return valuePerDollarA > valuePerDollarB ? "A" : "B";
  })();

  const vpdEdgePercent: number | null = (() => {
    if (valuePerDollarA === null || valuePerDollarB === null) return null;
    const winner = Math.max(valuePerDollarA, valuePerDollarB);
    const loser = Math.min(valuePerDollarA, valuePerDollarB);
    if (loser <= 0) return null;
    return ((winner - loser) / loser) * 100;
  })();

  if (!open || !playerA || !playerB) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close player comparison"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative mx-auto mt-5 flex max-h-[92vh] w-[97%] max-w-6xl flex-col overflow-hidden rounded-3xl border border-fuchsia-400/30 bg-gradient-to-b from-[#141933] via-[#0d1224] to-[#080c18] shadow-[0_28px_100px_rgba(4,8,20,0.72)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_12%,rgba(244,63,94,0.14),transparent_36%),radial-gradient(circle_at_85%_16%,rgba(245,158,11,0.12),transparent_38%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,transparent,rgba(255,255,255,0.08),transparent)] [background-size:140px_100%]" />

        <div className="relative flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-5 py-3.5">
          <div>
            <div className="text-xl font-black text-white">Player Comparison</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/5 text-sm font-black text-white/70 transition hover:bg-white/10"
          >
            X
          </button>
        </div>

        <div className="relative flex-1 space-y-5 overflow-y-auto p-5 [scrollbar-color:rgba(255,255,255,0.15)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb:hover]:bg-white/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-track]:bg-transparent">
          <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
            <div
              className={[
                "relative rounded-2xl border bg-gradient-to-r from-rose-700/95 to-red-800/95 px-4 py-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition",
                vpdWinner === "A"
                  ? "border-emerald-300/70 shadow-[0_0_28px_rgba(16,185,129,0.35)] ring-2 ring-emerald-300/40"
                  : "border-rose-300/25",
              ].join(" ")}
            >
              {vpdWinner === "A" && (
                <span className="absolute -top-2 left-3 rounded-full bg-emerald-400/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-950 shadow">
                  Top Value
                </span>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-2xl font-black">{playerA.name}</div>
                  <div className="mt-1 text-sm font-semibold text-rose-100">
                    {playerA.team} - {playerA.positions.join("/")}
                  </div>
                  <div className="mt-2 text-sm font-bold text-emerald-300">Draft Cost ${playerA.recommendedBid ?? "—"}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/60">PPA-DUN</div>
                  <div className="text-3xl font-black tabular-nums text-emerald-300">
                    {formatPpa(playerA.ppaValue)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border-2 border-white/30 bg-[#131a2b] text-base font-black text-white/80">
              VS
            </div>

            <div
              className={[
                "relative rounded-2xl border bg-gradient-to-r from-sky-700/95 to-blue-800/95 px-4 py-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition",
                vpdWinner === "B"
                  ? "border-emerald-300/70 shadow-[0_0_28px_rgba(16,185,129,0.35)] ring-2 ring-emerald-300/40"
                  : "border-sky-300/30",
              ].join(" ")}
            >
              {vpdWinner === "B" && (
                <span className="absolute -top-2 left-3 rounded-full bg-emerald-400/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-950 shadow">
                  Top Value
                </span>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-2xl font-black">{playerB.name}</div>
                  <div className="mt-1 text-sm font-semibold text-sky-100">
                    {playerB.team} - {playerB.positions.join("/")}
                  </div>
                  <div className="mt-2 text-sm font-bold text-emerald-300">Draft Cost ${playerB.recommendedBid ?? "—"}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/60">PPA-DUN</div>
                  <div className="text-3xl font-black tabular-nums text-emerald-300">
                    {formatPpa(playerB.ppaValue)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* HIGHLIGHT: AI Recommendation — primary decision-support block */}
          <section className="relative overflow-hidden rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-900/40 via-[#0a2a1f] to-[#061812] p-5 shadow-[0_0_40px_rgba(16,185,129,0.18)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.18),transparent_60%)]" />

            <div className="relative flex items-center justify-between gap-3">
              <div className="text-base font-black uppercase tracking-[0.2em] text-emerald-200">
                AI Recommendation
              </div>
              {recommendation && !aiLoading && !aiError && (
                <button
                  type="button"
                  onClick={() => fetchRecommendation()}
                  className="rounded-full border border-emerald-300/40 bg-emerald-500/15 px-3 py-1 text-[11px] font-black text-emerald-100 transition hover:bg-emerald-500/25"
                >
                  Regenerate
                </button>
              )}
            </div>

            <div className="relative mt-4 rounded-xl border border-emerald-400/25 bg-black/25 p-4 text-sm text-white/90">
              {!aiInputsValid ? (
                <div className="flex items-center gap-2 text-white/75">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-400/20 text-[11px] font-black text-amber-200">!</span>
                  Missing PPA value or draft cost — cannot analyze this matchup.
                </div>
              ) : aiLoading ? (
                <div className="flex items-center gap-2 text-emerald-100">
                  <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-300" />
                  <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-300 [animation-delay:150ms]" />
                  <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-300 [animation-delay:300ms]" />
                  <span className="ml-1 text-xs font-bold text-emerald-100/80">Analyzing matchup...</span>
                </div>
              ) : aiError ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-rose-200">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-rose-400/20 text-[11px] font-black text-rose-200">X</span>
                    <span className="font-bold">Couldn&apos;t generate recommendation.</span>
                  </div>
                  <div className="text-xs text-white/55">{aiError}</div>
                  <button
                    type="button"
                    onClick={() => fetchRecommendation()}
                    className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-100 transition hover:bg-emerald-500/25"
                  >
                    Retry
                  </button>
                </div>
              ) : recommendation ? (
                (() => {
                  const split = recommendation.match(/^(.+?[.!?])(\s+)([\s\S]*)$/);
                  const first = split ? split[1] : recommendation;
                  const rest = split ? split[3] : "";
                  return (
                    <div className="whitespace-pre-line leading-relaxed">
                      <span className="font-black text-white">{first}</span>
                      {rest ? <span className="text-white/85"> {rest}</span> : null}
                    </div>
                  );
                })()
              ) : (
                <div className="text-white/55">Preparing analysis...</div>
              )}
            </div>

            {vpdEdgePercent !== null && vpdWinner !== "tie" && (
              <div className="relative mt-3 text-xs font-semibold text-emerald-200/80">
                {vpdWinner === "A" ? playerA.name : playerB.name} offers{" "}
                <span className="font-black text-emerald-100">+{vpdEdgePercent.toFixed(1)}%</span> better
                value per dollar.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0d1223] to-[#090d19] p-4">
            <div className="mb-3 grid grid-cols-[minmax(0,1fr)_360px_minmax(0,1fr)] gap-4 text-xs font-black uppercase tracking-wide text-white/45">
              <div className="text-left">{playerA.name}</div>
              <div className="text-center text-sm font-black tracking-[0.2em] text-white/90">STAT</div>
              <div className="text-right">{playerB.name}</div>
            </div>

            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_360px_minmax(0,1fr)] items-center gap-4">
                  <div>
                    <div className="mb-1 text-left text-xs font-black text-white">{row.displayA}</div>
                    <div className="h-3 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-500 to-red-400"
                        style={{ width: `${row.barA}%` }}
                      />
                    </div>
                  </div>

                  <div className="min-w-[360px] text-xs font-black">
                    <div className="grid grid-cols-[92px_1fr_92px] items-center gap-3">
                      <span className={`${trendClass(row.trendA)} text-right tabular-nums`}>
                        {row.deltaA} {trendIcon(row.trendA)}
                      </span>
                      <span className="text-center text-sm font-black uppercase tracking-[0.15em] text-white">
                        {row.label}
                      </span>
                      <span className={`${trendClass(row.trendB)} text-left tabular-nums`}>
                        {trendIcon(row.trendB)} {row.deltaB}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-right text-xs font-black text-white">{row.displayB}</div>
                    <div className="h-3 rounded-full bg-white/10">
                      <div
                        className="ml-auto h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-400"
                        style={{ width: `${row.barB}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0d1223] to-[#090d19] p-5">
            <div className="mb-4 text-sm font-black uppercase tracking-[0.15em] text-white">
              Position Flexibility
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-rose-300/20 bg-rose-500/[0.06] p-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="truncate text-sm font-black text-rose-200">{playerA.name}</span>
                  <span className="shrink-0 text-xs font-bold text-white/55">
                    <span className="text-base font-black text-rose-100">{playerA.positions.length}</span> slot
                    {playerA.positions.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {playerA.positions.map((pos) => (
                    <span
                      key={`a-${pos}`}
                      className="rounded-md border border-rose-300/40 bg-rose-500/20 px-2.5 py-1 text-sm font-black text-rose-50"
                    >
                      {pos}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-sky-300/20 bg-sky-500/[0.06] p-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="truncate text-sm font-black text-sky-200">{playerB.name}</span>
                  <span className="shrink-0 text-xs font-bold text-white/55">
                    <span className="text-base font-black text-sky-100">{playerB.positions.length}</span> slot
                    {playerB.positions.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {playerB.positions.map((pos) => (
                    <span
                      key={`b-${pos}`}
                      className="rounded-md border border-sky-300/40 bg-sky-500/20 px-2.5 py-1 text-sm font-black text-sky-50"
                    >
                      {pos}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
