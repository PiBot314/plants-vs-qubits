import { describe, expect, it } from "vitest";
import { c } from "../src/quantum/complex";
import { MATRICES, phase } from "../src/quantum/gates";
import { StateVector } from "../src/quantum/state";
import { parseComplex } from "../src/quantum/parse";

const r = Math.SQRT1_2;

describe("StateVector", () => {
  it("X flips |0> to |1>", () => {
    const s = StateVector.fromProduct([[c(1), c(0)]]);
    s.apply1(0, MATRICES.X);
    expect(s.marginalP0(0)).toBeCloseTo(0);
  });

  it("HZH = X", () => {
    const s = StateVector.fromProduct([[c(1), c(0)]]);
    s.apply1(0, MATRICES.H);
    s.apply1(0, MATRICES.Z);
    s.apply1(0, MATRICES.H);
    expect(s.re[1]).toBeCloseTo(1);
    expect(s.marginalP0(0)).toBeCloseTo(0);
  });

  it("S S = Z and T T = S", () => {
    const a = StateVector.fromProduct([[c(r), c(r)]]);
    a.apply1(0, MATRICES.T);
    a.apply1(0, MATRICES.T);
    const b = StateVector.fromProduct([[c(r), c(r)]]);
    b.apply1(0, MATRICES.S);
    expect(a.im[1]).toBeCloseTo(b.im[1]);
    b.apply1(0, phase(Math.PI / 2));
    expect(b.re[1]).toBeCloseTo(-r);
  });

  it("CNOT on |+0> makes a Bell state with mixed marginals", () => {
    const s = StateVector.fromProduct([
      [c(r), c(r)],
      [c(1), c(0)],
    ]);
    s.applyControlled(0, 1, MATRICES.X);
    expect(s.re[0]).toBeCloseTo(r); // |00>
    expect(s.re[3]).toBeCloseTo(r); // |11>
    expect(s.marginalP0(0)).toBeCloseTo(0.5);
    expect(s.marginalP0(1)).toBeCloseTo(0.5);
    expect(s.purity([0])).toBeCloseTo(0.5);
    expect(s.purity([0, 1])).toBeCloseTo(1);
  });

  it("product states are pure per qubit and recoverable", () => {
    const s = StateVector.fromProduct([
      [c(r), c(0, r)],
      [c(0), c(1)],
    ]);
    expect(s.purity([0])).toBeCloseTo(1);
    const q0 = s.subsystemState([0])!;
    expect(q0[0].re).toBeCloseTo(r);
    expect(q0[1].im).toBeCloseTo(r);
    const q1 = s.subsystemState([1])!;
    expect(q1[1].re).toBeCloseTo(1);
  });
});

describe("parseComplex", () => {
  const cases: [string, number, number][] = [
    ["1", 1, 0],
    ["0", 0, 0],
    ["1/sqrt2", r, 0],
    ["-1/sqrt(2)", -r, 0],
    ["i/2", 0, 0.5],
    ["-i/sqrt2", 0, -r],
    ["sqrt3/2", Math.sqrt(3) / 2, 0],
    ["(1+i)/2", 0.5, 0.5],
    ["exp(i*pi/4)/sqrt2", 0.5, 0.5],
    ["e^(i pi/2)", 0, 1],
    ["1/√2", r, 0],
    ["0.6", 0.6, 0],
  ];
  it.each(cases)("%s", (src, re, im) => {
    const v = parseComplex(src);
    expect(v.re).toBeCloseTo(re);
    expect(v.im).toBeCloseTo(im);
  });

  it("rejects junk", () => {
    expect(() => parseComplex("foo")).toThrow();
    expect(() => parseComplex("1/")).toThrow();
  });
});

describe("entangled starting states", () => {
  it("fromGroups places a Bell pair on the right qubits", () => {
    // qubit 1 is a lone |1>; qubits 0 and 2 share (|00> + |11>)/√2
    const s = StateVector.fromGroups(3, [
      { qubits: [0, 2], amps: [c(r), c(0), c(0), c(r)] },
      { qubits: [1], amps: [c(0), c(1)] },
    ]);
    expect(s.re[0b010]).toBeCloseTo(r); // q0=0, q1=1, q2=0
    expect(s.re[0b111]).toBeCloseTo(r);
    expect(s.purity([0])).toBeCloseTo(0.5);
    expect(s.purity([1])).toBeCloseTo(1);
  });

  it("ket order puts the first listed qubit on the left", () => {
    // |01>: first qubit 0, second qubit 1
    const s = StateVector.fromGroups(2, [{ qubits: [0, 1], amps: [c(0), c(1), c(0), c(0)] }]);
    expect(s.marginalP0(0)).toBeCloseTo(1);
    expect(s.marginalP0(1)).toBeCloseTo(0);
  });

  it("CY untangles (|00> + i|11>)/√2", () => {
    const s = StateVector.fromGroups(2, [{ qubits: [0, 1], amps: [c(r), c(0), c(0), c(0, r)] }]);
    s.applyControlled(0, 1, MATRICES.Y);
    expect(s.purity([0])).toBeCloseTo(1);
  });
});
