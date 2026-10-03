import { Board } from "../game/board";
import { GateOption, Level } from "../game/types";
import { h, s } from "./dom";

export interface QubitRender {
  /** Cell position (fractional while moving). Cell c spans lines c..c+1. */
  pos: number;
  lane: number;
  color: string;
  lines: [string, string];
  /** Show |0⟩/|1⟩ labels next to the two lines (off for entangled qubits). */
  kets: boolean;
  opacity: number;
}

export interface BoardHandlers {
  onSlot(lane: number, x: number): void;
  onGateClick(id: number): void;
  onGateRemove(id: number): void;
  onGateHover(id: number | null): void;
  onQubitHover(k: number | null): void;
}

interface QubitEl {
  g: SVGGElement;
  circle: SVGCircleElement;
  t0: SVGTextElement;
  t1: SVGTextElement;
  key: string;
}

const M = 28; // outer margin, px

/** SVG view of the grid, the gates on it and the qubits moving across it. */
export class BoardView {
  readonly el: HTMLDivElement;
  private svg: SVGSVGElement;
  private gridLayer = s("g");
  private hotLayer = s("g");
  private gateLayer = s("g");
  private qubitLayer = s("g");
  private fxLayer = s("g");
  private gateEls = new Map<number, SVGGElement>();
  private qubitEls: QubitEl[] = [];
  private cell = 100;
  private queueCells: number;

  constructor(
    private level: Level,
    private handlers: BoardHandlers,
  ) {
    this.queueCells = Math.max(1, ...level.enemies.map((e) => e.time + 1));
    this.svg = s("svg", { class: "board" }, this.gridLayer, this.hotLayer, this.gateLayer, this.qubitLayer, this.fxLayer);
    this.svg.addEventListener("contextmenu", (e) => e.preventDefault());
    this.el = h("div", { class: "scroller" }, this.svg);
  }

  private px = (x: number) => M + x * this.cell;

  /** Size the board to fit the available space and redraw the static grid. */
  layout(availW: number, availH: number): void {
    const { lanes, columns } = this.level;
    const byH = (availH - 2 * M) / lanes;
    const byW = ((availW - 2 * M) * 0.72) / columns;
    this.cell = Math.round(Math.max(56, Math.min(130, byH, byW)));
    const w = 2 * M + (columns + this.queueCells) * this.cell;
    const ht = 2 * M + lanes * this.cell;
    this.svg.setAttribute("width", String(w));
    this.svg.setAttribute("height", String(ht));
    this.svg.setAttribute("viewBox", `0 0 ${w} ${ht}`);
    this.drawGrid();
    this.buildQubits();
  }

  private drawGrid(): void {
    const { lanes, columns } = this.level;
    const c = this.cell;
    const top = M;
    const bottom = M + lanes * c;
    const right = this.px(columns + this.queueCells);
    const els: SVGElement[] = [
      s("rect", { class: "grid-bg", x: M, y: M, width: columns * c, height: lanes * c, rx: 4 }),
    ];
    for (let l = 0; l <= lanes; l++) {
      const y = M + l * c;
      els.push(s("line", { class: "lane-line", x1: M, x2: this.px(columns), y1: y, y2: y }));
      els.push(s("line", { class: "queue-line", x1: this.px(columns), x2: right, y1: y, y2: y }));
    }
    for (let x = 1; x < columns; x++) {
      els.push(s("line", { class: "col-line", x1: this.px(x), x2: this.px(x), y1: top, y2: bottom }));
    }
    els.push(s("line", { class: "entry-line", x1: this.px(columns), x2: this.px(columns), y1: top, y2: bottom }));
    els.push(s("line", { class: "exit-line", x1: M, x2: M, y1: top, y2: bottom }));
    els.push(s("text", { class: "queue-label", x: this.px(columns) + 6, y: M - 9 }, "INCOMING →"));
    this.gridLayer.replaceChildren(...els);
  }

