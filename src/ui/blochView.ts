import { blochVector, gateRotation, lerp, norm, rotate, rotationBetween, Vec3 } from "../quantum/bloch";
import { Complex } from "../quantum/complex";
import { formatAngle, formatKetSum } from "../quantum/format";
import { binaryTarget, BinaryGateType, GateType, isBinary, unaryMatrix, UnaryGateType } from "../quantum/gates";
import { parseComplex, parseReal } from "../quantum/parse";
import { StateVector } from "../quantum/state";
import { Amps, BlochSpec } from "../game/types";
import { h, s } from "./dom";

/* ---------- projection ---------- */
const R = 58;
const AZ = (25 * Math.PI) / 180;
const EL = (18 * Math.PI) / 180;
const right: Vec3 = [-Math.sin(AZ), Math.cos(AZ), 0];
const up: Vec3 = [-Math.cos(AZ) * Math.sin(EL), -Math.sin(AZ) * Math.sin(EL), Math.cos(EL)];
const toward: Vec3 = [Math.cos(AZ) * Math.cos(EL), Math.sin(AZ) * Math.cos(EL), Math.sin(EL)];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const proj = (v: Vec3): [number, number] => [R * dot(v, right), -R * dot(v, up)];
const depth = (v: Vec3) => dot(v, toward);
const pts = (vs: Vec3[]) => vs.map((v) => proj(v).map((n) => n.toFixed(2)).join(",")).join(" ");

/** One sphere: static frame plus a movable arrow, trail and optional rotation axis. */
class Sphere {
  readonly el: SVGSVGElement;
  private arrow = s("line", { class: "bv-arrow", x1: 0, y1: 0 });
  private tip = s("circle", { class: "bv-tip" });
  private trail = s("polyline", { class: "bv-trail" });
  private axisLine = s("line", { class: "bv-axis" });

  constructor(label?: string) {
    // A great circle drawn as solid where it faces the viewer and dashed behind the sphere.
    const ring = (f: (t: number) => Vec3) => {
      let front = "";
      let back = "";
      let prev: boolean | null = null;
      for (let i = 0; i <= 96; i++) {
        const v = f((i / 96) * 2 * Math.PI);
        const isFront = depth(v) >= 0;
        const [x, y] = proj(v).map((n) => n.toFixed(2));
        if (isFront) front += `${prev === true ? "L" : "M"}${x},${y} `;
        else back += `${prev === false ? "L" : "M"}${x},${y} `;
        prev = isFront;
      }
      return [s("path", { class: "bv-ring back", d: back }), s("path", { class: "bv-ring", d: front })];
    };
    const axisEnd = (v: Vec3, text: string) => {
      const [x, y] = proj(v);
      return s("text", { class: "bv-label", x, y }, text);
    };
    this.el = s(
      "svg",
      { class: "bv-sphere", viewBox: "-82 -82 164 164" },
      s("circle", { class: "bv-ball", r: R }),
      ...ring((t) => [Math.cos(t), Math.sin(t), 0]),
      ...ring((t) => [Math.sin(t), 0, Math.cos(t)]),
      s("polyline", { class: "bv-ax", points: pts([[-1, 0, 0], [1, 0, 0]]) }),
      s("polyline", { class: "bv-ax", points: pts([[0, -1, 0], [0, 1, 0]]) }),
      s("polyline", { class: "bv-ax", points: pts([[0, 0, -1], [0, 0, 1]]) }),
      axisEnd([0, 0, 1.22], "|0⟩"),
      axisEnd([0, 0, -1.24], "|1⟩"),
      axisEnd([1.3, 0, 0], "|+⟩"),
      axisEnd([-1.25, 0, 0], "|−⟩"),
      axisEnd([0, 1.24, 0], "y"),
      this.axisLine,
      this.trail,
      this.arrow,
      this.tip,
      label ? s("text", { class: "bv-name", x: 0, y: 80 }, label) : null,
    );
    this.axisLine.style.display = "none";
  }

