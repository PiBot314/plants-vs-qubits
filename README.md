# Bloch It!

Bloch It! is a browser-based quantum tower-defence puzzle game built for the Quriosity game jam. Enemy qubits arrive from the right, and you place quantum gates on the grid to steer each one into a harmless |1⟩ state before it reaches the left edge. If a qubit reaches the base in a dangerous state, it deals damage based on the probability of measuring |0⟩.

The game turns quantum mechanics into a playable system: you are not “shooting” enemies, you are shaping amplitudes, phases, interference, and entanglement with the tools of quantum computation.

## What is new in the current version?

The game has grown well beyond the original prototype. The current build includes:

- Full level progression through 13 handcrafted levels
- More gate types: I, X, Y, Z, H, S, T, P, CNOT, CZ, CY, SWAP
- Phase-based mechanics and interference puzzles
- Entangled qubits and multi-qubit gate logic
- Real-time Bloch-sphere visualisation and live amplitude displays
- An encyclopedia for quantum concepts and terminology
- Star-based scoring and persistent progress in localStorage
- A stronger tutorial arc that teaches the ideas gradually instead of dumping theory all at once

## Core gameplay

- Qubits move left one cell per tick.
- A qubit with `time: t` starts `t` cells to the right.
- Unary gates sit on a vertical grid line inside a lane and affect every qubit crossing that line.
- Binary gates are placed at the corner where two lanes meet. They trigger only when both qubits cross that corner in the same tick.
- Measurement at the left edge is deterministic from the expected damage. A qubit in state α|0⟩ + β|1⟩ has probability P(0) = |α|², so damage is `P(0) × 100`.
- You win if HP remains above zero after all qubits have passed.
- You earn a star if your total gate cost is no more than the level’s `optimalCost`.
- Entangled qubits are coloured by group and show a joint state; hover to inspect it.

## Gates in the game

### Single-qubit gates

- I — identity
- X — bit flip, swaps |0⟩ and |1⟩
- Y — bit and phase flip
- Z — phase flip, negates the |1⟩ amplitude
- H — Hadamard, mixes bases and reveals interference
- S — phase shift by π/2
- T — phase shift by π/4
- P — arbitrary phase rotation

### Multi-qubit gates

- CNOT — flips the target when the control qubit is |1⟩
- CZ — applies a phase flip to |11⟩
- CY — controlled-Y operation
- SWAP — swaps the states of two qubits

Binary gates can be clicked after placement to swap the control/target orientation.

## How to play

1. Install dependencies:

   ```sh
   npm install
   ```

2. Start the dev server:

   ```sh
   npm run dev
   ```

3. Open the URL shown by Vite in your browser.

4. Place gates, run the board, and keep the incoming qubits from reaching the left edge as dangerous |0⟩ states.

5. Clear levels to unlock more, and use the optimal-cost solution to earn stars.

## Testing and build

```sh
npm test         # Vitest logic tests
npm run build    # production build in dist/
```

The project uses Vite + TypeScript with no frontend framework. Progress is saved in `localStorage`, and the board rendering is SVG-based.

## Level progression

The current level set includes:

1. First Flip
2. Spooky Pair
3. The H Paradox
4. Sign Matters
5. Full Arsenal
6. Quarter-Turns
7. Eighth-Turns
8. Phase Sandbox
9. Spooky Action
10. Entanglement Sandbox
11. Phase Control
12. Controlled Rotations
13. Swap Meet

These levels are designed to introduce quantum ideas gradually:

- basic state-flipping
- phase and sign changes
- interference
- multi-qubit control and entanglement
- rotation gates and phase tricks
- swap and controlled operations

## Project structure

- `src/data/levels.json` — level definitions, gate availability, enemies, budgets, and optimal costs
- `src/data/content.json` — in-game tutorial text, dialogue triggers, Bloch animations, and encyclopedia links
- `src/data/encyclopedia.json` — learn-as-you-go quantum references
- `src/data/gates.json` — display names, costs, and help text for every gate type
- `src/game/` — simulation, level loading, and progress logic
- `src/quantum/` — complex numbers, gates, parsing, and state math
- `src/ui/` — game screen, menus, dialogues, and encyclopedia UI
- `tests/` — rule checks, solver validation, and level verification

## Notes for contributors

The data files are deliberately authorable. `levels.json` contains the puzzle content; `content.json` drives the tutorial and dialogue; `encyclopedia.json` carries the explanatory entries. The solver and test suite are used to validate level legality, cost-optimality, and game state transitions.

If you want to add a new level, update the level definition plus any supporting tutorial content and encyclopedia entries that it introduces.

## License and project status

This project is an experimental game prototype and educational tool. It is intentionally designed to teach the intuition behind quantum algorithms through puzzle play rather than formal lecture-style instruction.

