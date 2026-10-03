import type { Navigate } from "../main";
import { Board } from "../game/board";
import { EntanglementTracker, QUBIT_PURPLE } from "../game/entangle";
import { GATE_INFO, getContent, getLevel, nextLevel } from "../game/level";
import { recordWin } from "../game/progress";
import { earnsStar, Outcome, SimEvent, Simulation, START_HP } from "../game/sim";
import { Level } from "../game/types";
import { formatComplex, formatKetSum, formatReal } from "../quantum/format";
import { BoardView, QubitRender } from "./boardView";
import { Cleanup, h } from "./dom";

const SPEEDS = [0.25, 0.5, 1, 2, 4];
const BASE_TICK_MS = 900;

type Mode = "edit" | "playing" | "paused" | "done";
type QubitLook = Pick<QubitRender, "color" | "lines" | "kets">;

interface TickAnim {
  t: number;
  startCells: number[];
  wasExited: boolean[];
  after: QubitLook[];
  events: SimEvent[];
  half: boolean;
}

const DEFAULT_TEXT = [
  "Pick a gate from the top bar and click a grid line to place it. Right-click a gate to remove it. Press ▶ to send the qubits in.",
];

export function mountGame(root: HTMLElement, levelId: number, navigate: Navigate): Cleanup {
  const found = getLevel(levelId);
  if (!found) {
    navigate({ name: "levels" });
    return () => {};
  }
  const level: Level = found;
  const n = level.enemies.length;
  const board = new Board(level);

  /* ---------- state ---------- */
  let mode: Mode = "edit";
  let selected: number | null = null;
  let speedIdx = 2;
  let sim = new Simulation(level, []);
  let tracker = new EntanglementTracker(n);
  let colors = new Map<number, string>();
  let shown: QubitLook[] = [];
  let anim: TickAnim | null = null;
  let hp = START_HP;

  const startMsgs = getContent(level.id, "start");
  const messages = startMsgs.length ? startMsgs : DEFAULT_TEXT;
  let msgIdx = 0;
  let hint: { text: string; cls: string } | null = null;
  let warnTimer = 0;

  /* ---------- DOM ---------- */
  const coinsEl = h("span", { class: "mono" });
  const chips = level.gates.map((g) =>
    h(
      "button",
      {
        class: "chip",
        onclick: () => selectGate(g.index),
        onmouseenter: () => setHint(gateHint(g.index)),
        onmouseleave: () => setHint(null),
      },
      h("span", { class: "sym" }, g.label),
      h("span", { class: "cost" }, h("span", { class: "coin" }), String(g.cost)),
    ),
  );
  const hpFill = h("div", { class: "fill" });
  const hpLabel = h("div", { class: "label" });
  const wrap = h("div", { class: "board-wrap" });
  const msgEl = h("div", { class: "msg" });
  const pageEl = h("span");
  const prevBtn = h("button", { title: "Previous", onclick: () => page(-1) }, "‹");
  const nextBtn = h("button", { title: "Next", onclick: () => page(1) }, "›");
  const pager = h("div", { class: "pager" }, prevBtn, pageEl, nextBtn);
  const speedLabel = h("span");
  const speedInput = h("input", { type: "range", min: 0, max: SPEEDS.length - 1, step: 1, value: speedIdx });
  speedInput.addEventListener("input", () => {
    speedIdx = Number(speedInput.value);
    renderHud();
  });
  const undoBtn = h("button", { class: "icon", title: "Undo (Ctrl+Z)", onclick: () => undo() }, "↶");
  const restartBtn = h("button", { class: "icon", title: "Restart: clear all gates", onclick: () => restart() }, "⟲");
  const playBtn = h("button", { class: "icon primary play", title: "Play / pause (Space)", onclick: () => togglePlay() }, "▶");

  const screen = h(
    "div",
    { class: "screen game" },
    h(
      "div",
      { class: "topbar" },
      h("div", { class: "coins", title: "Coins left" }, h("span", { class: "coin" }), coinsEl),
      h("div", { class: "gate-bar" }, ...chips),
      h("button", { class: "icon", title: "Exit to level select", onclick: () => navigate({ name: "levels" }) }, "✕"),
    ),
    h("div", { class: "hpbar" }, hpFill, hpLabel),
    wrap,
    h(
      "div",
      { class: "bottombar" },
      h("label", { class: "speed" }, speedLabel, speedInput),
      h("div", { class: "textbox" }, msgEl, pager),
      h("div", { class: "controls" }, undoBtn, restartBtn, playBtn),
    ),
  );
  root.append(screen);

  const view = new BoardView(level, {
    onSlot: (lane, x) => {
      if (selected === null || mode !== "edit") return;
      const r = board.place(selected, lane, x);
      if (typeof r === "string") warn(r);
      else if (level.gates[selected].cost > board.coins) selected = null;
      renderBoard();
    },
    onGateClick: (id) => {
      if (mode !== "edit") return;
      board.flip(id);
      renderBoard();
    },
    onGateRemove: (id) => {
      if (mode !== "edit") return;
      board.remove(id);
      setHint(null);
      renderBoard();
    },
    onGateHover: (id) => setHint(id === null ? null : placedHint(id)),
    onQubitHover: (k) => setHint(k === null ? null : qubitHint(k)),
  });
  wrap.append(view.el);

  /* ---------- qubit display ---------- */
  function look(k: number): QubitLook {
    const col = colors.get(k);
    if (col) return { color: col, lines: ["P(1)", formatReal(1 - sim.state.marginalP0(k))], kets: false };
    const st = sim.state.subsystemState([k]);
    if (!st) return { color: QUBIT_PURPLE, lines: ["P(1)", formatReal(1 - sim.state.marginalP0(k))], kets: false };
    return { color: QUBIT_PURPLE, lines: [formatComplex(st[0]), formatComplex(st[1])], kets: true };
  }
  const looks = () => level.enemies.map((_, k) => look(k));

  function qubitRenders(): QubitRender[] {
    return level.enemies.map((e, k) => {
      let pos = sim.cell(k);
      let opacity = sim.exited[k] ? 0 : 1;
      if (anim) {
        const t = Math.min(anim.t, 1);
        pos = anim.startCells[k] - (anim.wasExited[k] ? 0 : t);
        if (anim.wasExited[k]) opacity = 0;
        else if (sim.exited[k]) opacity = t < 0.5 ? 1 : Math.max(0, 1 - (t - 0.5) * 2.2);
      }
      return { pos, lane: e.lane, opacity, ...shown[k] };
    });
  }

  /* ---------- text box ---------- */
  function renderText() {
    if (hint) {
      msgEl.className = `msg ${hint.cls}`;
      msgEl.textContent = hint.text;
      pager.style.visibility = "hidden";
      return;
    }
    msgEl.className = "msg";
    msgEl.textContent = messages[msgIdx];
    pager.style.visibility = messages.length > 1 ? "visible" : "hidden";
    pageEl.textContent = `${msgIdx + 1}/${messages.length}`;
    prevBtn.disabled = msgIdx === 0;
    nextBtn.disabled = msgIdx === messages.length - 1;
  }

  function page(d: number) {
    msgIdx = Math.max(0, Math.min(messages.length - 1, msgIdx + d));
    renderText();
  }

  function setHint(text: string | null) {
    if (warnTimer) return; // let warnings stay visible
    hint = text ? { text, cls: "hint" } : null;
    renderText();
  }

  function warn(text: string) {
    clearTimeout(warnTimer);
    hint = { text, cls: "warn" };
    renderText();
    warnTimer = window.setTimeout(() => {
      warnTimer = 0;
      hint = null;
      renderText();
    }, 2200);
  }

  function gateHint(option: number): string {
    const g = level.gates[option];
    const info = GATE_INFO[g.type];
    const name = g.type === "P" ? `${info.name} ${g.label}` : info.name;
    const desc = g.type === "P" ? info.description.replace("φ", g.label.slice(2, -1)) : info.description;
    return `${name} · cost ${g.cost} · ${desc}`;
  }

  function placedHint(id: number): string {
    const p = board.placements.find((q) => q.id === id);
    if (!p) return "";
    const g = level.gates[p.option];
    let extra = "";
    if (mode === "edit") extra = g.type === "CNOT" ? " Click to swap control/target, right-click to remove." : " Right-click to remove.";
    return gateHint(p.option) + extra;
  }

  function qubitHint(k: number): string {
    const e = level.enemies[k];
    const p0 = formatReal(sim.state.marginalP0(k));
    if (colors.has(k)) {
      const group = tracker.groups(sim.state).find((g) => g.includes(k)) ?? [k];
      const st = sim.state.subsystemState(group);
      const names = group.map((q) => `q${q + 1}`).join(" ");
      const joint = st ? formatKetSum(st, group.length) : "(mixed)";
      return `Entangled |${names}⟩ = ${joint} · P(0) of q${k + 1} = ${p0}`;
    }
    const [a, b] = shown[k].lines;
    return `q${k + 1} · lane ${e.lane + 1} · ${a}|0⟩ + ${b}|1⟩ · P(0) = ${p0} → ${formatReal(sim.state.marginalP0(k) * 100)} damage`;
  }

  /* ---------- rendering ---------- */
  function renderHud() {
    coinsEl.textContent = String(board.coins);
    chips.forEach((chip, i) => {
      chip.classList.toggle("selected", selected === i);
      chip.classList.toggle("poor", level.gates[i].cost > board.coins);
      chip.disabled = mode !== "edit";
    });
    hpFill.style.width = `${hp}%`;
    hpLabel.textContent = `HP ${Math.round(hp * 100) / 100}`;
    speedLabel.textContent = `Speed ${SPEEDS[speedIdx]}×`;
    undoBtn.disabled = mode !== "edit" || !board.canUndo;
    playBtn.textContent = mode === "playing" ? "❚❚" : "▶";
  }

  function renderBoard() {
    view.drawGates(board, selected === null ? null : level.gates[selected], mode === "edit");
    view.drawQubits(qubitRenders());
    renderHud();
  }

  function relayout() {
    view.layout(wrap.clientWidth, wrap.clientHeight);
    renderBoard();
  }

  /* ---------- actions ---------- */
  function selectGate(i: number) {
    if (mode !== "edit") return;
    if (selected === i) selected = null;
    else if (level.gates[i].cost > board.coins) {
      warn("Not enough coins");
      return;
    } else selected = i;
    renderBoard();
  }

  function undo() {
    if (mode !== "edit") return;
    board.undo();
    renderBoard();
  }

  function resetRun() {
    mode = "edit";
    anim = null;
    sim = new Simulation(level, []);
    tracker = new EntanglementTracker(n);
    colors = new Map();
    shown = looks();
    hp = START_HP;
    overlay?.remove();
    overlay = null;
  }

  function restart() {
    resetRun();
    board.clear();
    selected = null;
    msgIdx = 0;
    hint = null;
    renderText();
    renderBoard();
  }

  function togglePlay() {
    if (mode === "edit") {
      sim = new Simulation(
        level,
        board.placements.map((p) => ({ ...p })),
      );
      selected = null;
      mode = "playing";
    } else if (mode === "playing") mode = "paused";
    else if (mode === "paused") mode = "playing";
    renderBoard();
  }

  function beginTick() {
    const startCells = level.enemies.map((_, k) => sim.cell(k));
    const wasExited = [...sim.exited];
    const events = sim.step();
    let linked = false;
    for (const e of events) {
      if (e.kind === "gate" && e.qubits.length === 2) {
        tracker.link(e.qubits[0], e.qubits[1]);
        linked = true;
      }
    }
    if (linked) colors = tracker.update(sim.state);
    anim = { t: 0, startCells, wasExited, after: looks(), events, half: false };
  }

  function halfTick(a: TickAnim) {
    a.half = true;
    shown = a.after;
    for (const e of a.events) {
      if (e.kind === "gate") view.flash(e.placementId);
      else view.showDamage(level.enemies[e.qubit].lane, e.damage, `−${formatReal(e.damage).replace("−", "")}`);
    }
    hp = sim.hp;
    renderHud();
  }

  /* ---------- end of run ---------- */
  let overlay: HTMLElement | null = null;

  function finish(outcome: Outcome) {
    mode = "done";
    renderBoard();
    const won = outcome === "won";
    const star = earnsStar(level, board.spent, outcome);
    const next = nextLevel(level.id);
    if (won) recordWin(level.id, star, next?.id);

    const endText = won ? getContent(level.id, "end") : [];
    const buttons: HTMLElement[] = [];
    if (won && next) buttons.push(h("button", { class: "primary", onclick: () => navigate({ name: "game", id: next.id }) }, "Next"));
    buttons.push(
      h(
        "button",
        {
          class: won && next ? "" : "primary",
          onclick: () => {
            resetRun();
            renderBoard();
          },
        },
        "Retry",
      ),
    );
    buttons.push(h("button", { onclick: () => navigate({ name: "levels" }) }, "Levels"));

    overlay = h(
      "div",
      { class: "overlay" },
      h(
        "div",
        { class: "dialog" },
        h("h2", {}, won ? "LEVEL COMPLETE" : "QUBITS BREACHED"),
        won ? h("div", { class: `big-star${star ? "" : " empty"}` }, star ? "★" : "☆") : null,
        h(
          "div",
          { class: "stats" },
          `HP ${Math.round(sim.hp * 100) / 100} · spent ${board.spent} · budget ${level.budget}`,
          won && !star ? h("div", {}, `An optimal solution costs ${level.optimalCost}. Find it for a ★`) : null,
          !won ? h("div", {}, "Every qubit hitting the left edge costs P(0) × 100 HP.") : null,
        ),
        ...endText.map((t) => h("p", { class: "story" }, t)),
        h("div", { class: "buttons" }, ...buttons),
      ),
    );
    screen.append(overlay);
  }

  /* ---------- loop ---------- */
  let raf = 0;
  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min(100, now - last);
    last = now;
    if (mode === "playing") {
      if (!anim) beginTick();
      const a = anim!;
      a.t += dt / (BASE_TICK_MS / SPEEDS[speedIdx]);
      if (!a.half && a.t >= 0.5) halfTick(a);
      view.drawQubits(qubitRenders());
      if (a.t >= 1) {
        anim = null;
        if (sim.outcome !== "running") finish(sim.outcome);
      }
    }
    raf = requestAnimationFrame(frame);
  }

  /* ---------- keyboard ---------- */
  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement && e.key !== " ") return;
    if (e.key === " ") {
      e.preventDefault();
      if (mode !== "done") togglePlay();
    } else if (e.key === "Escape") {
      selected = null;
      renderBoard();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
    } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= level.gates.length) {
      selectGate(Number(e.key) - 1);
    }
  }

  /* ---------- mount ---------- */
  shown = looks();
  renderText();
  const ro = new ResizeObserver(relayout);
  ro.observe(wrap);
  relayout();
  window.addEventListener("keydown", onKey);
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(warnTimer);
    ro.disconnect();
    window.removeEventListener("keydown", onKey);
  };
}