  showAxis(n: Vec3) {
    const [x1, y1] = proj([-1.3 * n[0], -1.3 * n[1], -1.3 * n[2]]);
    const [x2, y2] = proj([1.3 * n[0], 1.3 * n[1], 1.3 * n[2]]);
    Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => this.axisLine.setAttribute(k, String(v)));
    this.axisLine.style.display = "";
  }

  set(v: Vec3, trail: Vec3[] = []) {
    const [x, y] = proj(v);
    this.arrow.setAttribute("x2", String(x));
    this.arrow.setAttribute("y2", String(y));
    this.tip.setAttribute("cx", String(x));
    this.tip.setAttribute("cy", String(y));
    // Tip looks bigger in front of the sphere, smaller behind it; vanishes at the centre.
    this.tip.setAttribute("r", String(norm(v) < 1e-3 ? 0 : 4.2 + 1.4 * depth(v)));
    this.trail.setAttribute("points", pts(trail));
  }
}

/* ---------- specs → animation ---------- */
const parseAmps = (a: Amps): [Complex, Complex] => [parseComplex(a[0]), parseComplex(a[1])];
const ket = (st: StateVector) => formatKetSum(Array.from({ length: 1 << st.n }, (_, i) => st.amp(i)), st.n);
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) ** 2);

function describeRotation(type: GateType, angle: number): string {
  if (type === "I") return "No rotation at all";
  const rot = gateRotation(type, angle);
  const turn = { 180: "Half turn", 90: "Quarter turn", 45: "Eighth turn" }[Math.round((rot.angle * 180) / Math.PI)];
  const axis = type === "X" ? "x-axis" : type === "Y" ? "y-axis" : type === "H" ? "diagonal x+z axis" : "vertical z-axis";
  return `${turn ?? `Turn of ${formatAngle(rot.angle) ?? rot.angle.toFixed(2)}`} around the ${axis}`;
}

interface Timeline {
  /** Seconds per loop. */
  period: number;
  frame(t: number): void;
}

const HOLD0 = 0.8;
const MOVE = 1.8;
const HOLD1 = 1.3;

