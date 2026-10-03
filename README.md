# Bloch It!

Link: https://youtu.be/BkMaMbHdndg

Bloch It! is a browser-based quantum tower-defence puzzle game built for the Quriosity game jam. Enemy qubits arrive from the right, and you place quantum gates on the grid to steer each one into a harmless |1⟩ state before it reaches the left edge. If a qubit reaches the base in a dangerous state, it deals damage based on the probability of measuring |0⟩.

The game turns quantum mechanics into a playable system: you are not “shooting” enemies, you are shaping amplitudes, phases, interference, and entanglement with the tools of quantum computation.

## Testing / Skip to Any Level

To unlock all levels instantly without playing through the earlier ones, open the browser DevTools console and paste:

```js
const data = {
  unlocked:  [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
  completed: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
  starred:   [],
  discovered: [],
  seen: []
};
localStorage.setItem("blochit.save", JSON.stringify(data));
location.reload();
```

All levels will appear on the level-select screen immediately. To reset back to a fresh save, run `localStorage.removeItem("blochit.save")` and reload.

## What is new in the current version?

The game has grown well beyond the original prototype. The current build includes:

- Full level progression through 16 handcrafted levels
- More gate types: I, X, Y, Z, H, S, T, P, CNOT, CZ, CY, SWAP
- Phase-based mechanics and interference puzzles
- Entangled qubits and multi-qubit gate logic, including three-qubit GHZ states
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

- CNOT (also written CX) — flips the target when the control qubit is |1⟩
- CZ — applies a phase flip to |11⟩
- CY — controlled-Y operation
- SWAP — swaps the states of two qubits

CNOT and CY can be clicked after placement to swap control and target (CZ and SWAP are symmetric).

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
2. Measure Up
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
14. The Controlled Gate Suite
15. Multi-Lane Routing
16. The GHZ Triad

These levels are designed to introduce quantum ideas gradually:

- basic state-flipping
- phase and sign changes
- interference
- multi-qubit control and entanglement
- rotation gates and phase tricks
- swap and controlled operations
- routing across lanes and three-qubit (GHZ) entanglement

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

If you want to add a new level, update the level definition plus any supporting tutorial content and encyclopedia entries that it introduces. The formats are described below.

## Authoring reference

### `levels.json`: array of levels

```jsonc
{
  "id": 1,                 // unique; levels unlock in id order
  "name": "First Flip",
  "lanes": 1,
  "columns": 4,
  "budget": 3,             // coins available
  "optimalCost": 2,        // cost of the optimal solution (★)
  "gates": [               // available gates; cost overrides gates.json default
    { "type": "X", "cost": 2 },
    { "type": "P", "cost": 1, "angle": "pi/8" }   // P needs an angle
  ],
  "enemies": [
    { "amplitudes": ["1/sqrt2", "-i/sqrt2"], "lane": 0, "time": 0 }
  ]
}
```

Amplitudes and angles are expressions. They support `i`, `pi`/`π`, `e`, `sqrt`/`√`,
`exp`, `+ - * / ^`, parentheses, and implicit multiplication. Examples: `1/sqrt2`,
`(1+i)/2`, `exp(i*pi/4)/sqrt2`. States that aren't normalised are normalised with a
console warning. Two enemies can't share the same lane and time.

Enemies can also arrive **entangled**. Give `lanes` instead of `lane`, and list
2^n amplitudes in ket order, with the first listed lane as the leftmost digit:

```json
{ "lanes": [0, 1], "time": 0, "amplitudes": ["1/sqrt2", "0", "0", "1/sqrt2"] }
```

