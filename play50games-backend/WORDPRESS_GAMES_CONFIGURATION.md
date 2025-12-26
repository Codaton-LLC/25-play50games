# Complete WordPress Games Configuration Guide

## 📋 Table of Contents

1. [Accessing WordPress Admin](#accessing-wordpress-admin)
2. [Understanding Game Fields](#understanding-game-fields)
3. [All 50 Games Configuration](#all-50-games-configuration)
4. [Quick Reference](#quick-reference)

---

## Accessing WordPress Admin

1. Go to: `https://cms.play50.games/wp-admin`
2. Log in with your admin credentials
3. In the left sidebar, click **Games** → **Add New**

---

## Understanding Game Fields

### Required Fields in WordPress Admin:

| Field                  | Description                                                   | Example                                     |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------- |
| **Title**              | Game name (displayed to users)                                | `Match the Shapes`                          |
| **Game Order**         | Sequence number (1-50)                                        | `1`                                         |
| **Game Type**          | Category: `logic`, `memory`, `speed`, `skill`, or `final`     | `logic`                                     |
| **Difficulty**         | 1-5 (1=easiest, 5=hardest)                                    | `1`                                         |
| **Time Limit**         | Seconds allowed to play                                       | `60`                                        |
| **Passing Score**      | Minimum score to pass (0-100)                                 | `70`                                        |
| **Unlock Requirement** | Game ID that must be completed first (leave empty for Game 1) | `1`                                         |
| **Description**        | Brief game description                                        | `Drag shapes into correct outlines`         |
| **Game Config**        | JSON configuration (see examples below)                       | `{"gameType": "match-shapes", "rounds": 5}` |

### Finding Game IDs:

-  Go to **Games** → **All Games**
-  Hover over a game title
-  The ID is in the URL: `post.php?post=123&action=edit` (123 is the ID)

---

## All 50 Games Configuration

### 🧠 LOGIC & PUZZLE GAMES (1-15)

#### Game 1: Match the Shapes

```
Title: Match the Shapes
Game Order: 1
Game Type: logic
Difficulty: 1
Time Limit: 60
Passing Score: 70
Unlock Requirement: (leave empty)
Description: Match the target shape with the correct option
Game Config:
{
  "gameType": "match-shapes",
  "shapes": ["Home", "Fingerprint", "Key", "Star", "Eye", "Heart", "Camera", "Cube", "Bell", "Plus", "Gift", "Moon"],
  "rounds": 20
}
```

**Configuration Details:**

-  `shapes` (optional): Array of Heroicon names - default: 12 common icons
-  `rounds` (optional): Number of rounds - default: **20** (recommended for 100 points max)

**How it works:**

-  Player must match the target shape with one of the options
-  **Scoring**: 5 points per correct round (max 100 points for 20 rounds)
-  **Keyboard Controls**: Press **1-12** to select shapes directly:
-  **1-9**: Select shapes 1-9
-  **0**: Select shape 10
-  **-**: Select shape 11
-  **=**: Select shape 12
-  Visual keyboard shortcuts displayed on each button
-  Uses Heroicons for consistent visual design
-  All icons are the same size (80px for options, 120px for target)

#### Game 2: Color Sequence

```
Title: Color Sequence
Game Order: 2
Game Type: logic
Difficulty: 1
Time Limit: 90
Passing Score: 70
Unlock Requirement: [ID of Game 1]
Description: Watch and repeat color sequences. The sequence gets longer as rounds progress.
Game Config:
{
  "gameType": "color-sequence",
  "rounds": 20,
  "colors": ["red", "blue", "green", "yellow"]
}
```

**Configuration Details:**

-  `rounds` (optional): Number of rounds - default: **20** (recommended for 100 points max)
-  `colors` (optional): Array of colors to use - default: `["red", "blue", "green", "yellow"]`

**How it works:**

-  Rounds 1-5: 2 colors per sequence
-  Rounds 6-10: 3 colors per sequence
-  Rounds 11-15: 4 colors per sequence
-  Rounds 16-20: 5 colors per sequence
-  **Scoring**: 5 points per correct round (max 100 points for 20 rounds)
-  **Keyboard Controls**: Press 1-4 to select colors (1=Red, 2=Blue, 3=Green, 4=Yellow)

#### Game 3: Number Order

```
Title: Number Order
Game Order: 3
Game Type: logic
Difficulty: 1
Time Limit: 90
Passing Score: 70
Unlock Requirement: [ID of Game 2]
Description: Click numbers from smallest to largest in the correct order
Game Config:
{
  "gameType": "number-order",
  "rounds": 20
}
```

**Configuration Details:**

-  `rounds` (optional): Number of rounds - default: **20** (recommended for 100 points max)
-  Number count is **dynamic** based on rounds:
-  Rounds 1-5: **3 numbers** (1, 2, 3)
-  Rounds 6-10: **5 numbers** (1, 2, 3, 4, 5)
-  Rounds 11-20: **10 numbers** (1, 2, 3, 4, 5, 6, 7, 8, 9, 10)

**How it works:**

-  Numbers are shuffled randomly each round
-  Player must click numbers in ascending order: 1, 2, 3, 4, 5...
-  **Scoring**: 5 points per correct round (max 100 points for 20 rounds)
-  **Keyboard Controls**:
-  Press **1-9** to select by position in grid (press "1" for first number in grid, "2" for second number in grid)
-  Press **0** to select 10th position (if 10 numbers are present)
-  Press **Backspace/Delete** to undo last selection
-  Visual feedback shows correct (green) and incorrect (red) selections
-  Undo button available to remove last selected number

#### Game 4: Find the Odd One

```
Title: Find the Odd One
Game Order: 4
Game Type: logic
Difficulty: 2
Time Limit: 90
Passing Score: 70
Unlock Requirement: [ID of Game 3]
Description: Identify the icon that's different
Game Config:
{
  "gameType": "find-odd-one",
  "rounds": 20,
  "icons": ["Home", "Fingerprint", "Key", "Star", "Eye", "Heart", "Camera", "Cube", "Bell", "Plus", "Gift", "Moon"]
}
```

**Configuration Details:**

-  `rounds` (optional): Number of rounds - default: **20** (recommended for 100 points max)
-  `icons` (optional): Array of Heroicon names to use - default: 12 common icons
-  Item count is **dynamic** based on rounds:
-  Rounds 1-5: **10 icons** (5x2 grid)
-  Rounds 6-10: **30 icons** (6x5 grid)
-  Rounds 11-20: **50 icons** (10x5 grid)

**How it works:**

-  Icons are displayed in a grid, with one icon being different
-  Player must click on the odd icon
-  **Scoring**: 5 points per correct round (max 100 points for 20 rounds)
-  Icon size and grid layout adjust automatically based on item count
-  Visual feedback shows correct (green) and incorrect (red) selections

#### Game 5: Tile Slider (3×3)

```
Title: Tile Slider Puzzle
Game Order: 5
Game Type: logic
Difficulty: 2
Time Limit: 120
Passing Score: 80
Unlock Requirement: [ID of Game 4]
Description: Rearrange tiles into correct order
Game Config:
{
  "gameType": "tile-slider",
  "gridSize": 3,
  "showHints": true,
  "maxHints": 5
}
```

**Configuration Details:**

-  `gridSize` (optional): Grid size (3 = 3x3, 4 = 4x4) - default: **3**
-  `showHints` (optional): Enable hint button - default: **true**
-  `maxHints` (optional): Maximum number of hints allowed - default: **5**. Set to `0` or `>= 1000` for unlimited hints

**How it works:**

-  Player must arrange numbers 1-8 in order from left to right, top to bottom
-  Click tiles adjacent to the empty space (sparkle icon) to move them
-  **Scoring**: 100 points for solving, minus 1 point per move (minimum 0)
-  **Hint System**: 
  -  Click "Show Hint" button to automatically execute 2-3 optimal moves to solve the puzzle
  -  **Share to Unlock Unlimited Hints**: Click "Share for Unlimited Hints" button to share the game
  -  Sharing uses Web Share API (mobile/desktop) or copies link to clipboard automatically
  -  When user shares, they get unlimited hints immediately (stored in localStorage)
  -  When someone clicks a shared link (with `?shared=ID` parameter), they also get unlimited hints
  -  **Unlimited Hints**: Set `maxHints` to `0` or `>= 1000` to enable unlimited hints by default
  -  With unlimited hints, button changes to "Solve Puzzle" and uses BFS algorithm to solve completely
  -  All tiles in the solution sequence are highlighted (yellow outline)
  -  Current tile being moved has stronger highlight (pulsing yellow with scale effect)
  -  Uses Manhattan distance heuristic and sequence optimization for partial hints
  -  Uses BFS (Breadth-First Search) for complete solution when unlimited
  -  Algorithm ensures puzzle always improves (never gets stuck)
  -  Hints counter shows "Hints: X / 5" (or "Hints: Unlimited" if unlimited)
  -  Hints automatically solve the puzzle step by step with multiple moves per hint
  -  Once max hints are reached (if limited), hint button is disabled
-  **Keyboard Controls**:
  -  **Tab**: Select next tile (cycle through tiles)
  -  **Arrow Keys** (↑↓←→) or **WASD**: Move selected tile (if adjacent to empty space)
  -  Without selection: Arrow keys move tiles adjacent to empty space
-  Visual feedback: Green glow for movable tiles, green background for tiles in correct position
-  Selected tiles show blue outline and badge "⌂"

#### Game 6: Balance the Scale

```
Title: Balance the Scale
Game Order: 6
Game Type: logic
Difficulty: 2
Time Limit: 60
Passing Score: 75
Unlock Requirement: [ID of Game 5]
Description: Determine which side is heavier
Game Config:
{
  "gameType": "balance-scale",
  "rounds": 20
}
```

**Configuration Details:**

-  `rounds` (optional): Number of rounds - default: **20** (recommended for 100 points max)

**How it works:**

-  Player must determine which side of the scale is heavier, or if they are equal
-  **Scoring**: 5 points per correct round (max 100 points for 20 rounds)
-  **Keyboard Controls**:
-  **ArrowLeft** or **A**: Left is heavier
-  **ArrowRight** or **D**: Right is heavier
-  **Enter**, **Space**, or **E**: Equal weight
-  Modern UI with gradient backgrounds, animations, and visual feedback
-  Faster animations (0.5s) to allow 20 rounds within time limit

#### Game 7: Light Switch Puzzle

```
Title: Light Switch Puzzle
Game Order: 7
Game Type: logic
Difficulty: 3
Time Limit: 90
Passing Score: 80
Unlock Requirement: [ID of Game 6]
Description: Turn all lights off with limited moves
Game Config:
{
  "gameType": "light-switch",
  "gridSize": 3,
  "maxMoves": 10
}
```

#### Game 8: Maze Escape

```
Title: Maze Escape
Game Order: 8
Game Type: logic
Difficulty: 2
Time Limit: 120
Passing Score: 75
Unlock Requirement: [ID of Game 7]
Description: Navigate from start to exit
Game Config:
{
  "gameType": "maze-escape",
  "size": 5
}
```

#### Game 9: Pattern Completion

```
Title: Pattern Completion
Game Order: 9
Game Type: logic
Difficulty: 2
Time Limit: 60
Passing Score: 75
Unlock Requirement: [ID of Game 8]
Description: Complete the missing pattern element
Game Config:
{
  "gameType": "pattern-completion",
  "rounds": 5
}
```

#### Game 10: Simple Sudoku (4×4)

```
Title: Sudoku 4x4
Game Order: 10
Game Type: logic
Difficulty: 3
Time Limit: 180
Passing Score: 85
Unlock Requirement: [ID of Game 9]
Description: Complete the 4x4 sudoku grid
Game Config:
{
  "gameType": "sudoku-4x4"
}
```

**Configuration Details:**

-  No additional fields required - `gameType` is sufficient

**How it works:**

-  Generates a **new random puzzle** each time the game starts
-  Real-time validation: highlights errors immediately (red cells, shake animation)
-  Initial clues are uneditable (gray background)
-  **Keyboard Controls**:
-  **Arrow Keys**: Navigate between cells
-  **1-4**: Direct number input
-  **Backspace/Delete**: Clear selected cell
-  **NumberKeypad Component**: Visual number pad for mouse input
-  Tooltips show cell status (error, initial clue, normal)
-  Visual feedback for correct/incorrect entries

#### Game 11: Rotate to Fit

```
Title: Rotate to Fit
Game Order: 11
Game Type: logic
Difficulty: 2
Time Limit: 90
Passing Score: 75
Unlock Requirement: [ID of Game 10]
Description: Rotate shapes to fit perfectly
Game Config:
{
  "gameType": "rotate-to-fit",
  "rounds": 3
}
```

#### Game 12: Mirror Match

```
Title: Mirror Match
Game Order: 12
Game Type: logic
Difficulty: 2
Time Limit: 60
Passing Score: 75
Unlock Requirement: [ID of Game 11]
Description: Identify if images are mirrored or different
Game Config:
{
  "gameType": "mirror-match",
  "rounds": 5
}
```

#### Game 13: Logic Gates Lite

```
Title: Logic Gates
Game Order: 13
Game Type: logic
Difficulty: 3
Time Limit: 90
Passing Score: 80
Unlock Requirement: [ID of Game 12]
Description: Determine output of AND/OR gates
Game Config:
{
  "gameType": "logic-gates",
  "rounds": 5
}
```

#### Game 14: Sequence Arrows

```
Title: Sequence Arrows
Game Order: 14
Game Type: logic
Difficulty: 2
Time Limit: 60
Passing Score: 75
Unlock Requirement: [ID of Game 13]
Description: Predict the next arrow in sequence
Game Config:
{
  "gameType": "sequence-arrows",
  "rounds": 5
}
```

#### Game 15: Block Fill

```
Title: Block Fill
Game Order: 15
Game Type: logic
Difficulty: 3
Time Limit: 120
Passing Score: 80
Unlock Requirement: [ID of Game 14]
Description: Fill the grid with all blocks
Game Config:
{
  "gameType": "block-fill",
  "gridSize": 4
}
```

---

### 🧠 MEMORY GAMES (16-25)

#### Game 16: Card Flip Memory

```
Title: Card Flip Memory
Game Order: 16
Game Type: memory
Difficulty: 2
Time Limit: 120
Passing Score: 80
Unlock Requirement: [ID of Game 15]
Description: Classic card matching pairs
Game Config:
{
  "gameType": "card-flip",
  "gridSize": 4,
  "pairs": 8
}
```

#### Game 17: Sound Memory

```
Title: Sound Memory
Game Order: 17
Game Type: memory
Difficulty: 2
Time Limit: 90
Passing Score: 75
Unlock Requirement: [ID of Game 16]
Description: Repeat a sequence of sounds
Game Config:
{
  "gameType": "sound-memory",
  "rounds": 5
}
```

#### Game 18: Emoji Memory

```
Title: Emoji Memory
Game Order: 18
Game Type: memory
Difficulty: 2
Time Limit: 60
Passing Score: 75
Unlock Requirement: [ID of Game 17]
Description: Remember emoji positions
Game Config:
{
  "gameType": "emoji-memory",
  "gridSize": 3,
  "rounds": 3
}
```

#### Game 19: Number Recall

```
Title: Number Recall
Game Order: 19
Game Type: memory
Difficulty: 2
Time Limit: 60
Passing Score: 75
Unlock Requirement: [ID of Game 18]
Description: Remember and type a number sequence
Game Config:
{
  "gameType": "number-recall",
  "digits": 4,
  "rounds": 3
}
```

#### Game 20: Image Recall

```
Title: Image Recall
Game Order: 20
Game Type: memory
Difficulty: 3
Time Limit: 90
Passing Score: 80
Unlock Requirement: [ID of Game 19]
Description: Remember image order
Game Config:
{
  "gameType": "image-recall",
  "images": 5
}
```

#### Game 21: Path Memory

```
Title: Path Memory
Game Order: 21
Game Type: memory
Difficulty: 2
Time Limit: 60
Passing Score: 75
Unlock Requirement: [ID of Game 20]
Description: Recreate a path on a grid
Game Config:
{
  "gameType": "path-memory",
  "rounds": 3
}
```

#### Game 22: Word Memory

```
Title: Word Memory
Game Order: 22
Game Type: memory
Difficulty: 2
Time Limit: 90
Passing Score: 75
Unlock Requirement: [ID of Game 21]
Description: Remember and select words
Game Config:
{
  "gameType": "word-memory",
  "words": 5
}
```

#### Game 23: Face Memory

```
Title: Face Memory
Game Order: 23
Game Type: memory
Difficulty: 2
Time Limit: 90
Passing Score: 75
Unlock Requirement: [ID of Game 22]
Description: Match faces with names
Game Config:
{
  "gameType": "face-memory",
  "faces": 4
}
```

#### Game 24: Color Grid Memory

```
Title: Color Grid Memory
Game Order: 24
Game Type: memory
Difficulty: 3
Time Limit: 60
Passing Score: 80
Unlock Requirement: [ID of Game 23]
Description: Remember highlighted grid cells
Game Config:
{
  "gameType": "color-grid-memory",
  "gridSize": 3,
  "rounds": 3
}
```

#### Game 25: Symbol Stack

```
Title: Symbol Stack
Game Order: 25
Game Type: memory
Difficulty: 2
Time Limit: 60
Passing Score: 75
Unlock Requirement: [ID of Game 24]
Description: Rebuild a stack of symbols
Game Config:
{
  "gameType": "symbol-stack",
  "rounds": 3
}
```

---

### ⚡ SPEED & REACTION GAMES (26-35)

#### Game 26: Click the Green

```
Title: Click the Green
Game Order: 26
Game Type: speed
Difficulty: 1
Time Limit: 60
Passing Score: 70
Unlock Requirement: [ID of Game 25]
Description: Click only green items quickly
Game Config:
{
  "gameType": "click-green"
}
```

#### Game 27: Avoid the Red

```
Title: Avoid the Red
Game Order: 27
Game Type: speed
Difficulty: 2
Time Limit: 30
Passing Score: 75
Unlock Requirement: [ID of Game 26]
Description: Avoid red obstacles for set duration
Game Config:
{
  "gameType": "avoid-red",
  "duration": 30
}
```

#### Game 28: Reaction Test

```
Title: Reaction Test
Game Order: 28
Game Type: speed
Difficulty: 2
Time Limit: 60
Passing Score: 75
Unlock Requirement: [ID of Game 27]
Description: Click as fast as possible after color change
Game Config:
{
  "gameType": "reaction-test",
  "rounds": 10
}
```

#### Game 29: Fast Math

```
Title: Fast Math
Game Order: 29
Game Type: speed
Difficulty: 2
Time Limit: 90
Passing Score: 80
Unlock Requirement: [ID of Game 28]
Description: Solve math problems quickly
Game Config:
{
  "gameType": "fast-math",
  "rounds": 10
}
```

#### Game 30: Whack-a-Shape

```
Title: Whack-a-Shape
Game Order: 30
Game Type: speed
Difficulty: 2
Time Limit: 60
Passing Score: 75
Unlock Requirement: [ID of Game 29]
Description: Click the correct shape type
Game Config:
{
  "gameType": "whack-shape",
  "rounds": 20
}
```

#### Game 31: Typing Sprint

```
Title: Typing Sprint
Game Order: 31
Game Type: speed
Difficulty: 2
Time Limit: 120
Passing Score: 75
Unlock Requirement: [ID of Game 30]
Description: Type words accurately and fast
Game Config:
{
  "gameType": "typing-sprint",
  "words": 10
}
```

#### Game 32: Quick Compare

```
Title: Quick Compare
Game Order: 32
Game Type: speed
Difficulty: 1
Time Limit: 60
Passing Score: 70
Unlock Requirement: [ID of Game 31]
Description: Compare two numbers quickly
Game Config:
{
  "gameType": "quick-compare",
  "rounds": 15
}
```

#### Game 33: Falling Objects

```
Title: Falling Objects
Game Order: 33
Game Type: speed
Difficulty: 2
Time Limit: 30
Passing Score: 75
Unlock Requirement: [ID of Game 32]
Description: Catch good items, avoid bad ones
Game Config:
{
  "gameType": "falling-objects",
  "duration": 30
}
```

#### Game 34: Tap Counter

```
Title: Tap Counter
Game Order: 34
Game Type: speed
Difficulty: 1
Time Limit: 10
Passing Score: 70
Unlock Requirement: [ID of Game 33]
Description: Tap as many times as possible
Game Config:
{
  "gameType": "tap-counter",
  "duration": 10
}
```

#### Game 35: Reflex Arrows

```
Title: Reflex Arrows
Game Order: 35
Game Type: speed
Difficulty: 2
Time Limit: 60
Passing Score: 75
Unlock Requirement: [ID of Game 34]
Description: Press arrow keys quickly
Game Config:
{
  "gameType": "reflex-arrows",
  "rounds": 15
}
```

---

### 🎯 SKILL & COORDINATION GAMES (36-45)

#### Game 36: Ball Balance

```
Title: Ball Balance
Game Order: 36
Game Type: skill
Difficulty: 3
Time Limit: 120
Passing Score: 80
Unlock Requirement: [ID of Game 35]
Description: Balance a ball on a platform
Game Config:
{
  "gameType": "ball-balance"
}
```

#### Game 37: Target Aim

```
Title: Target Aim
Game Order: 37
Game Type: skill
Difficulty: 2
Time Limit: 90
Passing Score: 75
Unlock Requirement: [ID of Game 36]
Description: Click moving targets with increasing speed
Game Config:
{
  "gameType": "target-aim",
  "targets": 10
}
```

#### Game 38: Line Tracer

```
Title: Line Tracer
Game Order: 38
Game Type: skill
Difficulty: 3
Time Limit: 120
Passing Score: 80
Unlock Requirement: [ID of Game 37]
Description: Trace a path with cursor
Game Config:
{
  "gameType": "line-tracer"
}
```

#### Game 39: Timing Bar

```
Title: Timing Bar
Game Order: 39
Game Type: skill
Difficulty: 2
Time Limit: 60
Passing Score: 75
Unlock Requirement: [ID of Game 38]
Description: Stop moving bar at highlighted zone
Game Config:
{
  "gameType": "timing-bar",
  "rounds": 5
}
```

#### Game 40: Stack Blocks

```
Title: Stack Blocks
Game Order: 40
Game Type: skill
Difficulty: 3
Time Limit: 120
Passing Score: 80
Unlock Requirement: [ID of Game 39]
Description: Stack blocks as evenly as possible
Game Config:
{
  "gameType": "stack-blocks",
  "blocks": 10
}
```

#### Game 41: Precision Drop

```
Title: Precision Drop
Game Order: 41
Game Type: skill
Difficulty: 2
Time Limit: 90
Passing Score: 75
Unlock Requirement: [ID of Game 40]
Description: Drop object into small target area
Game Config:
{
  "gameType": "precision-drop",
  "rounds": 5
}
```

#### Game 42: Drag & Drop Sort

```
Title: Drag & Drop Sort
Game Order: 42
Game Type: skill
Difficulty: 2
Time Limit: 120
Passing Score: 75
Unlock Requirement: [ID of Game 41]
Description: Sort items into correct categories
Game Config:
{
  "gameType": "drag-sort",
  "items": 8
}
```

#### Game 43: Speed Drawing

```
Title: Speed Drawing
Game Order: 43
Game Type: skill
Difficulty: 3
Time Limit: 90
Passing Score: 80
Unlock Requirement: [ID of Game 42]
Description: Draw displayed shape within time limit
Game Config:
{
  "gameType": "speed-drawing",
  "rounds": 3
}
```

#### Game 44: One-Hand Mode

```
Title: One-Hand Mode
Game Order: 44
Game Type: skill
Difficulty: 2
Time Limit: 60
Passing Score: 75
Unlock Requirement: [ID of Game 43]
Description: Complete task using only one control
Game Config:
{
  "gameType": "one-hand",
  "rounds": 5
}
```

#### Game 45: Cursor Maze

```
Title: Cursor Maze
Game Order: 45
Game Type: skill
Difficulty: 3
Time Limit: 120
Passing Score: 80
Unlock Requirement: [ID of Game 44]
Description: Navigate maze with cursor without touching walls
Game Config:
{
  "gameType": "cursor-maze"
}
```

---

### 🏁 FINAL GAMES (46-50)

**Note:** For Final Games, you need to add `final` as a Game Type option. If it's not available, use `skill` and the games will still work.

#### Game 46: Mixed Quiz

```
Title: Mixed Quiz
Game Order: 46
Game Type: final (or skill)
Difficulty: 4
Time Limit: 180
Passing Score: 85
Unlock Requirement: [ID of Game 45]
Description: Randomly mix logic, memory, and reaction challenges
Game Config:
{
  "gameType": "mixed-quiz",
  "rounds": 5
}
```

#### Game 47: Survival Mode

```
Title: Survival Mode
Game Order: 47
Game Type: final (or skill)
Difficulty: 4
Time Limit: 300
Passing Score: 85
Unlock Requirement: [ID of Game 46]
Description: Complete several mini-games in sequence without failing
Game Config:
{
  "gameType": "survival-mode",
  "games": 5
}
```

#### Game 48: Boss Puzzle

```
Title: Boss Puzzle
Game Order: 48
Game Type: final (or skill)
Difficulty: 5
Time Limit: 600
Passing Score: 90
Unlock Requirement: [ID of Game 47]
Description: Combine multiple mechanics into one difficult puzzle
Game Config:
{
  "gameType": "boss-puzzle"
}
```

#### Game 49: Time Challenge

```
Title: Time Challenge
Game Order: 49
Game Type: final (or skill)
Difficulty: 4
Time Limit: 60
Passing Score: 85
Unlock Requirement: [ID of Game 48]
Description: Complete as many challenges as possible within time limit
Game Config:
{
  "gameType": "time-challenge",
  "duration": 60
}
```

#### Game 50: Final Certification Test

```
Title: Final Certification Test
Game Order: 50
Game Type: final (or skill)
Difficulty: 5
Time Limit: 600
Passing Score: 90
Unlock Requirement: [ID of Game 49]
Description: Randomized final exam using previous game mechanics
Game Config:
{
  "gameType": "final-test",
  "rounds": 10
}
```

---

## Quick Reference

### Game Type Options:

-  `logic` - Logic & Puzzle Games (1-15)
-  `memory` - Memory Games (16-25)
-  `speed` - Speed & Reaction Games (26-35)
-  `skill` - Skill & Coordination Games (36-45)
-  `final` - Final Games (46-50) - _May need to add this option to WordPress admin_

### Difficulty Guidelines:

-  **1** - Beginner (Easy)
-  **2** - Intermediate
-  **3** - Advanced
-  **4** - Expert
-  **5** - Master

### Time Limit Guidelines:

-  **Quick Games** (1-2 min): 30-60 seconds
-  **Standard Games** (2-3 min): 60-120 seconds
-  **Complex Games** (3-5 min): 120-180 seconds
-  **Final Games** (5-10 min): 300-600 seconds

### Passing Score Guidelines:

-  **Easy Games**: 70
-  **Medium Games**: 75-80
-  **Hard Games**: 80-85
-  **Final Games**: 85-90

---

## Important Notes

1. **Publishing**: Games must be **Published** (not Draft) to appear in the API
2. **Game Order**: Must be unique (1-50) and sequential
3. **Unlock Requirement**:
   -  Game 1: Leave empty
   -  Game 2-50: Enter the **ID** (not order) of the previous game
4. **Game Config JSON**: Must be valid JSON. Use a JSON validator if needed.
5. **Finding IDs**: Hover over game title in "All Games" list to see ID in URL

---

## Testing

After creating games:

1. Visit: `https://cms.play50.games/wp-json/play50/v1/games`
2. You should see a JSON array with all your games
3. Check your frontend to see games displayed

---

## Troubleshooting

### Games not showing?

-  ✅ Check game status is **Published**
-  ✅ Verify Game Order is set (1-50)
-  ✅ Check Game Config JSON is valid
-  ✅ Clear WordPress cache if using caching plugins

### API returns empty array?

-  This is normal if no games are created yet
-  Create at least one game following the guide above

### Game not working?

-  ✅ Verify `gameType` in Game Config matches the game name
-  ✅ Check all required fields are filled
-  ✅ Ensure JSON is valid (no trailing commas, proper quotes)

---

## Need Help?

Refer to:

-  `GAMES_LIST.md` - Complete list of all games
-  `QUICK_START_GAMES.md` - Quick start guide
-  WordPress Admin → Games → Help (if available)
