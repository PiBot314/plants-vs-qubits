import { describe, expect, it } from "vitest";
import { Board } from "../src/game/board";
import { getLevel } from "../src/game/level";
import { Simulation } from "../src/game/sim";
import { solve } from "./solver";

/**
 * Answer keys: one optimal solution per level. `x` is the grid line (1 = leftmost
 * interior line, `columns` = entry edge); qubits meet higher x first. For two-qubit
 * gates `lane` is the top lane of the corner.
 */
type Move = { gate: string; lane: number; x: number; flip?: boolean };
const SOLUTIONS: Record<number, Move[]> = {
  1: [{ gate: "X", lane: 0, x: 2 }],
  // Level 2 has no key: its |+⟩ lane can't be fixed without H, which arrives in level 3.
  3: [
    { gate: "Z", lane: 0, x: 5 },
    { gate: "H", lane: 0, x: 4 },
    { gate: "Z", lane: 1, x: 5 },
    { gate: "H", lane: 1, x: 4 },
  ],
  4: [
    { gate: "Z", lane: 0, x: 5 },
    { gate: "H", lane: 0, x: 4 },
    { gate: "H", lane: 1, x: 4 },
    { gate: "Z", lane: 2, x: 5 },
    { gate: "H", lane: 2, x: 4 },
  ],
  5: [
    { gate: "X", lane: 0, x: 4 },
    { gate: "Y", lane: 1, x: 4 },
    { gate: "Z", lane: 2, x: 5 },
    { gate: "H", lane: 2, x: 4 },
    { gate: "H", lane: 3, x: 4 },
  ],
  6: [
    { gate: "S", lane: 0, x: 4 },
    { gate: "H", lane: 0, x: 3 },
    { gate: "Z", lane: 1, x: 4 },
    { gate: "S", lane: 1, x: 3 },
    { gate: "H", lane: 1, x: 2 },
  ],
  7: [
    { gate: "T", lane: 0, x: 4 },
    { gate: "S", lane: 0, x: 3 },
    { gate: "H", lane: 0, x: 2 },
    { gate: "T", lane: 1, x: 4 },
    { gate: "H", lane: 1, x: 3 },
  ],
  8: [
    { gate: "X", lane: 0, x: 3 },
    { gate: "T", lane: 0, x: 2 },
    { gate: "H", lane: 0, x: 1 },
    { gate: "X", lane: 1, x: 3 },
    { gate: "S", lane: 1, x: 2 },
    { gate: "H", lane: 1, x: 1 },
    { gate: "Z", lane: 2, x: 3 },
    { gate: "H", lane: 2, x: 2 },
  ],
  9: [
    { gate: "X", lane: 1, x: 5 },
    { gate: "Z", lane: 0, x: 5 },
    { gate: "CNOT", lane: 0, x: 4 },
    { gate: "H", lane: 0, x: 3 },
  ],
  10: [
    { gate: "X", lane: 0, x: 6 },
    { gate: "Z", lane: 0, x: 5 },
    { gate: "CNOT", lane: 0, x: 4 },
    { gate: "H", lane: 0, x: 3 },
    { gate: "CNOT", lane: 1, x: 6, flip: true },
    { gate: "H", lane: 2, x: 5 },
  ],
  11: [
    { gate: "CZ", lane: 0, x: 5 },
    { gate: "Z", lane: 0, x: 4 },
    { gate: "H", lane: 0, x: 3 },
    { gate: "Z", lane: 1, x: 4 },
    { gate: "H", lane: 1, x: 3 },
  ],
  12: [
    { gate: "X", lane: 0, x: 5 },
    { gate: "CY", lane: 0, x: 4, flip: true },
    { gate: "H", lane: 1, x: 3 },
  ],
  13: [
    { gate: "SWAP", lane: 0, x: 6 },
    { gate: "CNOT", lane: 1, x: 5 },
    { gate: "H", lane: 1, x: 4 },
  ],
};

describe.each(Object.keys(SOLUTIONS).map(Number))("level %i", (id) => {
  const level = getLevel(id)!;

  it("answer key wins with full HP at exactly the optimal cost", () => {
    const board = new Board(level);
    for (const m of SOLUTIONS[id]) {
      const option = level.gates.findIndex((g) => g.type === m.gate);
      expect(option, `gate ${m.gate} not available`).toBeGreaterThanOrEqual(0);
      const p = board.place(option, m.lane, m.x);
      if (typeof p === "string") throw new Error(`${m.gate}@${m.lane},${m.x}: ${p}`);
      if (m.flip) board.flip(p.id);
    }
    expect(board.spent).toBe(level.optimalCost);
    expect(level.budget).toBeGreaterThanOrEqual(level.optimalCost);
    const sim = new Simulation(level, board.placements);
    expect(sim.runToEnd()).toBe("won");
    expect(sim.hp).toBeCloseTo(100, 6);
  });

  it("no cheaper solution survives", () => {
    const r = solve(level);
    expect(r.minWin).toBe(level.optimalCost);
    expect(r.minPerfect).toBe(level.optimalCost);
  });

  it("uses default gate costs", async () => {
    const gates = (await import("../src/data/gates.json")).default as Record<string, { defaultCost: number }>;
    for (const g of level.gates) expect(g.cost).toBe(gates[g.type].defaultCost);
  });
});
