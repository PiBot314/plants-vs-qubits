import { c, expi, Complex } from "./complex";
import type { Matrix2, StateVector } from "./state";

export type UnaryGateType = "I" | "X" | "Y" | "Z" | "H" | "S" | "T" | "P";
export type BinaryGateType = "CNOT" | "CZ" | "CY" | "SWAP";
export type GateType = UnaryGateType | BinaryGateType;

export const UNARY_GATES: UnaryGateType[] = ["I", "X", "Y", "Z", "H", "S", "T", "P"];
export const BINARY_GATES: BinaryGateType[] = ["CNOT", "CZ", "CY", "SWAP"];

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

export type ControlledGateType = Exclude<BinaryGateType, "SWAP">;

/** Controlled gates whose control and target can be swapped (CZ and SWAP are symmetric). */
export const isDirected = (type: GateType) => type === "CNOT" || type === "CY";

/** Target matrix of a controlled binary gate. */
export function binaryTarget(type: ControlledGateType): Matrix2 {
  return type === "CNOT" ? MATRICES.X : type === "CY" ? MATRICES.Y : MATRICES.Z;
}

/** Applies a two-qubit gate. SWAP is built from three CNOTs; the rest are controlled gates. */
export function applyBinary(state: StateVector, type: BinaryGateType, ctrl: number, tgt: number): void {
  if (type === "SWAP") {
    state.applyControlled(ctrl, tgt, MATRICES.X);
    state.applyControlled(tgt, ctrl, MATRICES.X);
    state.applyControlled(ctrl, tgt, MATRICES.X);
  } else state.applyControlled(ctrl, tgt, binaryTarget(type));
}
