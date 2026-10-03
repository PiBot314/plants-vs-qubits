import { ENTRIES } from "../game/encyclopedia";
import { loadProgress, markSeen } from "../game/progress";
import { blochDemo } from "./blochView";
import { h } from "./dom";
import { pushModal } from "./modal";

export interface EncyclopediaOptions {
  /** Entry to open on. */
  focus?: string;
  onClose?: () => void;
}

const num = (i: number) => `#${String(i + 1).padStart(3, "0")}`;

/** Pokédex-style overlay listing every quantum term; undiscovered ones show as "???". */
export function openEncyclopedia(parent: HTMLElement, opts: EncyclopediaOptions = {}): () => void {
  const save = loadProgress();
  const known = (id: string) => save.discovered.includes(id);
  const found = ENTRIES.filter((e) => known(e.id)).length;
  let current = opts.focus && known(opts.focus) ? opts.focus : ENTRIES.find((e) => known(e.id))?.id;

  const detail = h("div", { class: "ency-detail" });
  const items = ENTRIES.map((e, i) =>
    h(
      "button",
      {
        class: `ency-item${known(e.id) ? "" : " locked"}`,
        disabled: !known(e.id),
        onclick: () => select(e.id),
      },
      h("span", { class: "ency-num" }, num(i)),
      h("span", { class: "ency-name" }, known(e.id) ? e.term : "???"),
      known(e.id) && !save.seen.includes(e.id) ? h("span", { class: "ency-new" }, "NEW") : null,
    ),
  );

  const root = h(
    "div",
    { class: "modal ency-overlay", onclick: (ev: Event) => ev.target === root && close() },
    h(
      "div",
      { class: "ency-panel", role: "dialog", "aria-modal": "true" },
      h(
        "header",
        {},
        h("h2", {}, "ENCYCLOPEDIA"),
        h("span", { class: "ency-count" }, `${found} / ${ENTRIES.length} discovered`),
        h("button", { class: "icon", title: "Close (Esc)", onclick: () => close() }, "✕"),
      ),
      h("div", { class: "ency-body" }, h("div", { class: "ency-list" }, ...items), detail),
    ),
  );

  let stopDemo = () => {};

  function select(id: string | undefined) {
    stopDemo();
    stopDemo = () => {};
    current = id;
    items.forEach((el, i) => el.classList.toggle("on", ENTRIES[i].id === id));
    const i = ENTRIES.findIndex((e) => e.id === id);
    const e = ENTRIES[i];
    if (!e) {
      detail.replaceChildren(h("p", { class: "ency-empty" }, "Nothing discovered yet. Play a level to start filling the encyclopedia."));
      return;
    }
    markSeen(e.id);
    items[i].querySelector(".ency-new")?.remove();
    detail.replaceChildren(
      h("div", { class: "ency-num" }, num(i)),
      h("h3", {}, e.term),
      h("span", { class: "ency-cat" }, e.category),
      h("p", {}, e.text),
      ...(e.bloch ? [demo(e.bloch)] : []),
      h("a", { class: "ency-wiki", href: e.wiki, target: "_blank", rel: "noopener noreferrer" }, "Read more on Wikipedia ↗"),
    );
    items[i].scrollIntoView({ block: "nearest" });
  }

  function demo(spec: NonNullable<(typeof ENTRIES)[number]["bloch"]>) {
    const d = blochDemo(spec);
    stopDemo = d.stop;
    d.el.classList.add("ency-demo");
    return d.el;
  }

  function step(d: number) {
    const open = ENTRIES.map((e, i) => (known(e.id) ? i : -1)).filter((i) => i >= 0);
    const at = open.indexOf(ENTRIES.findIndex((e) => e.id === current));
    const next = open[Math.max(0, Math.min(open.length - 1, at + d))];
    if (next !== undefined) select(ENTRIES[next].id);
  }

  const popModal = pushModal((ev) => {
    if (ev.key === "Escape") close();
    else if (ev.key === "ArrowDown") step(1);
    else if (ev.key === "ArrowUp") step(-1);
    else return;
    ev.preventDefault();
  });

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    stopDemo();
    popModal();
    root.remove();
    opts.onClose?.();
  }

  select(current);
  parent.append(root);
  return close;
}
