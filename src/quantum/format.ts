import { Complex } from "./complex";

const EPS = 1e-6;

/** A non-negative real written as num/den, e.g. {num:"√3", den:"2"}. den "" means integer. */
interface Frac {
  value: number;
  num: string;
  den: string;
}

const s2 = Math.SQRT2;
const s3 = Math.sqrt(3);
const s5 = Math.sqrt(5);
const s6 = Math.sqrt(6);

const FRACTIONS: Frac[] = [
  { value: 1, num: "1", den: "" },
  { value: 1 / 2, num: "1", den: "2" },
  { value: 1 / s2, num: "1", den: "√2" },
  { value: s3 / 2, num: "√3", den: "2" },
  { value: 1 / s3, num: "1", den: "√3" },
  { value: s2 / s3, num: "√2", den: "√3" },
  { value: 1 / 4, num: "1", den: "4" },
  { value: 3 / 4, num: "3", den: "4" },
  { value: 1 / 3, num: "1", den: "3" },
  { value: 2 / 3, num: "2", den: "3" },
  { value: s3 / 4, num: "√3", den: "4" },
  { value: 1 / (2 * s2), num: "1", den: "2√2" },
  { value: s3 / (2 * s2), num: "√3", den: "2√2" },
  { value: 1 / s5, num: "1", den: "√5" },
  { value: 2 / s5, num: "2", den: "√5" },
  { value: 1 / s6, num: "1", den: "√6" },
  { value: s2, num: "√2", den: "" },
  { value: s3, num: "√3", den: "" },
  { value: 2, num: "2", den: "" },
];

function matchFrac(x: number): Frac | null {
  for (const f of FRACTIONS) if (Math.abs(x - f.value) < EPS) return f;
  return null;
}

const dec = (x: number) => {
  const s = x.toFixed(2).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
};

const withDen = (num: string, den: string) => (den ? `${num}/${den}` : num);

/** Formats a real number exactly where possible ("1/√2", "3/4"), otherwise as a decimal. */
export function formatReal(x: number): string {
  if (Math.abs(x) < EPS) return "0";
  const f = matchFrac(Math.abs(x));
  const sign = x < 0 ? "−" : "";
  return f ? sign + withDen(f.num, f.den) : sign + dec(Math.abs(x)).replace("-", "−");
}

/** Formats an angle in radians as a multiple of π ("π/4", "3π/2"). */
export function formatAngle(theta: number): string | null {
  for (const n of [1, 2, 3, 4, 6, 8, 12, 16]) {
    const k = (theta * n) / Math.PI;
    if (Math.abs(k - Math.round(k)) < EPS) {
      const ki = Math.round(k);
      if (ki === 0) return "0";
      const sign = ki < 0 ? "−" : "";
      const a = Math.abs(ki);
      return `${sign}${a === 1 ? "" : a}π${n === 1 ? "" : "/" + n}`;
    }
  }
  return null;
}

/**
 * Formats a complex amplitude using roots, fractions and π where they apply:
 * "1/√2", "−i/2", "(1+i)/2", "(1+√3i)/2", "e^{iπ/8}/√2". Falls back to decimals.
 */
export function formatComplex(z: Complex): string {
  const { re, im } = z;
  const ar = Math.abs(re);
  const ai = Math.abs(im);
  if (ar < EPS && ai < EPS) return "0";
  if (ai < EPS) return formatReal(re);
  if (ar < EPS) {
    const f = matchFrac(ai);
    const sign = im < 0 ? "−" : "";
    if (f) return sign + withDen(f.num === "1" ? "i" : `${f.num}i`, f.den);
    return `${sign}${dec(ai)}i`;
  }

  const fr = matchFrac(ar);
  const fi = matchFrac(ai);
  const sRe = re < 0 ? "−" : "";
  const sIm = im < 0 ? "−" : "+";

  // Equal parts: (±1±i)·c
  if (Math.abs(ar - ai) < EPS && fr) {
    const inner = `${sRe}1${sIm}i`;
    return withDen(fr.num === "1" ? `(${inner})` : `${fr.num}(${inner})`, fr.den);
  }
  // Common denominator: (a±bi)/d
  if (fr && fi && fr.den === fi.den) {
    const imPart = fi.num === "1" ? "i" : `${fi.num}i`;
    const inner = `${sRe}${fr.num}${sIm}${imPart}`;
    return fr.den ? `(${inner})/${fr.den}` : inner;
  }
  // Polar form r·e^{iθ}
  const r = Math.hypot(re, im);
  const fm = matchFrac(r);
  const ang = formatAngle(Math.atan2(im, re));
  if (fm && ang) {
    const e = `e^{i${ang}}`.replace("i−", "−i");
    return fm.num === "1" ? withDen(e, fm.den) : withDen(`${fm.num}${e}`, fm.den);
  }
  if (fr && fi) return `${formatReal(re)}${sIm}${withDen(fi.num === "1" ? "i" : fi.num + "i", fi.den)}`;
  return `${dec(re)}${sIm}${dec(ai)}i`.replace(/-/g, "−");
}

/** Formats a multi-qubit state as a ket sum, e.g. "1/√2|00⟩ + 1/√2|11⟩". Bit 0 is leftmost. */
export function formatKetSum(amps: Complex[], nQubits: number): string {
  const terms: string[] = [];
  amps.forEach((a, i) => {
    if (Math.hypot(a.re, a.im) < EPS) return;
    let bits = "";
    for (let k = 0; k < nQubits; k++) bits += (i >> k) & 1;
    let coef = formatComplex(a);
    if (coef.includes("+") || coef.slice(1).includes("−")) {
      if (!coef.startsWith("(")) coef = `(${coef})`;
    }
    coef = coef === "1" ? "" : coef === "−1" ? "−" : coef;
    terms.push(`${coef}|${bits}⟩`);
  });
  return terms.join(" + ").replace(/\+ −/g, "− ");
}

export interface BlochAngles {
  theta: number;        // polar angle, 0..π
  phi: number | null;   // azimuth, 0..2π; null at the poles where it's undefined
}

export function blochAngles(a: Complex, b: Complex): BlochAngles {
  const ra = Math.hypot(a.re, a.im);
  const rb = Math.hypot(b.re, b.im);
  const theta = 2 * Math.atan2(rb, ra);
  if (ra < EPS || rb < EPS) return { theta, phi: null };
  const TAU = 2 * Math.PI;
  let phi = Math.atan2(b.im, b.re) - Math.atan2(a.im, a.re);
  phi = ((phi % TAU) + TAU) % TAU;
  if (TAU - phi < EPS) phi = 0;
  return { theta, phi };
}

const angleStr = (x: number) => formatAngle(x) ?? x.toFixed(2);

/** Two short lines for the qubit circle: ["θ=π/2", "φ=π/4"]. */
export function formatBloch({ theta, phi }: BlochAngles): [string, string] {
  return [`θ=${angleStr(theta)}`, phi === null ? "φ=—" : `φ=${angleStr(phi)}`];
}