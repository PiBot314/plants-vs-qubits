import type { Navigate } from "../main";
import { LEVELS } from "../game/level";
import { isUnlocked, loadProgress, totalStars } from "../game/progress";
import { Cleanup, h } from "./dom";
import { openEncyclopedia } from "./encyclopedia";

export function mountLevelSelect(root: HTMLElement, navigate: Navigate): Cleanup {
  const save = loadProgress();
  const cards = LEVELS.map((l, i) => {
    const unlocked = i === 0 || isUnlocked(save, l.id);
    const done = save.completed.includes(l.id);
    const star = save.starred.includes(l.id);
    return h(
      "button",
      {
        class: `level-card${unlocked ? "" : " locked"}`,
        disabled: !unlocked,
        title: unlocked ? l.name : "Locked",
        onclick: () => navigate({ name: "game", id: l.id }),
      },
      h("div", { class: "num" }, unlocked ? String(l.id) : "🔒"),
      h("div", { class: "name" }, unlocked ? l.name : ""),
      h(
        "div",
        { class: "badges" },
        star ? h("span", { class: "got" }, "★") : done ? h("span", { class: "ok" }, "✓") : unlocked ? h("span", {}, "☆") : "",
      ),
    );
  });

  root.append(
    h(
      "div",
      { class: "screen levels" },
      h(
        "header",
        {},
        h("button", { class: "icon", title: "Back", onclick: () => navigate({ name: "start" }) }, "←"),
        h("h2", {}, "LEVELS"),
        h("div", { class: "star-count" }, `★ ${totalStars(save)} / ${LEVELS.length}`),
        h("button", { class: "icon", title: "Encyclopedia", onclick: () => openEncyclopedia(root) }, "Ψ"),
      ),
      h("div", { class: "level-grid" }, ...cards),
    ),
  );
  return () => {};
}
