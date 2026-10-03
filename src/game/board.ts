import { Level, Placement } from "./types";

type Action =
  | { kind: "place"; p: Placement }
  | { kind: "remove"; p: Placement }
  | { kind: "flip"; id: number };

/** The player's gate layout for one level, with cost accounting and undo. */
export class Board {
  placements: Placement[] = [];
  private history: Action[] = [];
  private nextId = 1;

  constructor(readonly level: Level) {}

  get spent(): number {
    return this.placements.reduce((s, p) => s + this.level.gates[p.option].cost, 0);
  }

  get coins(): number {
    return this.level.budget - this.spent;
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  /** Lanes a gate option occupies when placed at `lane`. */
  lanesFor(option: number, lane: number): number[] {
    return this.level.gates[option].binary ? [lane, lane + 1] : [lane];
  }

  /** The placement occupying `lane` on vertical line `x`, if any. */
  occupant(lane: number, x: number): Placement | undefined {
    return this.placements.find((p) => p.x === x && this.lanesFor(p.option, p.lane).includes(lane));
  }

  /** Returns a reason the gate can't go there, or null if it can. */
  checkPlacement(option: number, lane: number, x: number): string | null {
    const g = this.level.gates[option];
    if (!g) return "Unknown gate";
    if (x < 1 || x > this.level.columns) return "Gates go on interior grid lines";
    const lanes = this.lanesFor(option, lane);
    if (lane < 0 || lanes[lanes.length - 1] >= this.level.lanes) return "Out of bounds";
    if (lanes.some((l) => this.occupant(l, x))) return "That spot is taken";
    if (g.cost > this.coins) return "Not enough coins";
    return null;
  }

  place(option: number, lane: number, x: number): Placement | string {
    const err = this.checkPlacement(option, lane, x);
    if (err) return err;
    const p: Placement = { id: this.nextId++, option, lane, x, flipped: false };
    this.placements.push(p);
    this.history.push({ kind: "place", p });
    return p;
  }

  remove(id: number): void {
    const p = this.placements.find((q) => q.id === id);
    if (!p) return;
    this.placements = this.placements.filter((q) => q !== p);
    this.history.push({ kind: "remove", p });
  }

  flip(id: number): void {
    const p = this.placements.find((q) => q.id === id);
    if (!p || this.level.gates[p.option].type !== "CNOT") return;
    p.flipped = !p.flipped;
    this.history.push({ kind: "flip", id });
  }

  undo(): void {
    const a = this.history.pop();
    if (!a) return;
    if (a.kind === "place") this.placements = this.placements.filter((q) => q.id !== a.p.id);
    else if (a.kind === "remove") this.placements.push(a.p);
    else {
      const p = this.placements.find((q) => q.id === a.id);
      if (p) p.flipped = !p.flipped;
    }
  }

  clear(): void {
    this.placements = [];
    this.history = [];
  }
}