/** Builds a looping Bloch sphere illustration. Call stop() when it leaves the page. */
export function blochDemo(spec: BlochSpec): { el: HTMLElement; stop: () => void } {
  const captionTop = h("div", { class: "bv-states" });
  const captionBottom = h("div", { class: "bv-caption" });
  const spheres = h("div", { class: "bv-spheres" });
  const el = h("div", { class: "bloch-demo" }, spheres, captionTop, captionBottom);
  let timeline: Timeline;

  if (spec.gate && isBinary(spec.gate)) {
    const from = (spec.from && Array.isArray(spec.from[0]) ? spec.from : [["1/sqrt2", "1/sqrt2"], ["1", "0"]]) as Amps[];
    const st = StateVector.fromProduct(from.slice(0, 2).map(parseAmps));
    const before = ket(st);
    const v0 = [blochVector(st, 0), blochVector(st, 1)];
    st.applyControlled(0, 1, binaryTarget(spec.gate as BinaryGateType));
    const v1 = [blochVector(st, 0), blochVector(st, 1)];
    const names = spec.gate === "CNOT" ? ["control ●", "target ⊕"] : ["qubit 1", "qubit 2"];
    const sp = names.map((n) => new Sphere(n));
    spheres.append(...sp.map((x) => x.el));
    const ab = statePair(captionTop, before, ket(st), spec.gate);
    const shrinks = v1.some((v) => norm(v) < 0.99);
    captionBottom.textContent =
      spec.caption ??
      (shrinks
        ? "The arrows shrink into the sphere: the qubits are now entangled and no longer have a direction of their own."
        : `${spec.gate} acts on both qubits together.`);
    timeline = {
      period: HOLD0 + MOVE + HOLD1,
      frame(t) {
        const p = ease(Math.min(1, Math.max(0, (t - HOLD0) / MOVE)));
        sp.forEach((x, i) => x.set(lerp(v0[i], v1[i], p), [v0[i], lerp(v0[i], v1[i], p)]));
        ab(t < HOLD0 ? 0 : t > HOLD0 + MOVE ? 1 : -1);
      },
    };
  } else if (spec.gate) {
    const type = spec.gate as UnaryGateType;
    const angle = spec.angle ? parseReal(spec.angle) : Math.PI / 2;
    const fromAmps = (spec.from ? (Array.isArray(spec.from[0]) ? spec.from[0] : spec.from) : ["1", "0"]) as Amps;
    const st = StateVector.fromProduct([parseAmps(fromAmps)]);
    const before = ket(st);
    const v0 = blochVector(st, 0);
    st.apply1(0, unaryMatrix(type, angle));
    const rot = gateRotation(type, angle);
    const sphere = new Sphere();
    sphere.showAxis(rot.axis);
    spheres.append(sphere.el);
    const label = type === "P" ? `P(${formatAngle(angle)})` : type;
    const ab = statePair(captionTop, before, ket(st), label);
    captionBottom.textContent = spec.caption ?? `${label}: ${describeRotation(type, angle)}.`;
    timeline = {
      period: HOLD0 + MOVE + HOLD1,
      frame(t) {
        const p = ease(Math.min(1, Math.max(0, (t - HOLD0) / MOVE)));
        const trail: Vec3[] = [];
        for (let i = 0; i <= 40; i++) trail.push(rotate(v0, rot.axis, rot.angle * p * (i / 40)));
        sphere.set(rotate(v0, rot.axis, rot.angle * p), trail);
        ab(t < HOLD0 ? 0 : t > HOLD0 + MOVE ? 1 : -1);
      },
    };
  } else {
    const tour = (spec.tour ?? [["1", "0"]]).map((a) => {
      const st = StateVector.fromProduct([parseAmps(a)]);
      return { v: blochVector(st, 0), label: ket(st) };
    });
    const sphere = new Sphere();
    spheres.append(sphere.el);
    const stateEl = h("span", { class: "bv-ket on" });
    captionTop.append(stateEl);
    captionBottom.textContent = spec.caption ?? "";
    const leg = HOLD1 + MOVE;
    timeline = {
      period: tour.length > 1 ? tour.length * leg : 1,
      frame(t) {
        const i = Math.floor(t / leg) % tour.length;
        const a = tour[i];
        const b = tour[(i + 1) % tour.length];
        const local = t - i * leg;
        const p = tour.length > 1 ? ease(Math.min(1, Math.max(0, (local - HOLD1) / MOVE))) : 0;
        const rot = rotationBetween(a.v, b.v);
        sphere.set(rotate(a.v, rot.axis, rot.angle * p));
        stateEl.textContent = p < 0.5 ? a.label : b.label;
      },
    };
  }

  let raf = 0;
  const t0 = performance.now();
  const loop = (now: number) => {
    // rAF timestamps can predate t0 by a frame, so clamp to keep t >= 0.
    timeline.frame((Math.max(0, now - t0) / 1000) % timeline.period);
    raf = requestAnimationFrame(loop);
  };
  timeline.frame(0);
  raf = requestAnimationFrame(loop);
  return { el, stop: () => cancelAnimationFrame(raf) };
}

/** "before ─X→ after" with the current end highlighted; returns a setter (0 = before, 1 = after, -1 = moving). */
function statePair(parent: HTMLElement, before: string, after: string, gate: string): (which: number) => void {
  const a = h("span", { class: "bv-ket" }, before);
  const b = h("span", { class: "bv-ket" }, after);
  parent.append(a, h("span", { class: "bv-gate" }, ` ─${gate}→ `), b);
  return (which) => {
    a.classList.toggle("on", which === 0);
    b.classList.toggle("on", which === 1);
  };
}
