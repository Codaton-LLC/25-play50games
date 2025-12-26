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
   "shapes": [
      "Home",
      "Fingerprint",
      "Key",
      "Star",
      "Eye",
      "Heart",
      "Camera",
      "Cube",
      "Bell",
      "Plus",
      "Gift",
      "Moon"
   ],
   "rounds": 20
}
```

-  `shapes` (opsionale): Array i emrave të Heroicons - default: 12 icons të zakonshme
-  `rounds` (opsionale): Numri i raundeve - default: **20** (rekomanduar për 100 pikë max)
-  **Keyboard Controls**: 1-12 për zgjedhje direkte (1-9, 0, -, = për 10-12)
-  **Note**: Përdor Heroicons në vend të CSS shapes për konsistencë vizuale

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
   "rounds": 20,
   "icons": [
      "Home",
      "Fingerprint",
      "Key",
      "Star",
      "Eye",
      "Heart",
      "Camera",
      "Cube",
      "Bell",
      "Plus",
      "Gift",
      "Moon"
   ]
}
```

-  `rounds` (opsionale): Numri i raundeve - default: **20** (rekomanduar për 100 pikë max)
-  `icons` (opsionale): Array i emrave të Heroicons - default: 12 icons të zakonshme
-  Numri i objekteve rritet automatikisht bazuar në rounds:
-  Rounds 1-5: **10 icons** (5x2 grid)
-  Rounds 6-10: **30 icons** (6x5 grid)
-  Rounds 11-20: **50 icons** (10x5 grid)
-  **Note**: `gridSize` nuk përdoret më - grid rregullohet automatikisht bazuar në numrin e objekteve

### 4. **Tile Slider**

```json
{
   "gameType": "tile-slider",
   "gridSize": 3,
   "showHints": true,
   "maxHints": 5
}
```

-  `gridSize` (opsionale): Madhësia e grid (3x3 = 8 tiles, 4x4 = 15 tiles) - default: **3**
-  `showHints` (opsionale): Aktivizo butonin e hint - default: **true**
-  `maxHints` (opsionale): Numri maksimal i hints të lejuara - default: **5**. Vendos `0` ose `>= 1000` për unlimited hints
-  **Hint System**:
-  **Share për Unlimited Hints**: Kliko "Share for Unlimited Hints" për të ndarë lojën
-  Sharing përdor Web Share API (mobile/desktop) ose kopjon link automatikisht në clipboard
-  Kur përdoruesi ndan, merr unlimited hints menjëherë (ruhet në localStorage)
-  Kur dikush klikon link të ndarë (me `?shared=ID` parameter), merr edhe ai unlimited hints
-  Kliko "Show Hint" për të ekzekutuar automatikisht 2-3 lëvizje optimale për zgjidhjen e puzzle
-  **Unlimited Hints**: Vendos `maxHints: 0` ose `maxHints: 1000` për unlimited hints by default
-  Me unlimited hints, butoni ndryshon në "Solve Puzzle" dhe përdor BFS për zgjidhje të plotë
-  Të gjitha tiles në sekuencë shfaqen me highlight (yellow outline)
-  Tile-i aktual që po lëviz ka highlight më të fortë (pulsing yellow me scale effect)
-  Përdor Manhattan distance heuristic dhe sequence optimization për hints të pjesshme
-  Përdor BFS (Breadth-First Search) për zgjidhje të plotë kur unlimited
-  Algoritmi siguron që puzzle përmirësohet gjithmonë (nuk ngec në zgjidhje)
-  Shfaqet counter "Hints: X / 5" (ose "Hints: Unlimited" nëse unlimited)
-  Hints zgjidhin automatikisht puzzle hap pas hapi me lëvizje të shumta për hint
-  Pas arritjes së limitit (nëse limited), butoni bllokohet
-  **Keyboard Controls**: Tab për selektim, Arrow keys për lëvizje
-  **Scoring**: 100 pikë për zgjidhje, minus 1 pikë për lëvizje (minimum 0)

### 5. **Balance the Scale**

```json
{
   "gameType": "balance-scale",
   "rounds": 20
}
```

-  `rounds` (opsionale): Numri i raundeve - default: **20** (për 100 pikë max)
-  **Scoring**: 5 pikë për raund të saktë (max 100 pikë për 20 raunde)
-  **Keyboard Controls**: ArrowLeft/A (majtas më e rëndë), ArrowRight/D (djathtas më e rëndë), Enter/Space/E (barabartë)
-  **Note**: Animacione të shpejta (0.5s) për të lejuar 20 raunde brenda kufirit kohor

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
