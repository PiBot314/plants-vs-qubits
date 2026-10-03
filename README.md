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

`start` entries are paged through in the in-game text box. `end` entries show on the
level-complete dialog.

### `gates.json`

Holds the display name, default cost and help text for each gate type.

Levels 2 and 3 are placeholder dummies. Replace them with real levels.
