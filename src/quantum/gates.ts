import { c, expi, Complex } from "./complex";
import { Matrix2 } from "./state";

export type UnaryGateType = "I" | "X" | "Y" | "Z" | "H" | "S" | "T" | "P";
export type BinaryGateType = "CNOT" | "CZ";
export type GateType = UnaryGateType | BinaryGateType;

export const UNARY_GATES: UnaryGateType[] = ["I", "X", "Y", "Z", "H", "S", "T", "P"];
export const BINARY_GATES: BinaryGateType[] = ["CNOT", "CZ"];

export const isBinary = (g: GateType): g is BinaryGateType =>
  (BINARY_GATES as string[]).includes(g);

const r = Math.SQRT1_2;
const m = (a: Complex, b: Complex, cc: Complex, d: Complex): Matrix2 => [
  [a, b],
  [cc, d],
];

export const phase = (phi: number): Matrix2 => m(c(1), c(0), c(0), expi(phi));

export const MATRICES: Record<Exclude<UnaryGateType, "P">, Matrix2> = {
  I: m(c(1), c(0), c(0), c(1)),
  X: m(c(0), c(1), c(1), c(0)),
  Y: m(c(0), c(0, -1), c(0, 1), c(0)),
  Z: m(c(1), c(0), c(0), c(-1)),
  H: m(c(r), c(r), c(r), c(-r)),
  S: phase(Math.PI / 2),
  T: phase(Math.PI / 4),
};

/** Matrix of a single-qubit gate. `angle` is only used by P. */
export function unaryMatrix(type: UnaryGateType, angle = 0): Matrix2 {
  return type === "P" ? phase(angle) : MATRICES[type];
}

/** Target matrix of a controlled binary gate. */
export function binaryTarget(type: BinaryGateType): Matrix2 {
  return type === "CNOT" ? MATRICES.X : MATRICES.Z;
}
