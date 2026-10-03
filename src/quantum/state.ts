import { Complex, c } from "./complex";

export type Matrix2 = [[Complex, Complex], [Complex, Complex]];

/**
 * Pure state of n qubits. Qubit k corresponds to bit k of the basis index.
 */
export class StateVector {
  readonly n: number;
  readonly re: Float64Array;
  readonly im: Float64Array;

  constructor(n: number) {
    this.n = n;
    this.re = new Float64Array(1 << n);
    this.im = new Float64Array(1 << n);
    this.re[0] = 1;
  }

  /** Tensor product of single-qubit states; qubits[k] = [alpha, beta]. */
  static fromProduct(qubits: [Complex, Complex][]): StateVector {
    const s = new StateVector(qubits.length);
    const size = 1 << s.n;
    for (let i = 0; i < size; i++) {
      let re = 1;
      let im = 0;
      for (let k = 0; k < s.n; k++) {
        const amp = qubits[k][(i >> k) & 1];
        const nr = re * amp.re - im * amp.im;
        im = re * amp.im + im * amp.re;
        re = nr;
      }
      s.re[i] = re;
      s.im[i] = im;
    }
    return s;
  }

  clone(): StateVector {
    const s = new StateVector(this.n);
    s.re.set(this.re);
    s.im.set(this.im);
    return s;
  }

  amp(i: number): Complex {
    return c(this.re[i], this.im[i]);
  }

  /** Apply a 2x2 unitary to qubit k. */
  apply1(k: number, m: Matrix2): void {
    this.applyControlled(-1, k, m);
  }

  /** Apply m to target t when control qubit ctrl is |1> (ctrl = -1: unconditional). */
  applyControlled(ctrl: number, t: number, m: Matrix2): void {
    const bit = 1 << t;
    const cbit = ctrl >= 0 ? 1 << ctrl : 0;
    const size = 1 << this.n;
    const [[a, b], [cc, d]] = m;
    for (let i = 0; i < size; i++) {
      if (i & bit) continue;
      if (cbit && !(i & cbit)) continue;
      const j = i | bit;
      const r0 = this.re[i], i0 = this.im[i];
      const r1 = this.re[j], i1 = this.im[j];
      this.re[i] = a.re * r0 - a.im * i0 + b.re * r1 - b.im * i1;
      this.im[i] = a.re * i0 + a.im * r0 + b.re * i1 + b.im * r1;
      this.re[j] = cc.re * r0 - cc.im * i0 + d.re * r1 - d.im * i1;
      this.im[j] = cc.re * i0 + cc.im * r0 + d.re * i1 + d.im * r1;
    }
  }

  /** Probability that qubit k measures 0. */
  marginalP0(k: number): number {
    const bit = 1 << k;
    let p = 0;
    for (let i = 0; i < this.re.length; i++) {
      if (!(i & bit)) p += this.re[i] * this.re[i] + this.im[i] * this.im[i];
    }
    return p;
  }

  /**
   * Reduced density matrix of the given qubits (in the given order; qubits[j] is bit j of
   * the sub-index). Returned as row-major arrays of size 2^m x 2^m.
   */
  reducedDensity(qubits: number[]): { re: Float64Array; im: Float64Array; dim: number } {
    const m = qubits.length;
    const dim = 1 << m;
    const re = new Float64Array(dim * dim);
    const im = new Float64Array(dim * dim);
    let mask = 0;
    for (const q of qubits) mask |= 1 << q;
    // Group amplitudes by the state of the remaining qubits.
    const groups = new Map<number, number[]>();
    for (let i = 0; i < this.re.length; i++) {
      const rest = i & ~mask;
      let sub = 0;
      for (let j = 0; j < m; j++) sub |= ((i >> qubits[j]) & 1) << j;
      let g = groups.get(rest);
      if (!g) {
        g = new Array(dim).fill(-1);
        groups.set(rest, g);
      }
      g[sub] = i;
    }
    for (const g of groups.values()) {
      for (let a = 0; a < dim; a++) {
        const ia = g[a];
        const ar = this.re[ia], ai = this.im[ia];
        if (ar === 0 && ai === 0) continue;
        for (let b = 0; b < dim; b++) {
          const ib = g[b];
          const br = this.re[ib], bi = -this.im[ib];
          re[a * dim + b] += ar * br - ai * bi;
          im[a * dim + b] += ar * bi + ai * br;
        }
      }
    }
    return { re, im, dim };
  }

  /** Tr(rho^2) of the reduced state of the given qubits; 1 means separable from the rest. */
  purity(qubits: number[]): number {
    const { re, im, dim } = this.reducedDensity(qubits);
    // rho is Hermitian: Tr(rho^2) = sum |rho_ab|^2
    let p = 0;
    for (let i = 0; i < dim * dim; i++) p += re[i] * re[i] + im[i] * im[i];
    return p;
  }

  /**
   * State vector of the given qubits if they are separable from the rest, with the global
   * phase fixed so the first nonzero amplitude is real and positive.
   * Returns null if the subsystem is mixed.
   */
  subsystemState(qubits: number[], eps = 1e-9): Complex[] | null {
    const { re, im, dim } = this.reducedDensity(qubits);
    let p = 0;
    for (let i = 0; i < dim * dim; i++) p += re[i] * re[i] + im[i] * im[i];
    if (Math.abs(p - 1) > 1e-6) return null;
    // rho = |psi><psi|. Pick the first column with non-negligible diagonal as the phase reference.
    let ref = 0;
    while (ref < dim && re[ref * dim + ref] < eps) ref++;
    if (ref === dim) return null;
    const norm = Math.sqrt(re[ref * dim + ref]);
    const out: Complex[] = [];
    for (let a = 0; a < dim; a++) out.push(c(re[a * dim + ref] / norm, im[a * dim + ref] / norm));
    return out;
  }
}
