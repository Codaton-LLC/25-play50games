# Level titles check (P-103)

Date: 2026-10-25. Branch: `kimi/titles-check`.

Compared, for every game folder in `play50games-frontend/src/arcade3d/games/` that has a `levels.ts`, the 5 level titles in the game's code (`meta.ts` in all cases below; `levels.ts` in these games holds per-level config, not titles — except `obstacle-race`, whose titles live in the `LEVEL_TITLES` record in `meta.ts`) against the `title` values of that game's `levels` array in `play50games-backend/play50games/includes/arcade-games.json`.

| Game | Code titles | JSON titles | Match |
|---|---|---|---|
| castle-defender | Outer Wall, Main Gate, Twin Towers, Night Siege, Royal Defense | Outer Wall, Main Gate, Twin Towers, Night Siege, Royal Defense | yes |
| construction-worker | Garden Shed, Tiny House, Garage, Shop Front, Mini Tower | Garden Shed, Tiny House, Garage, Shop Front, Mini Tower | yes |
| dino-egg-rescue | Green Valley, Fern Forest, Riverbank, Volcanic Pass, Dino Sanctuary | Green Valley, Fern Forest, Riverbank, Volcanic Pass, Dino Sanctuary | yes |
| food-catcher | Fruit Catch, Snack Catch, Fast Food Mix, Speed Kitchen, Master Catch | Fruit Catch, Snack Catch, Fast Food Mix, Speed Kitchen, Master Catch | yes |
| ghost-vacuum | Living Room, Library, Kitchen, Attic, Whole Mansion | Living Room, Library, Kitchen, Attic, Whole Mansion | yes |
| monster-kitchen | Snack Bar, Monster Café, Busy Kitchen, Dinner Rush, Grand Feast | Snack Bar, Monster Café, Busy Kitchen, Dinner Rush, Grand Feast | yes |
| obstacle-race | Training Course, Moving Blocks, Bridge Run, Spinner Arena, Championship Course | Training Course, Moving Blocks, Bridge Run, Spinner Arena, Championship Course | yes |
| penguin-slide | Snow Hill, Ice Cave, Frozen Lake, Aurora Run, Glacier Sprint | Snow Hill, Ice Cave, Frozen Lake, Aurora Run, Glacier Sprint | yes |
| pirate-cannons | Training Deck, Harbor Targets, Moving Boats, Storm Battle, Captain Challenge | Training Deck, Harbor Targets, Moving Boats, Storm Battle, Captain Challenge | yes |
| robot-collector | Training Bay, Small Warehouse, Conveyor Zone, Dark Storage, Mega Warehouse | Training Bay, Small Warehouse, Conveyor Zone, Dark Storage, Mega Warehouse | yes |
| robot-factory | Basic Sort, Shape Sort, Color + Shape, Fast Factory, Overdrive | Basic Sort, Shape Sort, Color + Shape, Fast Factory, Overdrive | yes |
| snowball-battle | Snow Yard, Frozen Park, Snow Fort, Ice Village, Championship Arena | Snow Yard, Frozen Park, Snow Fort, Ice Village, Championship Arena | yes |
| tower-climb | Training Tower, Stone Tower, Clock Tower, Storm Tower, Sky Tower | Training Tower, Stone Tower, Clock Tower, Storm Tower, Sky Tower | yes |
| zoo-escape | Small Enclosure, Safari Zone, Bird Garden, Central Zoo, Night Escape | Small Enclosure, Safari Zone, Bird Garden, Central Zoo, Night Escape | yes |

## Levels array size

All 14 games have exactly 5 entries in their JSON `levels` array. No exceptions.
