import { describe, expect, it } from "vitest";
import { Board } from "../src/game/board";
import { EntanglementTracker, QUBIT_PURPLE } from "../src/game/entangle";
import { LEVELS, resolveLevel } from "../src/game/level";
import { earnsStar, Simulation } from "../src/game/sim";
import { LevelData } from "../src/game/types";

const level1 = LEVELS.find((l) => l.id === 1)!;

function play(board: Board) {
  const sim = new Simulation(board.level, board.placements);
  const outcome = sim.runToEnd();
  return { sim, outcome, star: earnsStar(board.level, board.spent, outcome) };
}

const opt = (b: Board, type: string) => b.level.gates.findIndex((g) => g.type === type);

describe("level 1", () => {
  it("fails with no gates", () => {
    const { outcome, sim } = play(new Board(level1));
    expect(outcome).toBe("lost");
    expect(sim.hp).toBe(0);
  });

  it("X wins with a star", () => {
    const b = new Board(level1);
    expect(b.place(opt(b, "X"), 0, 2)).not.toBeTypeOf("string");
    const { outcome, sim, star } = play(b);
    expect(outcome).toBe("won");
    expect(sim.hp).toBeCloseTo(100);
    expect(star).toBe(true);
  });

  it("H Z H wins without a star", () => {
    const b = new Board(level1);
    b.place(opt(b, "H"), 0, 3);
    b.place(opt(b, "Z"), 0, 2);
    b.place(opt(b, "H"), 0, 1);
    expect(b.coins).toBe(0);
    const { outcome, star } = play(b);
    expect(outcome).toBe("won");
    expect(star).toBe(false);
  });

  it("gate order follows movement direction (right to left)", () => {
    // Qubits meet x=3 first. H at 3, then Z at 2, then H at 1 is HZH = X.
    // Placing only H then Z leaves |->: P(0) = 1/2 per qubit, 2 qubits -> dead.
    const b = new Board(level1);
    b.place(opt(b, "H"), 0, 3);
    b.place(opt(b, "Z"), 0, 2);
    const { outcome } = play(b);
    expect(outcome).toBe("lost");
  });
});

describe("Board", () => {
  it("enforces budget, slots and undo", () => {
    const b = new Board(level1);
    const x = opt(b, "X");
    expect(b.place(x, 0, 0)).toBeTypeOf("string");
    b.place(x, 0, 1);
    expect(b.coins).toBe(1);
    expect(b.place(x, 0, 2)).toBe("Not enough coins");
    expect(b.place(opt(b, "H"), 0, 1)).toBe("That spot is taken");
    b.undo();
    expect(b.coins).toBe(3);
    const p = b.place(x, 0, 2);
    if (typeof p === "string") throw new Error(p);
    b.remove(p.id);
    expect(b.coins).toBe(3);
    b.undo();
    expect(b.coins).toBe(1);
  });
});

const twoLane: LevelData = {
  id: 99,
  name: "test",
  lanes: 2,
  columns: 3,
  budget: 99,
  optimalCost: 1,
  gates: [
    { type: "H", cost: 1 },
    { type: "CNOT", cost: 1 },
    { type: "X", cost: 1 },
  ],
  enemies: [
    { amplitudes: ["1", "0"], lane: 0, time: 0 },
    { amplitudes: ["1", "0"], lane: 1, time: 0 },
    { amplitudes: ["1", "0"], lane: 1, time: 1 },
  ],
};

describe("binary gates", () => {
  it("only fire when both lanes cross together, and entangle", () => {
    const level = resolveLevel(twoLane);
    const b = new Board(level);
    b.place(0, 0, 3); // H top lane
    b.place(1, 0, 2); // CNOT corner, control top
    const sim = new Simulation(level, b.placements);
    const tracker = new EntanglementTracker(3);
    let gateHits: number[][] = [];
    while (sim.outcome === "running") {
      for (const e of sim.step()) {
        if (e.kind === "gate" && level.gates[b.placements.find((p) => p.id === e.placementId)!.option].binary) {
          gateHits.push(e.qubits);
          tracker.link(e.qubits[0], e.qubits[1]);
          const colors = tracker.update(sim.state);
          expect(colors.get(0)).toBeDefined();
          expect(colors.get(0)).toBe(colors.get(1));
          expect(colors.get(0)).not.toBe(QUBIT_PURPLE);
          expect(colors.has(2)).toBe(false);
        }
        if (e.kind === "exit" && e.qubit < 2) expect(e.damage).toBeCloseTo(50);
      }
    }
    // Qubit 2 (lane 1, one tick behind) never meets a partner at the corner.
    expect(gateHits).toEqual([[0, 1]]);
    expect(sim.outcome).toBe("lost");
  });

  it("flipped CNOT swaps control and target; disentangled qubits lose their colour", () => {
    const level = resolveLevel({ ...twoLane, enemies: twoLane.enemies.slice(0, 2) });
    const b = new Board(level);
    b.place(2, 1, 3); // X on bottom lane -> bottom = |1>
    const cn = b.place(1, 0, 2);
    if (typeof cn === "string") throw new Error(cn);
    b.flip(cn.id); // control bottom -> flips top
    const { outcome, sim } = play(b);
    expect(outcome).toBe("won");
    const tracker = new EntanglementTracker(2);
    tracker.link(0, 1);
    expect(tracker.update(sim.state).size).toBe(0);
  });
});
