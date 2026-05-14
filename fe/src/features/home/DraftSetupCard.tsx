import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/LOGO.png";
import { isAuthed } from "../../lib/auth";

type LeagueType = "standard" | "lite" | "custom";

// 모달 안에서 재사용할 때 onSubmit 으로 동작을 override 한다.
// (생략 시 기본 동작: localStorage 저장 + /draft?setup=1 로 navigate)
// embedded=true 면 카드 wrapper(section, border, padding) 없이 폼 내용만 그린다.
export type DraftSetupConfig = {
  myTeamName: string;
  opponentsCount: number;
  oppTeamNames: string[];
  leagueType: LeagueType;
  budget: number;
  rosterPlayers: number;
};
type Props = {
  onSubmit?: (config: DraftSetupConfig) => void;
  embedded?: boolean;
};

const presets = {
  standard: { label: "Standard", budget: 260, players: 12, opponents: 11, note: "$260 / 12 players / 12 teams" },
  lite: { label: "Lite", budget: 200, players: 10, opponents: 9, note: "$200 / 10 players / 10 teams" },
  custom: { label: "Custom", budget: 260, players: 12, opponents: 0, note: "Set your own" },
} as const;

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

// Robust select-all on focus: deferred to next frame so mouse click positioning
// doesn't deselect. Works for both tab focus and mouse click.
function selectAllOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  const target = e.currentTarget;
  requestAnimationFrame(() => target.select());
}

const OPPONENTS_MAX = 12;
const ROSTER_MIN = 1;
const ROSTER_MAX = 12;
const BUDGET_MIN = 1;