This is the Bell pair (|00⟩ + |11⟩)/√2, with one qubit in lane 0 and one in lane 1.
Members of an entangled group always share a `time`. Groups can span any lanes (they
don't have to be neighbours) and any size: three lanes take 8 amplitudes, as in the
GHZ triad of level 16.

Gate names: `"CX"` is accepted as another name for `"CNOT"`. The chip shows whichever
name the level uses, and `place:`/`apply:` triggers fire under both.

### Checking a level

`tests/levels.test.ts` keeps an answer key for every level except 2, whose |+⟩ lane
can't be fixed before H is introduced. For each level it
checks that:
- the key is legal on the real board,
- it wins with full HP at exactly `optimalCost`,
- an exhaustive solver (`tests/solver.ts`) finds nothing cheaper that survives,
- the level uses default gate costs.

Levels 14–16 are too big for the exhaustive solver, so they skip the "nothing cheaper
survives" check. Their `optimalCost` is the cheapest *perfect* solution, found by
`solvePerfect(level)`, a column-aware A* search. A cheaper solution that loses some HP
hasn't been ruled out.

To check a new level, add its answer key there. The solver can also tell you a level's
true cheapest win (`solve(level).minWin`) and give one cheapest perfect solution
(`witness`).

### `content.json`: level text

```json
{ "level": 1, "when": "start", "text": "..." }
```

`when` decides when the text appears:

| `when`          | Shown                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| `start`         | In a centred dialogue when the level opens, until the level is beaten once |
| `end`           | On the level-complete dialog                                          |
| `place:<GATE>`  | The first time the player places that gate type, e.g. `place:X`       |
| `apply:<GATE>`  | The first time that gate type acts on a qubit, e.g. `apply:Z`. The run pauses until the dialogue closes |
| `damage`        | The first time a qubit deals damage                                   |
| `entangle`      | The first time qubits become entangled                                |
| `disentangle`   | The first time entangled qubits split back into separate states        |

Each trigger fires once per visit to a level. Every page shown also goes into the
text box at the bottom, where the player can page back through it or reopen the
centred dialogue with ⤢.

A page (or encyclopedia entry) can carry an animated Bloch sphere with an optional
`bloch` field:

```jsonc
"bloch": { "gate": "X", "from": [["1", "0"]] }               // animate a gate on |0⟩
"bloch": { "gate": "P", "angle": "pi/8", "from": [["1/sqrt2", "1/sqrt2"]] }
"bloch": { "gate": "CNOT", "from": [["1/sqrt2", "1/sqrt2"], ["1", "0"]] }  // control, target
"bloch": { "tour": [["1", "0"], ["1/sqrt2", "1/sqrt2"], ["0", "1"]] }       // glide between states
```

One-qubit gates are drawn as a rotation about their axis, shown as a gold dashed line.
Two-qubit gates show one sphere per qubit, and the arrows shrink when the qubits become
entangled. `"joint"` can hold a 2-, 3-… qubit entangled starting state, and
`"on": [control, target]` picks which qubits the gate acts on. A caption is generated automatically; set `"caption"` to override it.

Text can link to encyclopedia entries with `[[id]]` or `[[id|label]]`, e.g.
`"Grab the [[x|X flipper]]!"`. Links show up once the entry has been discovered;
before that they render as plain text.

### `encyclopedia.json`: quantum terms

```json
{ "id": "bloch", "term": "Bloch sphere", "category": "Concept", "level": 1,
  "text": "...", "wiki": "https://en.wikipedia.org/wiki/Bloch_sphere" }
```

Entries are numbered in file order, Pokédex-style. An entry is discovered when the
player starts its `level` or any later level. `"level": null` keeps it as "???" until
a level introduces it. Discovered entries the player hasn't opened yet get a NEW
tag and light a dot on the in-game Ψ button. `npm test` checks that every content
link points at a real entry that's unlocked by that level.

### `gates.json`

Holds the display name, default cost and help text for each gate type. Levels should
stick to the defaults:

| Gates                       | Cost | Why |
| --------------------------- | ---- | --- |
| I X Y Z H S T               | 1    | The basic toolkit. Raising any of them only inflates totals; no solution changes. |
| P(φ)                        | 2    | Any angle, so it must cost more than Z/S/T, or the named gates become pointless. |
| CNOT CZ CY                  | 2    | Interchangeable via single-qubit gates, so they share a price. |
| SWAP                        | 3    | Must be under two CNOTs (4), which can already move a pair one lane, and above one CNOT. |

Each level's `budget` should leave a little slack above `optimalCost`. A ★ goes to any
win at or under `optimalCost`, so make sure skipping a lane loses outright (send two
qubits down it), or players can trade HP for a cheaper star.

## License and project status

This project is an experimental game prototype and educational tool. It is intentionally designed to teach the intuition behind quantum algorithms through puzzle play rather than formal lecture-style instruction.

