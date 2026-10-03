/**
 * Stack of open modals. The topmost modal receives all key presses, and the
 * screens underneath (e.g. the game's Space/Ctrl+Z shortcuts) receive none.
 */
type KeyHandler = (e: KeyboardEvent) => void;

const stack: KeyHandler[] = [];

window.addEventListener(
  "keydown",
  (e) => {
    const top = stack[stack.length - 1];
    if (!top) return;
    e.stopPropagation();
    top(e);
  },
  true,
);

/** Registers a modal; returns a function that unregisters it. */
export function pushModal(onKey: KeyHandler): () => void {
  stack.push(onKey);
  return () => {
    const i = stack.lastIndexOf(onKey);
    if (i >= 0) stack.splice(i, 1);
  };
}

export const modalOpen = () => stack.length > 0;
