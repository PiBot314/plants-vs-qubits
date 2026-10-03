import * as C from "./complex";
import { Complex } from "./complex";

/**
 * Parses amplitude expressions such as "1/sqrt2", "-i/2", "sqrt(3)/2", "(1+i)/2",
 * "exp(i*pi/4)/sqrt2", "e^(i pi/4)/√2". Juxtaposition means multiplication.
 */
export function parseComplex(src: string): Complex {
  const tokens = tokenize(src);
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (t: string) => {
    if (next() !== t) throw new Error(`Expected '${t}' in "${src}"`);
  };
  const startsPrimary = (t: string | undefined) =>
    t !== undefined && (t === "(" || /^[0-9.]/.test(t) || /^[a-zπ√]/i.test(t));

  function expr(): Complex {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const rhs = term();
      v = op === "+" ? C.add(v, rhs) : C.sub(v, rhs);
    }
    return v;
  }

  function term(): Complex {
    let v = unary();
    for (;;) {
      const t = peek();
      if (t === "*") {
        next();
        v = C.mul(v, unary());
      } else if (t === "/") {
        next();
        v = C.div(v, unary());
      } else if (startsPrimary(t)) {
        v = C.mul(v, power());
      } else return v;
    }
  }

  function unary(): Complex {
    if (peek() === "-") {
      next();
      return C.neg(unary());
    }
    if (peek() === "+") {
      next();
      return unary();
    }
    return power();
  }

  function power(): Complex {
    const base = primary();
    if (peek() === "^") {
      next();
      return C.pow(base, unary());
    }
    return base;
  }

  function primary(): Complex {
    const t = next();
    if (t === undefined) throw new Error(`Unexpected end of "${src}"`);
    if (t === "(") {
      const v = expr();
      expect(")");
      return v;
    }
    if (/^[0-9.]/.test(t)) return C.c(parseFloat(t));
    switch (t.toLowerCase()) {
      case "i":
        return C.I;
      case "pi":
      case "π":
        return C.c(Math.PI);
      case "e":
        return C.c(Math.E);
      case "sqrt":
      case "√":
        return C.sqrt(power());
      case "exp":
        return C.exp(power());
    }
    throw new Error(`Unknown token '${t}' in "${src}"`);
  }

  const v = expr();
  if (pos !== tokens.length) throw new Error(`Unexpected '${peek()}' in "${src}"`);
  return v;
}

function tokenize(src: string): string[] {
  const re = /\s*(\d+\.?\d*|\.\d+|[a-zA-Z]+|π|√|[-+*/^()])/y;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while (re.lastIndex < src.length) {
    const start = re.lastIndex;
    m = re.exec(src);
    if (!m) {
      if (/^\s*$/.test(src.slice(start))) break;
      throw new Error(`Cannot parse "${src}" at position ${start}`);
    }
    out.push(m[1]);
  }
  return out;
}

/** Parses a real number expression (e.g. gate angles like "pi/8"). */
export function parseReal(src: string | number): number {
  if (typeof src === "number") return src;
  const v = parseComplex(src);
  if (Math.abs(v.im) > 1e-12) throw new Error(`"${src}" is not real`);
  return v.re;
}
