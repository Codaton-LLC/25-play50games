# Quick Start: Creating Your First Game

## The Problem

You're seeing "No games found" because there are no games created in WordPress yet. The API is working correctly, but the database is empty.

## Solution: Create Games in WordPress Admin

### Step 1: Access WordPress Admin

1. Go to your WordPress admin: `https://cms.play50.games/wp-admin`
2. Log in with your admin credentials

### Step 2: Create Your First Game

1. In the left sidebar, click **Games** → **Add New**
2. Fill in the following fields:

#### Required Fields:

-  **Title**: `Match the Shapes` (or any name you want)
-  **Game Order**: `1` (this is the first game)
-  **Game Type**: Select `logic`
-  **Difficulty**: `1`
-  **Time Limit**: `60` (seconds)
-  **Passing Score**: `70` (minimum score to pass)
-  **Unlock Requirement**: Leave **EMPTY** (this is the first game, no requirement)
-  **Description**: `Drag shapes into correct outlines`

#### Game Config (JSON):

In the **Game Config** field, paste this JSON:

```json
{
   "gameType": "match-shapes",
   "shapes": ["circle", "square", "triangle"],
   "rounds": 5
}
```

3. Click **Publish** button (top right)

### Step 3: Verify It Works

1. Go to your frontend: `http://localhost:3000` (or 3001)
2. Refresh the page
3. You should now see your game!

## Creating More Games

### Game 2: Color Sequence

-  **Title**: `Color Sequence`
-  **Game Order**: `2`
-  **Game Type**: `logic`
-  **Difficulty**: `1`
-  **Time Limit**: `90`
-  **Passing Score**: `70`
-  **Unlock Requirement**: `[ID of Game 1]` (find the ID from the Games list)
-  **Description**: `Watch and repeat color sequences. The sequence gets longer as rounds progress.`
-  **Game Config**:

```json
{
   "gameType": "color-sequence",
   "rounds": 20,
   "colors": ["red", "blue", "green", "yellow"]
}
```

**Configuration:**

-  `rounds` (optional): Default **20** rounds (recommended for 100 points max)
-  `colors` (optional): Default `["red", "blue", "green", "yellow"]`

**How it works:**

-  Rounds 1-5: 2 colors per sequence
-  Rounds 6-10: 3 colors per sequence
-  Rounds 11-15: 4 colors per sequence
-  Rounds 16-20: 5 colors per sequence
-  **Scoring**: 5 points per correct round (max 100 points)
-  **Keyboard**: Press 1-4 to select colors (1=Red, 2=Blue, 3=Green, 4=Yellow)

### Game 3: Card Flip Memory

-  **Title**: `Card Flip Memory`
-  **Game Order**: `3`
-  **Game Type**: `memory`
-  **Difficulty**: `2`
-  **Time Limit**: `120`
-  **Passing Score**: `80`
-  **Unlock Requirement**: `[ID of Game 2]`
-  **Description**: `Classic matching pairs`
-  **Game Config**:

```json
{
   "gameType": "card-flip",
   "gridSize": 4,
   "pairs": 8
}
```

## Important Notes

1. **Finding Game IDs**:

   -  Go to **Games** → **All Games**
   -  Hover over a game title
   -  The ID is in the URL: `post.php?post=123&action=edit` (123 is the ID)

2. **Game Order**:

   -  Determines the sequence games appear
   -  Game 1 should have order 1, Game 2 should have order 2, etc.

3. **Unlock Requirement**:

   -  First game: Leave empty
   -  Other games: Enter the **ID** (not the order) of the game that must be completed first

4. **Publishing**:
   -  Games must be **Published** (not Draft) to appear in the API
   -  Check the status in the top right when editing

## Testing the API

After creating games, test the API directly:

-  `https://cms.play50.games/wp-json/play50/v1/games`

You should see a JSON array with your games.

## Troubleshooting

### Games still not showing?

1. **Check game status**: Make sure games are **Published**, not Draft
2. **Check Game Order**: Make sure it's set (1, 2, 3, etc.)
3. **Clear cache**: If using caching plugins, clear the cache
4. **Check API directly**: Visit `https://cms.play50.games/wp-json/play50/v1/games` in browser
5. **Check browser console**: Look for any JavaScript errors

### API returns empty array `[]`?

-  This is normal if no games are created yet
-  Create at least one game following the steps above
