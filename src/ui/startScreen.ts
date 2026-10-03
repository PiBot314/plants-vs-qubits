import type { Navigate } from "../main";
import { LEVELS } from "../game/level";
import { isUnlocked, loadProgress, totalStars } from "../game/progress";
import { Cleanup, h, s } from "./dom";

/** A small Bloch sphere whose state vector slowly precesses. */
function blochSphere(): { el: SVGSVGElement; stop: () => void } {
  const R = 70;
  const tilt = 0.28; // vertical squash of the equator
  const arrow = s("line", { x1: 0, y1: 0, stroke: "#9b5cff", "stroke-width": 2.5, "stroke-linecap": "round" });
  const tip = s("circle", { r: 5, fill: "#9b5cff", style: "filter: drop-shadow(0 0 6px #9b5cff)" });
  const shadow = s("line", { x1: 0, y1: 0, stroke: "rgba(155,92,255,0.3)", "stroke-dasharray": "2 3" });
  const el = s(
    "svg",
    { class: "bloch", viewBox: "-85 -85 170 170" },
    s("circle", { r: R, fill: "rgba(111,227,255,0.03)", stroke: "rgba(150,165,255,0.45)" }),
    s("ellipse", { rx: R, ry: R * tilt, fill: "none", stroke: "rgba(150,165,255,0.25)", "stroke-dasharray": "3 4" }),
    s("line", { x1: 0, y1: -R, x2: 0, y2: R, stroke: "rgba(150,165,255,0.2)" }),
    s("text", { x: 0, y: -R - 6, "text-anchor": "middle", fill: "#7a80a8", "font-size": 10, "font-family": "monospace" }, "|0⟩"),
    s("text", { x: 0, y: R + 13, "text-anchor": "middle", fill: "#7a80a8", "font-size": 10, "font-family": "monospace" }, "|1⟩"),
    shadow,
    arrow,
    tip,
  );
  let raf = 0;
  const t0 = performance.now();
  const frame = (now: number) => {
    const t = (now - t0) / 1000;
    const theta = Math.PI / 2 + Math.sin(t * 0.35) * 1.1; // polar angle
    const phi = t * 0.9; // azimuth
    const x = R * Math.sin(theta) * Math.cos(phi);
    const y = -R * Math.cos(theta) + R * tilt * Math.sin(theta) * Math.sin(phi);
    arrow.setAttribute("x2", String(x));
    arrow.setAttribute("y2", String(y));
    tip.setAttribute("cx", String(x));
    tip.setAttribute("cy", String(y));
    shadow.setAttribute("x2", String(x));
    shadow.setAttribute("y2", String(R * tilt * Math.sin(theta) * Math.sin(phi)));
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { el, stop: () => cancelAnimationFrame(raf) };
}

export function mountStart(root: HTMLElement, navigate: Navigate): Cleanup {
  const save = loadProgress();
  // Continue from the first unlocked level that isn't completed yet.
  const playable = LEVELS.filter((l, i) => i === 0 || isUnlocked(save, l.id));
  const target = playable.find((l) => !save.completed.includes(l.id)) ?? playable[playable.length - 1];

  const sphere = blochSphere();
  root.append(
    h(
      "div",
      { class: "screen start" },
      sphere.el,
      h("h1", {}, "Bloch ", h("span", {}, "It!")),
      h("p", { class: "tagline" }, "align every incoming qubit to |1⟩"),
      h(
        "div",
        { class: "menu" },
        h("button", { class: "primary", onclick: () => navigate({ name: "game", id: target.id }) }, save.completed.length ? "Continue" : "Play"),
        h("button", { onclick: () => navigate({ name: "levels" }) }, "Level Select"),
      ),
      h("div", { class: "star-count" }, `★ ${totalStars(save)} / ${LEVELS.length}`),
    ),
  );
  return sphere.stop;
}
