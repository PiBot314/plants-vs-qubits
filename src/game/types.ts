import { Complex } from "../quantum/complex";
import { GateType } from "../quantum/gates";

/* ---------- Raw JSON shapes ---------- */

export interface GateEntryData {
  type: GateType;
  /** Overrides the default cost from gates.json. */
  cost?: number;
  /** Phase angle for P gates, e.g. "pi/8". */
  angle?: string | number;
}

export interface EnemyData {
  /** [alpha, beta] as expressions, e.g. ["1/sqrt2", "-i/sqrt2"]. */
  amplitudes: [string, string];
  lane: number;
  /** Ticks until the qubit enters the grid. */
  time: number;
}

export interface LevelData {
  id: number;
  name: string;
  lanes: number;
  columns: number;
  budget: number;
  optimalCost: number;
  gates: GateEntryData[];
  enemies: EnemyData[];
}

export interface ContentEntry {
  level: number;
  when: "start" | "end";
  text: string;
}

export interface GateInfo {
  name: string;
  defaultCost: number;
  description: string;
}

/* ---------- Resolved runtime shapes ---------- */

export interface GateOption {
  index: number;
  type: GateType;
  cost: number;
  angle: number;
  label: string;
  binary: boolean;
}

export interface Enemy {
  id: number;
  lane: number;
  time: number;
  amps: [Complex, Complex];
}

export interface Level {
  id: number;
  name: string;
  lanes: number;
  columns: number;
  budget: number;
  optimalCost: number;
  gates: GateOption[];
  enemies: Enemy[];
}

/**
 * A gate on the board. Unary gates sit on vertical line `x` inside `lane`.
 * Binary gates sit on the corner where line `x` meets the boundary between
 * `lane` and `lane + 1`.
 */
export interface Placement {
  id: number;
  option: number;
  lane: number;
  x: number;
  /** CNOT only: control on the bottom lane instead of the top. */
  flipped: boolean;
}

export interface SaveData {
  unlocked: number[];
  completed: number[];
  starred: number[];
}
