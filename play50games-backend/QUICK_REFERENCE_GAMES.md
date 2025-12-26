# Quick Reference: All 50 Games Configuration

Copy and paste these configurations directly into WordPress Admin.

---

## 🧠 LOGIC GAMES (1-15)

### 1. Match the Shapes

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

_Default: 20 rounds (max 100 points). Uses Heroicons. Keyboard: 1-12 to select shapes (1-9, 0, -, =)._

### 2. Color Sequence

```json
{
   "gameType": "color-sequence",
   "rounds": 20,
   "colors": ["red", "blue", "green", "yellow"]
}
```

_Default: 20 rounds (max 100 points). Keyboard: 1-4 to select colors._

### 3. Number Order

```json
{ "gameType": "number-order", "numbers": 5, "rounds": 20 }
```

_Default: 20 rounds (max 100 points). Keyboard: 1-9 to select numbers._

### 4. Find the Odd One

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

### 5. Tile Slider

```json
{ "gameType": "tile-slider", "gridSize": 3, "showHints": true, "maxHints": 5 }
```

_Default: gridSize 3 (3x3), hints enabled (max 3). Keyboard: Tab to select, Arrow keys to move._

### 6. Balance the Scale

```json
{ "gameType": "balance-scale", "rounds": 20 }
```

_Default: 20 rounds (max 100 points). Keyboard: ArrowLeft/A (left), ArrowRight/D (right), Enter/Space/E (equal)._

### 7. Light Switch Puzzle

```json
{ "gameType": "light-switch", "gridSize": 3, "maxMoves": 10 }
```

### 8. Maze Escape

```json
{ "gameType": "maze-escape", "size": 5 }
```

### 9. Pattern Completion

```json
{ "gameType": "pattern-completion", "rounds": 5 }
```

### 10. Sudoku 4x4

```json
{ "gameType": "sudoku-4x4" }
```

_Generates new random puzzle each game. Keyboard: Arrow keys (navigate), 1-4 (input), Backspace/Delete (clear). Real-time validation._

### 11. Rotate to Fit

```json
{ "gameType": "rotate-to-fit", "rounds": 3 }
```

### 12. Mirror Match

```json
{ "gameType": "mirror-match", "rounds": 5 }
```

### 13. Logic Gates

```json
{ "gameType": "logic-gates", "rounds": 5 }
```

### 14. Sequence Arrows

```json
{ "gameType": "sequence-arrows", "rounds": 5 }
```

### 15. Block Fill

```json
{ "gameType": "block-fill", "gridSize": 4 }
```

---

## 🧠 MEMORY GAMES (16-25)

### 16. Card Flip Memory

```json
{ "gameType": "card-flip", "gridSize": 4, "pairs": 8 }
```

### 17. Sound Memory

```json
{ "gameType": "sound-memory", "rounds": 5 }
```

### 18. Emoji Memory

```json
{ "gameType": "emoji-memory", "gridSize": 3, "rounds": 3 }
```

### 19. Number Recall

```json
{ "gameType": "number-recall", "digits": 4, "rounds": 3 }
```

### 20. Image Recall

```json
{ "gameType": "image-recall", "images": 5 }
```

### 21. Path Memory

```json
{ "gameType": "path-memory", "rounds": 3 }
```

### 22. Word Memory

```json
{ "gameType": "word-memory", "words": 5 }
```

### 23. Face Memory

```json
{ "gameType": "face-memory", "faces": 4 }
```

### 24. Color Grid Memory

```json
{ "gameType": "color-grid-memory", "gridSize": 3, "rounds": 3 }
```

### 25. Symbol Stack

```json
{ "gameType": "symbol-stack", "rounds": 3 }
```

---

## ⚡ SPEED GAMES (26-35)

### 26. Click the Green

```json
{ "gameType": "click-green" }
```

### 27. Avoid the Red

```json
{ "gameType": "avoid-red", "duration": 30 }
```

### 28. Reaction Test

```json
{ "gameType": "reaction-test", "rounds": 10 }
```

### 29. Fast Math

```json
{ "gameType": "fast-math", "rounds": 10 }
```

### 30. Whack-a-Shape

```json
{ "gameType": "whack-shape", "rounds": 20 }
```

### 31. Typing Sprint

```json
{ "gameType": "typing-sprint", "words": 10 }
```

### 32. Quick Compare

```json
{ "gameType": "quick-compare", "rounds": 15 }
```

### 33. Falling Objects

```json
{ "gameType": "falling-objects", "duration": 30 }
```

### 34. Tap Counter

```json
{ "gameType": "tap-counter", "duration": 10 }
```

### 35. Reflex Arrows

```json
{ "gameType": "reflex-arrows", "rounds": 15 }
```

---

## 🎯 SKILL GAMES (36-45)

### 36. Ball Balance

```json
{ "gameType": "ball-balance" }
```

### 37. Target Aim

```json
{ "gameType": "target-aim", "targets": 10 }
```

### 38. Line Tracer

```json
{ "gameType": "line-tracer" }
```

### 39. Timing Bar

```json
{ "gameType": "timing-bar", "rounds": 5 }
```

### 40. Stack Blocks

```json
{ "gameType": "stack-blocks", "blocks": 10 }
```

### 41. Precision Drop

```json
{ "gameType": "precision-drop", "rounds": 5 }
```

### 42. Drag & Drop Sort

```json
{ "gameType": "drag-sort", "items": 8 }
```

### 43. Speed Drawing

```json
{ "gameType": "speed-drawing", "rounds": 3 }
```

### 44. One-Hand Mode

```json
{ "gameType": "one-hand", "rounds": 5 }
```

### 45. Cursor Maze

```json
{ "gameType": "cursor-maze" }
```

---

## 🏁 FINAL GAMES (46-50)

### 46. Mixed Quiz

```json
{ "gameType": "mixed-quiz", "rounds": 5 }
```

### 47. Survival Mode

```json
{ "gameType": "survival-mode", "games": 5 }
```

### 48. Boss Puzzle

```json
{ "gameType": "boss-puzzle" }
```

### 49. Time Challenge

```json
{ "gameType": "time-challenge", "duration": 60 }
```

### 50. Final Certification Test

```json
{ "gameType": "final-test", "rounds": 10 }
```

---

## Standard Field Values

For all games, use these standard values (adjust as needed):

| Field                  | Value                                 |
| ---------------------- | ------------------------------------- |
| **Difficulty**         | 1-5 (1=easiest, 5=hardest)            |
| **Time Limit**         | 60-600 seconds (see full guide)       |
| **Passing Score**      | 70-90 (see full guide)                |
| **Unlock Requirement** | Previous game's ID (empty for Game 1) |

See `WORDPRESS_GAMES_CONFIGURATION.md` for complete field values for each game.
