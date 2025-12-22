# Play50Games WordPress Backend

WordPress theme with Custom Post Types and REST API for the Play50Games platform.

## Setup

1. Install WordPress (5.0+)
2. Copy the `play50games` theme folder to `wp-content/themes/`
3. Activate the theme in WordPress admin
4. The following Custom Post Types will be available:
   - **Games** (`play50_game`) - Game configurations
   - **Certificates** (`play50_certificate`) - Generated certificates

## REST API Endpoints

All endpoints are under `/wp-json/play50/v1/`:

### Games
- `GET /games` - Get all games with unlock status
- `GET /games/{id}` - Get single game configuration

### Progress
- `POST /progress` - Save user progress
  - Body: `{ game_id, score, completed, guest_id? }`
- `GET /progress` - Get user progress
  - Query: `game_id?`, `guest_id?`

### Unlock Status
- `GET /unlock-status` - Get unlock status for all games
  - Query: `guest_id?`

### Certificates
- `POST /certificate/generate` - Generate certificate
  - Body: `{ player_name, guest_id? }`
- `GET /certificate/{id}` - Get certificate by ID

## Creating Games

1. Go to WordPress Admin → Games
2. Add New Game
3. Fill in:
   - **Title**: Game name
   - **Game Order**: 1-50 (determines unlock sequence)
   - **Game Type**: logic, memory, speed, or skill
   - **Difficulty**: 1-5
   - **Time Limit**: Seconds
   - **Passing Score**: 0-100
   - **Unlock Requirement**: Game ID that must be completed first (leave empty for Game 1)
   - **Game Config**: JSON configuration (see examples below)

### Game Config Examples

**Match the Shapes:**
```json
{
  "gameType": "match-shapes",
  "shapes": ["circle", "square", "triangle"],
  "rounds": 5
}
```

**Color Sequence:**
```json
{
  "gameType": "color-sequence",
  "rounds": 5
}
```

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

**Ball Balance:**
```json
{
  "gameType": "ball-balance"
}
```

## User Progress

Progress is stored in:
- **Logged-in users**: WordPress user meta (`play50_all_progress`)
- **Guest users**: localStorage (frontend) + optional API sync

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

