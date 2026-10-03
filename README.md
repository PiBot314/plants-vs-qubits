# Bloch It!

A quantum tower-defence game for the Quriosity game jam. Enemy qubits fly in from the
right. Place unitary gates on the grid so each one arrives at the left edge as |1⟩.
Each qubit that reaches the edge costs **P(0) × 100 HP**.

## Running

```sh
npm install
npm run dev      # dev server
npm test         # logic tests (Vitest)
npm run build    # static build in dist/
```

Stack: Vite + TypeScript, no framework. The board is SVG and progress is saved in `localStorage`.

## Rules (as implemented)

- Qubits move one cell left per tick. A qubit with `time: t` sits `t` cells to the
  right of the grid at the start.
- **Unary gates** (I X Y Z H S T P) sit on a vertical grid line inside a lane. They act on
  every qubit that crosses that line.
- **Binary gates** (CNOT, CZ) sit on a corner where a vertical line meets the boundary
  between two lanes. They fire only when a qubit in *each* lane crosses that line on the
  same tick. A CNOT starts with its control on the top lane; click it to swap.
- Measurement at the left edge does not collapse the state. Damage is the expected
  value, so runs are deterministic.
- You win if HP > 0 after every qubit has passed. You earn a ★ if the gates cost
  no more than `optimalCost`.
- Entangled qubits are coloured by group, and each group gets a distinct non-purple
  colour. They show P(1) because they have no individual state. Hover one to see the
  joint state.

## Data files (`src/data/`)

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

Each trigger fires once per visit to a level. Every page shown also goes into the
text box at the bottom, where the player can page back through it or reopen the
centred dialogue with ⤢.

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

Holds the display name, default cost and help text for each gate type.

## Pedagogical Level Design

The levels are designed to introduce quantum mechanics incrementally, without ever feeling like a lecture.

- **Level 1 – First Flip**: Introduces the `|0⟩`/`|1⟩` notation, the HP system, and the X gate as a
  "flipper" without calling it a gate. One lane, two identical enemies. The single available
  gate (X) makes the solution obvious. The end card formally names it a "gate."

- **Level 2 – The Three Axes**: Introduces X, Y, and Z as gates that spin the qubit sphere
  around three different axes. Players are invited to **watch the displayed amplitudes
  change in real-time** as each gate is applied. A key insight is revealed: X and Y both
  block damage (the top amplitude becomes 0), but their output numbers look different due
  to the imaginary multipliers. Z changes the bottom number by −1 but leaves the top
  untouched — so it doesn't reduce damage yet. This seeds curiosity: *the numbers changed,
  but it didn't help... why would Z ever matter?*

- **Level 3 – Phase Space** *(coming soon)*: Introduces the Hadamard gate, which mixes the
  top and bottom amplitudes together. Now Z's −1 twist *does* affect the top amplitude
  after an H, making phase differences visible as damage differences for the first time.

Level 3 is a placeholder dummy. Replace it with a real level.
