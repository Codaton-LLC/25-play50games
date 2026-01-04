# Play50Games Platform

A complete browser-based gaming platform with 50 games, progress tracking, and certificate generation. Built with Next.js frontend and WordPress backend.

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Backend (WordPress)](#backend-wordpress)
   -  [Setup](#backend-setup)
   -  [REST API Endpoints](#rest-api-endpoints)
   -  [Creating Games](#creating-games)
   -  [Game Configuration](#game-configuration)
   -  [Circuit Path](#circuit-path)
   -  [Other Games](#other-games)
   -  [User Progress](#user-progress)
   -  [Certificate Generation](#certificate-generation)
   -  [Share Tracking](#share-tracking)
   -  [CORS Configuration](#cors-configuration)
4. [Frontend (Next.js)](#frontend-nextjs)
   -  [Setup](#frontend-setup)
   -  [Project Structure](#frontend-project-structure)
   -  [Features](#features)
   -  [Game Types](#game-types)
   -  [Environment Variables](#environment-variables)
   -  [Development](#development)
5. [Troubleshooting](#troubleshooting)

---

## Overview

Play50Games is a comprehensive gaming platform featuring:

-  **50 Games** across multiple categories (Logic, Memory, Speed, Skill, Final)
-  **Progress Tracking** with localStorage and WordPress API integration
-  **Unlock System** for sequential game progression
-  **Certificate Generation** after completing all games
-  **Modern UI** with Heroicons, animations, and fully responsive design (mobile, tablet, desktop)
-  **Keyboard Controls** for all games
-  **REST API** for game data and progress management

---

## Project Structure

```
play50games/
├── play50games-backend/          # WordPress theme
│   ├── play50games/              # Theme files
│   │   ├── functions.php        # Theme setup
│   │   ├── wt-cpt.php           # Custom Post Types
│   │   ├── wt-cpt/
│   │   │   └── games.php        # Games CPT meta fields
│   │   └── includes/
│   │       ├── rest-api.php     # REST API endpoints
│   │       └── certificate-generator.php
│   └── README.md                # Backend documentation
│
├── play50games-frontend/        # Next.js application
│   ├── src/
│   │   ├── app/                 # Next.js App Router
│   │   ├── components/          # React components
│   │   ├── lib/                 # API clients & utilities
│   │   └── types/               # TypeScript types
│   └── README.md                # Frontend documentation
│
└── README.md                     # This file
```

---

# Backend (WordPress)

WordPress theme with Custom Post Types and REST API for the Play50Games platform.

## Backend Setup

1. Install WordPress (5.0+)
2. Copy the `play50games` theme folder to `wp-content/themes/`
3. Activate the theme in WordPress admin
4. The following Custom Post Types will be available:
   -  **Games** (`play50_game`) - Game configurations
   -  **Certificates** (`play50_certificate`) - Generated certificates

## REST API Endpoints

All endpoints are under `/wp-json/play50/v1/`:

### Games

-  `GET /games` - Get all games with unlock status
-  `GET /games/{id}` - Get single game configuration

### Progress

-  `POST /progress` - Save user progress
   -  Body: `{ game_id, score, completed, guest_id? }`
-  `GET /progress` - Get user progress
   -  Query: `game_id?`, `guest_id?`

### Unlock Status

-  `GET /unlock-status` - Get unlock status for all games
   -  Query: `guest_id?`

### Certificates

-  `POST /certificate/generate` - Generate certificate
   -  Body: `{ player_name, guest_id? }`
-  `GET /certificate/{id}` - Get certificate by ID

### Share Tracking

-  `POST /share/register` - Register a new share link
   -  Body: `{ share_id, game_type }`
   -  Response: `{ success: boolean, share_id: string, clicks: number }`
-  `POST /share/click` - Track when someone clicks a shared link
   -  Body: `{ share_id }`
   -  Response: `{ success: boolean, share_id: string, clicks: number }`
-  `GET /share/status/{share_id}` - Get share link status
   -  Response: `{ success: boolean, share_id: string, game_type: string, clicks: number, has_clicks: boolean, created_at: string, last_click_at: string | null }`

## Creating Games

1. Go to WordPress Admin → **Games** → **Add New**
2. Fill in the required fields:
   -  **Title**: Game name (displayed to users)
   -  **Game Order**: Sequence number (1-50, determines unlock sequence)
   -  **Game Type**: Category (`logic`, `memory`, `speed`, `skill`, or `final`)
   -  **Difficulty**: 1-5 (1=easiest, 5=hardest)
   -  **Time Limit**: Seconds allowed to play
   -  **Passing Score**: Minimum score to pass (0-100)
   -  **Unlock Requirement**: Game ID that must be completed first (leave empty for Game 1)
   -  **Description**: Brief game description
   -  **Game Config**: JSON configuration (see examples below)

## Share Tracking

The platform includes a share tracking system that allows users to share games and receive unlimited hints when someone clicks their shared link.

### How It Works

1. **Sharing**: When a user clicks "Share for Unlimited Hints" in supported games (Card Flip Memory, Tile Slider, Sound Memory, Emoji Memory, Number Recall, Image Recall), a unique share link is generated and copied to clipboard
2. **Link Tracking**: The share link includes a `shared` URL parameter with a unique ID
3. **Click Detection**: When someone opens the shared link, the system tracks the click in the backend
4. **Unlimited Hints**: The original sharer receives unlimited hints for 15 minutes after someone clicks their link
5. **Heartbeat**: The system checks every 10 seconds (heartbeat) to see if the shared link has been clicked
6. **Expiry**: Unlimited hints automatically expire after 15 minutes

### Supported Games

-  **Card Flip Memory**: Share to unlock unlimited hints (up to 10 hints per round by default)
-  **Tile Slider**: Share to unlock unlimited hints (up to 5 hints by default)
-  **Sound Memory**: Share to unlock unlimited replay (5 replays by default)
-  **Emoji Memory**: Share to unlock unlimited hints (10 hints by default)
-  **Number Recall**: Share to unlock unlimited hints (10 hints by default, reveals digits one by one)
-  **Image Recall**: Share to unlock unlimited hints (10 hints by default, reveals positions one by one)
-  **Path Memory**: Share to unlock unlimited hints (10 hints by default, reveals path positions one by one)
-  **Word Memory**: Share to unlock unlimited hints (10 hints by default, reveals word positions one by one)
-  **Face Memory**: Share to unlock unlimited hints (10 hints by default, reveals face names one by one)
-  **Color Grid Memory**: Share to unlock unlimited hints (10 hints by default, reveals cell positions one by one)

### Admin Interface

WordPress Admin includes a **Share Tracking** page (`/wp-admin/admin.php?page=share-tracking`) where you can:

-  View all shared links with their status
-  See click counts and timestamps
-  Filter by game type
-  Delete individual shares or all shares
-  Monitor share activity

### Database

Share tracking data is stored in the `wp_play50_share_tracking` table with the following structure:

-  `id`: Auto-increment primary key
-  `share_id`: Unique share identifier (string)
-  `game_type`: Game type (e.g., "card-flip", "tile-slider")
-  `clicks`: Number of times the link was clicked
-  `created_at`: When the share was created
-  `last_click_at`: When the link was last clicked (NULL if never clicked)

### Finding Game IDs

-  Go to **Games** → **All Games**
-  Hover over a game title
-  The ID is in the URL: `post.php?post=123&action=edit` (123 is the ID)

### Quick Fill Templates

The WordPress admin includes a **Quick Fill Templates** dropdown that automatically fills all fields for common games. Simply select a game template and click **Fill Template**.

## Game Configuration

### Circuit Path

**Circuit Path** is a logic puzzle game where players connect nodes to create a continuous path from a Start node (green) to an End node (red).

#### How It Works

-  Each round is independent with randomly positioned Start and End nodes
-  Players click adjacent nodes (up, down, left, right) to build a path
-  The path must be continuous from Start to End
-  Players can backtrack by clicking a node that's already in the path
-  Obstacles (unclickable nodes) are randomly generated to increase difficulty
-  Grid size increases with rounds: 3x3 (rounds 1-5), 5x5 (rounds 6-10), 10x10 (rounds 11+)

#### Configuration

```json
{
   "gameType": "circuit-path",
   "gridSize": 3,
   "rounds": 20
}
```

**Fields:**

-  `gameType` (required): Must be `"circuit-path"`
-  `gridSize` (optional): Grid size (3 = 3x3, 4 = 4x4, 5 = 5x5, etc.) - Default: **3**
   -  Note: Grid size dynamically increases with rounds regardless of this setting
-  `rounds` (optional): Number of rounds - Default: **20** (recommended for 100 points max)

**Scoring:**

-  5 points per round when path is complete (Start → End)
-  Maximum 100 points for 20 rounds

**Controls:**

-  **Mouse**: Click nodes to add/remove from path
-  **Keyboard**:
   -  Arrow keys / WASD: Navigate between nodes
   -  Enter / Space / E: Add/remove node from path

**Example Configuration:**

```json
{
   "gameType": "circuit-path",
   "gridSize": 3,
   "rounds": 20
}
```

**Recommended Settings:**

-  **Time Limit**: 90 seconds (for 20 rounds)
-  **Passing Score**: 80 (80% of max score)
-  **Difficulty**: 3 (medium)

### Other Games

#### Block Fill

Block Fill supports fixed grids (via `gridSize`) or multi-level layouts (via `levelLayouts`). If you provide layouts, the game will build pieces from the letters so the puzzle is guaranteed solvable.

```json
{
   "gameType": "block-fill",
   "levels": [3, 4, 5, 6, 7],
   "levelLayouts": [
      { "size": 3, "rows": ["AAB", "ACB", "CCB"] },
      { "size": 4, "rows": ["AAAB", "CABB", "CCDB", "CDDD"] },
      { "size": 5, "rows": ["AABBC", "ADBEC", "ADEEC", "FDDEC", "FFFEC"] },
      {
         "size": 6,
         "rows": ["AAABBC", "DEABFC", "DEEBFC", "DGEHFC", "DGGHHC", "DGGHHC"]
      },
      {
         "size": 7,
         "rows": [
            "AAABBCC",
            "ADDBBCC",
            "ADDEEFF",
            "GGDEHFF",
            "GGGHHII",
            "JJKHHII",
            "JJKKKII"
         ]
      }
   ]
}
```

**Fields:**

-  `gameType` (required): Must be `"block-fill"`
-  `levels` (optional): Ordered list of grid sizes per level
-  `levelLayouts` (optional): Array of layout objects
   -  `size`: Grid size for that level
   -  `rows`: Array of strings that define the solved layout

Notes:

-  Use uppercase letters for pieces. Each letter is a unique piece.
-  Use `"."` for empty (unused) cells if needed.
-  If `levelLayouts` is provided, it overrides random piece sets for those levels.

#### Match the Shapes

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

-  Default: 20 rounds (max 100 points)
-  Uses Heroicons for visual consistency
-  Keyboard: 1-12 to select shapes directly (1-9, 0, -, = for 10-12)

#### Color Sequence

```json
{
   "gameType": "color-sequence",
   "rounds": 20,
   "colors": ["red", "blue", "green", "yellow"]
}
```

-  Default: 20 rounds (max 100 points)
-  Sequence length increases: rounds 1-5 = 2 colors, 6-10 = 3, 11-15 = 4, 16-20 = 5
-  Keyboard: 1-4 to select colors

#### Number Order

```json
{
   "gameType": "number-order",
   "rounds": 20
}
```

-  Default: 20 rounds (max 100 points)
-  Number count increases dynamically: rounds 1-5 = 3 numbers, rounds 6-10 = 5 numbers, rounds 11-20 = 10 numbers
-  Keyboard: 1-9 to select by position in grid, 0 for 10th position, Backspace/Delete to undo

#### Find the Odd One

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

-  Default: 20 rounds (max 100 points)
-  Item count increases dynamically: rounds 1-5 = 10 icons, rounds 6-10 = 30 icons, rounds 11-20 = 50 icons
-  Uses Heroicons for visual consistency

#### Balance the Scale

```json
{
   "gameType": "balance-scale",
   "rounds": 20
}
```

-  Default: 20 rounds (max 100 points)
-  5 points per correct round
-  Keyboard: ArrowLeft/A (left heavier), ArrowRight/D (right heavier), Enter/Space/E (equal)

#### Sudoku 4x4

```json
{
   "gameType": "sudoku-4x4"
}
```

-  Generates a new random puzzle each game start
-  Real-time validation with visual feedback
-  Keyboard: Arrow keys to navigate, 1-4 to input numbers, Backspace/Delete to clear
-  Includes NumberKeypad component

#### Tile Slider

```json
{
   "gameType": "tile-slider",
   "gridSize": 3,
   "showHints": true,
   "maxHints": 5
}
```

-  `gridSize` (optional): Grid size (3 = 3x3, 4 = 4x4) - Default: 3
-  `showHints` (optional): Enable hint button - Default: true
-  `maxHints` (optional): Maximum number of hints allowed - Default: 5
   -  Set to 0 or >= 1000 for unlimited hints (solves puzzle completely)
-  **Share Feature**: Users can share the game to unlock unlimited hints
   -  Click "Share for Unlimited Hints" button to copy a shareable link
   -  When someone else opens the shared link, the original sharer gets unlimited hints for 15 minutes
   -  The system uses a heartbeat mechanism (checks every 10 seconds) to detect when the link is clicked
   -  A success message appears for 10 seconds when unlimited hints are activated
   -  Hints automatically expire after 15 minutes and return to normal
-  Hints automatically execute 2-3 optimal moves (or complete solution if unlimited)
-  Keyboard: Tab to select tiles, Arrow keys to move selected tile

#### Pattern Completion

```json
{
   "gameType": "pattern-completion",
   "totalRounds": 20,
   "shapes": ["Home", "Star", "Heart", "Circle"],
   "patternRules": [
      { "rounds": 5, "patternLength": 6, "repeatSize": 3 },
      { "rounds": 7, "patternLength": 9, "repeatSize": 3 },
      { "rounds": 8, "patternLength": 13, "repeatSize": 4 }
   ]
}
```

**Configuration:**

-  `gameType` (required): Must be `"pattern-completion"`
-  `totalRounds` (optional): Number of rounds - Default: **20** (recommended for 100 points max)
   -  Also accepts `rounds` for backward compatibility
-  `shapes` (optional): Array of Heroicon shape names to use - Default: `["Home", "Star", "Heart", "Circle"]`
   -  Available shapes: `"Home"`, `"Star"`, `"Heart"`, `"Circle"`, `"Square"`, `"Triangle"`, `"Eye"`, `"Camera"`, `"Cube"`, `"Bell"`, `"Plus"`, `"Gift"`, `"Moon"`, `"Fingerprint"`, `"Key"`
-  `patternRules` (optional): Array of objects to configure pattern rules per round range:
   -  Each object has:
      -  `rounds` (max round for this rule)
      -  `patternLength` (total number of shapes in pattern, including the missing one)
      -  `repeatSize` (number of shapes that repeat: 3 = ABC ABC ABC, 4 = ABCD ABCD ABCD, 5 = ABCDE ABCDE ABCDE)
   -  Default if not specified:
      -  **Rounds 1-5**: `patternLength: 6`, `repeatSize: 3`
      -  **Rounds 6-10**: `patternLength: 9`, `repeatSize: 3`
      -  **Rounds 11+**: `patternLength: 13`, `repeatSize: 4`

**Scoring:**

-  5 points per correct round
-  Maximum 100 points for 20 rounds

**Controls:**

-  **Keyboard**: 1-4 to select options directly
-  **Mouse**: Click on the shape that completes the pattern

**Goal:**

-  Look at the pattern sequence and identify the missing element (shown as ?)
-  Choose the correct shape to complete the pattern
-  Patterns follow a repeating sequence structure:
   -  **Pattern length ≤ 9**: 3 elements repeat (ABC ABC ABC)
   -  **Pattern length 10-13**: 4 elements repeat (ABCD ABCD ABCD)
   -  **Pattern length > 13**: 5 elements repeat (ABCDE ABCDE ABCDE)
-  Pattern length and repeat size increase with rounds for added difficulty

**Features:**

-  Uses Heroicons for visual consistency
-  Dynamic pattern length and repeat size based on rounds (configurable via `patternRules`)
-  Structured pattern generation with repeating sequences (ABC, ABCD, or ABCDE)
-  Visual feedback for correct/incorrect selections
-  Horizontal layout for all patterns (no grid wrapping)

**Recommended Settings:**

-  **Time Limit**: 120 seconds (for 20 rounds)
-  **Passing Score**: 80 (80% of max score)
-  **Difficulty**: 2 (medium)

**Backend Configuration Example:**

In WordPress admin, when creating/editing a game:

1. **Title**: "Pattern Completion"
2. **Game Type**: Logic
3. **Game Order**: 9 (or your desired order)
4. **Difficulty**: 2
5. **Time Limit**: 120
6. **Passing Score**: 80
7. **Description**: "Complete the missing pattern element"
8. **Game Config** (JSON):

   ```json
   {
      "gameType": "pattern-completion",
      "totalRounds": 20,
      "shapes": ["Home", "Star", "Heart", "Circle"],
      "patternRules": [
         { "rounds": 5, "patternLength": 6, "repeatSize": 3 },
         { "rounds": 7, "patternLength": 9, "repeatSize": 3 },
         { "rounds": 8, "patternLength": 13, "repeatSize": 4 }
      ]
   }
   ```

   Or with default pattern rules (no `patternRules` needed):

   ```json
   {
      "gameType": "pattern-completion",
      "totalRounds": 20,
      "shapes": ["Home", "Star", "Heart", "Circle"]
   }
   ```

   Custom pattern rules example:

   ```json
   {
      "gameType": "pattern-completion",
      "totalRounds": 20,
      "shapes": ["Home", "Star", "Heart", "Circle", "Eye", "Camera"],
      "patternRules": [
         { "rounds": 3, "patternLength": 4, "repeatSize": 2 },
         { "rounds": 7, "patternLength": 7, "repeatSize": 3 },
         { "rounds": 15, "patternLength": 11, "repeatSize": 4 },
         { "rounds": 20, "patternLength": 16, "repeatSize": 5 }
      ]
   }
   ```

#### Rotate to Fit

```json
{
   "gameType": "rotate-to-fit",
   "rounds": 20,
   "shapes": [
      "HandThumbUp",
      "PuzzlePiece",
      "GlobeAmericas",
      "LightBulb",
      "Funnel",
      "Cake",
      "LockClosed",
      "ChevronDoubleRight",
      "ArrowUturnLeft",
      "BuildingOffice2"
   ],
   "objectCountRules": [
      { "rounds": 5, "count": 3 },
      { "rounds": 10, "count": 4 },
      { "rounds": 15, "count": 5 },
      { "rounds": 20, "count": 5 }
   ]
}
```

**Configuration:**

-  `gameType` (required): Must be `"rotate-to-fit"`
-  `rounds` (optional): Number of rounds - Default: **20** (recommended for 100 points max)
-  `shapes` (optional): Array of shape icon names from Heroicons - Default: **10 different Heroicons**
   -  Available icons: `HandThumbUp`, `PuzzlePiece`, `GlobeAmericas`, `LightBulb`, `Funnel`, `Cake`, `LockClosed`, `ChevronDoubleRight`, `ArrowUturnLeft`, `BuildingOffice2`
   -  All icons are from `@heroicons/react/24/outline`
   -  You can use any Heroicon by specifying its name (e.g., `"HandThumbUp"`, `"PuzzlePiece"`)
-  `objectCountRules` (optional): Array of rules defining how many objects to rotate per round range - Default: **3 objects (rounds 1-5), 4 objects (rounds 6-10), 5 objects (rounds 11-15), 5 objects (rounds 16+)**
   -  Each rule has `rounds` (max round number) and `count` (number of objects)
   -  Rules should be sorted by `rounds` in ascending order
   -  Example: `[{"rounds": 5, "count": 3}, {"rounds": 10, "count": 4}, {"rounds": 15, "count": 5}]`

**Scoring:**

-  5 points per correct round (when all objects match their target rotations)
-  Maximum 100 points for 20 rounds

**Controls:**

-  **Mouse**: Each object has 4 rotation buttons:
   -  **Left 90°**: Rotate object counter-clockwise by 90°
   -  **Right 90°**: Rotate object clockwise by 90°
   -  **Left 180°**: Rotate object counter-clockwise by 180°
   -  **Right 180°**: Rotate object clockwise by 180°

**Goal:**

-  Each round presents multiple objects (3-5 depending on round)
-  Each object has a target rotation (0°, 90°, 180°, or 270°)
-  Rotate each object using its individual buttons to match the target orientation
-  Round completes when **all objects** match their target rotations
-  Each round uses random shapes from the configured shapes list

**Features:**

-  Multiple objects per round (3-5 based on round number)
-  Individual rotation controls for each object
-  Uses react-icons for diverse shape library (30+ shapes by default)
-  Random shape and target rotation selection each round
-  Visual feedback for correct/wrong rotations (green border when object is correct)
-  Modern UI with progress tracking

**Recommended Settings:**

-  **Time Limit**: 120 seconds (for 20 rounds)
-  **Passing Score**: 80 (80% of max score)
-  **Difficulty**: 2 (medium)

**Backend Configuration Example:**

In WordPress admin, when creating/editing a game:

1. **Title**: "Rotate to Fit"
2. **Game Type**: Logic
3. **Game Order**: 11 (or your desired order)
4. **Difficulty**: 2
5. **Time Limit**: 120
6. **Passing Score**: 80
7. **Description**: "Rotate multiple objects to match their target orientations"
8. **Game Config** (JSON):

   ```json
   {
      "gameType": "rotate-to-fit",
      "rounds": 20,
      "shapes": [
         "HandThumbUp",
         "PuzzlePiece",
         "GlobeAmericas",
         "LightBulb",
         "Funnel",
         "Cake",
         "LockClosed",
         "ChevronDoubleRight",
         "ArrowUturnLeft",
         "BuildingOffice2"
      ],
      "objectCountRules": [
         { "rounds": 5, "count": 3 },
         { "rounds": 10, "count": 4 },
         { "rounds": 15, "count": 5 },
         { "rounds": 20, "count": 5 }
      ]
   }
   ```

   Or use default settings (no `shapes` or `objectCountRules` needed):

   ```json
   {
      "gameType": "rotate-to-fit",
      "rounds": 20
   }
   ```

#### Card Flip Memory

```json
{
   "gameType": "card-flip",
   "rounds": 5,
   "gridSizes": [
      [2, 2],
      [4, 4],
      [6, 6],
      [7, 6],
      [8, 8]
   ]
}
```

**Configuration:**

-  `gameType` (required): Must be `"card-flip"`
-  `rounds` (optional): Number of rounds - Default: **5** (recommended for 100 points max)
-  `gridSizes` (optional): Array of grid sizes - Default: **[[2, 2], [4, 4], [6, 6], [7, 6], [8, 8]]**
   -  Each element is `[width, height]` or a number (for square grids)
   -  Round 1: 2x2 grid (uses numbers 1-2)
   -  Round 2: 4x4 grid (uses heroicons)
   -  Round 3: 6x6 grid (uses heroicons)
   -  Round 4: 7x6 grid (uses heroicons, non-square)
   -  Round 5: 8x8 grid (uses heroicons)

**Scoring:**

-  20 points per correct round (when all pairs are matched)
-  Maximum 100 points for 5 rounds

**Controls:**

-  **Mouse**:
   -  Click on a card to flip it and reveal its content
   -  Click on two cards to try to match them
   -  Cards automatically flip back if they don't match

**Goal:**

-  Match pairs of cards by remembering their positions
-  Round 1 uses numbers (1, 2) for easier start
-  Rounds 2-5 use heroicons (HandThumbUp, PuzzlePiece, etc.) for visual variety
-  All pairs must be matched to complete the round

**Features:**

-  Progressive difficulty with increasing grid sizes
-  Round 1 uses numbers for easier start
-  Rounds 2-5 use heroicons for visual variety
-  Non-square grids supported (e.g., 7x6 in round 4)
-  Visual feedback for correct matches
-  Modern UI matching other games
-  Full-width grid with 5px spacing between cards
-  43+ heroicons available for variety
-  **Share Feature**: Users can share the game to unlock unlimited hints
   -  Click "Share for Unlimited Hints" button to copy a shareable link
   -  When someone else opens the shared link, the original sharer gets unlimited hints for 15 minutes
   -  The system uses a heartbeat mechanism (checks every 10 seconds) to detect when the link is clicked
   -  A success message appears for 10 seconds when unlimited hints are activated
   -  Hints automatically expire after 15 minutes and return to normal
   -  Up to 10 hints per round by default, unlimited when shared link is clicked

**Recommended Settings:**

-  **Time Limit**: 120 seconds (overall game time)
-  **Passing Score**: 80 (80% of max score)
-  **Difficulty**: 2 (medium)

#### Sound Memory

```json
{
   "gameType": "sound-memory",
   "rounds": 10
}
```

Or with predefined sequences for each round:

```json
{
   "gameType": "sound-memory",
   "rounds": 10,
   "roundSequences": [
      [2],
      [2, 3],
      [2, 3, 1],
      [2, 3, 1, 1],
      [2, 3, 1, 1, 4],
      [3, 1, 4, 2, 2],
      [3, 1, 4, 2, 2, 1],
      [4, 2, 1, 3, 1, 2, 4],
      [1, 2, 4, 1, 3, 2, 3, 4],
      [2, 4, 1, 3, 2, 1, 4, 3, 1]
   ]
}
```

**Configuration:**

-  `gameType` (required): Must be `"sound-memory"`
-  `rounds` (optional): Number of rounds - Default: **10** (recommended for 100 points max)
-  `roundSequences` (optional): Array of predefined sequences for each round
   -  Each element is an array of button numbers (1-4) representing the sequence for that round
   -  `roundSequences[0]` is for round 1, `roundSequences[1]` is for round 2, etc.
   -  If not provided, sequences are generated randomly
   -  Example: `[2, 3, 1]` means round 3 will play buttons 2 → 3 → 1 in order

**Scoring:**

-  10 points per correct round
-  Maximum 100 points for 10 rounds
-  Each round adds one more sound to the sequence

**Controls:**

-  **Mouse**: Click on sound pads (1-4) to play sounds and repeat the sequence
-  **Keyboard**:
   -  Press keys **1, 2, 3, 4** to play sounds during your turn
   -  Use keyboard for faster gameplay!

**Goal:**

-  Listen to a sequence of sounds played by the game
-  Repeat the sequence by clicking the sound pads (or pressing keys 1-4) in the same order
-  Each round adds one more sound to the sequence:
   -  Round 1: 1 sound
   -  Round 2: 2 sounds
   -  Round 3: 3 sounds
   -  ...
   -  Round 10: 10 sounds
-  Get it wrong and the game ends immediately

**Features:**

-  Progressive difficulty with increasing sequence length
-  4 different sound tones (frequencies: 220Hz, 330Hz, 440Hz, 550Hz) - each button always plays the same sound
-  Visual feedback with active pad highlighting (thicker border, brighter colors, scale animation)
-  Distinct color palette for each button (Blue, Green, Red/Pink, Yellow)
-  **Replay Button**: Listen to the sequence again (5 uses by default)
-  **Share Feature**: Share the game to unlock unlimited replay
   -  Click "Share for Unlimited Replay" button to copy a shareable link
   -  When someone else opens the shared link, the original sharer gets unlimited replay for 15 minutes
   -  The system uses a heartbeat mechanism (checks every 10 seconds) to detect when the link is clicked
   -  A success message appears when unlimited replay is activated
   -  Replay automatically expires after 15 minutes and returns to normal (5 replays)
-  Modern UI with game state indicators (Listening, Your Turn, Correct, Wrong)
-  Round and score progress display
-  Interactive example in game instructions section with colored buttons
-  Fully responsive design optimized for mobile, tablet, and desktop
-  Grid layout with 5px gap between sound pads
-  Sound pads fill full width/height of grid cells with aspect ratio 1:1
-  Touch-optimized for mobile devices

**Game States:**

-  **Listening**: Game is playing the sequence (pads are disabled)
-  **Your Turn**: Repeat the sequence you heard
-  **Correct**: You matched the sequence correctly
-  **Wrong**: You made a mistake (game ends)

**UI/UX Features:**

-  **Responsive Design**: Optimized layouts for mobile (< 768px), tablet (768-1023px), and desktop (≥ 1024px)
-  **Mobile Optimizations**:
   -  Full-width buttons for Replay and Share actions
   -  Smaller font sizes and spacing
   -  Touch-friendly button sizes (110-130px)
   -  Reduced padding and gaps
-  **Desktop Features**:
   -  Larger sound pads (140-160px)
   -  Hover effects on buttons
   -  Enhanced visual feedback
-  **Grid Layout**: 2x2 grid on mobile, 4x1 grid on desktop with 5px gap
-  **Visual Emphasis**: Active pads have thicker borders, brighter gradients, stronger shadows, and scale animation

**Recommended Settings:**

-  **Time Limit**: 90 seconds (overall game time)
-  **Passing Score**: 75 (75% of max score)
-  **Difficulty**: 2 (medium)

#### Click the Green

```json
{
   "gameType": "click-green",
   "levels": 10,
   "levelDuration": 20,
   "levelRequirements": [
      { "minCorrectClicks": 3 },
      { "minCorrectClicks": 4 },
      { "minCorrectClicks": 5 },
      { "minCorrectClicks": 6 },
      { "minCorrectClicks": 7 },
      { "minCorrectClicks": 8 },
      { "minCorrectClicks": 9 },
      { "minCorrectClicks": 10 },
      { "minCorrectClicks": 11 },
      { "minCorrectClicks": 12 }
   ]
}
```

**Configuration:**

-  `gameType` (required): Must be `"click-green"`
-  `levels` (optional): Number of levels - Default: **10**
-  `levelDuration` (optional): Duration per level in seconds - Default: **20 seconds**
-  `levelRequirements` (optional): Array of requirements for each level - Default: **auto-progression**
   -  Each level can have `minCorrectClicks` (minimum number of correct green clicks required)
   -  If not provided, uses default: `minCorrectClicks = 3 + level`

**Level Duration:**

-  **Level 1**: 20 seconds
-  **Level 2**: 20 seconds
-  **Level 3**: 20 seconds
-  ... (all levels have the same duration by default)
-  **Level 10**: 20 seconds
-  **Total Time**: 200 seconds (10 levels × 20 seconds) to complete all levels

**Level Passing Requirements:**

Për të kaluar çdo level, duhet të plotësosh kushtin:

**Minimum Correct Clicks**: Duhet të klikosh të paktën X green items

-  Level 1: 3 correct clicks
-  Level 2: 4 correct clicks
-  Level 3: 5 correct clicks
-  ... (rritet me 1 për çdo level)
-  Level 10: 12 correct clicks

**Nëse nuk plotëson kushtet:**

-  Level-i përsëritet (nuk kalon në level tjetër)
-  Shfaqet mesazh "Level X Failed! Need: Y correct clicks"
-  Loja restarton të njëjtin level pas 2 sekondash

**Scoring:**

-  Each correct click (green item) = +10 points
-  Each mistake (red item) = -5 points
-  Score accumulates across all levels
-  Maximum score: 100 points (capped)
-  Score is calculated based on performance: `correctClicks * 10 - wrongClicks * 5`

**Controls:**

-  **Mouse**:
   -  Click on green items (✓) to score points
   -  Avoid clicking red items (✕) or you'll lose points
   -  Clicking empty arena counts as a mistake

**Goal:**

-  Click ONLY on green items (✓) as fast as you can
-  Avoid clicking red items (✕) or you'll lose points
-  Complete all 10 levels by clicking as many green items as possible
-  Each level lasts 20 seconds
-  Game gets faster with each level (spawn rate increases, item TTL decreases)

**How It Works:**

-  Green and red items appear randomly on screen
-  Items spawn at intervals (600ms at level 1, down to 250ms at level 10)
-  Items disappear after a short time (2000ms at level 1, down to 800ms at level 10)
-  Sometimes 2 items spawn at once (more likely at higher levels)
-  Each level lasts 20 seconds (or until requirements are met)
-  **Early Completion**: If you reach the minimum score and correct clicks before time runs out, the level completes immediately and you advance to the next level
-  After completing a level, you advance to the next level automatically
-  If you don't meet the requirements, the level restarts
-  Game ends after completing all 10 levels

**Features:**

-  Progressive difficulty with increasing spawn rate and decreasing item TTL
-  Visual feedback with green (✓) and red (✕) items
-  Real-time stats showing correct clicks and mistakes
-  Level progression system (10 levels)
-  Time countdown per level
-  Feedback messages for correct clicks and mistakes
-  Modern UI with header showing level, score, and progress bar
-  Game state display (Click only green items!, Level X Complete!)
-  Fully responsive design optimized for mobile, tablet, and desktop
-  Touch-optimized for mobile devices

**Tips:**

-  Stay focused and react quickly
-  Don't click too fast or you might hit a red item by mistake
-  Items disappear after a short time, so be quick but accurate
-  Higher levels are faster - stay calm and focused

**Recommended Settings:**

-  **Time Limit**: 0 (no overall time limit, each level has its own timer)
-  **Passing Score**: 70 (70% of max score)
-  **Difficulty**: 1 (easy, but gets harder with each level)

#### Avoid the Red

```json
{
   "gameType": "avoid-red",
   "levels": 10,
   "levelRequirements": [
      { "minSurvivalTime": 20, "maxHits": 0 },
      { "minSurvivalTime": 20, "maxHits": 0 },
      { "minSurvivalTime": 20, "maxHits": 0 },
      { "minSurvivalTime": 20, "maxHits": 0 },
      { "minSurvivalTime": 20, "maxHits": 0 },
      { "minSurvivalTime": 20, "maxHits": 0 },
      { "minSurvivalTime": 20, "maxHits": 0 },
      { "minSurvivalTime": 20, "maxHits": 0 },
      { "minSurvivalTime": 20, "maxHits": 0 },
      { "minSurvivalTime": 20, "maxHits": 0 }
   ]
}
```

**Configuration:**

-  `gameType` (required): Must be `"avoid-red"`
-  `levels` (optional): Number of levels - Default: **10**
-  `levelRequirements` (required): Array of requirements for each level
   -  Each level must have `minSurvivalTime` (seconds to survive) and `maxHits` (maximum hits allowed)
   -  Example: `{"minSurvivalTime": 20, "maxHits": 0}` means survive 20 seconds with 0 hits

**Level Requirements:**

-  **minSurvivalTime**: Koha minimale për të mbijetuar (në sekonda)
   -  Level 1: 20 seconds (default)
   -  Level 2: 20 seconds (default)
   -  ... (mund të konfigurohen ndryshe për çdo level)
   -  Level 10: 20 seconds (default)
-  **maxHits**: Numri maksimal i hits të lejuara
   -  Default: **0** (pa hits të lejuara)
   -  Mund të konfigurohet për të lejuar më shumë hits në nivele më të vështira

**Level Passing Requirements:**

Për të kaluar çdo level, duhet të:

-  **Survive for minSurvivalTime**: Mbijeto për kohën e specifikuar në `minSurvivalTime`
-  **Max hits**: Mos u prek më shumë se `maxHits` herë (zakonisht 0)

**Nëse nuk plotëson kushtet:**

-  Level-i përsëritet (nuk kalon në level tjetër)
-  Shfaqet mesazh "Level X Failed! A red obstacle touched you!"
-  Butoni "Repeat the Round" shfaqet për të rinisur level-in

**Scoring:**

-  Level-based scoring: 10 points për level 1, 20 për level 2, 30 për level 3, etj.
-  Formula: `score = completedLevels * (100 / maxLevels)`
-  Maximum score: 100 points (kur të gjitha 10 nivelet përfundojnë)
-  Score rritet vetëm kur një level kompletohet me sukses (0 hits)

**Controls:**

-  **Mouse**: Move cursor to control the blue player dot
-  Player follows mouse position in real-time
-  Keep moving to avoid red obstacles

**Goal:**

-  Move your cursor to control the blue dot
-  Avoid red obstacles for the duration specified in `minSurvivalTime` (per level)
-  Keep moving—don't let red obstacles touch you!
-  Complete all 10 levels by surviving each level within the hit limit

**How It Works:**

-  Red obstacles spawn from 4 edges (top, right, bottom, left) randomly
-  Obstacles move toward the player with homing behavior
-  Spawn rate increases with time: starts at 360ms, decreases to 140ms
-  Sometimes 2 obstacles spawn at once (18% chance)
-  Each level lasts for the time specified in `minSurvivalTime` for that level
-  If you survive for `minSurvivalTime` with hits ≤ `maxHits`, the level completes
-  If a red obstacle touches you and hits exceed `maxHits`, the level fails immediately
-  After completing a level, you advance to the next level
-  If you fail, you must repeat the same level
-  Game ends after completing all 10 levels

**Features:**

-  Progressive difficulty with increasing spawn rate
-  Edge spawning system (obstacles come from all directions)
-  Homing behavior (obstacles move toward player)
-  Real-time collision detection
-  Visual feedback with blue player dot and red obstacles
-  Real-time stats showing hits and obstacles count
-  Level progression system (10 levels)
-  Time countdown per level
-  Game state display (Avoid red obstacles!, Level X Complete!, Level X Failed!)
-  **Share feature**: Share the game to unlock unlimited hits (15 minutes)
-  Share success and unlimited hits activation messages
-  Modern UI with header showing level, score, and progress bar
-  Fully responsive design optimized for mobile, tablet, and desktop
-  Smooth animations with `requestAnimationFrame`

**Tips:**

-  Keep your cursor moving constantly
-  Watch for red items coming from all directions
-  Red obstacles will home in on your position, so constant movement is key
-  Don't stay in one place for too long
-  Higher levels are faster - stay calm and keep moving

**Recommended Settings:**

-  **Time Limit**: 0 (no overall time limit, each level has its own timer)
-  **Passing Score**: 75 (75% of max score)
-  **Difficulty**: 2 (medium difficulty, gets harder with each level)

#### Reaction Test

```json
{
   "gameType": "reaction-test",
   "levels": 10,
   "levelRequirements": [
      { "maxTime": "700ms" },
      { "maxTime": "900ms" },
      { "maxTime": "1.2s" },
      { "maxTime": "1.5sec" },
      { "maxTime": 2000 },
      { "maxTime": "1.8s" },
      { "maxTime": "1.0s" },
      { "maxTime": "2.0s" },
      { "maxTime": "1.2s" },
      { "maxTime": "2.5s" }
   ]
}
```

**Configuration:**

-  `gameType` (required): Must be `"reaction-test"`
-  `levels` (optional): Number of levels - Default: **10**
-  `levelRequirements` (required): Array of requirements for each level
   -  Each level must have `maxTime` (maximum reaction time allowed)
   -  `maxTime` can be specified in multiple formats:
      -  String with unit: `"700ms"`, `"1.2s"`, `"1.5sec"`
      -  Number (milliseconds): `2000` (means 2000ms = 2 seconds)

**Level Requirements:**

-  **maxTime**: Maximum reaction time allowed to pass the level
   -  Level 1: 700ms
   -  Level 2: 900ms
   -  Level 3: 1.2s (1200ms)
   -  Level 4: 1.5s (1500ms)
   -  Level 5: 2000ms (2 seconds)
   -  Level 6: 1.8s (1800ms)
   -  Level 7: 1.0s (1000ms)
   -  Level 8: 2.0s (2000ms)
   -  Level 9: 1.2s (1200ms)
   -  Level 10: 2.5s (2500ms)

**Level Passing Requirements:**

Për të kaluar çdo level, duhet të:

-  **React within maxTime**: Reagimi duhet të jetë brenda kohës së specifikuar në `maxTime`
-  Nëse reagimi është brenda `maxTime`, merr 100 points për level
-  Nëse reagimi është më i ngadaltë se `maxTime`, score zvogëlohet gradualisht

**Nëse nuk plotëson kushtet:**

-  Level-i përsëritet (nuk kalon në level tjetër)
-  Shfaqet mesazh "Level X Failed! Reaction time too slow"
-  Butoni "Repeat the Round" shfaqet për të rinisur level-in

**Scoring:**

-  Level-based scoring: 10 points për level (100 points total)
-  Formula: `score = completedLevels * (100 / maxLevels)`
-  Maximum score: 100 points (kur të gjitha 10 nivelet përfundojnë)
-  Score rritet vetëm kur një level kompletohet me sukses (reaction time ≤ maxTime)

**Game Variants:**

Reaction Test përfshin 10 variante unike të mini-lojave:

1. **Color Flash**: Click when the screen turns green
2. **Moving Target**: Click the green circle as it moves
3. **Countdown**: Click when countdown reaches "GO"
4. **Shape Match**: Click the matching shape
5. **Speed Reaction**: Click green items quickly
6. **Pattern Reaction**: Follow the pattern sequence
7. **Multi-Target**: Click all green targets
8. **Timing Reaction**: Click within the green window
9. **Memory Reaction**: Remember and click the sequence
10.   **Master Reaction**: Combined challenge

**Controls:**

-  **Mouse**: Click when prompted based on the variant
-  Each variant has different interaction requirements

**Goal:**

-  Test your reaction time across 10 different mini-games
-  React as quickly as possible when the signal appears
-  Complete all 10 levels by reacting within the time limit
-  Each level uses a different variant to test various reaction skills

**How It Works:**

-  Each level randomly selects one of 10 variants
-  Wait for the signal (varies by variant: color change, countdown, shape, etc.)
-  Click/react as quickly as possible when the signal appears
-  Reaction time is measured in milliseconds
-  If reaction time ≤ `maxTime` for that level, you pass
-  If reaction time > `maxTime`, you fail and must retry
-  After completing a level, you advance to the next level
-  Game ends after completing all 10 levels

**Features:**

-  10 unique reaction test variants
-  Progressive difficulty with varying time limits
-  Real-time reaction time measurement
-  Visual feedback with success/failure indicators
-  Level progression system (10 levels)
-  Game state display (Ready!, Level X Complete!, Level X Failed!)
-  **Share feature**: Share the game to unlock unlimited replays (15 minutes)
-  Share success and unlimited replays activation messages
-  Modern UI with header showing level, score, and progress bar
-  Fully responsive design optimized for mobile, tablet, and desktop

**Tips:**

-  Stay focused and ready to react
-  Don't click too early (false starts count as penalties)
-  Each variant requires different strategies
-  Practice improves reaction time
-  Higher levels have stricter time limits - stay alert

**Recommended Settings:**

-  **Time Limit**: 0 (no overall time limit, each level has its own timer)
-  **Passing Score**: 70 (70% of max score)
-  **Difficulty**: 2 (medium difficulty)

#### Fast Math

```json
{
   "gameType": "fast-math",
   "levels": 20,
   "levelDuration": 30,
   "levelRequirements": [
      { "minCorrectAnswers": 5 },
      { "minCorrectAnswers": 6 },
      { "minCorrectAnswers": 7 },
      { "minCorrectAnswers": 8 },
      { "minCorrectAnswers": 9 },
      { "minCorrectAnswers": 10 },
      { "minCorrectAnswers": 11 },
      { "minCorrectAnswers": 12 },
      { "minCorrectAnswers": 13 },
      { "minCorrectAnswers": 14 },
      { "minCorrectAnswers": 15 },
      { "minCorrectAnswers": 16 },
      { "minCorrectAnswers": 17 },
      { "minCorrectAnswers": 18 },
      { "minCorrectAnswers": 19 },
      { "minCorrectAnswers": 20 },
      { "minCorrectAnswers": 21 },
      { "minCorrectAnswers": 22 },
      { "minCorrectAnswers": 23 },
      { "minCorrectAnswers": 24 }
   ]
}
```

**Configuration:**

-  `gameType` (required): Must be `"fast-math"`
-  `levels` (optional): Number of levels - Default: **20**
-  `levelDuration` (optional): Duration per level in seconds - Default: **30 seconds**
-  `levelRequirements` (optional): Array of requirements for each level - Default: **auto-progression**
   -  Each level can have `minCorrectAnswers` (minimum number of correct answers required)
   -  If not provided, uses default: `minCorrectAnswers = 5 + level`

**Level Requirements:**

-  Each level requires a minimum number of correct answers within the time limit
-  Example: `{"minCorrectAnswers": 5}` means you need at least 5 correct answers to pass level 1
-  If you don't meet the requirement, you can replay the level (5 replays by default, unlimited if shared)

**Level Progression:**

-  **Levels 1-5**: Simple addition/subtraction (numbers 1-20)
-  **Levels 6-10**: Addition/subtraction (numbers 1-50), introduce multiplication
-  **Levels 11-15**: All operations (addition, subtraction, multiplication), larger numbers
-  **Levels 16-20**: All operations including division, complex numbers (up to 200)

**Scoring:**

-  Score is calculated based on completed levels: `Math.round((completedLevels / maxLevels) * 100)`
-  Maximum 100 points for completing all levels
-  Score increases progressively with each completed level

**Controls:**

-  **Mouse**:
   -  Click on the button with the correct answer
   -  Each button shows a number badge (1-4) in the top-left corner for keyboard shortcuts
-  **Keyboard**:
   -  **Number Keys (1-4)**: Select answer option directly
   -  **1**: Select answer option 1 (top-left)
   -  **2**: Select answer option 2 (top-right)
   -  **3**: Select answer option 3 (bottom-left)
   -  **4**: Select answer option 4 (bottom-right)

**Goal:**

-  Solve math problems as quickly as possible by selecting the correct answer from 4 options
-  Each level has a time limit and requires a minimum number of correct answers to pass
-  Answer correctly as many times as possible within the time limit
-  Complete the minimum required correct answers to pass the level

#### Typing Sprint

```json
{
   "gameType": "typing-sprint",
   "levels": 15,
   "levelRequirements": [
      {
         "minCorrectWords": 3,
         "duration": 30,
         "words": [
            "cat",
            "dog",
            "sun",
            "moon",
            "star",
            "tree",
            "bird",
            "fish",
            "book",
            "pen",
            "cup",
            "hat",
            "car",
            "bus",
            "key",
            "door"
         ]
      },
      {
         "minCorrectWords": 4,
         "duration": 30,
         "words": [
            "apple",
            "banana",
            "orange",
            "purple",
            "yellow",
            "green",
            "computer",
            "keyboard",
            "window",
            "garden",
            "forest",
            "ocean",
            "planet",
            "camera",
            "guitar",
            "pencil"
         ]
      },
      {
         "minCorrectWords": 5,
         "duration": 30,
         "words": [
            "beautiful",
            "wonderful",
            "adventure",
            "mountain",
            "elephant",
            "butterfly",
            "chocolate",
            "dinosaur",
            "hospital",
            "university",
            "keyboard",
            "computer",
            "internet",
            "software",
            "hardware"
         ]
      },
      {
         "minCorrectWords": 6,
         "duration": 30,
         "words": [
            "don't",
            "can't",
            "won't",
            "it's",
            "we're",
            "they're",
            "you're",
            "I'm",
            "he's",
            "she's",
            "let's",
            "that's"
         ]
      },
      {
         "minCorrectWords": 7,
         "duration": 30,
         "words": [
            "The quick brown fox jumps over the lazy dog",
            "Practice makes perfect in everything you do",
            "Learning new skills takes time and dedication",
            "Success comes to those who never give up"
         ]
      },
      {
         "minCorrectWords": 8,
         "duration": 30,
         "words": [
            "12345",
            "67890",
            "246813579",
            "9876543210",
            "314159265",
            "271828182",
            "1000000",
            "9999999"
         ]
      },
      {
         "minCorrectWords": 9,
         "duration": 30,
         "words": [
            "JavaScript",
            "TypeScript",
            "React",
            "NodeJS",
            "Python",
            "Java",
            "CSharp",
            "GoLang",
            "Swift",
            "Kotlin"
         ]
      },
      {
         "minCorrectWords": 10,
         "duration": 30,
         "words": [
            "helloworld",
            "goodmorning",
            "thankyou",
            "welcomeback",
            "seeyoulater",
            "haveaniceday",
            "goodluck",
            "congratulations"
         ]
      },
      {
         "minCorrectWords": 11,
         "duration": 30,
         "words": [
            "racecar",
            "level",
            "radar",
            "civic",
            "rotor",
            "deified",
            "repaper",
            "redder"
         ]
      },
      {
         "minCorrectWords": 12,
         "duration": 30,
         "words": [
            "go",
            "hi",
            "ok",
            "no",
            "yes",
            "run",
            "fly",
            "jump",
            "fast",
            "quick",
            "rapid",
            "swift",
            "speed",
            "haste"
         ]
      },
      {
         "minCorrectWords": 13,
         "duration": 30,
         "words": [
            "The early bird catches the worm in the morning",
            "A picture is worth a thousand words they say",
            "Actions speak louder than words in real life",
            "Better late than never is a common saying"
         ]
      },
      {
         "minCorrectWords": 14,
         "duration": 30,
         "words": [
            "hello@world.com",
            "user_name",
            "price$99",
            "score#1",
            "item&item",
            "test+test",
            "value=100",
            "key:value"
         ]
      },
      {
         "minCorrectWords": 15,
         "duration": 30,
         "words": [
            "abc123",
            "test456",
            "user789",
            "code2024",
            "game50",
            "level15",
            "score100",
            "time60"
         ]
      },
      {
         "minCorrectWords": 16,
         "duration": 30,
         "words": [
            "The quick brown fox jumps over the lazy dog in the park",
            "She sells seashells by the seashore every single day",
            "How much wood would a woodchuck chuck if he could",
            "Peter Piper picked a peck of pickled peppers today"
         ]
      },
      {
         "minCorrectWords": 17,
         "duration": 30,
         "words": [
            "Supercalifragilisticexpialidocious",
            "Pneumonoultramicroscopicsilicovolcanoconiosis",
            "The quick brown fox jumps over the lazy dog quickly",
            "JavaScript TypeScript React NodeJS Python Java CSharp"
         ]
      }
   ]
}
```

**Configuration:**

-  `gameType` (required): Must be `"typing-sprint"`
-  `levels` (optional): Number of levels - Default: **15**
-  `levelRequirements` (required): Array of requirements for each level
   -  Each level must have:
      -  `minCorrectWords`: Minimum number of correct words required to pass
      -  `duration`: Duration per level in seconds
      -  `words`: Array of words/sentences for that level (or comma-separated string)

**Level Requirements:**

-  Each level requires typing a minimum number of words correctly within the time limit
-  Example: `{"minCorrectWords": 3, "duration": 30, "words": ["cat", "dog", "sun"]}` means you need at least 3 correct words in 30 seconds to pass level 1
-  If you don't meet the requirement, you can replay the level (5 replays by default, unlimited if shared)

**Level Progression:**

-  **Levels 1-3**: Simple words (3-8 letters)
-  **Level 4**: Words with special characters (apostrophes, contractions)
-  **Level 5**: Full sentences
-  **Level 6**: Numbers
-  **Level 7**: Programming languages and technical terms
-  **Level 8**: Compound words (no spaces)
-  **Level 9**: Palindromes (reverse typing challenge)
-  **Level 10**: Short words (2-4 letters, speed challenge)
-  **Level 11**: Longer sentences
-  **Level 12**: Special characters (emails, symbols, etc.)
-  **Level 13**: Alphanumeric combinations
-  **Level 14**: Complex sentences
-  **Level 15**: Master challenge (very long words and complex text)

**Features:**

-  **Character Highlighting**: Real-time visual feedback showing correct (green) and incorrect (red) characters as you type
-  **Auto-submit**: Automatically submits when the word/sentence is typed correctly
-  **Wrong Character Tracking**: Each incorrect character counts as +1 wrong word
-  **Progressive Difficulty**: Each level increases in complexity and required words

**Scoring:**

-  Score is calculated based on completed levels: `Math.round((completedLevels / maxLevels) * 100)`
-  Maximum 100 points for completing all 15 levels
-  Score increases progressively with each completed level

**Controls:**

-  **Mouse**:
   -  Click on the input field to focus and start typing
-  **Keyboard**:
   -  **Space**: Type spaces normally (for sentences)
   -  **Enter**: Reset input if wrong (counts as wrong attempt)
   -  **All other keys**: Normal typing

**Goal:**

-  Complete all 15 levels by typing words and sentences quickly and accurately
-  Each level has unique challenges: simple words, sentences, numbers, special characters, palindromes, and master challenges
-  Progress through all 20 levels to complete the game

**How It Works:**

-  A math problem appears at the top (e.g., "7 × 4 = ?")
-  Four answer options appear below in buttons with numbered badges (1-4)
-  Click the button with the correct answer, or press 1, 2, 3, or 4 on your keyboard
-  Each button shows a blue number badge in the corner matching the keyboard shortcut
-  New problem appears immediately after answering
-  Continue until time runs out or you reach the required correct answers
-  If you meet the requirement, you can proceed to the next level
-  If you don't meet the requirement, you can replay the level (5 replays by default, unlimited if shared)

**Features:**

-  Progressive difficulty with increasing complexity across 20 levels
-  Four answer options with numbered badges (1-4) for keyboard shortcuts
-  Visual feedback with correct/wrong indicators
-  Level progression system (20 levels)
-  Game state display (Level X Complete!, Level X Failed!, Game Complete!)
-  **Replay System**: 5 replays by default, unlimited if shared
   -  Click "Replay" button to retry the current level
   -  Replays reset the timer and correct/wrong counters
   -  Share the game to unlock unlimited replays for 15 minutes
-  **Share Feature**: Share the game to unlock unlimited replays
   -  Click "Share for unlimited" button to copy a shareable link
   -  **Share Success Message**: Shows "Link copied! Unlimited replay will unlock when someone opens your link!" for 15 seconds after sharing
   -  **Unlimited Activated Message**: Shows "🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!" when link is clicked
   -  When someone else opens the shared link, the original sharer gets unlimited replays for 15 minutes
   -  The system uses a heartbeat mechanism (checks every 10 seconds) to detect when the link is clicked
   -  Replays automatically expire after 15 minutes and return to normal
-  Modern UI with header showing level, score, time, and progress bar
-  Stats display showing correct/wrong answers and requirements
-  Fully responsive design optimized for mobile, tablet, and desktop
-  Interactive example in game instructions section
-  Support for negative results in subtraction
-  Decimal answers for division problems

**Tips:**

-  Use keyboard shortcuts (1-4) for faster answers
-  Practice mental math to improve speed
-  For division, answers may have decimals (displayed with 1 decimal place)
-  Negative results are possible in subtraction (e.g., 5 - 15 = -10)
-  Focus on accuracy first, then speed
-  Use replays strategically when you're close to meeting the requirement
-  Share the game to get unlimited replays if needed

**Recommended Settings:**

-  **Time Limit**: 0 (no overall time limit, each level has its own timer)
-  **Passing Score**: 70 (70% of max score)
-  **Difficulty**: 2 (medium difficulty)

#### Quick Compare

```json
{
   "gameType": "quick-compare",
   "levels": 15,
   "levelRequirements": [
      { "minCorrectAnswers": 5, "duration": 30 },
      { "minCorrectAnswers": 6, "duration": 30 },
      { "minCorrectAnswers": 7, "duration": 30 },
      { "minCorrectAnswers": 8, "duration": 30 },
      { "minCorrectAnswers": 9, "duration": 30 },
      { "minCorrectAnswers": 10, "duration": 30 },
      { "minCorrectAnswers": 11, "duration": 30 },
      { "minCorrectAnswers": 12, "duration": 30 },
      { "minCorrectAnswers": 13, "duration": 30 },
      { "minCorrectAnswers": 14, "duration": 30 },
      { "minCorrectAnswers": 15, "duration": 30 },
      { "minCorrectAnswers": 16, "duration": 30 },
      { "minCorrectAnswers": 17, "duration": 30 },
      { "minCorrectAnswers": 18, "duration": 30 },
      { "minCorrectAnswers": 20, "duration": 30 }
   ]
}
```

**Configuration:**

-  `gameType` (required): Must be `"quick-compare"`
-  `levels` (optional): Number of levels - Default: **15**
-  `levelRequirements` (optional): Array of requirements for each level - Default: **auto-progression**
   -  Each object can have:
      -  `minCorrectAnswers` (required): Minimum number of correct comparisons to pass the level
      -  `duration` (optional): Duration in seconds for this specific level (default: 30)

**Level Requirements:**

-  **Level 1**: Minimum 5 correct answers, 30 seconds
-  **Level 2**: Minimum 6 correct answers, 30 seconds
-  **Level 3**: Minimum 7 correct answers, 30 seconds
-  ... (progressive increase)
-  **Level 15**: Minimum 20 correct answers, 30 seconds

**Level Passing Requirements:**

-  Each level has a time limit (configurable per level via `duration`)
-  You must make a minimum number of correct comparisons within the time limit
-  If time runs out and requirements are not met, the level fails and you can replay it
-  If you meet the minimum correct answers requirement, you can proceed to the next level

**Scoring:**

-  Score is calculated based on completed levels: `completedLevels * (100 / maxLevels)`
-  Level 1 = ~6.67 points, Level 2 = ~13.33 points, Level 3 = ~20 points, etc.
-  Maximum 100 points for 15 levels
-  **Progress Bar**: Shows progress based on completed levels (not individual correct answers)

#### Falling Objects

```json
{
   "gameType": "falling-objects",
   "levels": 15,
   "levelRequirements": [
      { "minCaughtGood": 8, "duration": 30 },
      { "minCaughtGood": 10, "duration": 30 },
      { "minCaughtGood": 12, "duration": 30 },
      { "minCaughtGood": 14, "duration": 30 },
      { "minCaughtGood": 16, "duration": 30 },
      { "minCaughtGood": 18, "duration": 30 },
      { "minCaughtGood": 20, "duration": 30 },
      { "minCaughtGood": 22, "duration": 30 },
      { "minCaughtGood": 24, "duration": 30 },
      { "minCaughtGood": 26, "duration": 30 },
      { "minCaughtGood": 28, "duration": 30 },
      { "minCaughtGood": 30, "duration": 30 },
      { "minCaughtGood": 32, "duration": 30 },
      { "minCaughtGood": 35, "duration": 30 },
      { "minCaughtGood": 40, "duration": 30 }
   ]
}
```

**Configuration:**

-  `gameType` (required): Must be `"falling-objects"`
-  `levels` (optional): Number of levels - Default: **15**
-  `levelRequirements` (optional): Array of requirements for each level - Default: **auto-progression**
   -  Each object can have:
      -  `minCaughtGood` (required): Minimum number of good objects to catch to pass the level
      -  `duration` (optional): Duration in seconds for this specific level (default: 30)

**Level Requirements:**

-  **Level 1**: Minimum 8 good objects caught, 30 seconds
-  **Level 2**: Minimum 10 good objects caught, 30 seconds
-  **Level 3**: Minimum 12 good objects caught, 30 seconds
-  ... (progressive increase)
-  **Level 15**: Minimum 40 good objects caught, 30 seconds

**Level Passing Requirements:**

-  Each level has a time limit (configurable per level via `duration`)
-  You must catch a minimum number of good objects within the time limit
-  If time runs out and requirements are not met, the level fails and you can replay it
-  If you meet the minimum good objects requirement, you can proceed to the next level

**Scoring:**

-  Score is calculated based on completed levels: `completedLevels * (100 / maxLevels)`
-  Level 1 = ~6.67 points, Level 2 = ~13.33 points, Level 3 = ~20 points, etc.
-  Maximum 100 points for 15 levels
-  **Progress Bar**: Shows progress based on completed levels (not individual caught objects)

**Controls:**

-  **Mouse**: Click on good objects (star, heart, bolt, checkmark) to catch them. Avoid clicking bad objects (X mark, fire icon)

**Goal:**

-  Catch good falling objects and avoid bad ones
-  Objects fall from the top of the screen at different speeds
-  Complete the minimum required good objects caught within the time limit to pass each level
-  Each level has different speed, object sizes, and good/bad object ratios

**How It Works:**

-  Objects spawn from the top and fall downward
-  Click on good objects (star, heart, bolt, checkmark) to catch them
-  Avoid clicking bad objects (X mark, fire icon)
-  If a good object reaches the bottom without being caught, it counts as missed
-  You'll get immediate feedback (green for good catch, red for bad catch)
-  If you meet the requirement, you can proceed to the next level
-  If time runs out and requirements are not met, the level fails and you can replay it (5 replays by default, unlimited if shared)

**Level Progression:**

-  **Levels 1-3**: Slow falling, large objects, mostly good objects (80-70% good)
-  **Levels 4-6**: Faster speed, smaller objects, more bad objects (65-55% good)
-  **Levels 7-9**: Ultra fast, tiny objects, balanced good/bad ratio (50-45% good)
-  **Levels 10-12**: Extreme speed, rapid spawn, more bad objects (45-40% good)
-  **Levels 13-15**: Maximum difficulty, fastest speed, smallest objects (35-30% good)

**Features:**

-  Progressive difficulty with increasing speed, smaller objects, and more bad objects across 15 levels
-  Real-time feedback with good/bad catch indicators
-  Level progression system (15 levels)
-  Game state display (Level X Complete!, Level X Failed!, Game Complete!)
-  **Replay System**: 5 replays by default, unlimited if shared
   -  Click "Replay" button to retry the current level
   -  Replays reset the timer and caught/missed counters
   -  Share the game to unlock unlimited replays for 15 minutes
-  **Share Feature**: Share the game to unlock unlimited replays
   -  Click "Share for unlimited" button to copy a shareable link
   -  **Share Success Message**: Shows "Link copied! Unlimited replay will unlock when someone opens your link!" for 15 seconds after sharing
   -  **Unlimited Activated Message**: Shows "🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!" when link is clicked
   -  When someone else opens the shared link, the original sharer gets unlimited replays for 15 minutes
   -  The system uses a heartbeat mechanism (checks every 10 seconds) to detect when the link is clicked
   -  Replays automatically expire after 15 minutes and return to normal
-  Modern UI with header showing level, score, time, and progress bar
-  Stats display showing caught good/bad objects, missed good objects, and requirements
-  Level description showing the current level's difficulty characteristics
-  Fully responsive design optimized for mobile, tablet, and desktop
-  **Time Management**: When time runs out, the game automatically checks if requirements are met and shows "failed" if not, allowing replay
-  **Progress Bar**: Shows progress based on completed levels (not individual caught objects)
-  **Object Types**: Good objects (star, heart, bolt, checkmark) and bad objects (X mark, fire icon)
-  **Object Animation**: Objects rotate as they fall, with varying sizes and speeds
-  **Spawn System**: Objects spawn at configurable intervals based on level difficulty

**Controls:**

-  **Mouse**: Click the `<` button if left number is smaller, `>` button if left number is larger
-  **Keyboard**:
   -  **Comma (`,`)** or **`<`**: Select "<" (left number is smaller)
   -  **Period (`.`)** or **`>`**: Select ">" (left number is larger)

**Goal:**

-  Compare two numbers quickly and accurately
-  Determine if the left number is less than (`<`) or greater than (`>`) the right number
-  Complete the minimum required correct comparisons within the time limit to pass each level
-  Each level has different number types: integers, decimals, negative numbers, and more

**How It Works:**

-  Two numbers appear on screen (left and right)
-  Click `<` if the left number is smaller than the right number
-  Click `>` if the left number is larger than the right number
-  You'll get immediate feedback (green for correct, red for wrong)
-  New number pair appears after each comparison
-  If you meet the requirement, you can proceed to the next level
-  If time runs out and requirements are not met, the level fails and you can replay it (5 replays by default, unlimited if shared)

**Level Progression:**

-  **Levels 1-3**: Simple to larger integers (1-200)
-  **Levels 4-6**: Large to huge integers (100-10000)
-  **Levels 7-9**: Decimals with varying precision (0.1-1000)
-  **Levels 10-12**: Negative numbers and mixed positive/negative (-1000 to 1000)
-  **Levels 13-15**: Very large numbers, decimals, and master challenge with all types

**Features:**

-  Progressive difficulty with different number types across 15 levels
-  Real-time feedback with correct/wrong indicators
-  Level progression system (15 levels)
-  Game state display (Level X Complete!, Level X Failed!, Game Complete!)
-  **Replay System**: 5 replays by default, unlimited if shared
   -  Click "Replay" button to retry the current level
   -  Replays reset the timer and correct/wrong counters
   -  Share the game to unlock unlimited replays for 15 minutes
-  **Share Feature**: Share the game to unlock unlimited replays
   -  Click "Share for unlimited" button to copy a shareable link
   -  **Share Success Message**: Shows "Link copied! Unlimited replay will unlock when someone opens your link!" for 15 seconds after sharing
   -  **Unlimited Activated Message**: Shows "🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!" when link is clicked
   -  When someone else opens the shared link, the original sharer gets unlimited replays for 15 minutes
   -  The system uses a heartbeat mechanism (checks every 10 seconds) to detect when the link is clicked
   -  Replays automatically expire after 15 minutes and return to normal
-  Modern UI with header showing level, score, time, and progress bar
-  Stats display showing correct/wrong answers and requirements
-  Level description showing the current level's number type
-  Fully responsive design optimized for mobile, tablet, and desktop
-  Interactive example in game instructions section with visual demonstration
-  **Time Management**: When time runs out, the game automatically checks if requirements are met and shows "failed" if not, allowing replay
-  **Progress Tracking**: Progress bar shows completion based on levels (1, 2, 3...), not individual correct answers

**Tips:**

-  For large numbers, compare digit by digit from left to right
-  For decimals, compare the whole number part first, then the decimal part
-  For negative numbers, remember that -5 is smaller than -3
-  Stay focused and react quickly but accurately
-  Use keyboard shortcuts (`,` and `.`) for faster comparisons
-  Use replays strategically when you're close to meeting the requirement
-  Share the game to get unlimited replays if needed

**Recommended Settings:**

-  **Time Limit**: 60 seconds (overall game time)
-  **Passing Score**: 70 (70% of max score)
-  **Difficulty**: 1 (easy to medium difficulty)

#### Tap Counter

```json
{
   "gameType": "tap-counter",
   "levels": 15,
   "levelRequirements": [
      { "minTaps": 20, "duration": 10 },
      { "minTaps": 25, "duration": 10 },
      { "minTaps": 30, "duration": 10 },
      { "minTaps": 35, "duration": 10 },
      { "minTaps": 40, "duration": 10 },
      { "minTaps": 45, "duration": 10 },
      { "minTaps": 50, "duration": 10 },
      { "minTaps": 55, "duration": 10 },
      { "minTaps": 60, "duration": 10 },
      { "minTaps": 65, "duration": 10 },
      { "minTaps": 70, "duration": 10 },
      { "minTaps": 75, "duration": 10 },
      { "minTaps": 80, "duration": 10 },
      { "minTaps": 85, "duration": 10 },
      { "minTaps": 90, "duration": 10 }
   ]
}
```

**Configuration:**

-  `gameType` (required): Must be `"tap-counter"`
-  `levels` (optional): Number of levels - Default: **15**
-  `levelRequirements` (optional): Array of requirements for each level - Default: **auto-progression**
   -  Each object can have:
      -  `minTaps` (required): Minimum number of taps required to pass the level
      -  `duration` (optional): Duration in seconds for this specific level (default: 10)

**Level Requirements:**

-  **Level 1**: Minimum 20 taps in 10 seconds
-  **Level 2**: Minimum 25 taps in 10 seconds
-  **Level 3**: Minimum 30 taps in 10 seconds
-  ... (progressive increase)
-  **Level 15**: Minimum 90 taps in 10 seconds

**Level Passing Requirements:**

-  Each level has a time limit (configurable per level via `duration`)
-  You must tap a minimum number of times within the time limit
-  If time runs out and requirements are not met, the level fails and you can replay it
-  If you meet the minimum taps requirement, you can proceed to the next level

**Scoring:**

-  Each level gives a score from 0-100 based on taps vs minimum required
-  Formula: `Math.min(100, Math.round((taps / minTaps) * 100))`
-  Final score is the average of all level scores: `Math.round(totalScore / maxLevels)`
-  Maximum 100 points for completing all 15 levels perfectly

**Controls:**

-  **Mouse**: Click the large circular button to tap
-  **Keyboard**:
   -  **Space** or **Enter**: Tap the button (alternative to clicking)

**Goal:**

-  Tap the large circular button as fast as you can
-  Reach the minimum required taps within the time limit to pass each level
-  Each level requires progressively more taps
-  Watch your tap rate (taps per second) displayed at the top

**How It Works:**

-  A large circular tap button appears in the center of the screen
-  Click or tap the button as fast as you can
-  Each tap increments your tap counter
-  You must reach the minimum required taps within the time limit to pass the level
-  If you meet the requirement, you can proceed to the next level
-  If time runs out and requirements are not met, the level fails and you can replay it (5 replays by default, unlimited if shared)

**Level Progression:**

-  **Levels 1-3**: Basic tapping (20-30 taps in 10s) - Get comfortable with the rhythm
-  **Levels 4-6**: Speed up (35-45 taps in 10s) - Increase your tapping speed
-  **Levels 7-9**: Rapid tapping (50-60 taps in 10s) - Very fast tapping required
-  **Levels 10-12**: Lightning fast (65-75 taps in 10s) - Extremely fast tapping
-  **Levels 13-15**: Ultimate speed (80-90 taps in 10s) - Maximum tapping speed

**Features:**

-  Progressive difficulty with increasing tap requirements across 15 levels
-  Real-time tap rate tracking (taps per second)
-  Level progression system (15 levels)
-  Game state display (Level X Complete!, Level X Failed!, Game Complete!)
-  **Replay System**: 5 replays by default, unlimited if shared
   -  Click "Replay" button to retry the current level
   -  Replays reset the timer and tap counter
   -  Share the game to unlock unlimited replays for 15 minutes
-  **Share Feature**: Share the game to unlock unlimited replays
   -  Click "Share for Unlimited Replays" button to copy a shareable link
   -  **Share Success Message**: Shows "Link copied! Unlimited replay will unlock when someone opens your link!" for 15 seconds after sharing
   -  **Unlimited Activated Message**: Shows "🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!" when link is clicked
   -  When someone else opens the shared link, the original sharer gets unlimited replays for 15 minutes
   -  The system uses a heartbeat mechanism (checks every 10 seconds) to detect when the link is clicked
   -  Replays automatically expire after 15 minutes and return to normal
-  Modern UI with header showing level, score, time, and progress bar
-  Stats display showing current taps, target taps, and tap rate
-  Progress bar showing tap progress within the current level
-  Fully responsive design optimized for mobile, tablet, and desktop
-  Interactive example in game instructions section with visual demonstration
-  **Time Management**: When time runs out, the game automatically checks if requirements are met and shows "failed" if not, allowing replay
-  **Progress Tracking**: Progress bar shows completion based on levels (1, 2, 3...), not individual taps

**Tips:**

-  Use multiple fingers or alternate hands for faster tapping
-  Keep a steady rhythm - consistency is key
-  Watch your tap rate to track your speed
-  On mobile, use multiple fingers
-  On desktop, you can use both mouse clicks and keyboard (Space/Enter)
-  Practice maintaining speed throughout the entire time limit
-  Use replays strategically when you're close to meeting the requirement
-  Share the game to get unlimited replays if needed

**Recommended Settings:**

-  **Time Limit**: 0 (no overall time limit, each level has its own timer)
-  **Passing Score**: 70 (70% of max score)
-  **Difficulty**: 1 (easy to medium difficulty)

#### Reflex Arrow

```json
{
   "gameType": "reflex-arrow",
   "levels": 15,
   "levelRequirements": [
      { "minCorrect": 8, "duration": 30, "arrowInterval": 2500 },
      { "minCorrect": 9, "duration": 30, "arrowInterval": 2300 },
      { "minCorrect": 10, "duration": 30, "arrowInterval": 2100 },
      { "minCorrect": 11, "duration": 30, "arrowInterval": 1900 },
      { "minCorrect": 12, "duration": 30, "arrowInterval": 1700 },
      { "minCorrect": 13, "duration": 30, "arrowInterval": 1500 },
      { "minCorrect": 14, "duration": 30, "arrowInterval": 1300 },
      { "minCorrect": 15, "duration": 30, "arrowInterval": 1200 },
      { "minCorrect": 16, "duration": 30, "arrowInterval": 1100 },
      { "minCorrect": 17, "duration": 30, "arrowInterval": 1000 },
      { "minCorrect": 18, "duration": 30, "arrowInterval": 900 },
      { "minCorrect": 19, "duration": 30, "arrowInterval": 800 },
      { "minCorrect": 20, "duration": 30, "arrowInterval": 700 },
      { "minCorrect": 21, "duration": 30, "arrowInterval": 600 },
      { "minCorrect": 22, "duration": 30, "arrowInterval": 500 }
   ]
}
```

**Configuration:**

-  `gameType` (required): Must be `"reflex-arrow"`
-  `levels` (optional): Number of levels - Default: **15**
-  `levelRequirements` (optional): Array of requirements for each level - Default: **auto-progression**
   -  Each object can have:
      -  `minCorrect` (required): Minimum number of correct arrow matches required to pass the level
      -  `duration` (optional): Duration in seconds for this specific level (default: 30)
      -  `arrowInterval` (optional): Time in milliseconds between arrow changes (default: 2000)

**Level Requirements:**

-  **Level 1**: Minimum 8 correct matches, 30 seconds, arrows change every 2.5 seconds
-  **Level 2**: Minimum 9 correct matches, 30 seconds, arrows change every 2.3 seconds
-  **Level 3**: Minimum 10 correct matches, 30 seconds, arrows change every 2.1 seconds
-  ... (progressive increase in difficulty)
-  **Level 15**: Minimum 22 correct matches, 30 seconds, arrows change every 0.5 seconds

**Level Passing Requirements:**

-  Each level has a time limit (configurable per level via `duration`)
-  You must match a minimum number of arrows correctly within the time limit
-  If time runs out and requirements are not met, the level fails and you can replay it
-  If you meet the minimum correct matches requirement, you can proceed to the next level

**Scoring:**

-  Score is calculated based on completed levels: `Math.round((completedLevels / maxLevels) * 100)`
-  Maximum 100 points for 15 levels
-  Score increases progressively with each completed level

**Controls:**

-  **Desktop Keyboard**:
   -  **Arrow Keys** (↑ ↓ ← →): Match the displayed arrow direction
   -  **WASD**: Alternative controls (W=↑, S=↓, A=←, D=→)
-  **Mobile/Tablet**:
   -  **Tap Arrow Buttons**: Tap the arrow button that matches the displayed direction
   -  Arrow buttons are arranged in a cross pattern (up, down, left, right)

**Goal:**

-  Match arrow directions as fast as you can
-  Reach the target number of correct matches to pass each level
-  Progress through 15 levels with increasing difficulty (faster arrow changes, more correct matches required)

**How It Works:**

-  An arrow appears in the center of the screen pointing in one of four directions (↑ ↓ ← →)
-  Quickly press the matching arrow key on your keyboard (or tap the matching arrow button on mobile/tablet)
-  Correct matches are counted towards your progress
-  Wrong matches are also tracked
-  Arrows change automatically at intervals (faster in higher levels)
-  If you meet the minimum correct matches requirement within the time limit, the level is completed
-  If time runs out and requirements are not met, the level fails and you can replay it (5 replays by default, unlimited if shared)

**Level Progression:**

-  **Levels 1-3**: 8-10 correct answers, arrows change every 2.1-2.5 seconds (slow, easy)
-  **Levels 4-6**: 11-13 correct answers, arrows change every 1.5-1.9 seconds (medium speed)
-  **Levels 7-9**: 14-16 correct answers, arrows change every 1.1-1.3 seconds (fast)
-  **Levels 10-12**: 17-19 correct answers, arrows change every 0.8-1.0 seconds (very fast)
-  **Levels 13-15**: 20-22 correct answers, arrows change every 0.5-0.7 seconds (lightning fast)

**Features:**

-  Progressive difficulty with increasing speed and requirements across 15 levels
-  Real-time feedback on correct/wrong matches (visual indicators)
-  Level progression system (15 levels)
-  Game state display (Level X Complete!, Level X Failed!, Game Complete!)
-  **Mobile/Tablet Support**: On-screen arrow buttons arranged in a cross pattern for easy tapping
-  **Desktop Support**: Full keyboard controls with Arrow Keys and WASD
-  **Replay System**: 5 replays by default, unlimited if shared
   -  Click "Replay" button to retry the current level
   -  Replays reset the timer and correct/wrong counters
   -  Share the game to unlock unlimited replays for 15 minutes
-  **Share Feature**: Share the game to unlock unlimited replays
   -  Click "Share for unlimited" button to copy a shareable link
   -  **Share Success Message**: Shows "Link copied! Unlimited replay will unlock when someone opens your link!" for 15 seconds after sharing
   -  **Unlimited Activated Message**: Shows "🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!" when link is clicked
   -  When someone else opens the shared link, the original sharer gets unlimited replays for 15 minutes
   -  The system uses a heartbeat mechanism (checks every 10 seconds) to detect when the link is clicked
   -  Replays automatically expire after 15 minutes and return to normal
-  Modern UI with header showing level, score, time, and progress bar
-  Stats display showing current correct/wrong matches and target
-  Visual arrow display with feedback (green for correct, red for wrong)
-  Fully responsive design optimized for mobile, tablet, and desktop
-  Interactive example in game instructions section with visual demonstration
-  **Time Management**: When time runs out, the game automatically checks if requirements are met and shows "failed" if not, allowing replay
-  **Progress Tracking**: Progress bar shows completion based on levels (1, 2, 3...), not individual matches
-  **Arrow Feedback**: Visual feedback on arrow display (border color changes, scale animation)

**Tips:**

-  Focus on the arrow direction, not the position
-  Use muscle memory for faster responses
-  On desktop, use arrow keys for precision
-  On mobile, use the on-screen arrow buttons for quick tapping
-  Stay calm and react quickly
-  Higher levels require faster reactions due to shorter arrow intervals
-  Use replays strategically when you're close to meeting the requirement
-  Share the game to get unlimited replays if needed

**Recommended Settings:**

-  **Time Limit**: 0 (duration is per level)
-  **Passing Score**: 70 (70% of max score)
-  **Difficulty**: 2 (medium to hard difficulty)

#### Whack-a-Shape

```json
{
   "gameType": "whack-shape",
   "levels": 10,
   "levelDuration": 20,
   "levelRequirements": [
      { "minCorrectClicks": 3, "duration": 20 },
      { "minCorrectClicks": 4, "duration": 20 },
      { "minCorrectClicks": 5, "duration": 20 },
      { "minCorrectClicks": 6, "duration": 20 },
      { "minCorrectClicks": 7, "duration": 20 },
      { "minCorrectClicks": 8, "duration": 20 },
      { "minCorrectClicks": 9, "duration": 20 },
      { "minCorrectClicks": 10, "duration": 20 },
      { "minCorrectClicks": 11, "duration": 20 },
      { "minCorrectClicks": 12, "duration": 20 }
   ]
}
```

**Configuration:**

-  `gameType` (required): Must be `"whack-shape"`
-  `levels` (optional): Number of levels - Default: **10**
-  `levelDuration` (optional): Default duration in seconds per level - Default: **20** (used as fallback if not specified in levelRequirements)
-  `levelRequirements` (optional): Array of requirements for each level - Default: **auto-progression**
   -  Each object can have:
      -  `minCorrectClicks` (required): Minimum number of correct clicks to pass the level
      -  `duration` (optional): Duration in seconds for this specific level (overrides `levelDuration`)

**Level Requirements:**

-  **Level 1**: Minimum 3 correct clicks, 20 seconds
-  **Level 2**: Minimum 4 correct clicks, 20 seconds
-  **Level 3**: Minimum 5 correct clicks, 20 seconds
-  ... (progressive increase)
-  **Level 10**: Minimum 12 correct clicks, 20 seconds

**Level Passing Requirements:**

-  Each level has a time limit (configurable per level via `duration`)
-  You must click the correct shape type (circle, square, or triangle) as many times as required
-  If you meet the minimum correct clicks requirement before time runs out, the game pauses and waits for the timer to finish
-  If you don't meet the requirements, the level fails and you can repeat it
-  Wrong clicks count against you but don't end the level immediately

**Scoring:**

-  Score is calculated based on completed levels: `completedLevels * (100 / maxLevels)`
-  Level 1 = 10 points, Level 2 = 20 points, Level 3 = 30 points, etc.
-  Maximum 100 points for 10 levels

**Controls:**

-  **Mouse**: Click on shapes that match the target shape type
-  **Keyboard**: Not applicable (mouse-only interaction)

**Goal:**

-  Click the correct shape type (circle, square, or triangle) as quickly as possible
-  Each level shows a target shape at the top that you must match
-  Shapes spawn and move around the arena
-  Click shapes that match the target type to score points
-  Avoid clicking wrong shapes (they count as mistakes)
-  Complete the minimum required correct clicks within the time limit to pass the level

**How It Works:**

-  A target shape is displayed at the top (circle, square, or triangle)
-  Shapes spawn randomly in the arena and move around
-  Click shapes that match the target type to score correct clicks
-  Clicking wrong shapes counts as mistakes
-  Shapes disappear after being clicked or after their time-to-live expires
-  Spawn rate and shape display time increase with level (progressive difficulty)
-  If you meet the requirement, the game pauses and waits for the timer
-  If you don't meet the requirement, you can replay the level (5 replays by default, unlimited if shared)

**Features:**

-  Progressive difficulty with faster spawning and shorter display times across 10 levels
-  Three shape types: circle, square, and triangle
-  Shapes move around the arena with physics (bouncing off walls)
-  Visual feedback with correct/wrong indicators (+1 Correct! / -1 Mistake!)
-  Level progression system (10 levels)
-  Game state display (Level X Complete!, Level X Failed!, Game Complete!)
-  **Replay System**: 5 replays by default, unlimited if shared
   -  Click "Replay" button to retry the current level
   -  Replays reset the timer and correct/wrong counters
   -  Share the game to unlock unlimited replays for 15 minutes
-  **Share Feature**: Share the game to unlock unlimited replays
   -  Click "Share for unlimited" button to copy a shareable link
   -  **Share Success Message**: Shows "Link copied! Unlimited replay will unlock when someone opens your link!" for 15 seconds after sharing
   -  **Unlimited Activated Message**: Shows "🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!" when link is clicked
   -  When someone else opens the shared link, the original sharer gets unlimited replays for 15 minutes
   -  The system uses a heartbeat mechanism (checks every 10 seconds) to detect when the link is clicked
   -  Replays automatically expire after 15 minutes and return to normal
-  Modern UI with header showing level, score, time, and progress bar
-  Stats display showing correct/wrong clicks and requirements
-  Target shape indicator at the top of the game area
-  Fully responsive design optimized for mobile, tablet, and desktop
-  Each level can have its own duration (configurable via `duration` in `levelRequirements`)

**Progressive Difficulty:**

-  **Spawn Interval**: Decreases with level (Level 1: 800ms, Level 10: 300ms)
-  **Shape TTL**: Decreases with level (Level 1: 2500ms, Level 10: 1000ms)
-  **Shape Velocity**: Increases with level (Level 1: 0.2 px/frame, Level 10: 0.6 px/frame)
-  **Multiple Spawns**: Higher chance of spawning 2 shapes at once in higher levels

**Tips:**

-  Focus on the target shape type shown at the top
-  Click quickly but accurately to avoid mistakes
-  Watch for shapes that match the target type
-  Use replays strategically when you're close to meeting the requirement
-  Share the game to get unlimited replays if needed
-  Higher levels require faster reactions due to increased spawn rate and movement speed

**Recommended Settings:**

-  **Time Limit**: 0 (no overall time limit, each level has its own timer)
-  **Passing Score**: 70 (70% of max score)
-  **Difficulty**: 2 (medium difficulty)

#### Maze Escape

```json
{
   "gameType": "maze-escape",
   "rounds": 20
}
```

**Configuration:**

-  `gameType` (required): Must be `"maze-escape"`
-  `rounds` (optional): Number of rounds - Default: **20** (recommended for 2000 points max)
-  `size` (optional): Fixed grid size (overrides dynamic sizing) - Default: **dynamic based on rounds**

**Grid Size Configuration:**

-  `size` (optional): Fixed grid size - if not specified, uses dynamic progression:
   -  **Rounds 1-5**: 10x10 grid
   -  **Rounds 6-15**: 20x20 grid
   -  **Rounds 16-20**: 45x45 grid
-  `gridSizes` (optional): Array of objects to configure grid sizes per round range:
   ```json
   {
      "gameType": "maze-escape",
      "rounds": 20,
      "gridSizes": [
         { "rounds": 5, "size": 10 },
         { "rounds": 10, "size": 15 },
         { "rounds": 20, "size": 20 }
      ]
   }
   ```
   -  Each object has `rounds` (max round for this size) and `size` (grid size)
   -  Example above: 10x10 for rounds 1-5, 15x15 for rounds 6-10, 20x20 for rounds 11-20
-  Example: `{"gameType": "maze-escape", "rounds": 20, "size": 15}` for fixed 15x15 grid

**Scoring:**

-  100 points per round minus 1 point per move (min 0)
-  Maximum 2000 points for 20 rounds (100 points per round)

**Controls:**

-  **Keyboard**: Arrow keys or WASD to move through the maze
-  **Mouse**: Click on adjacent cells to move your character

**Goal:**

-  Navigate from start (top-left, marked with Play icon) to exit (bottom-right, marked with Trophy icon)
-  Avoid walls (black tiles)
-  Trail shows your path (blue dots)
-  Fewer moves = higher score

**Features:**

-  Uses Recursive Backtracker algorithm for maze generation
-  Trail visualization shows your path
-  Start position marked with Play icon (Heroicons)
-  Exit position marked with Trophy icon (Heroicons)
-  Rounded design matching other games
-  Modern UI with gradients and animations

**Recommended Settings:**

-  **Time Limit**: 300 seconds (for 20 rounds with larger grids)
-  **Passing Score**: 1600 (80% of max score)
-  **Difficulty**: 3-4 (medium to hard)

**Backend Configuration Example:**

In WordPress admin, when creating/editing a game:

1. **Title**: "Maze Escape"
2. **Game Type**: Logic
3. **Game Order**: 8 (or your desired order)
4. **Difficulty**: 3
5. **Time Limit**: 300
6. **Passing Score**: 1600
7. **Description**: "Navigate from start to exit through a maze"
8. **Game Config** (JSON):

   ```json
   {
      "gameType": "maze-escape",
      "rounds": 20
   }
   ```

   Or with fixed grid size:

   ```json
   {
      "gameType": "maze-escape",
      "rounds": 20,
      "size": 15
   }
   ```

**Quick Fill Template:**

In WordPress admin, you can use the "Quick Fill Templates" dropdown and select "8. Maze Escape" to auto-fill all fields with recommended settings.

#### Mirror Match

```json
{
   "gameType": "mirror-match",
   "rounds": 20,
   "mirrorTypes": ["horizontal", "vertical", "diagonal"],
   "shapes": [
      "WrenchWithJaw",
      "LightningBolt",
      "CameraOffCenter",
      "FlagOnPole",
      "SpiralCurl",
      "GearAsymmetric",
      "CircuitBranch",
      "KeyAsymmetric",
      "ShieldOffCenter",
      "BirdAsymmetric",
      "AnchorOffset",
      "PaperclipUneven",
      "RocketOneFin",
      "PuzzleMissingTab"
   ],
   "optionsCount": 3
}
```

**Configuration:**

-  `gameType` (required): Must be `"mirror-match"`
-  `rounds` (optional): Number of rounds - Default: **20** (recommended for 100 points max)
-  `mirrorTypes` (optional): Array of mirror types to use - Default: `["horizontal", "vertical", "diagonal"]`
   -  Available types: `"horizontal"` (flips left ↔ right), `"vertical"` (flips top ↔ bottom), `"diagonal"` (flips both ways)
-  `shapes` (optional): Array of custom SVG shape names - Default: **14 asymmetric shapes** designed for clear mirror transformations
-  `optionsCount` (optional): Number of options to display - Default: **3** (always shows horizontal, vertical, and diagonal mirrors)

**Scoring:**

-  5 points per correct round
-  Maximum 100 points for 20 rounds

**Controls:**

-  **Mouse**: Click on the option (1-3) that shows the correct mirror image
-  **Keyboard**: 1-3 to select option directly by number

**Goal:**

-  Each round shows a main shape and a mirror type (horizontal, vertical, or diagonal)
-  Find the correct mirrored version among the 3 options
-  Options always include all three mirror types (horizontal, vertical, diagonal) of the same shape

**Features:**

-  Custom SVG shapes with asymmetric details for clear mirror transformations
-  Interactive start screen preview explaining mirror types
-  Visual feedback with check/x icons
-  Modern UI matching other games
-  Fully responsive design for mobile, tablet, and desktop
-  **Mirror Types Explained Section**: Responsive grid layout
   -  Mobile: 1 column (vertical stack)
   -  Tablet: 2 columns
   -  Desktop: 3 columns
   -  Optimized font sizes, padding, and SVG sizes for each breakpoint

**Recommended Settings:**

-  **Time Limit**: 60 seconds (overall game time, not per round)
-  **Passing Score**: 75 (75% of max score)
-  **Difficulty**: 2 (medium)

#### Logic Gates

```json
{
   "gameType": "logic-gates",
   "rounds": 20,
   "gates": ["AND", "OR", "NOT"],
   "inputs": [0, 1],
   "difficulty": "medium"
}
```

**Configuration:**

-  `gameType` (required): Must be `"logic-gates"`
-  `rounds` (optional): Number of rounds - Default: **20** (recommended for 100 points max)
-  `gates` (optional): Array of gate types to use - Default: `["AND", "OR", "NOT"]`
   -  Available gates: `"AND"`, `"OR"`, `"NOT"`
-  `inputs` (optional): Array of possible input values - Default: `[0, 1]`
-  `difficulty` (optional): Difficulty level - Default: `"medium"`

**Scoring:**

-  5 points per correct round
-  Maximum 100 points for 20 rounds

**Controls:**

-  **Mouse**: Click on 0 or 1 to select the output
-  **Keyboard**: 0 or 1 to select output directly

**Goal:**

-  Each round presents a logic gate (AND, OR, or NOT) and its input(s)
-  Determine the correct output (0 or 1) based on the gate type
-  AND gate: Output is 1 only when ALL inputs are 1
-  OR gate: Output is 1 if at least ONE input is 1
-  NOT gate: Output is the inverse of the single input

**Features:**

-  Lamp visualization that turns on (glows) when output is 1, off when 0
-  Interactive start screen with truth tables and examples
-  Visual feedback with check/x icons
-  Modern UI matching other games

**Recommended Settings:**

-  **Time Limit**: 90 seconds (overall game time)
-  **Passing Score**: 80 (80% of max score)
-  **Difficulty**: 3 (medium-hard)

#### Sequence Arrows

```json
{
   "gameType": "sequence-arrows",
   "rounds": 20,
   "sequenceLength": null
}
```

**Configuration:**

-  `gameType` (required): Must be `"sequence-arrows"`
-  `rounds` (optional): Number of rounds - Default: **20** (recommended for 100 points max)
-  `sequenceLength` (optional): Fixed sequence length - Default: **null** (progressive difficulty)
   -  If `null`, sequence length increases: rounds 1-5 = 3, 6-10 = 4, 11-15 = 5, 16-20 = 6
   -  If specified, uses that length for all rounds

**Scoring:**

-  5 points per correct round
-  Maximum 100 points for 20 rounds

**Controls:**

-  **Mouse**: Click on the arrow option (1-4) that completes the sequence
-  **Keyboard**:
   -  1-4 to select option directly by number
   -  W/A/S/D or Arrow keys to select arrow by direction (W=↑, S=↓, A=←, D=→)

**Goal:**

-  Each round shows a sequence of arrows (↑ ↓ ← →) with one missing arrow shown as "?"
-  Predict which arrow should come next based on the pattern
-  Patterns can be: clockwise rotation, counter-clockwise rotation, repeating loops, alternating directions, or step jumps
-  Use the "Show Hint" button to see the detected pattern type

**Pattern Types:**

-  **Clockwise rotation**: ↑ → ↓ ← (then repeats)
-  **Counter-clockwise rotation**: ↑ ← ↓ → (then repeats)
-  **Repeating loops**: e.g., ↑ ↑ → → ↓ ↓ ← ←
-  **Alternating directions**: e.g., ↑ → ↑ → …
-  **Step jumps**: skipping one direction each time

**Features:**

-  Progressive difficulty with increasing sequence length
-  Pattern detection and hint system
-  Interactive start screen explaining all pattern types
-  Visual feedback with check/x icons
-  Modern UI matching other games

**Recommended Settings:**

-  **Time Limit**: 90 seconds (overall game time)
-  **Passing Score**: 75 (75% of max score)
-  **Difficulty**: 2 (medium)

#### Emoji Memory

```json
{
   "gameType": "emoji-memory",
   "rounds": 20,
   "gridSizes": [
      [4, 4],
      [4, 4],
      [4, 4],
      [4, 4],
      [4, 4],
      [5, 5],
      [5, 5],
      [5, 5],
      [5, 5],
      [5, 5],
      [6, 7],
      [6, 7],
      [6, 7],
      [6, 7],
      [6, 7],
      [8, 8],
      [8, 8],
      [8, 8],
      [8, 8],
      [8, 8]
   ]
}
```

**Configuration:**

-  `gameType` (required): Must be `"emoji-memory"`
-  `rounds` (optional): Number of rounds - Default: **20** (recommended for 100 points max)
-  `gridSizes` (optional): Array of grid sizes for each round - Default: Calculated automatically
   -  Each element is `[width, height]` representing the grid size for that round
   -  Rounds 1-5: 4x4 grid
   -  Rounds 6-10: 5x5 grid
   -  Rounds 11-15: 6x7 grid
   -  Rounds 16-20: 8x8 grid
   -  If not provided, grid sizes are calculated automatically based on round number

**Scoring:**

-  5 points per correct round (when all emoji positions are correctly identified)
-  Maximum 100 points for 20 rounds
-  Score is calculated based on successfully completed rounds

**Controls:**

-  **Mouse**:
   -  Click on cells where you saw emojis to select them
   -  Cells show visual feedback (green border for correct, red border for wrong)
-  **Keyboard**: Not available\*\* (mouse-only game)

**Goal:**

-  Memorize the positions of emojis on the grid
-  After emojis disappear, click on the cells where you saw each emoji in the correct order
-  Each round shows emojis for 2-4 seconds (increasing with round number)
-  Grid size increases with each round group for progressive difficulty
-  If you make a mistake, you can retry the same round (game doesn't end)

**How It Works:**

-  Each round displays a grid with emojis at random positions
-  Emojis are shown for a brief period (2-4 seconds based on round)
-  After emojis disappear, you must click on the cells where you saw emojis
-  The number of emojis increases with rounds (4-8 emojis per round)
-  Grid size increases: 4x4 → 5x5 → 6x7 → 8x8
-  Wrong answers show red feedback but allow retry (game continues)

**Features:**

-  Progressive difficulty with increasing grid sizes and emoji counts
-  Dynamic grid configuration from backend (configurable per round)
-  Visual feedback with colored borders (green for correct, red for wrong, blue for selected)
-  Notification messages like Match the Shapes (green for correct, red for wrong)
-  Modern UI with header showing round, score, and progress bar
-  Game state display (Memorizing, Your Turn, Correct, Wrong)
-  **Hint System**: 10 hints by default, unlimited if shared
   -  Click "Hint" button to reveal 1-2 emoji positions
   -  Hints show for 2 seconds then disappear
   -  Share the game to unlock unlimited hints for 15 minutes
-  **Share Feature**: Share the game to unlock unlimited hints
   -  Click "Share for Unlimited Hints" button to copy a shareable link
   -  When someone else opens the shared link, the original sharer gets unlimited hints for 15 minutes
   -  The system uses a heartbeat mechanism (checks every 10 seconds) to detect when the link is clicked
   -  A success message appears for 15 seconds when unlimited hints are activated
   -  Hints automatically expire after 15 minutes and return to normal
-  Interactive example in game instructions section with visual grid demonstration
-  Mouse controls displayed in game instructions
-  Fully responsive design optimized for mobile, tablet, and desktop
-  Touch-optimized for mobile devices
-  Game continues on wrong answer (allows retry instead of ending)

**Tips:**

-  Create a mental map of the grid
-  Associate each emoji with its position
-  Start with the corners and edges to build your spatial memory
-  Use hints strategically when stuck
-  Share the game to get unlimited hints if needed

**Recommended Settings:**

-  **Time Limit**: 60 seconds (overall game time)
-  **Passing Score**: 75 (75% of max score)
-  **Difficulty**: 2 (medium)

#### Number Recall

```json
{
   "gameType": "number-recall",
   "rounds": 15
}
```

**Configuration:**

-  `gameType` (required): Must be `"number-recall"`
-  `rounds` (optional): Number of rounds - Default: **15** (recommended for 100 points max)

**Scoring:**

-  Score is calculated based on completed rounds: `Math.round((completedRounds / maxRounds) * 100)`
-  Maximum 100 points for 15 rounds
-  Score increases progressively with each completed round
-  Example: Round 1 = 7 points, Round 2 = 13 points, ..., Round 15 = 100 points

**Controls:**

-  **Mouse**:
   -  Type the number sequence in the input field
   -  Click "OK" button to submit your answer
-  **Keyboard**:
   -  Type numbers **0-9** to enter the sequence
   -  Press **Enter** to submit your answer

**Goal:**

-  Watch the numbers appear on screen
-  After they disappear, type the sequence you saw in the correct order
-  Sequence length increases with each round: 3 + round (minimum 3, maximum 10 digits)
-  Show time increases with round: 1200ms + round \* 200ms
-  If you make a mistake, you can retry the same round (game doesn't end)

**How It Works:**

-  Each round displays a sequence of random numbers (0-9)
-  Numbers are shown for a brief period (1.2-4.2 seconds based on round)
-  After numbers disappear, you must type the exact sequence
-  Sequence length increases: Round 1 = 3 digits, Round 2 = 4 digits, ..., Round 7+ = 10 digits (max)
-  Wrong answers show red feedback but allow retry (game continues)

**Features:**

-  Progressive difficulty with increasing sequence length and display time
-  Visual feedback with colored number display box (gradient background)
-  Notification messages like Match the Shapes (green for correct, red for wrong)
-  Modern UI with header showing round, score, and progress bar
-  Game state display (Memorizing, Your Turn, Correct, Wrong)
-  **Hint System**: 10 hints by default, unlimited if shared
   -  Click "Hint" button to reveal digits one by one
   -  First hint reveals first digit, second hint reveals second digit, etc.
   -  Revealed digits stay visible (blue color) until round ends
   -  Share the game to unlock unlimited hints for 15 minutes
-  **Share Feature**: Share the game to unlock unlimited hints
   -  Click "Share for Unlimited Hints" button to copy a shareable link
   -  When someone else opens the shared link, the original sharer gets unlimited hints for 15 minutes
   -  The system uses a heartbeat mechanism (checks every 10 seconds) to detect when the link is clicked
   -  A success message appears for 15 seconds when unlimited hints are activated
   -  Hints automatically expire after 15 minutes and return to normal
-  Interactive example in game instructions section with visual number display
-  Mouse and keyboard controls displayed in game instructions
-  Fully responsive design optimized for mobile, tablet, and desktop
-  Touch-optimized for mobile devices
-  Game continues on wrong answer (allows retry instead of ending)
-  Monospace font for number input with letter spacing for better readability

**Tips:**

-  Break long sequences into smaller chunks
-  Remember groups of 2-3 numbers at a time
-  Use hints strategically when stuck
-  Share the game to get unlimited hints if needed

**Recommended Settings:**

-  **Time Limit**: 60 seconds (overall game time)
-  **Passing Score**: 75 (75% of max score)
-  **Difficulty**: 2 (medium)

#### Image Recall

```json
{
   "gameType": "image-recall",
   "rounds": 15,
   "gridSizes": [3, 3, 3, 3, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6]
}
```

**Configuration:**

-  `gameType` (required): Must be `"image-recall"`
-  `rounds` (optional): Number of rounds - Default: **15** (recommended for 100 points max)
-  `gridSizes` (optional): Array of grid sizes per round - Default: **[3, 3, 3, 3, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6]**
   -  Each number represents the grid size for that round (3 = 3x3, 5 = 5x5, 6 = 6x6)
   -  If `gridSizes` array is shorter than `rounds`, remaining rounds use the last grid size from array or fallback to default calculation
   -  If not provided, defaults to: rounds 1-4 = 3x3, rounds 5-8 = 5x5, rounds 9+ = 6x6

**Scoring:**

-  Score is calculated based on completed rounds: `Math.round((completedRounds / maxRounds) * 100)`
-  Maximum 100 points for 10 rounds
-  Score increases progressively with each completed round
-  Example: Round 1 = 10 points, Round 2 = 20 points, ..., Round 10 = 100 points

**Controls:**

-  **Mouse**:
   -  Click images in the same order as they flashed
   -  Images are shown in a grid (3x3, 5x5, or 6x6 depending on round)
-  **Keyboard**:
   -  **Number Keys (1-9, 0, -, =)**: Select images by position in grid
   -  Press **1-9** to select positions 1-9
   -  Press **0** to select position 10 (if grid has 10+ images)
   -  Press **-** to select position 11 (if grid has 11+ images)
   -  Press **=** to select position 12 (if grid has 12+ images)
   -  **Arrow Keys** or **WASD**: Navigate through grid cells
   -  **Arrow Up/W**: Move selection up
   -  **Arrow Down/S**: Move selection down
   -  **Arrow Left/A**: Move selection left
   -  **Arrow Right/D**: Move selection right
   -  **Enter** or **Space**: Select currently highlighted cell

**Goal:**

-  Watch the sequence of images flash on the grid
-  After they disappear, click on the images in the same order you saw them
-  Sequence length increases with each round: 2 + Math.floor(round / 2) (minimum 2, maximum 7)
-  If you make a mistake, you can retry the same round (game doesn't end)

**How It Works:**

-  Each round displays a sequence of images (emojis) that flash one by one
-  Grid size can be 3x3 (9 images), 5x5 (25 images), or 6x6 (36 images) - configurable per round
-  Sequence length scales with grid size:
   -  3x3 grid: 2-4 images
   -  5x5 grid: 3-6 images
   -  6x6 grid: 4-8 images
-  Sequence length also increases with round number
-  Each image flashes for 650ms with a brief delay between flashes
-  After the sequence completes, all images are hidden and you must click them in order
-  Wrong answers show red feedback but allow retry (game continues)

**Features:**

-  Progressive difficulty with increasing sequence length
-  Visual feedback with flash animation for active images
-  Notification messages like Match the Shapes (green for correct, red for wrong)
-  Modern UI with header showing round, score, and progress bar
-  Game state display (Watch the sequence…, Now click in the same order, Correct, Wrong)
-  **Hint System**: 10 hints by default, unlimited if shared
   -  Click "Hint" button to reveal positions one by one
   -  First hint reveals first position, second hint reveals second position, etc.
   -  Revealed positions stay visible (blue border) until round ends
   -  Share the game to unlock unlimited hints for 15 minutes
-  **Share Feature**: Share the game to unlock unlimited hints
   -  Click "Share for Unlimited Hints" button to copy a shareable link
   -  When someone else opens the shared link, the original sharer gets unlimited hints for 15 minutes
   -  The system uses a heartbeat mechanism (checks every 10 seconds) to detect when the link is clicked
   -  A success message appears for 15 seconds when unlimited hints are activated
   -  Hints automatically expire after 15 minutes and return to normal
-  Interactive example in game instructions section with visual grid
-  Mouse and keyboard controls displayed in game instructions
-  Fully responsive design optimized for mobile, tablet, and desktop
-  Touch-optimized for mobile devices
-  Game continues on wrong answer (allows retry instead of ending)
-  Order indicators show which position you clicked (1, 2, 3, etc.)

**Tips:**

-  Create a story or association to remember the order
-  Visualize the sequence as a story
-  Focus on order and positions
-  Use hints strategically when stuck
-  Share the game to get unlimited hints if needed

**Recommended Settings:**

-  **Time Limit**: 90 seconds (overall game time)
-  **Passing Score**: 75 (75% of max score)
-  **Difficulty**: 2 (medium)

#### Path Memory

```json
{
   "gameType": "path-memory",
   "rounds": 15,
   "gridSize": 5
}
```

**Configuration:**

-  `gameType` (required): Must be `"path-memory"`
-  `rounds` (optional): Number of rounds - Default: **15** (recommended for 100 points max)
-  `gridSize` (optional): Grid size - Default: **5** (5x5 grid)

**Scoring:**

-  Score is calculated based on completed rounds: `Math.round((completedRounds / maxRounds) * 100)`
-  Maximum 100 points for 15 rounds
-  Score increases progressively with each completed round
-  Example: Round 1 = 7 points, Round 2 = 13 points, ..., Round 15 = 100 points

**Controls:**

-  **Mouse**:
   -  Click cells in the same order as the path that was shown
-  **Keyboard**:
   -  Press **ArrowUp** or **W** to move selection Up
   -  Press **ArrowDown** or **S** to move selection Down
   -  Press **ArrowLeft** or **A** to move selection Left
   -  Press **ArrowRight** or **D** to move selection Right
   -  Press **Enter** or **Space** to select highlighted cell

**Goal:**

-  Watch the path that lights up on the grid
-  After it disappears, click on the cells to recreate the same path in the same order
-  Path length increases with each round: 3 + Math.floor(round / 2) (minimum 3, maximum 9)
-  If you make a mistake, you can retry the same round (game doesn't end)

**How It Works:**

-  Each round displays a path on a 5x5 grid that flashes one cell at a time
-  Path is generated using a random walk algorithm (no revisiting cells)
-  Path length increases with round number: 3-9 cells
-  Each cell flashes for 320ms with a 480ms delay between flashes
-  After the path completes, all cells are hidden and you must click them in order
-  Wrong answers show red feedback but allow retry (game continues)

**Features:**

-  Progressive difficulty with increasing path length
-  Visual feedback with flash animation for active cells
-  Notification messages like Match the Shapes (green for correct, red for wrong)
-  Modern UI with header showing round, score, path length, and progress bar
-  Game state display (Watch the path…, Your turn: recreate the path, Correct, Wrong)
-  **Hint System**: 10 hints by default, unlimited if shared
   -  Click "Hint" button to reveal path positions one by one
   -  First hint reveals first position, second hint reveals second position, etc.
   -  Revealed positions stay visible (yellow border with marker) until round ends
   -  Share the game to unlock unlimited hints for 15 minutes
-  **Share Feature**: Share the game to unlock unlimited hints
   -  Click "Share for Unlimited Hints" button to copy a shareable link
   -  When someone else opens the shared link, the original sharer gets unlimited hints for 15 minutes
   -  The system uses a heartbeat mechanism (checks every 10 seconds) to detect when the link is clicked
   -  A success message appears for 15 seconds when unlimited hints are activated
   -  Hints automatically expire after 15 minutes and return to normal
-  Interactive example in game instructions section with visual grid
-  Mouse and keyboard controls displayed in game instructions
-  Fully responsive design optimized for mobile, tablet, and desktop
-  Touch-optimized for mobile devices
-  Game continues on wrong answer (allows retry instead of ending)
-  Order markers show which position you clicked (1, 2, 3, etc.)
-  Enhanced visual emphasis for cells during path display and flash animation

**Tips:**

-  Remember the starting point
-  Follow the direction of movement step by step
-  Create a mental map of the path sequence
-  Use hints strategically when stuck
-  Share the game to get unlimited hints if needed

**Recommended Settings:**

-  **Time Limit**: 90 seconds (overall game time)
-  **Passing Score**: 75 (75% of max score)
-  **Difficulty**: 2 (medium)

#### Word Memory

```json
{
   "gameType": "word-memory",
   "rounds": 15,
   "gridSizes": [3, 3, 3, 3, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6]
}
```

**Configuration:**

-  `gameType` (required): Must be `"word-memory"`
-  `rounds` (optional): Number of rounds - Default: **15** (recommended for 100 points max)
-  `gridSizes` (optional): Array of grid sizes per round - Default: **[3, 3, 3, 3, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6]**
   -  Each number represents the grid size for that round (3 = 3x3, 5 = 5x5, 6 = 6x6)
   -  If `gridSizes` array is shorter than `rounds`, remaining rounds use the last grid size from array or fallback to default calculation
   -  If not provided, defaults to: rounds 1-4 = 3x3, rounds 5-8 = 5x5, rounds 9+ = 6x6

**Scoring:**

-  Score is calculated based on completed rounds: `Math.round((completedRounds / maxRounds) * 100)`
-  Maximum 100 points for 15 rounds
-  Score increases progressively with each completed round
-  Example: Round 1 = 7 points, Round 2 = 13 points, ..., Round 15 = 100 points

**Controls:**

-  **Mouse**:
   -  Click words in the same order as they flashed
   -  Words are shown in a grid (3x3, 5x5, or 6x6 depending on round)
-  **Keyboard**:
   -  **Number Keys (1-9, 0, -, =)**: Select words by position in grid
   -  Press **1-9** to select positions 1-9
   -  Press **0** to select position 10 (if grid has 10+ words)
   -  Press **-** to select position 11 (if grid has 11+ words)
   -  Press **=** to select position 12 (if grid has 12+ words)
   -  **Arrow Keys** or **WASD**: Navigate through grid cells
   -  **Arrow Up/W**: Move selection up
   -  **Arrow Down/S**: Move selection down
   -  **Arrow Left/A**: Move selection left
   -  **Arrow Right/D**: Move selection right
   -  **Enter** or **Space**: Select currently highlighted word

**Goal:**

-  Watch the sequence of words flash on the grid
-  After they disappear, click on the words in the same order you saw them
-  Sequence length increases with each round: 2 + Math.floor(round / 2) (minimum 2, maximum 7)
-  If you make a mistake, you can retry the same round (game doesn't end)

**How It Works:**

-  Each round displays a sequence of words that flash one by one
-  Grid size can be 3x3 (9 words), 5x5 (25 words), or 6x6 (36 words) - configurable per round
-  Words are randomly selected from a pool of 36 words
-  Each word flashes for 600ms with a 600ms delay between flashes
-  After all words are shown, you must click them in the same order
-  Wrong answers show red feedback but allow retry (game continues)

**Features:**

-  Progressive difficulty with increasing sequence length and grid size
-  Visual feedback with flash animation for active words
-  Notification messages like Match the Shapes (green for correct, red for wrong)
-  Modern UI with header showing round, score, and progress bar
-  Game state display (Watch the words flash…, Your turn: Click words in order, Correct, Wrong)
-  **Hint System**: 10 hints by default, unlimited if shared
   -  Click "Hint" button to reveal word positions one by one
   -  First hint reveals first position, second hint reveals second position, etc.
   -  Revealed positions stay visible (purple border with lightbulb icon) until round ends
   -  Share the game to unlock unlimited hints for 15 minutes
-  **Share Feature**: Share the game to unlock unlimited hints
   -  Click "Share for Unlimited Hints" button to copy a shareable link
   -  When someone else opens the shared link, the original sharer gets unlimited hints for 15 minutes
   -  The system uses a heartbeat mechanism (checks every 10 seconds) to detect when the link is clicked
   -  A success message appears for 15 seconds when unlimited hints are activated
   -  Hints automatically expire after 15 minutes and return to normal
-  Mouse and keyboard controls displayed in game instructions
-  Fully responsive design optimized for mobile, tablet, and desktop
-  Touch-optimized for mobile devices
-  Game continues on wrong answer (allows retry instead of ending)
-  Order indicators show which position you clicked (1, 2, 3, etc.)
-  Visual highlighting for keyboard navigation

**Tips:**

-  Remember the starting word
-  Follow the sequence step by step
-  Create a mental story or association to remember the order
-  Use hints strategically when stuck
-  Share the game to get unlimited hints if needed

**Recommended Settings:**

-  **Time Limit**: 90 seconds (overall game time)
-  **Passing Score**: 75 (75% of max score)
-  **Difficulty**: 2 (medium)

#### Face Memory

```json
{
   "gameType": "face-memory",
   "rounds": 15
}
```

**Configuration:**

-  `gameType` (required): Must be `"face-memory"`
-  `rounds` (optional): Number of rounds - Default: **15** (recommended for 100 points max)

**Scoring:**

-  Score is calculated based on completed rounds: `Math.round((completedRounds / maxRounds) * 100)`
-  Maximum 100 points for 15 rounds
-  Score increases progressively with each completed round

**Controls:**

-  **Mouse**:
   -  Click on a face to select it
   -  Click on a name button to match it with the selected face
-  **Keyboard**:
   -  **Number Keys (1-6)**: Select face by number (1-6) or select name when face is selected
   -  **Arrow Keys** or **WASD**: Navigate between faces
   -  **Enter** or **Space**: Cycle through available names for selected face

**Goal:**

-  Study the faces and their names during the memorizing phase
-  After they disappear, match each face with its correct name
-  Number of faces increases with rounds: 3-6 faces per round
-  If you make a mistake, the round repeats (game doesn't end)

**How It Works:**

-  Each round displays faces with their names for memorization (duration increases with round)
-  Number of faces increases: rounds 1-5 = 3 faces, rounds 6-10 = 4 faces, rounds 11-15 = 5-6 faces
-  After memorization, faces are shown without names
-  Names are shuffled and displayed as buttons for selection
-  Match each face with its correct name
-  Wrong answers cause the round to repeat (same faces, same names)

**Features:**

-  Progressive difficulty with increasing number of faces
-  Modern UI with header matching Rotate to Fit design
-  Notification messages positioned below game board (like Match the Shapes)
-  **Hint System**: 10 hints by default, unlimited if shared
   -  Click "Hint" button to reveal a face name
   -  Hints continue from where they left off (next unmatched face)
   -  Share the game to unlock unlimited hints for 15 minutes
-  **Share Feature**: Share the game to unlock unlimited hints
   -  Click "Share for Unlimited Hints" button to copy a shareable link
   -  When someone else opens the shared link, the original sharer gets unlimited hints for 15 minutes
   -  The system uses a heartbeat mechanism (checks every 10 seconds) to detect when the link is clicked
   -  Hints automatically expire after 15 minutes and return to normal
-  Names are shuffled once per round (not continuously)
-  Keyboard controls for navigation and selection
-  Fully responsive design optimized for mobile, tablet, and desktop
-  Interactive example in game instructions section
-  Round repetition on wrong answer (same round restarts)

**Tips:**

-  Look for distinctive features on each face
-  Associate names with facial characteristics
-  Use hints strategically when stuck
-  Share the game to get unlimited hints if needed

**Recommended Settings:**

-  **Time Limit**: 90 seconds (overall game time)
-  **Passing Score**: 75 (75% of max score)
-  **Difficulty**: 2 (medium)

#### Color Grid Memory

```json
{
   "gameType": "color-grid-memory",
   "rounds": 20
}
```

**Configuration:**

-  `gameType` (required): Must be `"color-grid-memory"`
-  `rounds` (optional): Number of rounds - Default: **20** (recommended for 100 points max)

**Scoring:**

-  Score is calculated based on completed rounds: `Math.round((completedRounds / maxRounds) * 100)`
-  Maximum 100 points for 20 rounds
-  Score increases progressively with each completed round

**Controls:**

-  **Mouse**:
   -  Click on cells in the same order they appeared
-  **Keyboard**:
   -  **Number Keys (1-9, 0, -, =)**: Select cells by position in grid (1-12)
   -  **Arrow Keys** or **WASD**: Navigate through grid cells
   -  **Arrow Up/W**: Move selection up
   -  **Arrow Down/S**: Move selection down
   -  **Arrow Left/A**: Move selection left
   -  **Arrow Right/D**: Move selection right
   -  **Enter** or **Space**: Select currently highlighted cell

**Goal:**

-  Watch the colored cells flash on the grid one by one
-  After the sequence finishes, click the cells in the same order they appeared
-  Grid size and sequence length increase with each round
-  If you make a mistake, you can retry the same round (game doesn't end)

**How It Works:**

-  Each round displays a sequence of colored cells that flash one by one
-  Grid size increases: rounds 1-5 = 3x3, rounds 6-12 = 4x4, rounds 13+ = 5x5
-  Sequence length increases: starts at 3 cells, increases by 1 per round (Round 1 = 3, Round 2 = 4, ..., Round 20 = 22)
-  Each cell flashes with a different color from a palette of 6 colors
-  After the sequence completes, you must click cells in the same order
-  Wrong answers show red feedback but allow retry (game continues)

**Features:**

-  Progressive difficulty with increasing grid size and sequence length
-  Visual feedback with flash animation for active cells
-  Color palette with 6 distinct colors (blue, green, yellow, pink, purple, rose)
-  Notification messages like Match the Shapes (green for correct, red for wrong)
-  Modern UI with header showing round, score, and progress bar
-  Game state display (Watch the sequence…, Now click in the same order, Correct, Wrong)
-  **Number Badges on Cells**: Small number badges (1-9, 0, -, =) appear on each cell in input mode to indicate keyboard input options
   -  Badges are positioned in the top-left corner of each cell
   -  Styled with blue gradient background and white text
   -  Hidden if cell is already selected or has a hint
   -  Helps users identify which number key to press for keyboard input
-  **Hint System**: 10 hints by default, unlimited if shared
   -  Click "Hint" button to reveal the next correct cell position
   -  Hints continue from where they left off (next unrevealed position)
   -  Revealed positions stay visible (yellow border with number) until round ends
   -  Share the game to unlock unlimited hints for 15 minutes
-  **Share Feature**: Share the game to unlock unlimited hints
   -  Click "Share for Unlimited Hints" button to copy a shareable link
   -  **Share Success Message**: Shows "Link copied! Unlimited hints will unlock when someone opens your link!" for 15 seconds after sharing
   -  **Unlimited Hints Activated Message**: Shows "🎉 Someone opened your link! Unlimited hints is now active for 15 minutes!" for 15 seconds when link is clicked
   -  When someone else opens the shared link, the original sharer gets unlimited hints for 15 minutes
   -  The system uses a heartbeat mechanism (checks every 10 seconds) to detect when the link is clicked
   -  Hints automatically expire after 15 minutes and return to normal
-  Interactive example in game instructions section
-  Fully responsive design optimized for mobile, tablet, and desktop
-  Touch-optimized for mobile devices
-  Game continues on wrong answer (allows retry instead of ending)
-  Order indicators show which position you clicked (1, 2, 3, etc.)

**Tips:**

-  Focus on the order of cells, not just which cells were highlighted
-  Try to visualize the pattern as a path
-  Group cells mentally to remember longer sequences
-  Use hints strategically when stuck
-  Share the game to get unlimited hints if needed

**Recommended Settings:**

-  **Time Limit**: 0 (no time limit, focus on memory)
-  **Passing Score**: 75 (75% of max score)
-  **Difficulty**: 2 (medium)

#### Symbol Stack

```json
{
   "gameType": "symbol-stack",
   "rounds": 15
}
```

**Configuration:**

-  `gameType` (required): Must be `"symbol-stack"`
-  `rounds` (optional): Number of rounds - Default: **15** (recommended for 100 points max)

**Scoring:**

-  Score is calculated based on completed rounds: `Math.round((completedRounds / maxRounds) * 100)`
-  Maximum 100 points for 15 rounds
-  Score increases progressively with each completed round

**Controls:**

-  **Mouse**:
   -  Click on symbols in the same order they appeared (bottom to top)
-  **Keyboard**:
   -  **Number Keys (1-3)**: Select symbols by position in palette (1-3)
   -  **Arrow Keys** or **WASD**: Navigate through palette symbols
   -  **Arrow Up/W**: Move selection up
   -  **Arrow Down/S**: Move selection down
   -  **Arrow Left/A**: Move selection left
   -  **Arrow Right/D**: Move selection right
   -  **Enter** or **Space**: Select currently highlighted symbol

**Goal:**

-  Watch the symbols appear one by one, stacking from bottom to top
-  After the sequence finishes, click the symbols in the same order they appeared to rebuild the stack
-  Sequence length increases with each round
-  If you make a mistake, you can retry the same round (game doesn't end)

**How It Works:**

-  Each round displays a sequence of symbols (●, ■, ▲) that appear one by one
-  Symbols stack from bottom to top (first symbol is at the bottom)
-  Sequence length increases: starts at 3 symbols, increases by 1 per round (Round 1 = 3, Round 2 = 4, ..., Round 15 = 17)
-  After the sequence completes, you must click symbols in the same order (bottom to top)
-  Palette shows all symbols from the sequence in shuffled order
-  Wrong answers show red feedback but allow retry (game continues)

**Features:**

-  Progressive difficulty with increasing sequence length
-  Visual feedback with flash animation for active symbols
-  Three distinct symbols (●, ■, ▲) for clear differentiation
-  Stack display from bottom to top (flex-direction: column-reverse)
-  Notification messages like Match the Shapes (green for correct, red for wrong)
-  Modern UI with header showing round, score, and progress bar
-  Game state display (Watch the symbols stack up..., Rebuild the stack from bottom to top, Correct, Wrong)
-  **Hint System**: 10 hints by default, unlimited if shared
   -  Click "Hint" button to reveal the next correct symbol position
   -  Hints continue from where they left off (next unrevealed position)
   -  Revealed positions stay visible (yellow border) until round ends
   -  Share the game to unlock unlimited hints for 15 minutes
-  **Share Feature**: Share the game to unlock unlimited hints
   -  Click "Share for Unlimited Hints" button to copy a shareable link
   -  **Share Success Message**: Shows "Link copied! Unlimited hints will unlock when someone opens your link!" for 15 seconds after sharing
   -  **Unlimited Hints Activated Message**: Shows "🎉 Someone opened your link! Unlimited hints is now active for 15 minutes!" for 15 seconds when link is clicked
   -  When someone else opens the shared link, the original sharer gets unlimited hints for 15 minutes
   -  The system uses a heartbeat mechanism (checks every 10 seconds) to detect when the link is clicked
   -  Hints automatically expire after 15 minutes and return to normal
-  Interactive example in game instructions section
-  Fully responsive design optimized for mobile, tablet, and desktop
-  Touch-optimized for mobile devices
-  Game continues on wrong answer (allows retry instead of ending)
-  Keyboard controls for navigation and selection

**Tips:**

-  Think bottom → top. Create a visual story to remember the order
-  Focus on the sequence, not just which symbols appeared
-  Use hints strategically when stuck
-  Share the game to get unlimited hints if needed

**Recommended Settings:**

-  **Time Limit**: 0 (no time limit, focus on memory)
-  **Passing Score**: 75 (75% of max score)
-  **Difficulty**: 2 (medium)

#### Block Fill

```json
{
   "gameType": "block-fill",
   "rounds": 20,
   "gridSize": 6
}
```

**Configuration:**

-  `gameType` (required): Must be `"block-fill"`
-  `rounds` (optional): Number of rounds - Default: **20** (recommended for 100 points max)
-  `gridSize` (optional): Base size of the grid - Default: **6** (6x6 grid)
   -  Grid size varies by round: rounds 1-5 = 5x5, rounds 6-10 = 6x6, rounds 11-20 = 7x7
   -  The game automatically adjusts grid size per round for progressive difficulty

**Scoring:**

-  5 points per correct round (when all pieces are placed and grid is filled)
-  Maximum 100 points for 20 rounds

**Controls:**

-  **Mouse**:
   -  Click on a piece in the pieces panel to select it
   -  Move mouse over grid to see ghost preview (blue = valid placement, red = invalid)
   -  Click on grid cell to place selected piece
   -  Click on placed piece to remove it
-  **Keyboard**:
   -  **R**: Rotate selected piece (90° clockwise)
   -  **U**: Undo last placement
   -  **ESC**: Deselect current piece

**Goal:**

-  Fill the entire grid using all provided polyomino pieces
-  Pieces cannot overlap
-  Pieces must fit completely within the grid
-  All pieces must be used to complete the round
-  Pieces are selected to exactly match grid area (solvable puzzles)

**How It Works:**

-  Each round presents a grid (5x5, 6x6, or 7x7) and a set of polyomino pieces
-  Polyomino pieces are shapes made of connected squares (like Tetris pieces)
-  The total area of all pieces exactly matches the grid area, ensuring the puzzle is solvable
-  Pieces can be rotated 90° at a time (4 possible rotations)
-  Ghost preview shows where the selected piece will be placed (blue = valid, red = invalid)
-  Each placed piece gets a unique color for visual clarity

**Features:**

-  Dynamic grid sizes (5x5, 6x6, 7x7) based on round number
-  Ghost preview showing valid/invalid placement areas (follows mouse)
-  Piece rotation (4 rotations: 0°, 90°, 180°, 270°)
-  Undo functionality to remove last placed piece
-  Unique colors for each placed piece for visual clarity
-  Pre-game explanation with instructions and tips
-  Visual feedback matching other games (correct messages)
-  Pieces are guaranteed to fit exactly (total area matches grid)
-  Modern UI with header showing round, score, and progress

**Tips:**

-  Start with larger pieces first
-  Build from corners and edges
-  Use rotation to fit pieces better
-  If stuck, remove pieces and try different placements
-  Pay attention to the ghost preview to avoid invalid placements

**Recommended Settings:**

-  **Time Limit**: 120 seconds (overall game time)
-  **Passing Score**: 80 (80% of max score)
-  **Difficulty**: 3 (medium-hard)

#### Ball Balance

```json
{
   "gameType": "ball-balance",
   "levels": 15,
   "levelRequirements": [
      { "minTimeInCenter": 3, "duration": 10 },
      { "minTimeInCenter": 4, "duration": 10 },
      { "minTimeInCenter": 5, "duration": 12 },
      { "minTimeInCenter": 6, "duration": 15 },
      { "minTimeInCenter": 7, "duration": 18 },
      {
         "minTimeInCenter": 8,
         "duration": 18,
         "shrinkingPlatform": true,
         "shrinkMinScale": 0.1,
         "shrinkDelay": 0
      },
      {
         "minTimeInCenter": 9,
         "duration": 10,
         "shrinkingPlatform": true,
         "shrinkMinScale": 0.3,
         "shrinkDelay": 0
      },
      {
         "minTimeInCenter": 10,
         "duration": 18,
         "redZones": [
            { "start": -100, "end": -60 },
            { "start": 60, "end": 100 }
         ]
      },
      {
         "minTimeInCenter": 11,
         "duration": 18,
         "redZones": [
            { "start": -90, "end": -50 },
            { "start": 50, "end": 90 }
         ]
      },
      {
         "minTimeInCenter": 12,
         "duration": 30,
         "shrinkingPlatform": true,
         "shrinkMinScale": 0.4,
         "redZones": [
            { "start": -85, "end": -45 },
            { "start": 45, "end": 85 }
         ]
      },
      {
         "minTimeInCenter": 13,
         "duration": 30,
         "platformShake": true,
         "shakeInterval": 6,
         "shakeIntensity": 12,
         "shakeDuration": 1.1,
         "shakeFrequency": 13,
         "shakeAngle": 10
      },
      {
         "minTimeInCenter": 14,
         "duration": 25,
         "platformShake": true,
         "shakeInterval": 5,
         "shakeIntensity": 13,
         "shakeDuration": 1,
         "shakeFrequency": 14,
         "shakeAngle": 15
      },
      {
         "minTimeInCenter": 15,
         "duration": 50,
         "windZones": [
            { "start": -80, "end": -40, "force": -80 },
            { "start": 40, "end": 80, "force": 80 }
         ]
      },
      {
         "minTimeInCenter": 16,
         "duration": 50,
         "platformShake": true,
         "shakeInterval": 4,
         "shakeIntensity": 14,
         "shakeDuration": 1,
         "shakeFrequency": 15,
         "shakeAngle": 16,
         "windZones": [
            { "start": -75, "end": -35, "force": -90 },
            { "start": 35, "end": 75, "force": 90 }
         ]
      },
      {
         "minTimeInCenter": 20,
         "duration": 50,
         "shrinkingPlatform": true,
         "shrinkMinScale": 0.35,
         "redZones": [
            { "start": -70, "end": -30 },
            { "start": 30, "end": 70 }
         ],
         "platformShake": true,
         "shakeInterval": 3,
         "shakeIntensity": 16,
         "shakeDuration": 1.1,
         "shakeFrequency": 16,
         "shakeAngle": 18,
         "windZones": [
            { "start": -65, "end": -25, "force": -110 },
            { "start": 25, "end": 65, "force": 110 }
         ]
      }
   ]
}
```

#### Target Aim

```json
{
   "gameType": "target-aim",
   "levels": 15,
   "levelRequirements": [
      { "minTargetsHit": 5, "duration": 20 },
      { "minTargetsHit": 7, "duration": 20 },
      { "minTargetsHit": 9, "duration": 20 },
      { "minTargetsHit": 11, "duration": 20 },
      { "minTargetsHit": 13, "duration": 20 },
      { "minTargetsHit": 15, "duration": 20, "movingTargets": true },
      { "minTargetsHit": 17, "duration": 20, "movingTargets": true },
      { "minTargetsHit": 19, "duration": 20, "multipleTargets": true },
      {
         "minTargetsHit": 21,
         "duration": 20,
         "movingTargets": true,
         "multipleTargets": true
      },
      { "minTargetsHit": 23, "duration": 20, "shrinkingTargets": true },
      {
         "minTargetsHit": 25,
         "duration": 20,
         "movingTargets": true,
         "shrinkingTargets": true
      },
      {
         "minTargetsHit": 27,
         "duration": 20,
         "multipleTargets": true,
         "shrinkingTargets": true
      },
      {
         "minTargetsHit": 29,
         "duration": 20,
         "movingTargets": true,
         "multipleTargets": true,
         "shrinkingTargets": true
      },
      {
         "minTargetsHit": 31,
         "duration": 20,
         "movingTargets": true,
         "multipleTargets": true,
         "shrinkingTargets": true
      },
      {
         "minTargetsHit": 35,
         "duration": 20,
         "movingTargets": true,
         "multipleTargets": true,
         "shrinkingTargets": true
      }
   ]
}
```

**Description:**

Aim and hit targets with precision across 15 progressively challenging levels. Move the target icon (crosshair) with keyboard (WASD/Arrow keys) or mouse, and hit targets when they are near the center.

**Scoring:**

-  Score is calculated based on completed levels: `completedLevels * (100 / maxLevels)`
-  Level 1 = 6.67 points, Level 2 = 13.33 points, Level 3 = 20 points, etc.
-  Maximum 100 points for 15 levels

**Controls:**

-  **Mouse**: Move mouse to control the target icon (crosshair), click on targets to hit them
-  **Keyboard**:
   -  **W, A, S, D** or **Arrow Keys**: Move the target icon (crosshair) around the arena
   -  **Enter** or **Space**: Hit the target nearest to the target icon when it's within range

**Goal:**

-  Move the target icon (crosshair) to aim at targets

#### Speed Drawing

```json
{
   "gameType": "speed-drawing",
   "levels": 15,
   "levelDefinitions": [
      { "duration": 20, "targetShape": "circle", "minAccuracy": 60 },
      { "duration": 20, "targetShape": "square", "minAccuracy": 62 },
      { "duration": 18, "targetShape": "triangle", "minAccuracy": 65 },
      { "duration": 18, "targetShape": "star", "minAccuracy": 67 },
      { "duration": 16, "targetShape": "heart", "minAccuracy": 70 },
      { "duration": 16, "targetShape": "wave", "minAccuracy": 72 },
      { "duration": 15, "targetShape": "curve", "minAccuracy": 75 },
      { "duration": 15, "targetShape": "zigzag", "minAccuracy": 77 },
      { "duration": 14, "targetShape": "circle", "minAccuracy": 78 },
      { "duration": 14, "targetShape": "square", "minAccuracy": 80 },
      { "duration": 13, "targetShape": "triangle", "minAccuracy": 82 },
      { "duration": 13, "targetShape": "star", "minAccuracy": 83 },
      { "duration": 12, "targetShape": "heart", "minAccuracy": 84 },
      { "duration": 12, "targetShape": "wave", "minAccuracy": 85 },
      { "duration": 10, "targetShape": "spiral", "minAccuracy": 85 }
   ]
}
```

**Description:**

Draw target shapes as accurately as possible within the time limit. Each level has a specific shape to draw (circle, square, triangle, star, heart, wave, curve, zigzag, spiral) with increasing accuracy requirements.

**Scoring:**

-  Score is calculated based on completed levels: `completedLevels * (100 / maxLevels)`
-  Level 1 = 6.67 points, Level 2 = 13.33 points, Level 3 = 20 points, etc.
-  Maximum 100 points for 15 levels

**Controls:**

-  **Mouse/Touch**: Click and hold, then drag to draw the shape
-  **Keyboard**: Not applicable (drawing requires mouse/touch input)

**Goal:**

-  Draw the target shape shown on screen as accurately as possible
-  Meet the minimum accuracy requirement for each level
-  Complete the drawing within the time limit

#### One-Hand Mode

```json
{
   "gameType": "one-hand-mode",
   "levels": 15,
   "levelRequirements": [
      { "duration": 6, "speed": 260, "spawnInterval": 1.1 },
      { "duration": 5.85, "speed": 290, "spawnInterval": 1.067 },
      { "duration": 5.7, "speed": 320, "spawnInterval": 1.034 },
      { "duration": 5.55, "speed": 350, "spawnInterval": 1.001 },
      { "duration": 5.4, "speed": 380, "spawnInterval": 0.968 },
      { "duration": 5.1, "speed": 410, "spawnInterval": 0.902 },
      { "duration": 4.95, "speed": 440, "spawnInterval": 0.869 },
      { "duration": 4.8, "speed": 470, "spawnInterval": 0.836 },
      { "duration": 4.65, "speed": 500, "spawnInterval": 0.803 },
      { "duration": 4.5, "speed": 530, "spawnInterval": 0.77 },
      { "duration": 4.4, "speed": 560, "spawnInterval": 0.737 },
      { "duration": 4.25, "speed": 590, "spawnInterval": 0.704 },
      { "duration": 4.1, "speed": 620, "spawnInterval": 0.671 },
      { "duration": 3.95, "speed": 650, "spawnInterval": 0.638 },
      { "duration": 3.8, "speed": 680, "spawnInterval": 0.6 }
   ]
}
```

**Description:**

Control a character that runs automatically through an endless runner. Jump over obstacles using a single input (click, tap, or spacebar). Test your timing and reflexes across 15 progressively challenging levels with increasing speed, shorter durations, and more frequent obstacles.

**Scoring:**

-  Score is calculated based on completed levels: `completedLevels * (100 / maxLevels)`
-  Level 1 = 6.67 points, Level 2 = 13.33 points, Level 3 = 20 points, etc.
-  Maximum 100 points for 15 levels

**Controls:**

-  **Mouse**: Click to jump
-  **Touch**: Tap to jump
-  **Keyboard**: Press SPACEBAR to jump

**Goal:**

-  Survive until the timer runs out by jumping over obstacles
-  Avoid hitting any obstacles (hitting one ends the level)
-  Complete all 15 levels to finish the game
-  Hit targets when they are within range of the crosshair
-  Complete all 15 levels by hitting the required number of targets

**Level Progression:**

-  **Levels 1-5**: Static targets, increasing minimum hits (5-13)
-  **Levels 6-7**: Moving targets introduced
-  **Levels 8-9**: Multiple simultaneous targets
-  **Levels 10+**: Shrinking targets, moving targets, and multiple targets combined

**Features:**

-  **Moving Targets**: Targets move around the arena (levels 6+)
-  **Multiple Targets**: Multiple targets appear simultaneously (levels 8+)
-  **Shrinking Targets**: Targets shrink over time (levels 10+)
-  **Progressive Difficulty**: Each level increases minimum hits and adds new challenges

#### Cursor Maze

```json
{
   "gameType": "cursor-maze",
   "levels": 15,
   "levelRequirements": [
      { "duration": 60 },
      { "duration": 58 },
      { "duration": 56 },
      { "duration": 54 },
      { "duration": 52 },
      { "duration": 48 },
      { "duration": 46 },
      { "duration": 44 },
      { "duration": 42 },
      { "duration": 40 },
      { "duration": 38 },
      { "duration": 36 },
      { "duration": 34 },
      { "duration": 32 },
      { "duration": 30 }
   ]
}
```

**Description:**

Navigate a blue square through a procedurally generated maze to reach the green exit. Avoid touching walls - if you hit a wall, you'll stay at your current position (no reset to start). The game has 15 levels with increasing difficulty (larger mazes and shorter time limits).

**Scoring:**

-  Score is calculated based on completed levels: `completedLevels * (100 / maxLevels)`
-  Level 1 = 6.67 points, Level 2 = 13.33 points, Level 3 = 20 points, etc.
-  Maximum 100 points for 15 levels

**Controls:**

-  **Mouse**: Move mouse to control the blue square
-  **Touch**: Drag finger on mobile to control the square
-  **Keyboard**: Use WASD keys (W=Up, A=Left, S=Down, D=Right) or Arrow keys to move the square

**Goal:**

-  Navigate from the blue START area to the green EXIT area
-  Avoid touching walls - hitting a wall keeps you at your current position
-  Complete the maze before time runs out
-  Complete all 15 levels to finish the game

**Level Progression:**

-  **Levels 1-5**: Smaller mazes (13-17 grid size), longer duration (60-52 seconds), fewer walls
-  **Levels 6-10**: Medium mazes (15-19 grid size), moderate duration (48-40 seconds), more walls
-  **Levels 11-15**: Larger mazes (18-22 grid size), shorter duration (38-30 seconds), many walls

**Features:**

-  **Procedurally Generated Mazes**: Each maze is unique, generated using Depth-First Search (DFS) algorithm
-  **Solid Wall Collision**: Walls are solid - you cannot pass through them
-  **Progressive Difficulty**: Grid size increases from 13x13 to 22x22, with more walls and less time
-  **Visual Feedback**: Blue START area, green EXIT area with "EXIT" text, and clear wall boundaries
-  **Multiple Control Methods**: Mouse, touch, or keyboard (WASD/Arrow keys)
-  **No Reset on Wall Hit**: Hitting a wall keeps you at your current position instead of resetting to start

**Tips:**

-  Move slowly and carefully - precision beats speed!
-  Plan your path before moving
-  Keep the square centered in corridors
-  On mobile, use touch and drag
-  Lift your finger to pause movement
-  The maze is procedurally generated, so each attempt is unique!

#### Line Tracer

```json
{
   "gameType": "line-tracer",
   "levels": 15,
   "levelRequirements": [
      {
         "minAccuracy": 40,
         "minProgress": 80,
         "duration": 60,
         "pathType": "smooth",
         "complexity": 3,
         "pathLength": 12
      },
      {
         "minAccuracy": 45,
         "minProgress": 82,
         "duration": 60,
         "pathType": "smooth",
         "complexity": 3,
         "pathLength": 12
      },
      {
         "minAccuracy": 50,
         "minProgress": 84,
         "duration": 60,
         "pathType": "smooth",
         "complexity": 4,
         "pathLength": 11
      },
      {
         "minAccuracy": 52,
         "minProgress": 85,
         "duration": 62,
         "pathType": "smooth",
         "complexity": 4,
         "pathLength": 11
      },
      {
         "minAccuracy": 55,
         "minProgress": 86,
         "duration": 80,
         "pathType": "zigzag",
         "complexity": 5,
         "pathLength": 10
      },
      {
         "minAccuracy": 60,
         "minProgress": 87,
         "duration": 100,
         "pathType": "zigzag",
         "complexity": 5,
         "pathLength": 10
      },
      {
         "minAccuracy": 62,
         "minProgress": 88,
         "duration": 110,
         "pathType": "zigzag",
         "complexity": 6,
         "pathLength": 9
      },
      {
         "minAccuracy": 65,
         "minProgress": 89,
         "duration": 130,
         "pathType": "spiral",
         "complexity": 6,
         "pathLength": 9
      },
      {
         "minAccuracy": 65,
         "minProgress": 90,
         "duration": 140,
         "pathType": "spiral",
         "complexity": 7,
         "pathLength": 8
      },
      {
         "minAccuracy": 70,
         "minProgress": 91,
         "duration": 130,
         "pathType": "circle",
         "complexity": 7,
         "pathLength": 8
      },
      {
         "minAccuracy": 75,
         "minProgress": 92,
         "duration": 140,
         "pathType": "smooth",
         "complexity": 8,
         "pathLength": 8
      },
      {
         "minAccuracy": 75,
         "minProgress": 93,
         "duration": 160,
         "pathType": "zigzag",
         "complexity": 8,
         "pathLength": 8
      },
      {
         "minAccuracy": 80,
         "minProgress": 94,
         "duration": 180,
         "pathType": "spiral",
         "complexity": 9,
         "pathLength": 7
      },
      {
         "minAccuracy": 82,
         "minProgress": 95,
         "duration": 200,
         "pathType": "circle",
         "complexity": 9,
         "pathLength": 7
      },
      {
         "minAccuracy": 85,
         "minProgress": 95,
         "duration": 220,
         "pathType": "smooth",
         "complexity": 10,
         "pathLength": 7
      }
   ]
}
```

**Description:**

Trace paths with precision across 15 progressively challenging levels. Use your mouse or touch to follow the blue line as accurately as possible. Features include different path types (smooth, zigzag, spiral, circle) and increasing accuracy requirements.

**Configuration:**

-  `gameType` (required): Must be `"line-tracer"`
-  `levels` (optional): Number of levels - Default: **15**
-  `levelRequirements` (required): Array of requirements for each level
   -  Each level must have:
      -  `minAccuracy`: Minimum accuracy percentage required (0-100)
      -  `minProgress`: Minimum progress percentage required (0-100)
      -  `duration`: Duration per level in seconds
      -  `pathType`: Type of path - `"smooth"`, `"zigzag"`, `"spiral"`, or `"circle"`
      -  `complexity`: Path complexity (higher = more complex curves)
      -  `pathLength`: Path length multiplier

**Level Progression:**

-  **Levels 1-4**: Smooth paths, accuracy 40-52%, progress 80-85%
-  **Levels 5-7**: Zigzag paths, accuracy 55-62%, progress 86-88%
-  **Levels 8-9**: Spiral paths, accuracy 65%, progress 89-90%
-  **Levels 10+**: Circle and complex paths, accuracy 70-85%, progress 91-95%

**Scoring:**

-  Score is calculated based on completed levels: `Math.round((completedLevels / maxLevels) * 100)`
-  Maximum 100 points for completing all 15 levels

**Controls:**

-  **Mouse/Touch**: Click and drag to trace the path
-  **Keyboard**: Not applicable (mouse/touch only)

**Goal:**

-  Follow the blue path as accurately as possible
-  Meet both accuracy and progress requirements to pass each level
-  Complete all 15 levels with increasing difficulty

**Features:**

-  **Path Types**: Smooth curves, zigzag patterns, spirals, and circles
-  **Progressive Difficulty**: Accuracy and progress requirements increase each level
-  **Visual Feedback**: Real-time accuracy and progress tracking
-  **Path Complexity**: Higher complexity means more challenging curves

#### Timing Bar

```json
{
   "gameType": "timing-bar",
   "levels": 15,
   "levelRequirements": [
      { "minStops": 3, "duration": 30, "targetZoneWidth": 20, "barSpeed": 1.2 },
      { "minStops": 3, "duration": 30, "targetZoneWidth": 19, "barSpeed": 1.3 },
      { "minStops": 4, "duration": 30, "targetZoneWidth": 18, "barSpeed": 1.4 },
      { "minStops": 4, "duration": 30, "targetZoneWidth": 17, "barSpeed": 1.5 },
      { "minStops": 4, "duration": 30, "targetZoneWidth": 16, "barSpeed": 1.6 },
      { "minStops": 5, "duration": 30, "targetZoneWidth": 15, "barSpeed": 1.7 },
      { "minStops": 5, "duration": 30, "targetZoneWidth": 14, "barSpeed": 1.8 },
      { "minStops": 5, "duration": 30, "targetZoneWidth": 13, "barSpeed": 1.9 },
      { "minStops": 6, "duration": 30, "targetZoneWidth": 12, "barSpeed": 2.0 },
      { "minStops": 6, "duration": 30, "targetZoneWidth": 11, "barSpeed": 2.1 },
      { "minStops": 6, "duration": 30, "targetZoneWidth": 10, "barSpeed": 2.2 },
      { "minStops": 7, "duration": 30, "targetZoneWidth": 9, "barSpeed": 2.3 },
      { "minStops": 7, "duration": 30, "targetZoneWidth": 9, "barSpeed": 2.4 },
      { "minStops": 8, "duration": 30, "targetZoneWidth": 8, "barSpeed": 2.4 },
      { "minStops": 8, "duration": 30, "targetZoneWidth": 8, "barSpeed": 2.5 }
   ]
}
```

**Description:**

Stop the moving bar at the highlighted green zone. Test your timing and precision across 15 progressively challenging levels with increasing speed and smaller target zones.

**Configuration:**

-  `gameType` (required): Must be `"timing-bar"`
-  `levels` (optional): Number of levels - Default: **15**
-  `levelRequirements` (required): Array of requirements for each level
   -  Each level must have:
      -  `minStops`: Minimum number of successful stops required
      -  `duration`: Duration per level in seconds
      -  `targetZoneWidth`: Width of the target zone (percentage, smaller = harder)
      -  `barSpeed`: Speed multiplier for the moving bar (higher = faster)

**Level Progression:**

-  **Levels 1-2**: 3 stops, target zone 20-19%, speed 1.2-1.3
-  **Levels 3-5**: 4 stops, target zone 18-16%, speed 1.4-1.6
-  **Levels 6-8**: 5 stops, target zone 15-13%, speed 1.7-1.9
-  **Levels 9-11**: 6 stops, target zone 12-10%, speed 2.0-2.2
-  **Levels 12-15**: 7-8 stops, target zone 9-8%, speed 2.3-2.5

**Scoring:**

-  Score is calculated based on completed levels: `Math.round((completedLevels / maxLevels) * 100)`
-  Maximum 100 points for completing all 15 levels

**Controls:**

-  **Mouse**: Click when the bar is in the green zone
-  **Keyboard**: Press **Enter** or **Space** when the bar is in the green zone

**Goal:**

-  Stop the moving bar when it's in the green target zone
-  Complete the required number of successful stops within the time limit
-  Complete all 15 levels with increasing difficulty

**Features:**

-  **Moving Bar**: Bar moves back and forth automatically
-  **Target Zone**: Green highlighted zone indicates where to stop
-  **Progressive Difficulty**: Smaller target zones and faster bar speed each level
-  **Visual Feedback**: Immediate feedback for successful/failed stops

#### Stack Blocks

```json
{
   "gameType": "stack-blocks",
   "levels": 15,
   "levelRequirements": [
      {
         "minBlocks": 5,
         "duration": 30,
         "blockSpeed": 0.5,
         "initialBlockWidth": 50,
         "widthReduction": 2
      },
      {
         "minBlocks": 5,
         "duration": 30,
         "blockSpeed": 0.6,
         "initialBlockWidth": 48,
         "widthReduction": 2
      },
      {
         "minBlocks": 6,
         "duration": 30,
         "blockSpeed": 0.7,
         "initialBlockWidth": 46,
         "widthReduction": 1.9
      },
      {
         "minBlocks": 6,
         "duration": 30,
         "blockSpeed": 0.8,
         "initialBlockWidth": 44,
         "widthReduction": 1.9
      },
      {
         "minBlocks": 7,
         "duration": 30,
         "blockSpeed": 0.9,
         "initialBlockWidth": 42,
         "widthReduction": 1.8
      },
      {
         "minBlocks": 7,
         "duration": 30,
         "blockSpeed": 1.0,
         "initialBlockWidth": 40,
         "widthReduction": 1.8
      },
      {
         "minBlocks": 8,
         "duration": 30,
         "blockSpeed": 1.1,
         "initialBlockWidth": 38,
         "widthReduction": 1.7
      },
      {
         "minBlocks": 8,
         "duration": 30,
         "blockSpeed": 1.2,
         "initialBlockWidth": 36,
         "widthReduction": 1.7
      },
      {
         "minBlocks": 9,
         "duration": 30,
         "blockSpeed": 1.3,
         "initialBlockWidth": 34,
         "widthReduction": 1.6
      },
      {
         "minBlocks": 9,
         "duration": 30,
         "blockSpeed": 1.4,
         "initialBlockWidth": 32,
         "widthReduction": 1.6
      },
      {
         "minBlocks": 10,
         "duration": 30,
         "blockSpeed": 1.4,
         "initialBlockWidth": 32,
         "widthReduction": 1.5
      },
      {
         "minBlocks": 10,
         "duration": 30,
         "blockSpeed": 1.5,
         "initialBlockWidth": 30,
         "widthReduction": 1.5
      },
      {
         "minBlocks": 11,
         "duration": 30,
         "blockSpeed": 1.5,
         "initialBlockWidth": 30,
         "widthReduction": 1.5
      },
      {
         "minBlocks": 11,
         "duration": 30,
         "blockSpeed": 1.5,
         "initialBlockWidth": 30,
         "widthReduction": 1.5
      },
      {
         "minBlocks": 12,
         "duration": 30,
         "blockSpeed": 1.5,
         "initialBlockWidth": 30,
         "widthReduction": 1.5
      }
   ]
}
```

**Description:**

Stack blocks as evenly as possible. Click on the moving green block to place it on the stack. Align blocks as close to center as possible to pass each level. Each block placed reduces in width based on overlap with the block below.

**Configuration:**

-  `gameType` (required): Must be `"stack-blocks"`
-  `levels` (optional): Number of levels - Default: **15**
-  `levelRequirements` (required): Array of requirements for each level
   -  Each level must have:
      -  `minBlocks`: Minimum number of blocks to place successfully
      -  `duration`: Duration per level in seconds
      -  `blockSpeed`: Speed multiplier for the moving block (higher = faster)
      -  `initialBlockWidth`: Initial width of the first block (percentage of canvas width)
      -  `widthReduction`: Amount to reduce block width per placement (pixels)

**Level Progression:**

-  **Levels 1-2**: 5 blocks, speed 0.5-0.6, initial width 50-48%
-  **Levels 3-4**: 6 blocks, speed 0.7-0.8, initial width 46-44%
-  **Levels 5-6**: 7 blocks, speed 0.9-1.0, initial width 42-40%
-  **Levels 7-8**: 8 blocks, speed 1.1-1.2, initial width 38-36%
-  **Levels 9-10**: 9 blocks, speed 1.3-1.4, initial width 34-32%
-  **Levels 11-15**: 10-12 blocks, speed 1.4-1.5, initial width 32-30%

**Scoring:**

-  Score is calculated based on completed levels: `Math.round((completedLevels / maxLevels) * 100)`
-  Maximum 100 points for completing all 15 levels

**Controls:**

-  **Mouse**: Click on the moving block to place it
-  **Keyboard**: Press **Enter** or **Space** to place the block

**Goal:**

-  Place blocks on top of each other, aligning them as closely as possible
-  Place the minimum number of blocks required within the time limit
-  Complete all 15 levels with increasing difficulty

**Features:**

-  **Overlap Logic**: Blocks reduce in width based on overlap with the block below
-  **Perfect Snap**: Blocks snap to exact position if placed very close (within tolerance)
-  **Progressive Difficulty**: Faster block speed and smaller initial width each level
-  **Canvas Rendering**: Smooth animation using Canvas API and requestAnimationFrame

#### Precision Drop

```json
{
   "gameType": "precision-drop",
   "levels": 15,
   "levelRequirements": [
      {
         "drops": 1,
         "duration": 30,
         "targetWidth": 160,
         "targetSpeed": 0,
         "shakeEnabled": false,
         "minHits": 1
      },
      {
         "drops": 1,
         "duration": 30,
         "targetWidth": 148,
         "targetSpeed": 0,
         "shakeEnabled": false,
         "minHits": 1
      },
      {
         "drops": 1,
         "duration": 30,
         "targetWidth": 136,
         "targetSpeed": 0,
         "shakeEnabled": false,
         "minHits": 1
      },
      {
         "drops": 1,
         "duration": 30,
         "targetWidth": 124,
         "targetSpeed": 0,
         "shakeEnabled": false,
         "minHits": 1
      },
      {
         "drops": 3,
         "duration": 30,
         "targetWidth": 112,
         "targetSpeed": 210,
         "shakeEnabled": false,
         "minHits": 2
      },
      {
         "drops": 3,
         "duration": 30,
         "targetWidth": 100,
         "targetSpeed": 228,
         "shakeEnabled": false,
         "minHits": 2
      },
      {
         "drops": 3,
         "duration": 30,
         "targetWidth": 88,
         "targetSpeed": 246,
         "shakeEnabled": false,
         "minHits": 2
      },
      {
         "drops": 3,
         "duration": 30,
         "targetWidth": 76,
         "targetSpeed": 264,
         "shakeEnabled": false,
         "minHits": 2
      },
      {
         "drops": 3,
         "duration": 30,
         "targetWidth": 64,
         "targetSpeed": 282,
         "shakeEnabled": false,
         "minHits": 2
      },
      {
         "drops": 5,
         "duration": 30,
         "targetWidth": 52,
         "targetSpeed": 300,
         "shakeEnabled": true,
         "minHits": 3
      },
      {
         "drops": 5,
         "duration": 30,
         "targetWidth": 40,
         "targetSpeed": 318,
         "shakeEnabled": true,
         "minHits": 3
      },
      {
         "drops": 5,
         "duration": 30,
         "targetWidth": 32,
         "targetSpeed": 336,
         "shakeEnabled": true,
         "minHits": 3
      },
      {
         "drops": 5,
         "duration": 30,
         "targetWidth": 28,
         "targetSpeed": 354,
         "shakeEnabled": true,
         "minHits": 3
      },
      {
         "drops": 5,
         "duration": 30,
         "targetWidth": 26,
         "targetSpeed": 372,
         "shakeEnabled": true,
         "minHits": 3
      },
      {
         "drops": 5,
         "duration": 30,
         "targetWidth": 24,
         "targetSpeed": 390,
         "shakeEnabled": true,
         "minHits": 3
      }
   ]
}
```

**Description:**

Drop object into small target area. Move the object left/right, then click to drop it. Land fully inside the target to score. Each level has multiple drops (mini levels) that must be completed.

**Configuration:**

-  `gameType` (required): Must be `"precision-drop"`
-  `levels` (optional): Number of levels - Default: **15**
-  `levelRequirements` (required): Array of requirements for each level
   -  Each level must have:
      -  `drops`: Number of drops (mini levels) per level
      -  `duration`: Duration per level in seconds
      -  `targetWidth`: Width of the target area in pixels (smaller = harder)
      -  `targetSpeed`: Speed of target movement in px/s (0 = static, >0 = moving)
      -  `shakeEnabled`: Whether platform shakes while object is falling (true/false)
      -  `minHits`: Minimum number of successful hits required to pass

**Level Progression:**

-  **Levels 1-4**: 1 drop, static target, width 160-124px
-  **Levels 5-9**: 3 drops, moving target, width 112-64px, speed 210-282 px/s
-  **Levels 10-15**: 5 drops, moving target + shake, width 52-24px, speed 300-390 px/s

**Scoring:**

-  Score is calculated based on completed levels: `Math.round((completedLevels / maxLevels) * 100)`
-  Maximum 100 points for completing all 15 levels

**Controls:**

-  **Mouse**: Move mouse left/right to position object, click to drop
-  **Keyboard**: **Arrow Left/Right** to move, **Enter** or **Space** to drop

**Goal:**

-  Position the object above the target
-  Drop it so it lands fully inside the target area
-  Complete the minimum number of successful hits within the time limit
-  Complete all 15 levels with increasing difficulty

**Features:**

-  **Multiple Drops**: Each level has multiple drops (mini levels) to complete
-  **Moving Target**: Target moves automatically from level 5+
-  **Platform Shake**: Platform shakes while object falls from level 10+
-  **Progressive Difficulty**: Smaller target, faster movement, and shake effects
-  **Physics Simulation**: Realistic gravity and falling mechanics

#### Drag & Drop Sort

```json
{
   "gameType": "drag-sort",
   "levels": 15,
   "levelDefinitions": [
      {
         "duration": 45,
         "penaltySec": 0,
         "minCorrect": 6,
         "categories": [
            {
               "id": "red",
               "label": "🔴",
               "color": "rgba(239, 68, 68, 0.25)",
               "items": ["🔴", "🟥", "❤️", "🍎"]
            },
            {
               "id": "blue",
               "label": "🔵",
               "color": "rgba(59, 130, 246, 0.25)",
               "items": ["🔵", "🟦", "💙", "🧊"]
            }
         ]
      },
      {
         "duration": 45,
         "penaltySec": 0,
         "minCorrect": 6,
         "categories": [
            {
               "id": "circle",
               "label": "⚪",
               "color": "rgba(148, 163, 184, 0.25)",
               "items": ["⚪", "⚫", "🔘", "⭕"]
            },
            {
               "id": "square",
               "label": "⬜",
               "color": "rgba(203, 213, 225, 0.25)",
               "items": ["⬜", "⬛", "◻️", "◼️"]
            }
         ]
      },
      {
         "duration": 40,
         "penaltySec": 0,
         "minCorrect": 6,
         "categories": [
            {
               "id": "big",
               "label": "🐘",
               "color": "rgba(34, 197, 94, 0.22)",
               "items": ["🐘", "🚌", "🏠", "🐋"]
            },
            {
               "id": "small",
               "label": "🐭",
               "color": "rgba(168, 85, 247, 0.22)",
               "items": ["🐭", "🐜", "🍬", "🧸"]
            }
         ]
      },
      {
         "duration": 40,
         "penaltySec": 0,
         "minCorrect": 6,
         "categories": [
            {
               "id": "fruits",
               "label": "🍎",
               "color": "rgba(234, 88, 12, 0.25)",
               "items": ["🍎", "🍌", "🍇", "🍉"]
            },
            {
               "id": "animals",
               "label": "🐶",
               "color": "rgba(59, 130, 246, 0.25)",
               "items": ["🐶", "🐱", "🐵", "🐯"]
            }
         ]
      },
      {
         "duration": 35,
         "penaltySec": 0,
         "minCorrect": 6,
         "categories": [
            {
               "id": "tools",
               "label": "🔧",
               "color": "rgba(148, 163, 184, 0.25)",
               "items": ["🔧", "🔨", "🧰", "🪛"]
            },
            {
               "id": "vehicles",
               "label": "🚗",
               "color": "rgba(59, 130, 246, 0.25)",
               "items": ["🚗", "🚕", "🚲", "🚁"]
            }
         ]
      },
      {
         "duration": 35,
         "penaltySec": 0,
         "minCorrect": 6,
         "categories": [
            {
               "id": "food",
               "label": "🍔",
               "color": "rgba(245, 158, 11, 0.25)",
               "items": ["🍔", "🍕", "🍟", "🌮"]
            },
            {
               "id": "drinks",
               "label": "🥤",
               "color": "rgba(14, 165, 233, 0.25)",
               "items": ["🥤", "🧃", "☕", "🥛"]
            }
         ]
      },
      {
         "duration": 35,
         "penaltySec": 0,
         "minCorrect": 6,
         "categories": [
            {
               "id": "living",
               "label": "🌱",
               "color": "rgba(34, 197, 94, 0.2)",
               "items": ["🐶", "🐦", "🌳", "🐟"]
            },
            {
               "id": "nonliving",
               "label": "⚙️",
               "color": "rgba(100, 116, 139, 0.25)",
               "items": ["🪑", "📱", "🚗", "🧱"]
            }
         ]
      },
      {
         "duration": 30,
         "penaltySec": 0,
         "minCorrect": 6,
         "categories": [
            {
               "id": "indoor",
               "label": "🏠",
               "color": "rgba(59, 130, 246, 0.2)",
               "items": ["🛋️", "🛏️", "🚿", "🧴"]
            },
            {
               "id": "outdoor",
               "label": "🌤️",
               "color": "rgba(234, 179, 8, 0.2)",
               "items": ["🌳", "🏕️", "🏔️", "🏖️"]
            }
         ]
      },
      {
         "duration": 30,
         "penaltySec": 0,
         "minCorrect": 6,
         "categories": [
            {
               "id": "natural",
               "label": "🌿",
               "color": "rgba(34, 197, 94, 0.2)",
               "items": ["🌋", "🌊", "🌲", "🪨"]
            },
            {
               "id": "manmade",
               "label": "🏗️",
               "color": "rgba(94, 234, 212, 0.2)",
               "items": ["🏭", "🏢", "🛣️", "🧱"]
            }
         ]
      },
      {
         "duration": 28,
         "penaltySec": 2,
         "minCorrect": 6,
         "categories": [
            {
               "id": "safe",
               "label": "🛡️",
               "color": "rgba(34, 197, 94, 0.2)",
               "items": ["🪖", "🧯", "🦺", "🛟"]
            },
            {
               "id": "danger",
               "label": "⚠️",
               "color": "rgba(239, 68, 68, 0.2)",
               "items": ["🔥", "⚡", "🗡️", "☣️"]
            }
         ]
      },
      {
         "duration": 26,
         "penaltySec": 2,
         "minCorrect": 6,
         "categories": [
            {
               "id": "before",
               "label": "⏪",
               "color": "rgba(59, 130, 246, 0.2)",
               "items": ["🥚", "🌱", "🧊", "🌙"]
            },
            {
               "id": "after",
               "label": "⏩",
               "color": "rgba(234, 179, 8, 0.2)",
               "items": ["🐣", "🌳", "💧", "🌞"]
            }
         ]
      },
      {
         "duration": 24,
         "penaltySec": 3,
         "minCorrect": 6,
         "categories": [
            {
               "id": "cause",
               "label": "💥",
               "color": "rgba(248, 113, 113, 0.2)",
               "items": ["⚡", "🌧️", "🔥", "🥶"]
            },
            {
               "id": "effect",
               "label": "✨",
               "color": "rgba(59, 130, 246, 0.2)",
               "items": ["💡", "🌈", "💧", "🧊"]
            }
         ]
      },
      {
         "duration": 24,
         "penaltySec": 3,
         "minCorrect": 12,
         "switchAt": 0.5,
         "phases": [
            {
               "categories": [
                  {
                     "id": "true",
                     "label": "✅",
                     "color": "rgba(34, 197, 94, 0.2)",
                     "items": ["🐟💧", "🕊️🌤️", "🌞☀️", "🌳🌿"]
                  },
                  {
                     "id": "false",
                     "label": "❌",
                     "color": "rgba(239, 68, 68, 0.2)",
                     "items": ["🐟🔥", "☂️🔥", "🌙☀️", "🌵❄️"]
                  }
               ]
            },
            {
               "categories": [
                  {
                     "id": "problem",
                     "label": "❓",
                     "color": "rgba(251, 191, 36, 0.2)",
                     "items": ["🔌❌", "💡❌", "🚪🔒", "🌧️"]
                  },
                  {
                     "id": "solution",
                     "label": "🧠",
                     "color": "rgba(59, 130, 246, 0.2)",
                     "items": ["🔌✅", "💡", "🔑", "☂️"]
                  }
               ]
            }
         ]
      },
      {
         "duration": 22,
         "penaltySec": 3,
         "minCorrect": 12,
         "switchAt": 0.5,
         "phases": [
            {
               "categories": [
                  {
                     "id": "cause",
                     "label": "💥",
                     "color": "rgba(248, 113, 113, 0.2)",
                     "items": ["🌧️", "🏃", "😴", "🔥"]
                  },
                  {
                     "id": "effect",
                     "label": "✨",
                     "color": "rgba(59, 130, 246, 0.2)",
                     "items": ["💧", "💦", "😪", "💨"]
                  }
               ]
            },
            {
               "categories": [
                  {
                     "id": "before",
                     "label": "⏪",
                     "color": "rgba(59, 130, 246, 0.2)",
                     "items": ["🥚", "🧊", "🌑", "🌱"]
                  },
                  {
                     "id": "after",
                     "label": "⏩",
                     "color": "rgba(234, 179, 8, 0.2)",
                     "items": ["🐣", "💧", "🌕", "🌳"]
                  }
               ]
            }
         ]
      },
      {
         "duration": 20,
         "penaltySec": 4,
         "minCorrect": 19,
         "switchAt": 0.5,
         "phases": [
            {
               "categories": [
                  {
                     "id": "fruits",
                     "label": "🍎",
                     "color": "rgba(234, 88, 12, 0.25)",
                     "items": ["🍎", "🍌", "🍇"]
                  },
                  {
                     "id": "animals",
                     "label": "🐶",
                     "color": "rgba(59, 130, 246, 0.25)",
                     "items": ["🐶", "🐱", "🐵"]
                  },
                  {
                     "id": "vehicles",
                     "label": "🚗",
                     "color": "rgba(14, 165, 233, 0.25)",
                     "items": ["🚗", "🚌", "🚲"]
                  },
                  {
                     "id": "tools",
                     "label": "🛠️",
                     "color": "rgba(100, 116, 139, 0.25)",
                     "items": ["🔧", "🔨", "🪛"]
                  }
               ]
            },
            {
               "categories": [
                  {
                     "id": "red",
                     "label": "🔴",
                     "color": "rgba(239, 68, 68, 0.25)",
                     "items": ["🔴", "🟥", "❤️"]
                  },
                  {
                     "id": "blue",
                     "label": "🔵",
                     "color": "rgba(59, 130, 246, 0.25)",
                     "items": ["🔵", "🟦", "💙"]
                  },
                  {
                     "id": "circle",
                     "label": "⚪",
                     "color": "rgba(148, 163, 184, 0.25)",
                     "items": ["⚪", "⚫", "⭕"]
                  },
                  {
                     "id": "square",
                     "label": "⬜",
                     "color": "rgba(203, 213, 225, 0.25)",
                     "items": ["⬜", "⬛", "◻️"]
                  }
               ]
            }
         ]
      }
   ]
}
```

**Description:**

Sort emoji items into the matching categories. Levels progress from simple visuals to real-world groups and logic, with faster timers later. Each level has different categories and items. Some levels have multiple phases that switch mid-level.

**Configuration:**

-  `gameType` (required): Must be `"drag-sort"`
-  `levels` (optional): Number of levels - Default: **15**
-  `levelDefinitions` (required): Array of level definitions
   -  Each level must have:
      -  `duration`: Duration per level in seconds
      -  `penaltySec`: Time penalty in seconds for incorrect drops (0 = no penalty)
      -  `minCorrect`: Minimum number of correctly sorted items required
      -  `categories`: Array of category objects
         -  Each category has:
            -  `id`: Unique category identifier
            -  `label`: Display label (emoji or text)
            -  `color`: Background color (RGBA)
            -  `items`: Array of emoji items that belong to this category
      -  `switchAt` (optional): Fraction (0-1) indicating when to switch phases (e.g., 0.5 = switch at 50% items placed)
      -  `phases` (optional): Array of phase objects for multi-phase levels
         -  Each phase has `categories` array

**Level Progression:**

-  **Levels 1-2**: Simple visual categories (Red/Blue, Circle/Square), 45s, no penalty
-  **Levels 3-4**: Size-based (Big/Small), real-world (Fruits/Animals), 40s
-  **Levels 5-6**: Tools/Vehicles, Food/Drinks, 35s
-  **Levels 7-9**: Conceptual (Living/Non-living, Indoor/Outdoor, Natural/Man-made), 30-35s
-  **Levels 10-11**: Logic-based (Safe/Danger, Before/After), 26-28s, 2s penalty
-  **Levels 12-13**: Cause/Effect, True/False, Problem/Solution, 24s, 3s penalty, multi-phase
-  **Levels 14-15**: Complex multi-phase with 4 categories, 20-22s, 3-4s penalty

**Scoring:**

-  Score is calculated based on completed levels: `Math.round((completedLevels / maxLevels) * 100)`
-  Maximum 100 points for completing all 15 levels

**Controls:**

-  **Mouse/Touch**: Click and drag items from center area, drop into category boxes

**Goal:**

-  Drag items from the center into their correct category boxes
-  Correct drops: Item moves to category and turns green
-  Wrong drops: Item stays in center, flashes red, and may incur time penalty
-  Complete the minimum number of correct sorts within the time limit
-  Complete all 15 levels with increasing difficulty

**Features:**

-  **Multiple Phases**: Some levels switch categories mid-level (levels 13-15)
-  **Time Penalties**: Incorrect drops reduce time remaining (levels 10+)
-  **Visual Feedback**: Correct items turn green, incorrect items flash red
-  **Progressive Difficulty**: Faster timers, more categories, and logic-based sorting
-  **Emoji-based**: All items are emojis for visual clarity
-  Hit targets by clicking on them or pressing Enter/Space when the target icon is near them
-  Each level requires you to hit a minimum number of targets within the time limit
-  Targets appear at random positions and you must hit them before they disappear
-  Complete all 15 levels to finish the game

**How It Works:**

-  A target icon (crosshair) appears in the center of the arena
-  Move the target icon using WASD/Arrow keys or mouse movement
-  Targets spawn randomly in the arena
-  Click on targets directly or press Enter/Space when the target icon is near a target to hit it
-  Targets disappear after being hit or after their lifetime expires
-  Each level has increasing difficulty with more targets required and special features

**Features:**

-  **Progressive Difficulty**: More targets required per level, faster spawning, shorter display times
-  **Moving Targets** (Levels 6-7, 9, 11-15): Targets move around the arena, bouncing off walls
-  **Multiple Targets** (Levels 8-9, 11-15): Multiple targets appear simultaneously
-  **Shrinking Targets** (Levels 10-15): Targets shrink over time, making them harder to hit
-  **Target Icon (Crosshair)**: Visual indicator that moves with keyboard or mouse
-  **Dual Control Methods**: Use keyboard (WASD/Arrow keys) or mouse to move the target icon
-  **Visual Feedback**: Hit/Missed statistics displayed at the top with gradient backgrounds
-  **Level Progression System**: 15 levels with increasing difficulty
-  **Game State Display**: Level X Complete!, Level X Failed!, Game Complete!
-  **Replay System**: 5 replays by default, unlimited if shared
-  **Share Feature**: Share the game to unlock unlimited replays (15 minutes)
-  **Modern UI**: Consistent design with other Skill Games (border, background, shadow, radius)
-  **Fully Responsive**: Optimized for mobile, tablet, and desktop

**Tips:**

-  Use WASD keys smoothly to move the target icon - don't rush!
-  Aim slightly ahead of moving targets to account for their velocity
-  For multiple targets, prioritize the ones that are about to disappear
-  Shrinking targets require quick reactions - hit them while they're still large enough
-  Practice your hand-eye coordination and stay calm under pressure
-  Each level teaches new skills!

**Recommended Settings:**

-  **Time Limit**: 0 (no overall time limit, each level has its own duration)
-  **Passing Score**: 75 (75% of max score)

## User Progress

Progress is stored in:

-  **Logged-in users**: WordPress user meta (`play50_all_progress`)
-  **Guest users**: localStorage (frontend) + optional API sync

Progress structure:

```json
{
   "game_id": {
      "score": 85,
      "completed": true,
      "completed_at": "2024-01-15T10:30:00Z"
   }
}
```

## Certificate Generation

Certificates are generated as HTML (can be extended with DomPDF for PDF generation).

### API Endpoint

```
POST /wp-json/play50/v1/certificate/generate
```

**Body:**

```json
{
   "player_name": "John Doe",
   "guest_id": "optional-guest-id"
}
```

**Response:**

```json
{
   "certificate_id": 123,
   "certificate_url": "https://cms.play50.games/wp-json/play50/v1/certificate/123"
}
```

### Enable PDF Generation

1. Install DomPDF: `composer require dompdf/dompdf`
2. The certificate generator will automatically use it if available

## CORS Configuration

CORS (Cross-Origin Resource Sharing) is configured in `wp-config.php` and `includes/rest-api.php`.

### Development (Localhost)

The backend automatically allows requests from:

-  `http://localhost:3000`
-  `http://localhost:3001`
-  `http://127.0.0.1:3000`
-  `http://127.0.0.1:3001`

### Production

Configure allowed origins in `wp-config.php`:

```php
define('PLAY50_CORS_ORIGIN', 'https://your-frontend-domain.com');
```

Or allow multiple origins:

```php
define('PLAY50_CORS_ORIGIN', 'https://frontend1.com,https://frontend2.com');
```

### Testing CORS

Test the API endpoint:

```bash
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://cms.play50.games/wp-json/play50/v1/games
```

---

# Frontend (Next.js)

Next.js frontend for the Play50Games platform - a browser-based game platform with 50 games, progress tracking, and certificate generation.

## Frontend Setup

1. Navigate to the frontend directory:

```bash
cd play50games-frontend
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file:

```env
NEXT_PUBLIC_WORDPRESS_API_URL=https://cms.play50.games/wp-json/play50/v1
```

For local development:

```env
NEXT_PUBLIC_WORDPRESS_API_URL=http://localhost/wp-json/play50/v1
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Frontend Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Home page (games list)
│   ├── games/[id]/        # Individual game pages
│   ├── progress/          # Progress dashboard
│   ├── certificate/       # Certificate generation/view
│   └── diagnostics/       # API diagnostics page
├── components/
│   ├── GameEngine/        # Main game engine
│   │   ├── GameEngine.tsx # Core game orchestrator
│   │   ├── KeyboardControls.tsx # Keyboard controls display
│   │   ├── NumberKeypad.tsx    # Numeric keypad component
│   │   └── game-types/    # Game type implementations
│   │       ├── LogicGames.tsx      # Logic games container
│   │       ├── MemoryGames.tsx     # Memory games container
│   │       ├── SpeedGames.tsx      # Speed games container
│   │       ├── SkillGames.tsx      # Skill games container
│   │       ├── FinalGames.tsx      # Final games container
│   │       ├── logicgames-parts/   # Individual logic game components
│   │       │   ├── MatchShapes.tsx
│   │       │   ├── ColorSequence.tsx
│   │       │   ├── NumberOrder.tsx
│   │       │   ├── FindOddOne.tsx
│   │       │   ├── BalanceScale.tsx
│   │       │   ├── Sudoku4x4.tsx
│   │       │   ├── TileSlider.tsx
│   │       │   ├── CircuitPath.tsx
│   │       │   ├── MazeEscape.tsx
│   │       │   ├── PatternCompletion.tsx
│   │       │   ├── RotateToFit.tsx
│   │       │   ├── MirrorMatch.tsx
│   │       │   ├── LogicGates.tsx
│   │       │   ├── SequenceArrows.tsx
│   │       │   └── BlockFill.tsx
│   │       ├── memorygames-parts/  # Individual memory game components
│   │       │   ├── CardFlipMemory.tsx
│   │       │   ├── SoundMemory.tsx
│   │       │   ├── EmojiMemory.tsx
│   │       │   ├── NumberRecall.tsx
│   │       │   ├── ImageRecall.tsx
│   │       │   ├── PathMemory.tsx
│   │       │   ├── WordMemory.tsx
│   │       │   ├── FaceMemory.tsx
│   │       │   ├── ColorGridMemory.tsx
│   │       │   └── SymbolStack.tsx
│   │       └── speedgames-parts/   # Individual speed game components
│   │           ├── ClickGreen.tsx
│   │           ├── AvoidRed.tsx
│   │           ├── ReactionTest.tsx
│   │           ├── FastMath.tsx
│   │           ├── WhackShape.tsx
│   │           ├── TypingSprint.tsx
│   │           ├── QuickCompare.tsx
│   │           ├── FallingObjects.tsx
│   │           ├── ReflexArrow.tsx
│   │           └── TapCounter.tsx
│   │       ├── skillgames-parts/   # Individual skill game components
│   │       │   ├── BallBalance.tsx
│   │       │   ├── TargetAim.tsx
│   │       │   ├── SpeedDrawing.tsx
│   │       │   ├── OneHandMode.tsx
│   │       │   ├── CursorMaze.tsx
│   │       │   ├── LineTracer.tsx
│   │       │   ├── TimingBar.tsx
│   │       │   ├── StackBlocks.tsx
│   │       │   ├── PrecisionDrop.tsx
│   │       │   └── DragAndDropSort.tsx
│   └── UnlockSystem/      # Game unlock logic
├── lib/
│   ├── api/              # WordPress REST API clients
│   │   ├── games.ts      # Games API
│   │   ├── progress.ts   # Progress API
│   │   └── certificate.ts # Certificate API
│   ├── storage/           # Progress storage (localStorage + API)
│   │   └── progressStorage.ts
│   └── utils/             # Utility functions
│       ├── gameInstructions.ts # Game instructions and tips
│       └── gameTypes.ts   # Game type utilities
├── hooks/
│   └── useKeyboardControls.ts # Keyboard controls hook
└── types/                 # TypeScript type definitions
    └── game.ts
```

## Features

-  **Modern Games**: Match Shapes, Color Sequence, Number Order, Find the Odd One, Balance the Scale, Sudoku 4x4, Tile Slider, Circuit Path, and more
-  **Modular Architecture**: Games organized in separate files within category-specific folders (`logicgames-parts/`, `memorygames-parts/`, `speedgames-parts/`, `skillgames-parts/`) for better maintainability
-  **Progress Tracking**: localStorage for guests, WordPress API for logged-in users
-  **Unlock System**: Sequential game unlocking based on completion
-  **Certificate Generation**: PDF certificate after completing all games
-  **Responsive Design**: Works on desktop, tablet, and mobile
-  **Heroicons Integration**: Consistent iconography across all games
-  **Keyboard Controls**: Full keyboard support for all games
-  **Mouse Controls**: Visual mouse control instructions
-  **Modern UI**: Gradient backgrounds, animations, and visual feedback
-  **Game Instructions**: Detailed instructions and tips displayed before each game
-  **Diagnostics Page**: API connectivity and CORS diagnostics
-  **Share Feature**: Share games to unlock unlimited hints (Card Flip Memory, Tile Slider, Sound Memory, Emoji Memory, Number Recall, Image Recall, Path Memory, Word Memory, Face Memory, Color Grid Memory, Symbol Stack)
-  **Optimized Imports**: Each game component imports only necessary dependencies for better performance

## Game Types

### Logic Games

-  Match the Shapes
-  Color Sequence
-  Number Order
-  Find the Odd One
-  Balance the Scale
-  Sudoku 4x4
-  Tile Slider
-  Circuit Path
-  Maze Escape
-  Pattern Completion
-  Rotate to Fit
-  Mirror Match
-  Logic Gates
-  Sequence Arrows
-  Block Fill

### Memory Games

-  Card Flip Memory
-  Sound Memory
-  Emoji Memory
-  Number Recall
-  Image Recall
-  Path Memory
-  Word Memory
-  Face Memory
-  Color Grid Memory
-  Symbol Stack

### Speed Games

-  Click the Green
-  Avoid the Red
-  Reaction Test
-  Fast Math
-  Whack-a-Shape
-  Typing Sprint
-  Quick Compare
-  Falling Objects
-  Tap Counter

### Skill Games

-  Ball Balance
-  Target Aim
-  Speed Drawing
-  One-Hand Mode
-  Cursor Maze
-  Line Tracer
-  Timing Bar
-  Stack Blocks
-  Precision Drop
-  Drag & Drop Sort

## Environment Variables

### Required

-  `NEXT_PUBLIC_WORDPRESS_API_URL` - WordPress REST API base URL
   -  Example: `https://cms.play50.games/wp-json/play50/v1`
   -  For local: `http://localhost/wp-json/play50/v1`

### Optional

-  None currently

## Development

### Available Scripts

-  `npm run dev` - Start development server
-  `npm run build` - Build for production
-  `npm run start` - Start production server
-  `npm run lint` - Run ESLint

### Key Technologies

-  **Next.js 14** - React framework with App Router
-  **TypeScript** - Type safety
-  **Heroicons** - Icon library
-  **CSS Modules** - Scoped styling
-  **localStorage** - Client-side progress storage

### Game Development

To add a new game:

1. **Determine game category**: Logic, Memory, Speed, Skill, or Final
2. **Create game component**:
   -  Create a new file in the appropriate `*-parts/` folder (e.g., `logicgames-parts/YourGame.tsx`)
   -  Export the component as default
   -  Follow the existing game component structure and props interface
3. **Import in container**: Add import and entry in the corresponding container file:
   -  `LogicGames.tsx` for logic games
   -  `MemoryGames.tsx` for memory games
   -  `SpeedGames.tsx` for speed games
   -  `SkillGames.tsx` for skill games
   -  `FinalGames.tsx` for final games
4. **Add game instructions**: Add instructions to `src/lib/utils/gameInstructions.ts`
5. **Configure game**: Add game configuration in WordPress backend (`wt-cpt/games.php`)
6. **Add styles**: Add game-specific styles to `src/app/globals.css` if needed

#### Game Component Structure

Each game component should:

-  Accept `config`, `onScoreUpdate`, `onComplete`, and other relevant props
-  Export as default function component
-  Use optimized imports (only import what's needed)
-  Follow the same design patterns as existing games
-  Include keyboard controls where applicable
-  Support responsive design (mobile, tablet, desktop)

#### Example: Adding a Logic Game

```typescript
// 1. Create logicgames-parts/YourGame.tsx
export default function YourGame({ config, onScoreUpdate, onComplete }) {
   // Game implementation
}

// 2. Import in LogicGames.tsx
import YourGame from "./logicgames-parts/YourGame";

// 3. Add to gameComponents object
const gameComponents = {
   "your-game": (
      <YourGame
         config={config}
         onScoreUpdate={onScoreUpdate}
         onComplete={onComplete}
      />
   ),
   // ... other games
};
```

---

## Troubleshooting

### Games Not Appearing

1. Check that the theme is activated in WordPress Admin
2. Verify REST API is accessible: `https://cms.play50.games/wp-json/play50/v1/games`
3. Check browser console for CORS errors
4. Ensure `includes/rest-api.php` is loaded in `functions.php`
5. Visit `/diagnostics` page in frontend for detailed diagnostics

### CORS Errors

1. Verify `PLAY50_CORS_ORIGIN` is set correctly in `wp-config.php`
2. Check that `includes/rest-api.php` is properly handling CORS headers
3. Clear any caching plugins
4. Check server configuration (nginx/apache) for CORS
5. Use the diagnostics page to check CORS headers

### Game Config Not Working

1. Validate JSON syntax using the "Validate JSON" button in WordPress Admin
2. Check that `gameType` matches the expected value
3. Verify optional fields use correct data types
4. Check browser console for errors

### Frontend Build Errors

1. Ensure all dependencies are installed: `npm install`
2. Check TypeScript errors: `npm run lint`
3. Verify environment variables are set in `.env.local`
4. Clear `.next` folder and rebuild: `rm -rf .next && npm run build`

### API Connection Issues

1. Check `NEXT_PUBLIC_WORDPRESS_API_URL` in `.env.local`
2. Verify WordPress backend is running and accessible
3. Test API endpoint directly in browser
4. Use `/diagnostics` page for detailed connection diagnostics
5. Check browser network tab for failed requests

---

## Support

For issues or questions:

1. Check the browser console for errors
2. Verify API endpoints are accessible
3. Review game configuration JSON syntax
4. Check WordPress error logs
5. Use the diagnostics page (`/diagnostics`) for API diagnostics

---

## License

This project is part of the Play50Games platform.
