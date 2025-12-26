# Number Order Configuration Guide

## Overview

**Number Order** is a logic game where players must click numbers in ascending order (1, 2, 3, 4, 5...) from a shuffled set. The number count increases dynamically based on the round.

---

## WordPress Backend Configuration

### Required Fields

| Field                  | Value                                                         |
| ---------------------- | ------------------------------------------------------------- |
| **Title**              | `Number Order`                                                |
| **Game Order**         | `3` (or desired position)                                     |
| **Game Type**          | `logic`                                                       |
| **Difficulty**         | `1` (Easy)                                                    |
| **Time Limit**         | `90` seconds (recommended)                                    |
| **Passing Score**      | `70` (out of 100)                                             |
| **Unlock Requirement** | `[ID of previous game]` (empty for Game 1)                    |
| **Description**        | `Click numbers from smallest to largest in the correct order` |

### Game Config (JSON)

```json
{
   "gameType": "number-order",
   "rounds": 20
}
```

**Note**: The `numbers` field is no longer used. Number count is now **dynamic** based on rounds.

---

## Configuration Fields

### `gameType` (required)

-  **Value**: `"number-order"`
-  **Description**: Identifies this as the Number Order game

### `rounds` (optional)

-  **Default**: `20` (recommended)
-  **Description**: Number of rounds to play
-  **Scoring**: 5 points per correct round (max 100 points for 20 rounds)
-  **Recommended**: `20` rounds for optimal gameplay

### Dynamic Number Count

The number of numbers to sort **increases automatically** based on the round:

-  **Rounds 1-5**: **3 numbers** (1, 2, 3)
-  **Rounds 6-10**: **5 numbers** (1, 2, 3, 4, 5)
-  **Rounds 11-20**: **10 numbers** (1, 2, 3, 4, 5, 6, 7, 8, 9, 10)

This provides a progressive difficulty curve as players advance through rounds.

---

## How It Works

1. **Gameplay**:

   -  Numbers are shuffled randomly each round
   -  Player must click numbers in ascending order: 1, 2, 3, 4, 5...
   -  Number count increases automatically based on round (3 → 5 → 10)
   -  Visual feedback shows correct (green) and incorrect (red) selections
   -  Undo button available to remove last selected number

2. **Scoring**:

   -  **Correct round**: +5 points
   -  **Wrong round**: 0 points
   -  **Maximum score**: 100 points (20 rounds × 5 points)

3. **Keyboard Controls**:

   -  Press **1-9** to select by **position in grid** (press "1" to select first number in grid, "2" for second number in grid)
   -  Press **0** to select 10th position (if 10 numbers are present)
   -  Press **Backspace/Delete** to undo last selection
   -  **Important**: Keyboard selects by position, not by value!

4. **Visual Feedback**:
   -  Selected numbers show in a preview box
   -  Green highlight for numbers in correct order
   -  Red highlight for numbers in wrong order
   -  Undo button to remove last selected number

---

## Configuration Examples

### Minimal Configuration (Uses Defaults)

```json
{
   "gameType": "number-order"
}
```

-  Uses: 20 rounds (dynamic number count: 3 → 5 → 10)

### Custom Configuration

```json
{
   "gameType": "number-order",
   "rounds": 15
}
```

-  Uses: 15 rounds (max 75 points)
-  Number count: rounds 1-5 = 3 numbers, rounds 6-10 = 5 numbers, rounds 11-15 = 10 numbers

### Recommended Configuration

```json
{
   "gameType": "number-order",
   "rounds": 20
}
```

-  Uses: 20 rounds (max 100 points)
-  Number count: rounds 1-5 = 3 numbers, rounds 6-10 = 5 numbers, rounds 11-20 = 10 numbers

---

## Tips for Configuration

1. **Dynamic Number Count**:

   -  Number count increases automatically: 3 → 5 → 10
   -  Provides progressive difficulty as players advance
   -  No manual configuration needed

2. **Rounds**:

   -  **10 rounds**: Quick game (max 50 points)
      -  Rounds 1-5: 3 numbers
      -  Rounds 6-10: 5 numbers
   -  **20 rounds**: Standard game (max 100 points) - **Recommended**
      -  Rounds 1-5: 3 numbers
      -  Rounds 6-10: 5 numbers
      -  Rounds 11-20: 10 numbers
   -  **30+ rounds**: Extended game (max 150+ points)
      -  Rounds 1-5: 3 numbers
      -  Rounds 6-10: 5 numbers
      -  Rounds 11+: 10 numbers

3. **Time Limit**:

   -  **60 seconds**: Fast-paced (for 10 rounds)
   -  **90 seconds**: Balanced (for 20 rounds) - **Recommended**
   -  **120 seconds**: Relaxed (for 30+ rounds)

4. **Passing Score**:
   -  **60**: Easy (12+ correct rounds out of 20)
   -  **70**: Standard (14+ correct rounds) - **Recommended**
   -  **80**: Challenging (16+ correct rounds)

---

## Testing

After configuring in WordPress:

1. Visit: `https://cms.play50.games/wp-json/play50/v1/games`
2. Find your game in the JSON response
3. Verify `game_config` contains the correct JSON
4. Test in the frontend to ensure:
   -  Numbers shuffle correctly each round
   -  Number count increases: 3 → 5 → 10
   -  Selection order is validated
   -  Scoring works (5 points per correct round)
   -  Keyboard controls work (1-9 by position, 0 for 10th, Backspace/Delete for undo)
   -  Undo button works correctly
   -  Visual feedback displays correctly

---

## Troubleshooting

### Numbers not shuffling?

-  ✅ Verify JSON is valid (no syntax errors)
-  ✅ Check that numbers shuffle randomly each round
-  ✅ Ensure number count increases correctly (3 → 5 → 10)

### Scoring not working?

-  ✅ Ensure `rounds` is set (default: 20)
-  ✅ Check that correct selections award 5 points
-  ✅ Verify max score is 100 for 20 rounds

### Keyboard controls not working?

-  ✅ Verify keyboard selects by position (1-9 for positions 1-9, 0 for position 10)
-  ✅ Check Backspace/Delete for undo functionality
-  ✅ Check browser console for errors

---

## Related Documentation

-  `WORDPRESS_GAMES_CONFIGURATION.md` - Complete game configuration guide
-  `GAME_CONFIG_FIELDS.md` - All game config fields
-  `QUICK_REFERENCE_GAMES.md` - Quick config reference
