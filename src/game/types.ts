import { Complex } from "../quantum/complex";
import { GateType } from "../quantum/gates";

/* ---------- Raw JSON shapes ---------- */

export interface GateEntryData {
  /** A gate type, or an alias such as "CX" for CNOT. */
  type: GateType | "CX";
  /** Overrides the default cost from gates.json. */
  cost?: number;
  /** Phase angle for P gates, e.g. "pi/8". */
  angle?: string | number;
}

/** A single enemy qubit. */
export interface SingleEnemyData {
  /** [alpha, beta] as expressions, e.g. ["1/sqrt2", "-i/sqrt2"]. */
  amplitudes: [string, string];
  lane: number;
  /** Ticks until the qubit enters the grid. */
  time: number;
}

/** Several enemy qubits that arrive entangled, one per lane, side by side. */
export interface EntangledEnemyData {
  /** One qubit in each of these lanes, e.g. [0, 1]. */
  lanes: number[];
  /**
   * 2^lanes.length amplitudes in ket-label order, where the first listed lane is the
   * leftmost digit: for lanes [0, 1] that's [|00⟩, |01⟩, |10⟩, |11⟩].
   */
  amplitudes: string[];
  time: number;
}

export type EnemyData = SingleEnemyData | EntangledEnemyData;

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

export type Amps = [string, string];

/**
 * A Bloch sphere illustration attached to a dialogue page or encyclopedia entry.
 * - `gate` or `gates` (+ optional `from` / `joint`): animates the gate(s) acting on the input qubit(s).
 * - `tour`: glides between the listed states.
 */
export interface BlochSpec {
  gate?: GateType;
  /** Several single-qubit gates in a row, e.g. ["T", "T"]. */
  gates?: GateType[];
  /** P gate angle, e.g. "pi/8". */
  angle?: string;
  /** Input state(s): one [α, β] per qubit. Defaults to |0⟩ (and |+⟩|0⟩ for two-qubit gates). */
  from?: Amps | Amps[];
  /**
   * Two-qubit gates only: an entangled starting state of 2, 3… qubits in ket order,
   * e.g. [|00⟩, |01⟩, |10⟩, |11⟩] or 8 amplitudes for three qubits. One sphere per qubit.
   */
  joint?: string[];
  /** Two-qubit gates only: [control, target] qubit indices within `joint` (default [0, 1]). */
  on?: [number, number];
  tour?: Amps[];
  caption?: string;
}

export interface ContentEntry {
  level: number;
  /** "start", "end", or an in-game trigger: "place:<GATE>", "apply:<GATE>", "damage", "entangle", "disentangle". */
  when: string;
  text: string;
  /** Optional Bloch sphere illustration shown with this page. */
  bloch?: BlochSpec;
}

/** One page of dialogue. */
export type DialoguePage = Pick<ContentEntry, "text" | "bloch">;

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
}

/** Qubits whose starting state is given together (size 1 for ordinary enemies). */
export interface EnemyGroup {
  qubits: number[];
  amps: Complex[];
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
  /** Starting state, as a product of these groups. */
  groups: EnemyGroup[];
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
  /** CNOT/CY only: control on the bottom lane instead of the top. */
  flipped: boolean;
}

export interface EncyclopediaEntry {
  id: string;
  term: string;
  category: string;
  /** Level that introduces the term; null = not in the game yet. */
  level: number | null;
  text: string;
  wiki: string;
  bloch?: BlochSpec;
}

export interface SaveData {
  unlocked: number[];
  completed: number[];
  starred: number[];
  /** Encyclopedia entries the player has unlocked. */
  discovered: string[];
  /** Discovered entries the player has opened (the rest show as "new"). */
  seen: string[];
}
