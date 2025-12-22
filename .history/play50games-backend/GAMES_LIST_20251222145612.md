# Complete Games List (50 Games)

## 🧠 LOGIC & PUZZLE GAMES (1–15)

1. **Match the Shapes** - `gameType: "match-shapes"`
2. **Color Sequence** - `gameType: "color-sequence"`
3. **Number Order** - `gameType: "number-order"`
4. **Find the Odd One** - `gameType: "find-odd-one"`
5. **Tile Slider (3×3)** - `gameType: "tile-slider"`
6. **Balance the Scale** - `gameType: "balance-scale"`
7. **Light Switch Puzzle** - `gameType: "light-switch"`
8. **Maze Escape** - `gameType: "maze-escape"`
9. **Pattern Completion** - `gameType: "pattern-completion"`
10. **Simple Sudoku (4×4)** - `gameType: "sudoku-4x4"`
11. **Rotate to Fit** - `gameType: "rotate-to-fit"`
12. **Mirror Match** - `gameType: "mirror-match"`
13. **Logic Gates Lite** - `gameType: "logic-gates"`
14. **Sequence Arrows** - `gameType: "sequence-arrows"`
15. **Block Fill** - `gameType: "block-fill"`

## 🧠 MEMORY GAMES (16–25)

16. **Card Flip Memory** - `gameType: "card-flip"`
17. **Sound Memory** - `gameType: "sound-memory"`
18. **Emoji Memory** - `gameType: "emoji-memory"`
19. **Number Recall** - `gameType: "number-recall"`
20. **Image Recall** - `gameType: "image-recall"`
21. **Path Memory** - `gameType: "path-memory"`
22. **Word Memory** - `gameType: "word-memory"`
23. **Face Memory** - `gameType: "face-memory"`
24. **Color Grid Memory** - `gameType: "color-grid-memory"`
25. **Symbol Stack** - `gameType: "symbol-stack"`

## ⚡ SPEED & REACTION (26–35)

26. **Click the Green** - `gameType: "click-green"`
27. **Avoid the Red** - `gameType: "avoid-red"`
28. **Reaction Test** - `gameType: "reaction-test"`
29. **Fast Math** - `gameType: "fast-math"`
30. **Whack-a-Shape** - `gameType: "whack-shape"`
31. **Typing Sprint** - `gameType: "typing-sprint"`
32. **Quick Compare** - `gameType: "quick-compare"`
33. **Falling Objects** - `gameType: "falling-objects"`
34. **Tap Counter** - `gameType: "tap-counter"`
35. **Reflex Arrows** - `gameType: "reflex-arrows"`

## 🎯 SKILL & COORDINATION (36–45)

36. **Ball Balance** - `gameType: "ball-balance"`
37. **Target Aim** - `gameType: "target-aim"`
38. **Line Tracer** - `gameType: "line-tracer"`
39. **Timing Bar** - `gameType: "timing-bar"`
40. **Stack Blocks** - `gameType: "stack-blocks"`
41. **Precision Drop** - `gameType: "precision-drop"`
42. **Drag & Drop Sort** - `gameType: "drag-sort"`
43. **Speed Drawing** - `gameType: "speed-drawing"`
44. **One-Hand Mode** - `gameType: "one-hand"`
45. **Cursor Maze** - `gameType: "cursor-maze"`

## 🏁 FINAL GAMES (46–50)

46. **Mixed Quiz** - `gameType: "mixed-quiz"`
47. **Survival Mode** - `gameType: "survival-mode"`
48. **Boss Puzzle** - `gameType: "boss-puzzle"`
49. **Time Challenge** - `gameType: "time-challenge"`
50. **Final Certification Test** - `gameType: "final-test"`

## Game Config Examples

### Logic Games
```json
{"gameType": "match-shapes", "shapes": ["circle", "square", "triangle"], "rounds": 5}
{"gameType": "color-sequence", "rounds": 5}
{"gameType": "number-order", "numbers": 5, "rounds": 3}
{"gameType": "find-odd-one", "gridSize": 3, "rounds": 5}
{"gameType": "tile-slider", "gridSize": 3}
{"gameType": "balance-scale", "rounds": 5}
{"gameType": "light-switch", "gridSize": 3}
{"gameType": "maze-escape", "size": 5}
{"gameType": "pattern-completion", "rounds": 5}
{"gameType": "sudoku-4x4"}
{"gameType": "rotate-to-fit", "rounds": 3}
{"gameType": "mirror-match", "rounds": 5}
{"gameType": "logic-gates", "rounds": 5}
{"gameType": "sequence-arrows", "rounds": 5}
{"gameType": "block-fill", "gridSize": 4}
```

### Memory Games
```json
{"gameType": "card-flip", "gridSize": 4, "pairs": 8}
{"gameType": "sound-memory", "rounds": 5}
{"gameType": "emoji-memory", "gridSize": 3, "rounds": 3}
{"gameType": "number-recall", "digits": 4, "rounds": 3}
{"gameType": "image-recall", "images": 5}
{"gameType": "path-memory", "rounds": 3}
{"gameType": "word-memory", "words": 5}
{"gameType": "face-memory", "faces": 4}
{"gameType": "color-grid-memory", "gridSize": 3, "rounds": 3}
{"gameType": "symbol-stack", "rounds": 3}
```

### Speed Games
```json
{"gameType": "click-green"}
{"gameType": "avoid-red", "duration": 30}
{"gameType": "reaction-test", "rounds": 10}
{"gameType": "fast-math", "rounds": 10}
{"gameType": "whack-shape", "rounds": 20}
{"gameType": "typing-sprint", "words": 10}
{"gameType": "quick-compare", "rounds": 15}
{"gameType": "falling-objects", "duration": 30}
{"gameType": "tap-counter", "duration": 10}
{"gameType": "reflex-arrows", "rounds": 15}
```

### Skill Games
```json
{"gameType": "ball-balance"}
{"gameType": "target-aim", "targets": 10}
{"gameType": "line-tracer"}
{"gameType": "timing-bar", "rounds": 5}
{"gameType": "stack-blocks", "blocks": 10}
{"gameType": "precision-drop", "rounds": 5}
{"gameType": "drag-sort", "items": 8}
{"gameType": "speed-drawing", "rounds": 3}
{"gameType": "one-hand", "rounds": 5}
{"gameType": "cursor-maze"}
```

### Final Games
```json
{"gameType": "mixed-quiz", "rounds": 5}
{"gameType": "survival-mode", "games": 5}
{"gameType": "boss-puzzle"}
{"gameType": "time-challenge", "duration": 60}
{"gameType": "final-test", "rounds": 10}
```

