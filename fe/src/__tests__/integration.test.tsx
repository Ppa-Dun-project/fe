// Integration tests — verify that user-interaction flows work correctly with the real component + its children.
// Instead of plain props snapshots, this uses RTL + userEvent to simulate clicks/typing/keystrokes and observe the resulting state changes.
//
//   1. ComparisonPanel             — A/B slot display, X click, Compare button enable condition
//   2. StatPickerStrip             — chip add/remove (preserving slot position), Reset button, "+" disabled when full
//   3. RenameSessionModal          — input + Enter key + Confirm disabled when empty
//   4. OrderedDraftHistoryModal    — render picks in chronological order + empty-state message

import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ComparisonPanel from "../features/draft/components/ComparisonPanel";
import StatPickerStrip from "../features/draft/components/StatPickerStrip";
import RenameSessionModal from "../features/draft/components/RenameSessionModal";
import OrderedDraftHistoryModal from "../features/draft/components/OrderedDraftHistoryModal";

import type { StatSlot } from "../features/draft/useStatColumns";
import type {
  DraftPick,
  DraftPlayer,
  DraftPlayerPublic,
  DraftTeam,
} from "../types/draft";

// Player factory for tests — populate only the fields needed and leave the rest as null/defaults.
function makePlayer(overrides: Partial<DraftPlayerPublic> = {}): DraftPlayer {
  return {
    id: "1",
    name: "Aaron Judge",
    playerType: "batter",
    team: "NYY",
    positions: ["OF"],
    ab: 500, r: 100, h: 150, single: 80, double: 30, triple: 1,
    hr: 50, rbi: 130, bb: 90, k: 150, sb: 8, cs: 2,
    avg: 0.3, obp: 0.4, slg: 0.6,
    w: null, l: null, sv: null, so: null, era: null, whip: null, ip: null,
    g: null, gs: null, war: null, fip: null, er: null, hbp: null, bf: null,
    era_plus: null, h9: null, hr9: null, bb9: null, so9: null, so_bb: null,
    ppaValue: 12.5,
    recommendedBid: 45,
    ...overrides,
  } as DraftPlayer;
}

// ───────────────────────────────────────────────────────────────────────
// 1. ComparisonPanel
// ───────────────────────────────────────────────────────────────────────
describe("ComparisonPanel", () => {
  const baseProps = {
    selectedA: null,
    selectedB: null,
    authed: true,
    onClearA: vi.fn(),
    onClearB: vi.fn(),
    onClearAll: vi.fn(),
    onOpenComparison: vi.fn(),
  };

  it("shows placeholder text and disables the Compare button when nobody is selected", () => {
    render(<ComparisonPanel {...baseProps} />);
    expect(screen.getByText(/Select player A/i)).toBeInTheDocument();
    expect(screen.getByText(/Select player B/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Compare$/i })).toBeDisabled();
  });

  it("enables the Compare button once both A and B are selected", () => {
    render(
      <ComparisonPanel
        {...baseProps}
        selectedA={makePlayer({ id: "1", name: "Aaron Judge" })}
        selectedB={makePlayer({ id: "2", name: "Mookie Betts", team: "LAD" })}
      />,
    );
    expect(screen.getByRole("button", { name: /^Compare$/i })).toBeEnabled();
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("Mookie Betts")).toBeInTheDocument();
  });

  it("calls onClearA / onClearB when the slot's X button is clicked", async () => {
    const onClearA = vi.fn();
    const onClearB = vi.fn();
    render(
      <ComparisonPanel
        {...baseProps}
        selectedA={makePlayer({ id: "1", name: "Aaron Judge" })}
        selectedB={makePlayer({ id: "2", name: "Mookie Betts" })}
        onClearA={onClearA}
        onClearB={onClearB}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Remove player A/i }));
    await user.click(screen.getByRole("button", { name: /Remove player B/i }));
    expect(onClearA).toHaveBeenCalledTimes(1);
    expect(onClearB).toHaveBeenCalledTimes(1);
  });

  it("keeps the Compare button disabled for unauthenticated users even when both A and B are selected", () => {
    render(
      <ComparisonPanel
        {...baseProps}
        authed={false}
        selectedA={makePlayer({ id: "1" })}
        selectedB={makePlayer({ id: "2" })}
      />,
    );
    expect(screen.getByRole("button", { name: /^Compare$/i })).toBeDisabled();
  });
});

