import { StateVector } from "../quantum/state";
import { Level } from "./types";

export const QUBIT_PURPLE = "#9b5cff";
export const ENTANGLE_PALETTE = [
  "#3ee6d4", // cyan
  "#ffb347", // amber
  "#9be15d", // lime
  "#ff6fb5", // pink
  "#5ab0ff", // blue
  "#f5e663", // yellow
  "#ff7a59", // coral
  "#e0e0ff", // pale
];

const PURITY_EPS = 1e-6;
/** Above this size a component isn't split further (2^m subsets get expensive). */
const MAX_REFINE = 10;

/**
 * Finds which qubits are entangled and gives each entangled group a distinct colour.
 * Qubits can only become entangled through binary gates, so connected components of
 * the interaction graph bound the groups; each component is then split into its
 * minimal separable factors using reduced-state purity.
 */
export class EntanglementTracker {
  private parent: number[];
  private colorOf = new Map<number, string>();

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }

  private find(a: number): number {
    while (this.parent[a] !== a) a = this.parent[a] = this.parent[this.parent[a]];
    return a;
  }

  link(a: number, b: number): void {
    this.parent[this.find(a)] = this.find(b);
  }

  /** Entangled groups (size >= 2), each sorted, in order of smallest member. */
  groups(state: StateVector): number[][] {
    const comps = new Map<number, number[]>();
    for (let q = 0; q < this.parent.length; q++) {
      const r = this.find(q);
      if (!comps.has(r)) comps.set(r, []);
      comps.get(r)!.push(q);
    }
    const out: number[][] = [];
    for (const comp of comps.values()) {
      if (comp.length < 2) continue;
      if (comp.length > MAX_REFINE) {
        out.push(comp);
        continue;
      }
      out.push(...splitSeparable(state, comp).filter((g) => g.length >= 2));
    }
    return out.sort((a, b) => a[0] - b[0]);
  }

  /** Recomputes groups and returns qubit -> colour for entangled qubits. */
  update(state: StateVector): Map<number, string> {
    const groups = this.groups(state);
    const next = new Map<number, string>();
    const used = new Set<string>();
    const pending: number[][] = [];

    // Keep the colour a group (or most of it) already had.
    for (const g of groups) {
      const votes = new Map<string, number>();
      for (const q of g) {
        const col = this.colorOf.get(q);
        if (col) votes.set(col, (votes.get(col) ?? 0) + 1);
      }
      const best = [...votes.entries()].sort((a, b) => b[1] - a[1]).find(([col]) => !used.has(col));
      if (best) {
        used.add(best[0]);
        g.forEach((q) => next.set(q, best[0]));
      } else pending.push(g);
    }
    for (const g of pending) {
      const col =
        ENTANGLE_PALETTE.find((p) => !used.has(p)) ??
        `hsl(${(used.size * 137) % 360} 80% 65%)`;
      used.add(col);
      g.forEach((q) => next.set(q, col));
    }
    this.colorOf = next;
    return next;
  }
}

/** A tracker that already knows which of the level's enemies start out entangled. */
export function trackerFor(level: Level): EntanglementTracker {
  const t = new EntanglementTracker(level.enemies.length);
  for (const g of level.groups) for (let i = 1; i < g.qubits.length; i++) t.link(g.qubits[0], g.qubits[i]);
  return t;
}

/** Splits `qubits` into minimal subsets whose reduced states are pure. */
function splitSeparable(state: StateVector, qubits: number[]): number[][] {
  let rest = [...qubits];
  const out: number[][] = [];
  while (rest.length) {
    const [q, ...others] = rest;
    let found: number[] = rest;
    search: for (let size = 0; size < others.length; size++) {
      for (const sub of combinations(others, size)) {
        const cand = [q, ...sub];
        if (Math.abs(state.purity(cand) - 1) < PURITY_EPS) {
          found = cand;
          break search;
        }
      }
    }
    out.push([...found].sort((a, b) => a - b));
    rest = rest.filter((x) => !found.includes(x));
  }
  return out;
}

function* combinations<T>(arr: T[], k: number, start = 0): Generator<T[]> {
  if (k === 0) {
    yield [];
    return;
  }
  for (let i = start; i <= arr.length - k; i++) {
    for (const rest of combinations(arr, k - 1, i + 1)) yield [arr[i], ...rest];
  }
}
