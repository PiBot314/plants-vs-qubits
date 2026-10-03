import { GateType } from "./gates";
import { StateVector } from "./state";

export type Vec3 = [number, number, number];

/** Bloch vector of qubit k (length < 1 if it is entangled with others). |0⟩ = +z, |+⟩ = +x, |+i⟩ = +y. */
export function blochVector(state: StateVector, k: number): Vec3 {
  const { re, im } = state.reducedDensity([k]);
  // rho = [[r00, r01], [r10, r11]]; x = 2 Re r10, y = 2 Im r10, z = r00 - r11
  return [2 * re[2], 2 * im[2], re[0] - re[3]];
}

const S = Math.SQRT1_2;

/** Every single-qubit gate is (up to global phase) a rotation of the Bloch sphere. */
export function gateRotation(type: GateType, angle = 0): { axis: Vec3; angle: number } {
  switch (type) {
    case "X":
      return { axis: [1, 0, 0], angle: Math.PI };
    case "Y":
      return { axis: [0, 1, 0], angle: Math.PI };
    case "Z":
      return { axis: [0, 0, 1], angle: Math.PI };
    case "H":
      return { axis: [S, 0, S], angle: Math.PI };
    case "S":
      return { axis: [0, 0, 1], angle: Math.PI / 2 };
    case "T":
      return { axis: [0, 0, 1], angle: Math.PI / 4 };
    case "P":
      return { axis: [0, 0, 1], angle };
    default:
      return { axis: [0, 0, 1], angle: 0 };
  }
}

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const norm = (a: Vec3) => Math.sqrt(dot(a, a));
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Rotates v by angle θ about unit axis n (right-hand rule, Rodrigues' formula). */
export function rotate(v: Vec3, n: Vec3, theta: number): Vec3 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const k = cross(n, v);
  const d = dot(n, v) * (1 - c);
  return [v[0] * c + k[0] * s + n[0] * d, v[1] * c + k[1] * s + n[1] * d, v[2] * c + k[2] * s + n[2] * d];
}

/** The rotation taking unit vector a to unit vector b along the shortest great circle. */
export function rotationBetween(a: Vec3, b: Vec3): { axis: Vec3; angle: number } {
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (norm(a) * norm(b) || 1))));
  let axis = cross(a, b);
  if (norm(axis) < 1e-9) {
    // Parallel or antipodal: any perpendicular axis works; prefer one that sweeps through +x.
    axis = norm(cross(a, [0, 1, 0])) > 1e-9 ? [0, Math.sign(a[2]) || 1, 0] : [0, 0, 1];
  }
  const l = norm(axis);
  return { axis: [axis[0] / l, axis[1] / l, axis[2] / l], angle };
}
