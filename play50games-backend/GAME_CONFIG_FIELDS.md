# Game Config Fields - Udhëzime

## Përgjigje e shkurtër: **JO, jo vetëm `gameType`**

Shumica e lojërave kanë nevojë vetëm për `gameType`, por disa lojëra kanë nevojë për fusha shtesë.

---

## Lojëra që kanë nevojë VETËM për `gameType`:

Këto lojëra funksionojnë me vetëm `gameType` dhe përdorin default values për të gjitha fushat e tjera:

-  ✅ **Sudoku 4x4**: `{"gameType": "sudoku-4x4"}`
-  ✅ **Color Sequence**: `{"gameType": "color-sequence"}` (default: 20 rounds, 4 colors)
-  ✅ **Pattern Completion**: `{"gameType": "pattern-completion"}` (default: 5 rounds)
-  ✅ **Rotate to Fit**: `{"gameType": "rotate-to-fit"}` (default: 3 rounds)
-  ✅ **Mirror Match**: `{"gameType": "mirror-match"}` (default: 5 rounds)
-  ✅ **Logic Gates**: `{"gameType": "logic-gates"}` (default: 5 rounds)
-  ✅ **Sequence Arrows**: `{"gameType": "sequence-arrows"}` (default: 5 rounds)
-  ✅ **Maze Escape**: `{"gameType": "maze-escape"}` (default: size 5)

---

## Lojëra që kanë nevojë për fusha SHTESË:

### 1. **Match the Shapes**

```json
{
   "gameType": "match-shapes",
   "shapes": ["circle", "square", "triangle", "star"],
   "rounds": 5
}
```

-  `shapes` (opsionale): Array i formave - default: `["circle", "square", "triangle"]`
-  `rounds` (opsionale): Numri i raundeve - default: 5

### 2. **Number Order**

```json
{
   "gameType": "number-order",
   "numbers": 5,
   "rounds": 20
}
```

-  `numbers` (opsionale): Numri i numrave për t'u renditur - default: **5** (numrat 1-5)
-  `rounds` (opsionale): Numri i raundeve - default: **20** (rekomanduar për 100 pikë max)

### 3. **Find the Odd One**

```json
{
   "gameType": "find-odd-one",
   "gridSize": 3,
   "rounds": 5
}
```

-  `gridSize` (opsionale): Madhësia e grid (3x3, 4x4) - default: 3
-  `rounds` (opsionale): Numri i raundeve - default: 5

### 4. **Tile Slider**

```json
{
   "gameType": "tile-slider",
   "gridSize": 3
}
```

-  `gridSize` (opsionale): Madhësia e grid (3x3 = 8 tiles) - default: 3

### 5. **Balance the Scale**

```json
{
   "gameType": "balance-scale",
   "rounds": 20
}
```

-  `rounds` (opsionale): Numri i raundeve - default: 20 (për 100 pikë max)

### 6. **Light Switch Puzzle**

```json
{
   "gameType": "light-switch",
   "gridSize": 3,
   "maxMoves": 10
}
```

-  `gridSize` (opsionale): Madhësia e grid - default: 3
-  `maxMoves` (opsionale): Numri maksimal i lëvizjeve - default: 10

### 7. **Block Fill**

```json
{
   "gameType": "block-fill",
   "gridSize": 4
}
```

-  `gridSize` (opsionale): Madhësia e grid - default: 4

---

## Rekomandime:

### Për shumicën e lojërave:

**Mjafton vetëm `gameType`** - default values do të përdoren automatikisht.

### Për lojëra të personalizuara:

Shto fusha shtesë vetëm nëse dëshiron të ndryshosh default values.

### Shembull minimal (mjafton):

```json
{ "gameType": "sudoku-4x4" }
```

### Shembull i plotë (nëse dëshiron customization):

```json
{
   "gameType": "balance-scale",
   "rounds": 20
}
```

---

## Konkluzion:

**Përgjigje**: JO, jo vetëm `gameType`. Por për shumicën e lojërave, `gameType` është i mjaftueshëm dhe fusha të tjera janë opsionale me default values.

**Rekomandim**: Përdor vetëm `gameType` për fillim, dhe shto fusha shtesë vetëm nëse dëshiron të personalizosh lojën.
