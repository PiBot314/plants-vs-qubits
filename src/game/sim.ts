import { StateVector } from "../quantum/state";
import { binaryTarget, unaryMatrix, BinaryGateType, UnaryGateType } from "../quantum/gates";
import { Level, Placement } from "./types";

export type SimEvent =
  | { kind: "gate"; placementId: number; qubits: number[] }
  | { kind: "exit"; qubit: number; p0: number; damage: number };

export type Outcome = "running" | "won" | "lost";

export const START_HP = 100;
const HP_EPS = 1e-6;

/**
 * Deterministic tick engine. Qubit k sits in cell `columns + time_k - tick`
 * (cells >= columns are the queue off the right edge). Each tick every qubit
 * moves one cell left, crossing vertical line `cell` on the way; gates on that
 * line fire. Crossing line 0 means the qubit leaves the board and deals
 * P(0) x 100 damage. Measurement does not collapse the state.
 */
export class Simulation {
  readonly state: StateVector;
  tick = 0;
  hp = START_HP;
  readonly exited: boolean[];

  constructor(
    readonly level: Level,
    readonly placements: Placement[],
  ) {
    this.state = StateVector.fromGroups(level.enemies.length, level.groups);
    this.exited = level.enemies.map(() => false);
  }

  cell(k: number): number {
    return this.level.columns + this.level.enemies[k].time - this.tick;
  }

  get outcome(): Outcome {
    if (this.hp <= HP_EPS) return "lost";
    return this.exited.every(Boolean) ? "won" : "running";
  }

  /** Advance one tick; returns what happened. */
  step(): SimEvent[] {
    if (this.outcome !== "running") return [];
    const events: SimEvent[] = [];
    const { enemies, gates } = this.level;

    // Qubits crossing each (lane, line) this tick.
    const crossing = new Map<string, number>();
    enemies.forEach((e, k) => {
      if (!this.exited[k]) crossing.set(`${e.lane}:${this.cell(k)}`, k);
    });

    for (const p of this.placements) {
      const g = gates[p.option];
      if (g.binary) {
        const top = crossing.get(`${p.lane}:${p.x}`);
        const bottom = crossing.get(`${p.lane + 1}:${p.x}`);
        if (top === undefined || bottom === undefined) continue;
        const [ctrl, tgt] = p.flipped ? [bottom, top] : [top, bottom];
        this.state.applyControlled(ctrl, tgt, binaryTarget(g.type as BinaryGateType));
        events.push({ kind: "gate", placementId: p.id, qubits: [top, bottom] });
      } else {
        const k = crossing.get(`${p.lane}:${p.x}`);
        if (k === undefined) continue;
        this.state.apply1(k, unaryMatrix(g.type as UnaryGateType, g.angle));
        events.push({ kind: "gate", placementId: p.id, qubits: [k] });
      }
    }

    this.tick++;

    enemies.forEach((_, k) => {
      if (this.exited[k] || this.cell(k) >= 0) return;
      this.exited[k] = true;
      const p0 = Math.min(1, Math.max(0, this.state.marginalP0(k)));
      const damage = p0 * 100;
      this.hp = Math.max(0, this.hp - damage);
      events.push({ kind: "exit", qubit: k, p0, damage });
    });
    if (this.hp <= HP_EPS) this.hp = 0;

    return events;
  }

  /** Run to completion (used by tests / solvers). */
  runToEnd(maxTicks = 10_000): Outcome {
    while (this.outcome === "running" && this.tick < maxTicks) this.step();
    return this.outcome;
  }
}

/** A win earns a star when it costs no more than the level's optimal solution. */
export function earnsStar(level: Level, spent: number, outcome: Outcome): boolean {
  return outcome === "won" && spent <= level.optimalCost;
}
