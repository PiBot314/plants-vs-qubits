import levelsJson from "../data/levels.json";
import contentJson from "../data/content.json";
import gatesJson from "../data/gates.json";
import { c, Complex } from "../quantum/complex";
import { formatAngle } from "../quantum/format";
import { isBinary, GateType } from "../quantum/gates";
import { parseComplex, parseReal } from "../quantum/parse";
import { ContentEntry, DialoguePage, GateInfo, Level, LevelData } from "./types";

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
  const enemies = data.enemies.map((e, id) => {
    if (e.lane < 0 || e.lane >= data.lanes) throw new Error(`${where}: enemy ${id} lane out of range`);
    if (!Number.isInteger(e.time) || e.time < 0) throw new Error(`${where}: enemy ${id} time must be a non-negative integer`);
    const key = `${e.lane}:${e.time}`;
    if (seen.has(key)) throw new Error(`${where}: two enemies share lane ${e.lane} and time ${e.time}`);
    seen.add(key);
    let a = parseComplex(e.amplitudes[0]);
    let b = parseComplex(e.amplitudes[1]);
    const norm = Math.sqrt(a.re ** 2 + a.im ** 2 + b.re ** 2 + b.im ** 2);
    if (norm === 0) throw new Error(`${where}: enemy ${id} has zero amplitudes`);
    if (Math.abs(norm - 1) > 1e-6) {
      console.warn(`${where}: enemy ${id} amplitudes not normalised (|ψ| = ${norm}); normalising.`);
      a = c(a.re / norm, a.im / norm);
      b = c(b.re / norm, b.im / norm);
    }
    return { id, lane: e.lane, time: e.time, amps: [a, b] as [Complex, Complex] };
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
