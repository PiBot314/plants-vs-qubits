import { getEntry, isDiscovered } from "../game/encyclopedia";
import { openEncyclopedia } from "./encyclopedia";
import { h } from "./dom";

/**
 * Renders content text, turning [[id]] or [[id|label]] into a link that opens that
 * encyclopedia entry. Links to undiscovered or unknown entries render as plain text.
 */
export function richText(text: string, modalParent: HTMLElement, onClose?: () => void): DocumentFragment {
  const frag = document.createDocumentFragment();
  const re = /\[\[([a-z0-9_-]+)(?:\|([^\]]+))?\]\]/gi;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    frag.append(text.slice(last, m.index));
    const [, id, label] = m;
    const entry = getEntry(id);
    const shown = label ?? entry?.term ?? id;
    if (entry && isDiscovered(id)) {
      frag.append(
        h(
          "button",
          {
            class: "term",
            title: `Encyclopedia: ${entry.term}`,
            onclick: () => openEncyclopedia(modalParent, { focus: id, onClose }),
          },
          shown,
        ),
      );
    } else frag.append(shown);
    last = re.lastIndex;
  }
  frag.append(text.slice(last));
  return frag;
}

/** Content text with link markup removed (for plain-text contexts). */
export const plainText = (text: string) =>
  text.replace(/\[\[([a-z0-9_-]+)(?:\|([^\]]+))?\]\]/gi, (_, id: string, label?: string) => label ?? getEntry(id)?.term ?? id);
