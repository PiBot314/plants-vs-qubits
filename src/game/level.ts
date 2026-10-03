import levelsJson from "../data/levels.json";
import contentJson from "../data/content.json";
import gatesJson from "../data/gates.json";
import { c } from "../quantum/complex";
import { formatAngle } from "../quantum/format";
import { isBinary, GateType } from "../quantum/gates";
import { parseComplex, parseReal } from "../quantum/parse";
import { ContentEntry, DialoguePage, Enemy, EnemyGroup, GateInfo, Level, LevelData } from "./types";

export const GATE_INFO = gatesJson as unknown as Record<GateType, GateInfo>;

const MAX_QUBITS = 14;

export function resolveLevel(data: LevelData): Level {
  const where = `Level ${data.id}`;
  if (data.lanes < 1 || data.columns < 1) throw new Error(`${where}: needs at least one lane and column`);

  const gates = data.gates.map((g, index) => {
    const info = GATE_INFO[g.type];
    if (!info) throw new Error(`${where}: unknown gate "${g.type}"`);
    const binary = isBinary(g.type);
    if (binary && data.lanes < 2) throw new Error(`${where}: ${g.type} needs at least 2 lanes`);
    const angle = g.type === "P" ? parseReal(g.angle ?? "pi/2") : 0;
    const label = g.type === "P" ? `P(${formatAngle(angle) ?? angle.toFixed(2)})` : g.type;
    return { index, type: g.type, cost: g.cost ?? info.defaultCost, angle, label, binary };
  });

  const seen = new Set<string>();
  const enemies: Enemy[] = [];
  const groups: EnemyGroup[] = [];
  data.enemies.forEach((e, i) => {
    const what = `${where}: enemy ${i}`;
    const lanes = "lanes" in e ? e.lanes : [e.lane];
    if (!lanes.length) throw new Error(`${what} has no lanes`);
    if (!Number.isInteger(e.time) || e.time < 0) throw new Error(`${what} time must be a non-negative integer`);
    if (e.amplitudes.length !== 1 << lanes.length) {
      throw new Error(`${what} needs ${1 << lanes.length} amplitudes for ${lanes.length} lane(s)`);
    }
    const qubits = lanes.map((lane) => {
      if (lane < 0 || lane >= data.lanes) throw new Error(`${what} lane ${lane} out of range`);
      const key = `${lane}:${e.time}`;
      if (seen.has(key)) throw new Error(`${where}: two enemies share lane ${lane} and time ${e.time}`);
      seen.add(key);
      enemies.push({ id: enemies.length, lane, time: e.time });
      return enemies.length - 1;
    });
    let amps = e.amplitudes.map((a) => parseComplex(a));
    const norm = Math.sqrt(amps.reduce((s, a) => s + a.re ** 2 + a.im ** 2, 0));
    if (norm === 0) throw new Error(`${what} has zero amplitudes`);
    if (Math.abs(norm - 1) > 1e-6) {
      console.warn(`${what} amplitudes not normalised (|ψ| = ${norm}); normalising.`);
      amps = amps.map((a) => c(a.re / norm, a.im / norm));
    }
    groups.push({ qubits, amps });
  });
  if (enemies.length > MAX_QUBITS) console.warn(`${where}: ${enemies.length} qubits may simulate slowly`);

  return {
    id: data.id,
    name: data.name,
    lanes: data.lanes,
    columns: data.columns,
    budget: data.budget,
    optimalCost: data.optimalCost,
    gates,
    enemies,
    groups,
  };
}

export const LEVELS: Level[] = (levelsJson as unknown as LevelData[]).map(resolveLevel).sort((a, b) => a.id - b.id);

const CONTENT = contentJson as unknown as ContentEntry[];

export function getContent(level: number, when: string): DialoguePage[] {
  return CONTENT.filter((e) => e.level === level && e.when === when).map(({ text, bloch }) => ({ text, bloch }));
}

export function getLevel(id: number): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function nextLevel(id: number): Level | undefined {
  return LEVELS.find((l) => l.id > id);
}