  /** Redraws placed gates and, when a gate is selected, the free slots it can go in. */
  drawGates(board: Board, selected: GateOption | null, editable: boolean): void {
    const c = this.cell;
    this.svg.classList.toggle("locked", !editable);

    const hots: SVGElement[] = [];
    if (editable && selected) {
      for (let lane = 0; lane < this.level.lanes; lane++) {
        for (let x = 1; x <= this.level.columns; x++) {
          if (board.checkPlacement(selected.index, lane, x) !== null) continue;
          const onClick = () => this.handlers.onSlot(lane, x);
          hots.push(
            selected.binary
              ? s("circle", { class: "hot", cx: this.px(x), cy: this.px(lane + 1), r: Math.max(9, c * 0.11), onclick: onClick })
              : s("rect", {
                  class: "hot",
                  x: this.px(x) - c * 0.1,
                  y: this.px(lane) + c * 0.18,
                  width: c * 0.2,
                  height: c * 0.64,
                  rx: 4,
                  onclick: onClick,
                }),
          );
        }
      }
    }
    this.hotLayer.replaceChildren(...hots);

    this.gateEls.clear();
    const gates = board.placements.map((p) => {
      const opt = this.level.gates[p.option];
      const x = this.px(p.x);
      const g = s("g", {
        class: "gate",
        onclick: () => editable && this.handlers.onGateClick(p.id),
        oncontextmenu: (e: Event) => {
          e.preventDefault();
          if (editable) this.handlers.onGateRemove(p.id);
        },
        onmouseenter: () => this.handlers.onGateHover(p.id),
        onmouseleave: () => this.handlers.onGateHover(null),
      });
      if (opt.binary) {
        const yTop = this.px(p.lane + 0.5);
        const yBot = this.px(p.lane + 1.5);
        const rr = c * 0.11;
        // Wide transparent hit area along the wire.
        g.append(s("rect", { x: x - c * 0.14, y: yTop - rr, width: c * 0.28, height: yBot - yTop + 2 * rr, fill: "transparent" }));
        g.append(s("line", { class: "wire", x1: x, x2: x, y1: yTop, y2: yBot }));
        g.append(s("circle", { class: "dot", cx: x, cy: this.px(p.lane + 1), r: 3 }));
        const [yc, yt] = p.flipped ? [yBot, yTop] : [yTop, yBot];
        if (opt.type === "CNOT") {
          g.append(s("circle", { class: "dot", cx: x, cy: yc, r: rr * 0.6 }));
          g.append(s("circle", { class: "target", cx: x, cy: yt, r: rr }));
          g.append(s("line", { class: "wire", x1: x - rr, x2: x + rr, y1: yt, y2: yt }));
          g.append(s("line", { class: "wire", x1: x, x2: x, y1: yt - rr, y2: yt + rr }));
        } else if (opt.type === "CY") {
          // Control dot, and a small Y box on the target.
          const b = rr * 1.7;
          g.append(s("circle", { class: "dot", cx: x, cy: yc, r: rr * 0.6 }));
          g.append(s("rect", { class: "box", x: x - b / 2, y: yt - b / 2, width: b, height: b, rx: 5 }));
          g.append(s("text", { x, y: yt, "font-size": b * 0.62 }, "Y"));
        } else if (opt.type === "SWAP") {
          // The usual circuit symbol: a cross on each lane.
          const k = rr * 0.7;
          for (const y of [yTop, yBot]) {
            g.append(s("line", { class: "wire", x1: x - k, x2: x + k, y1: y - k, y2: y + k }));
            g.append(s("line", { class: "wire", x1: x - k, x2: x + k, y1: y + k, y2: y - k }));
          }
        } else {
          g.append(s("circle", { class: "dot", cx: x, cy: yTop, r: rr * 0.6 }));
          g.append(s("circle", { class: "dot", cx: x, cy: yBot, r: rr * 0.6 }));
        }
      } else {
        const size = c * 0.4;
        const y = this.px(p.lane + 0.5);
        const label = opt.type === "P" ? opt.label : opt.type;
        g.append(s("rect", { class: "box", x: x - size / 2, y: y - size / 2, width: size, height: size, rx: 7 }));
        g.append(
          s(
            "text",
            {
              x,
              y,
              "font-size": label.length > 2 ? c * 0.11 : c * 0.19,
              ...(label.length > 2 ? { textLength: size * 0.86, lengthAdjust: "spacingAndGlyphs" } : {}),
            },
            label,
          ),
        );
      }
      this.gateEls.set(p.id, g);
      return g;
    });
    this.gateLayer.replaceChildren(...gates);
  }

  private buildQubits(): void {
    const r = this.cell * 0.37;
    const fs = Math.max(9, this.cell * 0.12);
    this.qubitEls = this.level.enemies.map((_, k) => {
      const circle = s("circle", { r });
      const t0 = s("text", { y: -r * 0.36, "font-size": fs });
      const t1 = s("text", { y: r * 0.36, "font-size": fs });
      const g = s(
        "g",
        {
          class: "qubit",
          onmouseenter: () => this.handlers.onQubitHover(k),
          onmouseleave: () => this.handlers.onQubitHover(null),
        },
        circle,
        s("line", { class: "sep", x1: -r * 0.55, x2: r * 0.55, y1: 0, y2: 0 }),
        t0,
        t1,
      );
      return { g, circle, t0, t1, key: "" };
    });
    this.qubitLayer.replaceChildren(...this.qubitEls.map((q) => q.g));
  }

  drawQubits(qs: QubitRender[]): void {
    const c = this.cell;
    const r = c * 0.37;
    const fs = Math.max(9, c * 0.12);
    qs.forEach((q, k) => {
      const el = this.qubitEls[k];
      el.g.setAttribute("transform", `translate(${this.px(q.pos + 0.5)} ${this.px(q.lane + 0.5)})`);
      el.g.style.opacity = String(q.opacity);
      el.g.style.display = q.opacity <= 0 ? "none" : "";
      const key = `${q.color}|${q.lines.join("|")}|${q.kets}`;
      if (key === el.key) return;
      el.key = key;
      el.circle.setAttribute("fill", q.color);
      el.circle.setAttribute("fill-opacity", "0.2");
      el.circle.setAttribute("stroke", q.color);
      el.circle.style.filter = `drop-shadow(0 0 ${c * 0.07}px ${q.color})`;
      const maxW = r * 1.7;
      [el.t0, el.t1].forEach((t, i) => {
        t.replaceChildren(q.lines[i]);
        if (q.kets) t.append(s("tspan", { class: "ket", "font-size": fs * 0.8 }, i === 0 ? "|0⟩" : "|1⟩"));
        const chars = q.lines[i].length + (q.kets ? 2.4 : 0);
        if (chars * fs * 0.6 > maxW) {
          t.setAttribute("textLength", String(maxW));
          t.setAttribute("lengthAdjust", "spacingAndGlyphs");
        } else {
          t.removeAttribute("textLength");
        }
      });
    });
  }

  flash(placementId: number): void {
    const g = this.gateEls.get(placementId);
    if (!g) return;
    g.classList.remove("fired");
    void g.getBoundingClientRect(); // restart the animation
    g.classList.add("fired");
  }

  /** Floating "−50" at the exit edge of a lane. */
  showDamage(lane: number, amount: number, text: string): void {
    if (amount < 1e-9) return;
    const t = s("text", { class: "dmg", x: M + 4, y: this.px(lane + 0.5) - this.cell * 0.45 }, text);
    this.fxLayer.append(t);
    setTimeout(() => t.remove(), 1400);
  }
}
