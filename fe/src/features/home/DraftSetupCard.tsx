import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/LOGO.png";
import { isAuthed } from "../../lib/auth";
import {
  DEFAULT_ROSTER_SLOTS,
  sumRosterSlots,
} from "../draft/utils";
import type { RosterSlotCounts, RosterSlotPosition } from "../../types/draft";

export type LeagueType = "AL" | "NL" | "custom";

// When reused inside a modal, override the behavior via onSubmit.
// (Default behavior when omitted: save to sessionStorage and navigate to /draft.)
// If embedded=true, renders only the form contents without the card wrapper (section, border, padding).
export type DraftSetupConfig = {
  myTeamName: string;
  opponentsCount: number;
  oppTeamNames: string[];
  leagueType: LeagueType;
  budget: number;
  rosterPlayers: number;
  rosterSlots: RosterSlotCounts;
  // Reference season for keeper rollover. Used in calculations together with each pick's contractCode/signedSeason.
  targetSeason: number;
};
type Props = {
  onSubmit?: (config: DraftSetupConfig) => void;
  embedded?: boolean;
};

const INPUT_CLASS =
  "mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition hover:border-white/30 focus:border-white/40 focus-visible:ring-2 focus-visible:ring-white/20 placeholder:text-white/40";

const INPUT_CLASS_COMPACT =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition hover:border-white/30 focus:border-white/40 focus-visible:ring-2 focus-visible:ring-white/20";

function pill(active: boolean) {
  return [
    "flex-1 rounded-2xl border px-3 py-3 text-left transition",
    active ? "border-white/30 bg-white/10" : "border-white/10 bg-black/30 hover:bg-white/5",
  ].join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseIntOr0(s: string): number {
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? 0 : n;
}

function selectAllOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  const target = e.currentTarget;
  requestAnimationFrame(() => target.select());
}

const OPPONENTS_MAX = 12;
const BUDGET_MIN = 1;
const SLOT_MIN = 0;
const SLOT_MAX = 10;
const SEASON_MIN = 2020;
const SEASON_MAX = 2100;

const POSITION_ORDER: RosterSlotPosition[] = [
  "C", "1B", "2B", "3B", "SS", "OF", "UTIL", "SP", "RP", "BENCH",
];

// AL / NL is fixed at the standard 16 slots (the user can only redistribute within those 16).
// Custom is fully flexible — only needs at least 1 player to be valid.
const TARGET_ROSTER_SIZE = sumRosterSlots(DEFAULT_ROSTER_SLOTS); // = 16
const MIN_ROSTER_SIZE = 1;

const POSITION_LABEL: Record<RosterSlotPosition, string> = {
  C: "C",
  "1B": "1B",
  "2B": "2B",
  "3B": "3B",
  SS: "SS",
  OF: "OF",
  UTIL: "UTIL",
  SP: "SP",
  RP: "RP",
  BENCH: "BENCH",
};

