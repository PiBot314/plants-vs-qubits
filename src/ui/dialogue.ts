import { h } from "./dom";
import { pushModal } from "./modal";

export interface DialogueOptions {
  title?: string;
  /** Page to open on. */
  start?: number;
  /** Renders a page's text (defaults to plain text). */
  render?: (text: string) => Node;
  onClose?: (lastPage: number) => void;
}

export interface Dialogue {
  close(): void;
}

/** Centred, paged dialogue. Arrow keys / Enter page through it, Esc skips. */
export function openDialogue(parent: HTMLElement, pages: string[], opts: DialogueOptions = {}): Dialogue {
  let idx = Math.max(0, Math.min(pages.length - 1, opts.start ?? 0));
  const last = pages.length - 1;

  const body = h("div", { class: "dlg-body" });
  const dots = h("div", { class: "dlg-dots" });
  const back = h("button", { onclick: () => go(-1) }, "Back");
  const next = h("button", { class: "primary", onclick: () => go(1) });
  const skip = h("button", { class: "dlg-skip", title: "Skip (Esc)", onclick: () => close() }, "Skip");

  const root = h(
    "div",
    { class: "modal dlg-overlay" },
    h(
      "div",
      { class: "dlg-card", role: "dialog", "aria-modal": "true" },
      opts.title ? h("div", { class: "dlg-title" }, opts.title) : null,
      body,
      h("div", { class: "dlg-foot" }, skip, dots, h("div", { class: "dlg-nav" }, back, next)),
    ),
  );

  function render() {
    body.replaceChildren(h("p", { class: "dlg-text" }, opts.render ? opts.render(pages[idx]) : pages[idx]));
    dots.replaceChildren(
      ...pages.map((_, i) => h("span", { class: `dlg-dot${i === idx ? " on" : i < idx ? " seen" : ""}` })),
    );
    dots.style.visibility = pages.length > 1 ? "visible" : "hidden";
    back.style.visibility = idx === 0 ? "hidden" : "visible";
    skip.style.visibility = idx === last ? "hidden" : "visible";
    next.textContent = idx === last ? "Got it" : "Next";
  }

  function go(d: number) {
    if (idx + d > last) return close();
    idx = Math.max(0, idx + d);
    render();
  }

  const popModal = pushModal((e) => {
    if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") go(1);
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "Escape") close();
    else return;
    e.preventDefault();
  });

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    popModal();
    root.remove();
    opts.onClose?.(idx);
  }

  render();
  parent.append(root);
  next.focus();
  return { close };
}