export default function DraftSetupCard({ onSubmit, embedded = false }: Props = {}) {
  const navigate = useNavigate();
  const authed = isAuthed();

  const [myTeam, setMyTeam] = useState<string>("");
  const [opponentsCountStr, setOpponentsCountStr] = useState<string>("0");
  const [oppTeamNames, setOppTeamNames] = useState<string[]>([]);
  const [leagueType, setLeagueType] = useState<LeagueType>("standard");
  const [customBudgetStr, setCustomBudgetStr] = useState<string>("260");
  const [customPlayersStr, setCustomPlayersStr] = useState<string>("12");

  // Derived, clamped numeric values — single source of truth for downstream logic
  const opponentsCount = clamp(parseIntOr0(opponentsCountStr), 0, OPPONENTS_MAX);
  const customBudget = Math.max(BUDGET_MIN, parseIntOr0(customBudgetStr));
  const customPlayers = clamp(parseIntOr0(customPlayersStr), ROSTER_MIN, ROSTER_MAX);

  const computed = useMemo(() => {
    if (leagueType === "custom") {
      return {
        budget: customBudget,
        players: customPlayers,
        note: `$${customBudget} / ${customPlayers} players`,
      };
    }
    return presets[leagueType];
  }, [leagueType, customBudget, customPlayers]);

  // Sync oppTeamNames array with a given count (keep existing entries, pad/trim)
  const syncOppTeamNames = (count: number) => {
    setOppTeamNames((prev) => {
      if (count === prev.length) return prev;
      if (count < prev.length) return prev.slice(0, count);
      return [...prev, ...Array<string>(count - prev.length).fill("")];
    });
  };

  // Central update: set input string + sync names synchronously so UI stays in lockstep
  const updateOpponentsCount = (str: string) => {
    setOpponentsCountStr(str);
    const c = clamp(parseIntOr0(str), 0, OPPONENTS_MAX);
    syncOppTeamNames(c);
  };

  // In Custom mode, Roster Players drives both roster size and opponent count
  // (matching Standard/Lite pattern where "N players = N teams"). Typing here
  // immediately creates N opponent name boxes.
  const updateCustomPlayers = (str: string) => {
    setCustomPlayersStr(str);
    const p = clamp(parseIntOr0(str), ROSTER_MIN, ROSTER_MAX);
    // X players → X opponents (so user sees X name boxes matching their input)
    updateOpponentsCount(String(p));
  };

  const applyLeagueType = (type: LeagueType) => {
    setLeagueType(type);
    // Custom preserves user's current opponents count; Standard/Lite apply preset
    if (type !== "custom") {
      updateOpponentsCount(String(presets[type].opponents));
    }
  };

  const updateOppTeamName = (index: number, value: string) => {
    setOppTeamNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const onStartDraft = () => {
    const config: DraftSetupConfig = {
      myTeamName: myTeam.trim() || "My Team",
      opponentsCount,
      oppTeamNames: oppTeamNames.map((name, i) => name.trim() || `Opponent ${i + 1}`),
      leagueType,
      budget: computed.budget,
      rosterPlayers: computed.players,
    };

    // 모달 컨텍스트에서는 onSubmit 으로 부모(DraftPage)가 state 를 직접 갱신한다.
    if (onSubmit) {
      onSubmit(config);
      return;
    }

    // 기본 동작: ppadun_unsaved_draft 에 저장하고 /draft 로 이동.
    localStorage.setItem(
      "ppadun_unsaved_draft",
      JSON.stringify({ config, picks: [] })
    );
    navigate("/draft?setup=1");
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
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="text-xs font-extrabold text-white/70">
            Participants (opponents) <span className="text-white/40">(max 12)</span>
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

          <div className="mt-1 text-xs text-white/50">Enter how many opponents you&apos;ll draft with.</div>

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
                    className={INPUT_CLASS_COMPACT}
                  />
                ))}
              </div>
              <div className="text-[11px] text-white/45">Blank entries will use default names (e.g., &ldquo;Opponent 1&rdquo;).</div>
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-extrabold text-white/70">League type</div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className={pill(leagueType === "standard")}
              onClick={() => applyLeagueType("standard")}
            >
              <div className="text-sm font-black text-white">Standard</div>
              <div className="mt-1 text-xs text-white/60">$260 / 12 players / 12 teams</div>
            </button>

            <button
              type="button"
              className={pill(leagueType === "lite")}
              onClick={() => applyLeagueType("lite")}
            >
              <div className="text-sm font-black text-white">Lite</div>
              <div className="mt-1 text-xs text-white/60">$200 / 10 players / 10 teams</div>
            </button>

            <button
              type="button"
              className={pill(leagueType === "custom")}
              onClick={() => applyLeagueType("custom")}
            >
              <div className="text-sm font-black text-white">Custom</div>
              <div className="mt-1 text-xs text-white/60">Set your own</div>
            </button>
          </div>
        </div>

        {leagueType === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs font-bold text-white/70">Budget ($)</div>
              <input
                type="number"
                inputMode="numeric"
                min={BUDGET_MIN}
                value={customBudgetStr}
                onFocus={selectAllOnFocus}
                onChange={(e) => setCustomBudgetStr(e.target.value)}
                className={`${INPUT_CLASS_COMPACT} no-spinner`}
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs font-bold text-white/70">
                Roster players <span className="text-white/40">(max {ROSTER_MAX})</span>
              </div>
              <input
                type="number"
                inputMode="numeric"
                min={ROSTER_MIN}
                max={ROSTER_MAX}
                value={customPlayersStr}
                onFocus={selectAllOnFocus}
                onChange={(e) => updateCustomPlayers(e.target.value)}
                className={`${INPUT_CLASS_COMPACT} no-spinner`}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs font-bold text-white/70">Budget ($)</div>
            <div className="mt-2 text-2xl font-black text-white">{computed.budget}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs font-bold text-white/70">Roster players</div>
            <div className="mt-2 text-2xl font-black text-white">{computed.players}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={onStartDraft}
          className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-black transition hover:translate-y-[-1px] hover:bg-white/90 active:translate-y-0"
        >
          Start Draft
        </button>

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
