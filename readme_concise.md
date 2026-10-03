# Bloch It!

Link: https://youtu.be/BkMaMbHdndg

Bloch It! is a tiny quantum defence game. Incoming qubits are attacking from the right, and your job is to place gates to turn them into harmless |1⟩ states before they reach your base.

This game was built for quriosity, for the theme "Unitary Gates".

## Testing / Skip to Any Level

To unlock all levels instantly, open the browser DevTools console and paste:

```js
const data = {
  unlocked:  [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
  completed: [], starred: [], discovered: [], seen: []
};
localStorage.setItem("blochit.save", JSON.stringify(data));
location.reload();
```

To reset: `localStorage.removeItem("blochit.save")` then reload.

## Run it


```sh
npm install
npm run dev
```

Then open the local URL that Vite prints in the browser.


## The idea

This is a puzzle game about quantum mechanics, but it is designed to feel like play instead of a lecture.

- You place quantum gates on the board to change the qubits' state.
- Some gates flip values, some change phase, and some create interference.
- Later levels introduce entanglement and multi-qubit control.
- The goal is not to destroy enemies — it is to manipulate quantum states so they arrive safely.
- Each level teaches one concept at a time: flip, phase, interference, entanglement, control.

## Win the game

- Survive with positive HP after every qubit passes.
- Use the gates you are given wisely.
- Beat levels to unlock more.
- Earn stars by finding a low-cost solution.

## Why it is interesting

The game shows that quantum behaviour is not just “weird math” — it is about probabilities, signs, phase, interference, and how measurement turns a state into a result. By making those ideas part of the puzzle, the game turns abstract concepts into a playable strategy challenge.