// ───────────────────────────────────────────────────────────────────────
// 2. StatPickerStrip
// ───────────────────────────────────────────────────────────────────────
describe("StatPickerStrip", () => {
  it("fixed 5 slots — empty slots render the 'Empty' placeholder and keep their position", () => {
    const cols: StatSlot[] = ["AVG", null, "RBI", null, "SB"];
    render(
      <StatPickerStrip group="batter" cols={cols} onChange={vi.fn()} onReset={vi.fn()} />,
    );
    expect(screen.getAllByText(/Empty/i)).toHaveLength(2);
    expect(screen.getByText("AVG")).toBeInTheDocument();
    expect(screen.getByText("RBI")).toBeInTheDocument();
    expect(screen.getByText("SB")).toBeInTheDocument();
  });

  it("the X button sets only that slot to null and leaves the other slots untouched", async () => {
    const onChange = vi.fn();
    const cols: StatSlot[] = ["AVG", "HR", "RBI", "SB", "AB"];
    render(
      <StatPickerStrip group="batter" cols={cols} onChange={onChange} onReset={vi.fn()} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Remove HR/i }));
    expect(onChange).toHaveBeenCalledWith(["AVG", null, "RBI", "SB", "AB"]);
  });

  it("clicking an available chip fills the first empty slot (no shifting)", async () => {
    const onChange = vi.fn();
    const cols: StatSlot[] = ["AVG", null, "RBI", "SB", "AB"];
    render(
      <StatPickerStrip group="batter" cols={cols} onChange={onChange} onReset={vi.fn()} />,
    );
    const user = userEvent.setup();
    // The "+ HR" button in the available area — its accessible name is "+ HR", so match by title directly.
    await user.click(screen.getByTitle("Add HR"));
    expect(onChange).toHaveBeenCalledWith(["AVG", "HR", "RBI", "SB", "AB"]);
  });

  it("disables every available chip when all 5 slots are full", () => {
    const cols: StatSlot[] = ["AVG", "HR", "RBI", "SB", "AB"];
    render(
      <StatPickerStrip group="batter" cols={cols} onChange={vi.fn()} onReset={vi.fn()} />,
    );
    // Any other key from the batter catalog — AB/AVG/HR/RBI/SB are all selected, so OBP is a candidate.
    // When the strip is full, every available chip's title becomes "Remove one stat first".
    const buttons = screen.getAllByTitle("Remove one stat first");
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((b) => expect(b).toBeDisabled());
  });

  it("invokes the onReset callback when the Reset button is clicked", async () => {
    const onReset = vi.fn();
    render(
      <StatPickerStrip group="batter" cols={["AVG", "HR", "RBI", "SB", "AB"]} onChange={vi.fn()} onReset={onReset} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Reset$/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("switches the catalog by group — the pitcher group exposes ERA / SO, etc.", () => {
    render(
      <StatPickerStrip
        group="pitcher"
        cols={[null, null, null, null, null]}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByTitle("Add ERA")).toBeInTheDocument();
    expect(screen.getByTitle("Add WHIP")).toBeInTheDocument();
  });
});

// ───────────────────────────────────────────────────────────────────────
// 3. RenameSessionModal
// ───────────────────────────────────────────────────────────────────────
describe("RenameSessionModal", () => {
  const baseProps = {
    nameInput: "",
    onChangeName: vi.fn(),
    error: null,
    saving: false,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
  };

  it("disables the Save button when the input is empty", () => {
    render(<RenameSessionModal {...baseProps} nameInput="" />);
    expect(screen.getByRole("button", { name: /^Save$/i })).toBeDisabled();
  });

  it("enables Save once a name is present, and clicking it calls onConfirm", async () => {
    const onConfirm = vi.fn();
    render(<RenameSessionModal {...baseProps} nameInput="2026 AL" onConfirm={onConfirm} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("the Enter key also calls onConfirm (not called when the value is empty)", async () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <RenameSessionModal {...baseProps} nameInput="" onConfirm={onConfirm} />,
    );
    const input = screen.getByPlaceholderText(/Session name/i);
    const user = userEvent.setup();
    await user.type(input, "{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();

    rerender(<RenameSessionModal {...baseProps} nameInput="2026" onConfirm={onConfirm} />);
    await user.type(screen.getByPlaceholderText(/Session name/i), "{Enter}");
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("while saving, the Save button text changes to 'Saving...' and the button is disabled", () => {
    render(<RenameSessionModal {...baseProps} nameInput="x" saving />);
    const btn = screen.getByRole("button", { name: /Saving\.\.\./i });
    expect(btn).toBeDisabled();
  });

  it("renders the error message when the error prop is set", () => {
    render(
      <RenameSessionModal {...baseProps} nameInput="x" error="Name already taken" />,
    );
    expect(screen.getByText(/Name already taken/i)).toBeInTheDocument();
  });

  it("the Cancel button always calls onCancel", async () => {
    const onCancel = vi.fn();
    render(<RenameSessionModal {...baseProps} onCancel={onCancel} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Cancel$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// ───────────────────────────────────────────────────────────────────────
// 4. OrderedDraftHistoryModal
// ───────────────────────────────────────────────────────────────────────
describe("OrderedDraftHistoryModal", () => {
  const teams: DraftTeam[] = [
    { id: "team-0", name: "My Team", isMine: true },
    { id: "team-1", name: "Opp A" },
    { id: "team-2", name: "Opp B" },
  ];

  const pick = (
    over: Partial<DraftPick>,
  ): DraftPick => ({
    playerId: "1",
    draftedByTeamId: "team-0",
    slotIndex: 0,
    slotPos: "OF",
    bid: 30,
    type: "mine",
    kind: "main",
    ...over,
  });

  it("renders the 'No picks yet.' empty-state message when there are no picks", () => {
    render(
      <OrderedDraftHistoryModal
        open
        picks={[]}
        teams={teams}
        playersById={{}}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/No picks yet\./i)).toBeInTheDocument();
  });

  it("renders main picks in chronological order — Pick # goes 1, 2, 3...", () => {
    const picks: DraftPick[] = [
      pick({ playerId: "10", draftedByTeamId: "team-1", bid: 25 }),
      pick({ playerId: "20", draftedByTeamId: "team-0", bid: 50 }),
      pick({ playerId: "30", draftedByTeamId: "team-2", bid: 12 }),
    ];
    const playersById: Record<string, DraftPlayer> = {
      "10": makePlayer({ id: "10", name: "Player Ten", positions: ["1B"], team: "BOS" }),
      "20": makePlayer({ id: "20", name: "Player Twenty", positions: ["OF"], team: "NYY" }),
      "30": makePlayer({ id: "30", name: "Player Thirty", positions: ["SS"], team: "TEX" }),
    };

    render(
      <OrderedDraftHistoryModal
        open
        picks={picks}
        teams={teams}
        playersById={playersById}
        onClose={vi.fn()}
      />,
    );

    const rows = screen.getAllByRole("row").slice(1); // exclude header
    expect(rows).toHaveLength(3);

    // First row: Pick #1 = Player Ten / Opp A / $25
    const firstRow = within(rows[0]);
    expect(firstRow.getByText("1")).toBeInTheDocument();
    expect(firstRow.getByText("Player Ten")).toBeInTheDocument();
    expect(firstRow.getByText("Opp A")).toBeInTheDocument();
    expect(firstRow.getByText("$25")).toBeInTheDocument();

    // Third row: Pick #3
    const thirdRow = within(rows[2]);
    expect(thirdRow.getByText("3")).toBeInTheDocument();
    expect(thirdRow.getByText("Player Thirty")).toBeInTheDocument();
    expect(thirdRow.getByText("Opp B")).toBeInTheDocument();
  });

  it("excludes minor/taxi picks from the main draft history", () => {
    const picks: DraftPick[] = [
      pick({ playerId: "10", kind: "main", bid: 25 }),
      pick({ playerId: "20", kind: "minor", bid: null }),
      pick({ playerId: "30", kind: "taxi", bid: null }),
    ];
    render(
      <OrderedDraftHistoryModal
        open
        picks={picks}
        teams={teams}
        playersById={{
          "10": makePlayer({ id: "10", name: "Main Only" }),
          "20": makePlayer({ id: "20", name: "Minor Pick" }),
          "30": makePlayer({ id: "30", name: "Taxi Pick" }),
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Main Only")).toBeInTheDocument();
    expect(screen.queryByText("Minor Pick")).not.toBeInTheDocument();
    expect(screen.queryByText("Taxi Pick")).not.toBeInTheDocument();
  });
});
