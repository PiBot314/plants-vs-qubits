import { describe, expect, it } from "vitest";
import { c } from "../src/quantum/complex";
import { blochVector, gateRotation, rotate, rotationBetween, Vec3 } from "../src/quantum/bloch";
import { MATRICES, unaryMatrix, UnaryGateType } from "../src/quantum/gates";
import { StateVector } from "../src/quantum/state";

const r = Math.SQRT1_2;
const close = (a: Vec3, b: Vec3) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i]));

describe("Bloch vectors", () => {
  it("places the basis states on the axes", () => {
    close(blochVector(StateVector.fromProduct([[c(1), c(0)]]), 0), [0, 0, 1]);
    close(blochVector(StateVector.fromProduct([[c(0), c(1)]]), 0), [0, 0, -1]);
    close(blochVector(StateVector.fromProduct([[c(r), c(r)]]), 0), [1, 0, 0]);
    close(blochVector(StateVector.fromProduct([[c(r), c(0, r)]]), 0), [0, 1, 0]);
  });

  it("entangled qubits have zero-length vectors", () => {
    const s = StateVector.fromProduct([
      [c(r), c(r)],
      [c(1), c(0)],
    ]);
    s.applyControlled(0, 1, MATRICES.X);
    close(blochVector(s, 0), [0, 0, 0]);
  });

  it.each(["X", "Y", "Z", "H", "S", "T", "P"] as UnaryGateType[])("%s matches its Bloch rotation", (g) => {
    const angle = 0.7;
    for (const st of [
      [c(1), c(0)],
      [c(r), c(0, r)],
      [c(0.6), c(0, 0.8)],
    ] as [ReturnType<typeof c>, ReturnType<typeof c>][]) {
      const s = StateVector.fromProduct([st]);
      const before = blochVector(s, 0);
      s.apply1(0, unaryMatrix(g, angle));
      const rot = gateRotation(g, angle);
      close(rotate(before, rot.axis, rot.angle), blochVector(s, 0));
    }
  });

  it("rotationBetween handles antipodes", () => {
    const { axis, angle } = rotationBetween([0, 0, 1], [0, 0, -1]);
    expect(angle).toBeCloseTo(Math.PI);
    close(rotate([0, 0, 1], axis, Math.PI / 2), [1, 0, 0]);
  });
});
