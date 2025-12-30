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
   "gameType": "click-green"
}
```

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
   "gameType": "ball-balance"
}
```

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
│   │       ├── LogicGames.tsx
│   │       ├── MemoryGames.tsx
│   │       ├── SpeedGames.tsx
│   │       ├── SkillGames.tsx
│   │       └── FinalGames.tsx
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
-  **Share Feature**: Share games to unlock unlimited hints (Card Flip Memory, Tile Slider, Sound Memory, Emoji Memory, Number Recall, Image Recall, Path Memory, Word Memory)

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

### Speed Games

-  Click the Green

### Skill Games

-  Ball Balance

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

1. Add game type to `src/lib/utils/gameTypes.ts`
2. Implement game component in `src/components/GameEngine/game-types/`
3. Add game instructions to `src/lib/utils/gameInstructions.ts`
4. Configure game in WordPress backend
5. Add game styles to `src/app/globals.css` if needed

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
