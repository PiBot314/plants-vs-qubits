/**
 * Exhaustive solver used by the level tests to prove optimal costs.
 *
 * Gate x-positions don't matter, only their order: every qubit crosses every line in
 * the same order, and a binary gate pairs exactly the qubits that share a `time`. So a
 * solution is a sequence of operations, and we run a uniform-cost search over the
 * resulting quantum states. Each wave (qubits sharing a time) is simulated separately,
 * and identical waves are merged. Unary-only levels are solved lane by lane, enforcing
 * that each lane holds at most `columns` gates.
 */
import { applyBinary, BinaryGateType, isDirected, unaryMatrix, UnaryGateType } from "../src/quantum/gates";
import { StateVector } from "../src/quantum/state";
import { Level } from "../src/game/types";

export interface SolveResult {
  /** Cheapest cost that survives (HP > 0), or null if none within maxCost. */
  minWin: number | null;
  /** Cheapest cost that takes no damage at all, or null. */
  minPerfect: number | null;
  /** A cheapest perfect solution, as gate labels in the order qubits meet them (joint search only). */
  witness?: string[];
}

interface Wave {
  weight: number;
  /** lane -> local qubit index */
  local: Map<number, number>;
  init: StateVector;
}

interface Op {
  label: string;
  cost: number;
  apply(states: StateVector[], waves: Wave[]): StateVector[];
}

const EPS = 1e-6;

function wavesOf(level: Level, lanes?: number[]): Wave[] {
  const byTime = new Map<number, number[]>();
  for (const e of level.enemies) {
    if (lanes && !lanes.includes(e.lane)) continue;
    if (!byTime.has(e.time)) byTime.set(e.time, []);
    byTime.get(e.time)!.push(e.id);
  }
  const merged = new Map<string, Wave>();
  for (const ids of byTime.values()) {
    const localOf = new Map(ids.map((q, i) => [q, i]));
    const groups = level.groups
      .filter((g) => g.qubits.some((q) => localOf.has(q)))
      .map((g) => ({ qubits: g.qubits.map((q) => localOf.get(q)!), amps: g.amps }));
    const init = StateVector.fromGroups(ids.length, groups);
    const local = new Map(ids.map((q, i) => [level.enemies[q].lane, i]));
    const key = [...local.entries()].sort().join(";") + "|" + stateKey(init);
    const w = merged.get(key);
    if (w) w.weight++;
    else merged.set(key, { weight: 1, local, init });
  }
  return [...merged.values()];
}