export default function DraftSetupCard({ onSubmit, embedded = false }: Props = {}) {
  const navigate = useNavigate();
  const authed = isAuthed();

  const [myTeam, setMyTeam] = useState<string>("");
  const [opponentsCountStr, setOpponentsCountStr] = useState<string>("11");
  const [oppTeamNames, setOppTeamNames] = useState<string[]>(
    Array.from({ length: 11 }, () => "")
  );
  const [leagueType, setLeagueType] = useState<LeagueType>("AL");
  const [budgetStr, setBudgetStr] = useState<string>("260");
  const [rosterSlots, setRosterSlots] = useState<RosterSlotCounts>(DEFAULT_ROSTER_SLOTS);
  // Default is the current year + 1. The most common scenario when setting up a new keeper draft after May is to target the next season.
  const [targetSeasonStr, setTargetSeasonStr] = useState<string>(
    String(new Date().getFullYear() + 1)
  );

  // Derived numbers
  const opponentsCount = clamp(parseIntOr0(opponentsCountStr), 0, OPPONENTS_MAX);
  const budget = Math.max(BUDGET_MIN, parseIntOr0(budgetStr));
  const rosterPlayers = useMemo(() => sumRosterSlots(rosterSlots), [rosterSlots]);
  const targetSeason = clamp(parseIntOr0(targetSeasonStr), SEASON_MIN, SEASON_MAX);

  const syncOppTeamNames = (count: number) => {
    setOppTeamNames((prev) => {
      if (count === prev.length) return prev;
      if (count < prev.length) return prev.slice(0, count);
      return [...prev, ...Array<string>(count - prev.length).fill("")];
    });
  };

  const updateOpponentsCount = (str: string) => {
    setOpponentsCountStr(str);
    const c = clamp(parseIntOr0(str), 0, OPPONENTS_MAX);
    syncOppTeamNames(c);
  };

  const updateOppTeamName = (index: number, value: string) => {
    setOppTeamNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const adjustSlot = (pos: RosterSlotPosition, delta: number) => {
    setRosterSlots((prev) => ({
      ...prev,
      [pos]: clamp((prev[pos] ?? 0) + delta, SLOT_MIN, SLOT_MAX),
    }));
  };

  // Per-league validation:
  //   AL / NL → total must equal exactly TARGET_ROSTER_SIZE (16)
  //   custom  → total must be ≥ MIN_ROSTER_SIZE (1)
  const isCustomLeague = leagueType === "custom";
  const rosterDelta = rosterPlayers - TARGET_ROSTER_SIZE;
  const canStart = isCustomLeague
    ? rosterPlayers >= MIN_ROSTER_SIZE
    : rosterDelta === 0;

  const resetRosterSlots = () => setRosterSlots(DEFAULT_ROSTER_SLOTS);

  const onStartDraft = () => {
    if (!canStart) return;
    const config: DraftSetupConfig = {
      myTeamName: myTeam.trim() || "My Team",
      opponentsCount,
      oppTeamNames: oppTeamNames.map((name, i) => name.trim() || `Opponent ${i + 1}`),
      leagueType,
      budget,
      rosterPlayers,
      rosterSlots,
      targetSeason,
    };

    if (onSubmit) {
      onSubmit(config);
      return;
    }

    sessionStorage.setItem(
      "ppadun_unsaved_draft",
      JSON.stringify({ config, picks: [] })
    );
    navigate("/draft");
  };

  const body = (
    <>
      <div className="flex items-center justify-center gap-3">
        <div className="h-12 w-12 overflow-hidden rounded-2xl">
          <img src={logo} alt="Logo" className="h-full w-full object-cover" />
        </div>
        <div className="text-left">
          <div className="text-base font-black leading-tight text-white">Draft Setup</div>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="text-xs font-extrabold text-white/70">My team name</label>
          <input
            value={myTeam}
            onChange={(e) => setMyTeam(e.target.value)}
            placeholder="e.g., Black Sluggers"
            maxLength={20}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <div className="text-xs font-extrabold text-white/70">League</div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className={pill(leagueType === "AL")}
              onClick={() => setLeagueType("AL")}
            >
              <div className="text-sm font-black text-white">AL</div>
              <div className="mt-1 text-xs text-white/60">American League only</div>
            </button>

            <button
              type="button"
              className={pill(leagueType === "NL")}
              onClick={() => setLeagueType("NL")}
            >
              <div className="text-sm font-black text-white">NL</div>
              <div className="mt-1 text-xs text-white/60">National League only</div>
            </button>

            <button
              type="button"
              className={pill(leagueType === "custom")}
              onClick={() => setLeagueType("custom")}
            >
              <div className="text-sm font-black text-white">AL+NL</div>
              <div className="mt-1 text-xs text-white/60">Both leagues</div>
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-extrabold text-white/70">
            Target season{" "}
            <span className="text-white/40">(keeper rollover anchor)</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={SEASON_MIN}
            max={SEASON_MAX}
            value={targetSeasonStr}
            onFocus={selectAllOnFocus}
            onChange={(e) => setTargetSeasonStr(e.target.value)}
            className={`${INPUT_CLASS} no-spinner`}
          />
        </div>

        <div>
          <label className="text-xs font-extrabold text-white/70">
            Participants (opponents) <span className="text-white/40">(max {OPPONENTS_MAX})</span>
          </label>

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateOpponentsCount(String(clamp(opponentsCount - 1, 0, OPPONENTS_MAX)))}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/30 text-white/80 hover:bg-white/5"
              aria-label="Decrease opponents"
            >
              -
            </button>

            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={OPPONENTS_MAX}
              value={opponentsCountStr}
              onFocus={selectAllOnFocus}
              onChange={(e) => updateOpponentsCount(e.target.value)}
              className={`${INPUT_CLASS} mt-0 no-spinner`}
            />

            <button
              type="button"
              onClick={() => updateOpponentsCount(String(clamp(opponentsCount + 1, 0, OPPONENTS_MAX)))}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/30 text-white/80 hover:bg-white/5"
              aria-label="Increase opponents"
            >
              +
            </button>
          </div>

          {opponentsCount > 0 && (
            <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs font-extrabold text-white/70">Opponent names</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {oppTeamNames.map((name, i) => (
                  <input
                    key={i}
                    value={name}
                    onChange={(e) => updateOppTeamName(i, e.target.value)}
                    placeholder={`Opponent ${i + 1}`}
                    maxLength={20}
                    className={INPUT_CLASS_COMPACT}
                  />
                ))}
              </div>
              <div className="text-[11px] text-white/45">Blank entries will use default names (e.g., &ldquo;Opponent 1&rdquo;).</div>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-extrabold text-white/70">Budget ($)</label>
          <input
            type="number"
            inputMode="numeric"
            min={BUDGET_MIN}
            value={budgetStr}
            onFocus={selectAllOnFocus}
            onChange={(e) => setBudgetStr(e.target.value)}
            className={`${INPUT_CLASS} no-spinner`}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-extrabold text-white/70">Roster slots by position</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetRosterSlots}
                className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[11px] font-black text-white/75 transition hover:bg-white/10"
                title="Reset roster slots to the default 16-player layout"
              >
                Reset
              </button>
              <div className="text-xs font-black">
                <span className="text-white/70">Total: </span>
                <span className={canStart ? "text-emerald-300" : "text-rose-300"}>
                  {rosterPlayers}
                </span>
                {isCustomLeague ? (
                  <span className="text-white/40">{rosterPlayers === 1 ? " player" : " players"}</span>
                ) : (
                  <span className="text-white/40"> / {TARGET_ROSTER_SIZE}</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {POSITION_ORDER.map((pos) => (
              <div
                key={pos}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2"
              >
                <div className="text-xs font-black text-white/80">{POSITION_LABEL[pos]}</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => adjustSlot(pos, -1)}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/30 text-white/80 hover:bg-white/5"
                    aria-label={`Decrease ${pos}`}
                  >
                    -
                  </button>
                  <div className="min-w-6 text-center text-sm font-black text-white">
                    {rosterSlots[pos]}
                  </div>
                  <button
                    type="button"
                    onClick={() => adjustSlot(pos, 1)}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/30 text-white/80 hover:bg-white/5"
                    aria-label={`Increase ${pos}`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onStartDraft}
          disabled={!canStart}
          className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-black transition hover:-translate-y-px hover:bg-white/90 active:translate-y-0 disabled:cursor-not-allowed disabled:bg-white/30 disabled:hover:translate-y-0"
        >
          Start Draft
        </button>

        {!canStart && (
          <div className="text-center text-xs text-rose-300">
            {isCustomLeague
              ? "Add at least one roster slot to start the draft."
              : rosterDelta < 0
                ? `Add ${-rosterDelta} more roster slot${-rosterDelta === 1 ? "" : "s"} to reach ${TARGET_ROSTER_SIZE} players.`
                : `Remove ${rosterDelta} roster slot${rosterDelta === 1 ? "" : "s"} to fit ${TARGET_ROSTER_SIZE} players.`}
          </div>
        )}

        {!authed && (
          <div className="text-center text-xs text-white/50">
            Guests can enter the draft board. Sign in to save, compare, and make picks.
          </div>
        )}
      </div>
    </>
  );

  if (embedded) return body;
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      {body}
    </section>
  );
}
