import { describe, expect, it } from "vitest";
import { c, expi, scale } from "../src/quantum/complex";
import { formatAngle, formatComplex, formatKetSum, formatReal } from "../src/quantum/format";

const r = Math.SQRT1_2;

describe("formatComplex", () => {
  const cases: [number, number, string][] = [
    [0, 0, "0"],
    [1, 0, "1"],
    [-1, 0, "−1"],
    [r, 0, "1/√2"],
    [-r, 0, "−1/√2"],
    [0, 1, "i"],
    [0, -0.5, "−i/2"],
    [0, r, "i/√2"],
    [Math.sqrt(3) / 2, 0, "√3/2"],
    [0.5, 0.5, "(1+i)/2"],
    [0.5, -0.5, "(1−i)/2"],
    [-r, r, "(−1+i)/√2"],
    [0.5, Math.sqrt(3) / 2, "(1+√3i)/2"],
    [0.3, 0, "0.3"],
  ];
  it.each(cases)("(%f, %f) -> %s", (re, im, out) => {
    expect(formatComplex(c(re, im))).toBe(out);
  });

  it("uses polar form for awkward phases", () => {
    expect(formatComplex(scale(expi(Math.PI / 8), r))).toBe("e^{iπ/8}/√2");
    expect(formatComplex(scale(expi(-Math.PI / 8), 1))).toBe("e^{−iπ/8}");
  });
});

describe("other formatters", () => {
  it("formatReal", () => {
    expect(formatReal(0.5)).toBe("1/2");
    expect(formatReal(0.75)).toBe("3/4");
    expect(formatReal(0.123)).toBe("0.12");
  });
  it("formatAngle", () => {
    expect(formatAngle(Math.PI / 4)).toBe("π/4");
    expect(formatAngle((3 * Math.PI) / 2)).toBe("3π/2");
    expect(formatAngle(-Math.PI / 8)).toBe("−π/8");
  });
  it("formatKetSum", () => {
    expect(formatKetSum([c(r), c(0), c(0), c(r)], 2)).toBe("1/√2|00⟩ + 1/√2|11⟩");
    expect(formatKetSum([c(r), c(0), c(0), c(-r)], 2)).toBe("1/√2|00⟩ − 1/√2|11⟩");
  });
});