function opsOf(level: Level, lanes: number[]): Op[] {
  const ops: Op[] = [];
  const seen = new Set<string>();
  for (const g of level.gates) {
    if (g.type === "I") continue; // never helps
    const id = `${g.type}:${g.angle}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (!g.binary) {
      const m = unaryMatrix(g.type as UnaryGateType, g.angle);
      for (const lane of lanes) {
        ops.push({
          label: `${g.label}@lane${lane}`,
          cost: g.cost,
          apply: (states, waves) =>
            states.map((st, i) => {
              const k = waves[i].local.get(lane);
              if (k === undefined) return st;
              const next = st.clone();
              next.apply1(k, m);
              return next;
            }),
        });
      }
    } else {
      for (const top of lanes) {
        if (!lanes.includes(top + 1)) continue;
        for (const flipped of isDirected(g.type) ? [false, true] : [false]) {
          ops.push({
            label: `${g.type}@lanes${top}-${top + 1}${flipped ? "(flipped)" : ""}`,
            cost: g.cost,
            apply: (states, waves) =>
              states.map((st, i) => {
                const a = waves[i].local.get(top);
                const b = waves[i].local.get(top + 1);
                if (a === undefined || b === undefined) return st;
                const next = st.clone();
                applyBinary(next, g.type as BinaryGateType, flipped ? b : a, flipped ? a : b);
                return next;
              }),
          });
        }
      }
    }
  }
  return ops;
}

/** Key of a state up to global phase. */
function stateKey(st: StateVector): string {
  let ref = 0;
  while (ref < st.re.length && Math.hypot(st.re[ref], st.im[ref]) < 1e-9) ref++;
  const pr = st.re[ref] / Math.hypot(st.re[ref], st.im[ref]);
  const pi = -st.im[ref] / Math.hypot(st.re[ref], st.im[ref]);
  let out = "";
  for (let i = 0; i < st.re.length; i++) {
    const re = st.re[i] * pr - st.im[i] * pi;
    const im = st.re[i] * pi + st.im[i] * pr;
    out += `${re.toFixed(5)},${im.toFixed(5)};`;
  }
  return out.replace(/-0\.00000/g, "0.00000");
}

function damage(states: StateVector[], waves: Wave[]): number {
  let d = 0;
  states.forEach((st, i) => {
    for (let k = 0; k < st.n; k++) d += waves[i].weight * st.marginalP0(k) * 100;
  });
  return d;
}

/**
 * Uniform-cost search. Returns, for each cost c, the least damage reachable at cost <= c.
 * `maxOps` caps the number of operations (the lane's columns in per-lane mode).
 */
function search(waves: Wave[], ops: Op[], maxCost: number, maxOps = Infinity, witness?: string[]): number[] {
  const best = new Array(maxCost + 1).fill(Infinity);
  const buckets: { states: StateVector[]; ops: number; path: string[] }[][] = Array.from({ length: maxCost + 1 }, () => []);
  const visited = new Map<string, number>();
  buckets[0].push({ states: waves.map((w) => w.init), ops: 0, path: [] });
  for (let cost = 0; cost <= maxCost; cost++) {
    for (const node of buckets[cost]) {
      const key = node.states.map(stateKey).join("|") + (maxOps < Infinity ? `#${node.ops}` : "");
      if ((visited.get(key) ?? Infinity) <= cost) continue;
      visited.set(key, cost);
      const d = damage(node.states, waves);
      if (witness && !witness.length && d < EPS) witness.push(...node.path, "");
      best[cost] = Math.min(best[cost], d);
      if (node.ops >= maxOps) continue;
      for (const op of ops) {
        const c = cost + op.cost;
        if (c <= maxCost) buckets[c].push({ states: op.apply(node.states, waves), ops: node.ops + 1, path: [...node.path, op.label] });
      }
    }
    buckets[cost] = [];
    if (cost > 0) best[cost] = Math.min(best[cost], best[cost - 1]);
  }
  return best;
}

export function solve(level: Level, maxCost = level.budget): SolveResult {
  const lanes = Array.from({ length: level.lanes }, (_, i) => i);
  const unaryOnly = level.gates.every((g) => !g.binary) && level.groups.every((g) => g.qubits.length === 1);

  // best[c] = least total damage at total cost <= c
  let best: number[];
  const witness: string[] = [];
  if (unaryOnly) {
    // Lanes are independent: solve each, then combine (min-plus convolution).
    best = [0, ...new Array(maxCost).fill(0)];
    for (const lane of lanes) {
      const waves = wavesOf(level, [lane]);
      const laneBest = waves.length ? search(waves, opsOf(level, [lane]), maxCost, level.columns) : new Array(maxCost + 1).fill(0);
      const next = new Array(maxCost + 1).fill(Infinity);
      for (let a = 0; a <= maxCost; a++) for (let b = 0; a + b <= maxCost; b++) next[a + b] = Math.min(next[a + b], best[a] + laneBest[b]);
      best = next;
    }
  } else {
    best = search(wavesOf(level), opsOf(level, lanes), maxCost, Infinity, witness);
  }
  const minWin = best.findIndex((d) => d < 100 - EPS);
  const minPerfect = best.findIndex((d) => d < EPS);
  return {
    minWin: minWin < 0 ? null : minWin,
    minPerfect: minPerfect < 0 ? null : minPerfect,
    ...(witness.length ? { witness: witness.slice(0, -1) } : {}),
  };
}

/* ======================================================================
 * A* search for the cheapest perfect (zero-damage) solution, for levels too
 * big for the exhaustive search above (many lanes, T gates, 3-qubit groups).
 *
 * Heuristic: cost partitioning over waves. An op that affects k waves is
 * charged cost/k to each, and d_w(s) is wave w's exact cheapest partitioned
 * cost from state s to |1…1⟩ when solved on its own. The sum over waves is an
 * admissible, consistent lower bound on the remaining cost. d_w is looked up
 * in a table built by searching backwards from |1…1⟩. The table only needs to
 * reach B_w = maxCost − Σ_{v≠w} d_v(start), because a state further out than
 * that can't lie on any solution within maxCost.
 * ====================================================================== */

