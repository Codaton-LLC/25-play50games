# Play50Games WordPress Backend

WordPress theme with Custom Post Types and REST API for the Play50Games platform.

## Setup

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

## Creating Games

1. Go to WordPress Admin → Games
2. Add New Game
3. Fill in:
   -  **Title**: Game name
   -  **Game Order**: 1-50 (determines unlock sequence)
   -  **Game Type**: logic, memory, speed, or skill
   -  **Difficulty**: 1-5
   -  **Time Limit**: Seconds
   -  **Passing Score**: 0-100
   -  **Unlock Requirement**: Game ID that must be completed first (leave empty for Game 1)
   -  **Game Config**: JSON configuration (see examples below)

### Game Config Examples

**Match the Shapes:**

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

_Note: Default is 20 rounds (max 100 points). Uses Heroicons for visual consistency. Keyboard: 1-12 to select shapes directly (1-9, 0, -, = for 10-12)._

**Color Sequence:**

```json
{
   "gameType": "color-sequence",
   "rounds": 20,
   "colors": ["red", "blue", "green", "yellow"]
}
```

_Note: Default is 20 rounds (max 100 points). Sequence length increases: rounds 1-5 = 2 colors, 6-10 = 3, 11-15 = 4, 16-20 = 5. Keyboard: 1-4 to select colors._

**Number Order:**

```json
{
   "gameType": "number-order",
   "rounds": 20
}
```

_Note: Default is 20 rounds (max 100 points). Number count increases dynamically: rounds 1-5 = 3 numbers, rounds 6-10 = 5 numbers, rounds 11-20 = 10 numbers. Keyboard: 1-9 to select by position in grid, 0 for 10th position, Backspace/Delete to undo._

**Find the Odd One:**

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

_Note: Default is 20 rounds (max 100 points). Item count increases dynamically: rounds 1-5 = 10 icons, rounds 6-10 = 30 icons, rounds 11-20 = 50 icons. Uses Heroicons for visual consistency._

**Card Flip Memory:**

```json
{
   "gameType": "card-flip",
   "gridSize": 4,
   "pairs": 8
}
```

**Click the Green:**

```json
{
   "gameType": "click-green"
}
```

**Balance the Scale:**

```json
{
   "gameType": "balance-scale",
   "rounds": 20
}
```

_Note: Default is 20 rounds (max 100 points). 5 points per correct round. Keyboard: ArrowLeft/A (left heavier), ArrowRight/D (right heavier), Enter/Space/E (equal)._

**Sudoku 4x4:**

```json
{
   "gameType": "sudoku-4x4"
}
```

_Note: Generates a new random puzzle each game start. Real-time validation with visual feedback. Keyboard: Arrow keys to navigate, 1-4 to input numbers, Backspace/Delete to clear. Includes NumberKeypad component._

**Tile Slider:**

```json
{
   "gameType": "tile-slider",
   "gridSize": 3,
   "showHints": true,
   "maxHints": 5
}
```

_Note: `gridSize` (optional): Grid size (3 = 3x3, 4 = 4x4) - default: 3. `showHints` (optional): Enable hint button - default: true. `maxHints` (optional): Maximum number of hints allowed - default: 5. Set to 0 or >= 1000 for unlimited hints (solves puzzle completely). **Share to Unlock**: Users can share the game to get unlimited hints automatically. Sharing uses Web Share API (mobile/desktop) or copies link to clipboard. When someone clicks a shared link (with `?shared=ID` parameter), they also get unlimited hints. Hints automatically execute 2-3 optimal moves (or complete solution if unlimited). Uses BFS for complete solution, Manhattan distance heuristic for partial hints. Keyboard: Tab to select tiles, Arrow keys to move selected tile._

**Ball Balance:**

```json
{
   "gameType": "ball-balance"
}
```

## User Progress

Progress is stored in:

-  **Logged-in users**: WordPress user meta (`play50_all_progress`)
-  **Guest users**: localStorage (frontend) + optional API sync

## Certificate Generation

Certificates are generated as HTML (can be extended with DomPDF for PDF generation).

To enable PDF generation:

1. Install DomPDF: `composer require dompdf/dompdf`
2. The certificate generator will automatically use it if available

## File Structure

```
play50games/
├── functions.php              # Theme setup
├── wt-cpt.php                 # Custom Post Type registrations
├── wt-cpt/
│   ├── games.php             # Games CPT meta fields
│   └── certificates.php      # Certificates CPT meta fields
└── includes/
    ├── rest-api.php          # REST API endpoints
    └── certificate-generator.php  # Certificate generation
```

## CORS Configuration

If your frontend is on a different domain, add to `wp-config.php`:

```php
define('WP_ACCESSIBLE_HOSTS', 'your-frontend-domain.com');
```

Or use a CORS plugin to allow your frontend domain.
