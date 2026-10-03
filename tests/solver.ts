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
import { binaryTarget, BinaryGateType, isDirected, unaryMatrix, UnaryGateType } from "../src/quantum/gates";
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
      const m = binaryTarget(g.type as BinaryGateType);
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
                next.applyControlled(flipped ? b : a, flipped ? a : b, m);
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