interface WaveOp {
  label: string;
  cost: number;
  /** Lanes the gate occupies (one column in each). */
  lanes: number[];
  /** wave index -> forward / inverse application on that wave's state */
  forward: Map<number, (st: StateVector) => StateVector>;
  inverse: Map<number, (st: StateVector) => StateVector>;
}

const adjoint = (m: ReturnType<typeof unaryMatrix>): ReturnType<typeof unaryMatrix> => [
  [{ re: m[0][0].re, im: -m[0][0].im }, { re: m[1][0].re, im: -m[1][0].im }],
  [{ re: m[0][1].re, im: -m[0][1].im }, { re: m[1][1].re, im: -m[1][1].im }],
];

function waveOpsOf(level: Level, waves: Wave[]): WaveOp[] {
  const lanes = Array.from({ length: level.lanes }, (_, i) => i);
  const ops: WaveOp[] = [];
  const seen = new Set<string>();
  const clone = (st: StateVector, f: (s: StateVector) => void) => {
    const next = st.clone();
    f(next);
    return next;
  };
  for (const g of level.gates) {
    if (g.type === "I") continue;
    const id = `${g.type}:${g.angle}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (!g.binary) {
      const m = unaryMatrix(g.type as UnaryGateType, g.angle);
      const mi = adjoint(m);
      for (const lane of lanes) {
        const op: WaveOp = { label: `${g.label}@lane${lane}`, cost: g.cost, lanes: [lane], forward: new Map(), inverse: new Map() };
        waves.forEach((w, i) => {
          const k = w.local.get(lane);
          if (k === undefined) return;
          op.forward.set(i, (st) => clone(st, (s) => s.apply1(k, m)));
          op.inverse.set(i, (st) => clone(st, (s) => s.apply1(k, mi)));
        });
        if (op.forward.size) ops.push(op);
      }
    } else {
      for (const top of lanes.slice(0, -1)) {
        for (const flipped of isDirected(g.type) ? [false, true] : [false]) {
          const label = `${g.label}@lanes${top}-${top + 1}${flipped ? "(flipped)" : ""}`;
          const op: WaveOp = { label, cost: g.cost, lanes: [top, top + 1], forward: new Map(), inverse: new Map() };
          waves.forEach((w, i) => {
            const a = w.local.get(top);
            const b = w.local.get(top + 1);
            if (a === undefined || b === undefined) return;
            // Every two-qubit gate we support is its own inverse.
            const f = (st: StateVector) => clone(st, (s) => applyBinary(s, g.type as BinaryGateType, flipped ? b : a, flipped ? a : b));
            op.forward.set(i, f);
            op.inverse.set(i, f);
          });
          if (op.forward.size) ops.push(op);
        }
      }
    }
  }
  return ops;
}

/** Tiny binary min-heap keyed by priority. */
class Heap<T> {
  private items: { p: number; v: T }[] = [];
  get size() {
    return this.items.length;
  }
  push(p: number, v: T) {
    const a = this.items;
    a.push({ p, v });
    let i = a.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (a[j].p <= a[i].p) break;
      [a[i], a[j]] = [a[j], a[i]];
      i = j;
    }
  }
  pop(): { p: number; v: T } {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].p < a[m].p) m = l;
        if (r < a.length && a[r].p < a[m].p) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

const COST_EPS = 1e-9;

/** Dijkstra over one wave's states with partitioned costs, up to `bound` (or until `target` is settled). */
function waveDijkstra(
  start: StateVector,
  steps: { pc: number; apply: (st: StateVector) => StateVector }[],
  bound: number,
  maxStates = Infinity,
): { dist: Map<string, number>; radius: number } {
  const dist = new Map<string, number>([[stateKey(start), 0]]);
  const settled = new Map<string, number>();
  const heap = new Heap<StateVector>();
  heap.push(0, start);
  let radius = 0;
  while (heap.size) {
    const { p, v } = heap.pop();
    const vk = stateKey(v);
    if (settled.has(vk) || p > (dist.get(vk) ?? Infinity) + COST_EPS) continue;
    // Stop once the table is full; everything settled so far is exact.
    if (settled.size >= maxStates) {
      radius = p;
      return { dist: settled, radius };
    }
    settled.set(vk, p);
    radius = p;
    for (const s of steps) {
      const c = p + s.pc;
      if (c > bound + COST_EPS) continue;
      const next = s.apply(v);
      const key = stateKey(next);
      if (c + COST_EPS < (dist.get(key) ?? Infinity)) {
        dist.set(key, c);
        heap.push(c, next);
      }
    }
  }
  // Exhausted: every state within `bound` is settled.
  return { dist: settled, radius: bound + COST_EPS };
}

const allOnes = (n: number) => {
  const st = new StateVector(n);
  st.re[0] = 0;
  st.re[(1 << n) - 1] = 1;
  return st;
};

export interface PerfectResult {
  /** Cheapest zero-damage cost, or null if there is none within maxCost. */
  minPerfect: number | null;
  /** One cheapest solution, in the order the qubits meet the gates. */
  witness: string[];
  /** Joint states expanded (for the curious). */
  expanded: number;
}

/**
 * Also respects the grid width: gates on different lanes commute, so the
 * columns a solution needs is the depth of its earliest-possible layout. Each
 * lane tracks how many columns it has used; a two-qubit gate first waits for
 * both of its lanes. Anything deeper than `level.columns` is pruned.
 */
export function solvePerfect(level: Level, maxCost = level.budget, maxTableStates = 200_000): PerfectResult {
  const waves = wavesOf(level);
  const ops = waveOpsOf(level, waves);
  const pc = (op: WaveOp) => op.cost / op.forward.size;

  // Backward tables: exact d_w(s) for states near |1…1⟩. A state missing from a table
  // is at least `radius` away (Dijkstra settles states in distance order), so the
  // heuristic stays admissible even when a table is capped.
  const tables = waves.map((w, i) => {
    const steps = ops.filter((o) => o.inverse.has(i)).map((o) => ({ pc: pc(o), apply: o.inverse.get(i)! }));
    return waveDijkstra(allOnes(w.init.n), steps, maxCost, maxTableStates);
  });
  solvePerfect.lastTableSizes = tables.map((t) => t.dist.size);
  const h = (states: StateVector[]) => {
    let sum = 0;
    for (let i = 0; i < states.length; i++) sum += tables[i].dist.get(stateKey(states[i])) ?? tables[i].radius;
    return sum;
  };
  const isGoal = (states: StateVector[]) => states.every((st, i) => tables[i].dist.get(stateKey(st)) === 0);

  interface Node {
    states: StateVector[];
    depth: number[];
    g: number;
    path: string[];
  }
  const heap = new Heap<Node>();
  const bestG = new Map<string, number>();
  const start = waves.map((w) => w.init);
  heap.push(h(start), { states: start, depth: new Array(level.lanes).fill(0), g: 0, path: [] });
  let expanded = 0;
  while (heap.size) {
    const { v: node } = heap.pop();
    const key = node.states.map(stateKey).join("|") + "#" + node.depth.join(",");
    if ((bestG.get(key) ?? Infinity) < node.g) continue;
    expanded++;
    if (isGoal(node.states)) return { minPerfect: node.g, witness: node.path, expanded };
    for (const op of ops) {
      const g = node.g + op.cost;
      if (g > maxCost) continue;
      const col = Math.max(...op.lanes.map((l) => node.depth[l])) + 1;
      if (col > level.columns) continue;
      const depth = [...node.depth];
      for (const l of op.lanes) depth[l] = col;
      const states = node.states.map((st, i) => op.forward.get(i)?.(st) ?? st);
      const f = g + h(states);
      if (f > maxCost + COST_EPS) continue;
      const k = states.map(stateKey).join("|") + "#" + depth.join(",");
      if ((bestG.get(k) ?? Infinity) <= g) continue;
      bestG.set(k, g);
      heap.push(f, { states, depth, g, path: [...node.path, `${op.label}@x${level.columns + 1 - col}`] });
    }
  }
  return { minPerfect: null, witness: [], expanded };
}

solvePerfect.lastTableSizes = [] as number[];
