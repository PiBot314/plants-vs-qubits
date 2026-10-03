export interface Complex {
  re: number;
  im: number;
}

export const c = (re: number, im = 0): Complex => ({ re, im });

export const ZERO = c(0);
export const ONE = c(1);
export const I = c(0, 1);

export const add = (a: Complex, b: Complex): Complex => c(a.re + b.re, a.im + b.im);
export const sub = (a: Complex, b: Complex): Complex => c(a.re - b.re, a.im - b.im);
export const mul = (a: Complex, b: Complex): Complex =>
  c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const conj = (a: Complex): Complex => c(a.re, -a.im);
export const neg = (a: Complex): Complex => c(-a.re, -a.im);
export const abs2 = (a: Complex): number => a.re * a.re + a.im * a.im;
export const abs = (a: Complex): number => Math.hypot(a.re, a.im);
export const arg = (a: Complex): number => Math.atan2(a.im, a.re);
export const scale = (a: Complex, k: number): Complex => c(a.re * k, a.im * k);

export function div(a: Complex, b: Complex): Complex {
  const d = abs2(b);
  if (d === 0) throw new Error("Division by zero");
  return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
}

export const expi = (theta: number): Complex => c(Math.cos(theta), Math.sin(theta));

export function exp(a: Complex): Complex {
  return scale(expi(a.im), Math.exp(a.re));
}

export function log(a: Complex): Complex {
  return c(Math.log(abs(a)), arg(a));
}

export function pow(a: Complex, b: Complex): Complex {
  if (abs2(a) === 0) return abs2(b) === 0 ? ONE : ZERO;
  return exp(mul(b, log(a)));
}

export function sqrt(a: Complex): Complex {
  return pow(a, c(0.5));
}

export const approxEq = (a: Complex, b: Complex, eps = 1e-9): boolean =>
  Math.abs(a.re - b.re) < eps && Math.abs(a.im - b.im) < eps;
