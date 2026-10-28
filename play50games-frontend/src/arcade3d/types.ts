// Server-safe contracts for the 3D Arcade.
// Do NOT import three, @react-three/*, React components or "use client" files here.

/**
 * All 50 Menu 1 games: the 10 originals in rollout order, the expansion (docs/arcade-expansion/02 §C.1),
 * then the 20 new Menu 1 games 31-50 (docs/menu1-new/specs-31-40.md, specs-41-50.md), then Menu 2 (Color Roll Heroes).
 */
export const ARCADE_SLUGS = [
   "robot-collector",
   "food-catcher",
   "office-escape",
   "pigeon-crossing",
   "penalty-hero",
   "warehouse-rush",
   "tower-climb",
   "clean-city",
   "escape-room",
   "obstacle-race",
   "treasure-island",
   "museum-guard",
   "luggage-rush",
   "dino-egg-rescue",
   "delivery-drone",
   "shopping-cart",
   "snowball-battle",
   "ghost-vacuum",
   "construction-worker",
   "alien-farm",
   "mini-golf",
   "robot-factory",
   "pirate-cannons",
   "castle-defender",
   "penguin-slide",
   "space-repair",
   "monster-kitchen",
   "knight-arena",
   "zoo-escape",
   "rocket-landing",
   "firefighter-rescue",
   "taxi-rush-3d",
   "burger-delivery-scooter",
   "beach-lifeguard",
   "farm-tractor-challenge",
   "cat-vs-robot-vacuum",
   "hotel-bellboy-rush",
   "wizard-potion-lab",
   "haunted-mansion-keys",
   "bee-garden",
   "dog-park-fetch",
   "submarine-treasure-dive",
   "mars-rover-mission",
   "train-station-rush",
   "pizza-kitchen-3d",
   "jungle-bridge-run",
   "magic-carpet-ride",
   "toy-store-night-shift",
   "aquarium-cleaner",
   "postman-3d",
   // Menu 2 (Color Roll Heroes): the vertical slice, docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md
   "sky-tower-jump",
   "rooftop-roll-climb",
   "flooded-ruins-escape",
   "lava-pillar-jump",
   "cloud-hopper",
   "plate-surf",
   "zipline-rush",
   "ring-jump-challenge",
   "wind-tunnel-escape",
   "roll-cannon-jump",
   "color-city-sprint",
] as const;

export type ArcadeSlug = (typeof ARCADE_SLUGS)[number];

export function isArcadeSlug(value: string): value is ArcadeSlug {
   return (ARCADE_SLUGS as readonly string[]).includes(value);
}

export type AgentOwner = "claude" | "cursor" | "codex" | "antigravity" | "kimi";

/** "dev": hidden on production (no card, no route, no sitemap), playable with NEXT_PUBLIC_ARCADE_PREVIEW. */
export type ArcadeStatus = "live" | "soon" | "dev";

/** Sections of /3d. Omitted on the first ten = "originals". */
export type ArcadeCollection = "originals" | "adventure" | "skill" | "rollheroes";

export const ARCADE_COLLECTIONS: ReadonlyArray<{ id: ArcadeCollection; title: string }> = [
   { id: "originals", title: "Originals" },
   { id: "adventure", title: "Adventure" },
   { id: "skill", title: "Skill" },
   // Menu 2: every game here is "dev" until the user signs off, so the section shows only on preview builds
   { id: "rollheroes", title: "Color Roll Heroes" },
];

export type ScoreKind = "points" | "time";

/**
 * Scoring limits. Must match play50games-backend/play50games/includes/arcade-games.json
 * (checked by registry.sync.test.ts). Higher score is always better.
 */
export interface ScoringRules {
   kind: ScoreKind;
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   /** points games: server rejects score > base + maxPointsPerSec * duration_s */
   base: number;
   maxPointsPerSec: number;
   /** time games: score = max(0, floor((timeBaseMs - durationMs) / 10)); the server recomputes it */
   timeBaseMs?: number;
   /** e.g. "pts", "goals" – shown next to the score */
   unitLabel: string;
   /** "int" shows the score, "time" shows the best duration */
   display: "int" | "time";
}

export type ControlScheme =
   | "joystick"
   | "lanes"
   | "runner"
   | "hop"
   | "tap-target"
   | "platformer"
   | "point-and-move"
   | "aim-drag"
   | "steer"
   | "timing"
   | "look"
   | "flight";

/** The five levels every 3D game gets (docs/arcade-levels.md). Level 1 is today's game. */
export const LEVEL_IDS = [1, 2, 3, 4, 5] as const;
export type LevelId = (typeof LEVEL_IDS)[number];
/** a level id as an object key (localStorage, the API's `levels` maps) */
export type LevelKey = `${LevelId}`;

/**
 * One level's server-safe data. `scoring` must equal arcade-games.json games[slug].levels[id - 1]
 * (registry.sync.test.ts). Every level shares the game's `kind`, `unitLabel` and `display`.
 */
export interface LevelMeta {
   id: LevelId;
   /** from the plan, e.g. "Open Office" */
   title: string;
   /** this level's server limits */
   scoring: ScoringRules;
   /**
    * A run whose score reaches this clears the level (the plan's target score), at most
    * `scoring.maxScore`. Omitted = only a win clears it. Level 5 needs none (nothing to unlock).
    */
   clearScore?: number;
}

export interface ArcadeGameMeta {
   slug: ArcadeSlug;
   title: string;
   tagline: string;
   description: string;
   /** 1-based position in the arcade grid (rollout order) */
   order: number;
   status: ArcadeStatus;
   /** omitted = "originals" (the first ten keep their meta files untouched) */
   collection?: ArcadeCollection;
   difficulty: 1 | 2 | 3;
   orientation: "any" | "landscape" | "portrait";
   controls: { scheme: ControlScheme; keyboard: string; touch: string };
   scoring: ScoringRules;
   /** /images/3d/<slug>.webp once it exists */
   thumbnail: string | null;
   /** card accent colour */
   accent: string;
   owner: AgentOwner;
   /**
    * Omitted = one level (= `scoring`). When present: exactly 5, ids 1..5 in order, and
    * `levels[0].scoring` deep-equals `scoring` (levelMetaProblems in levelMeta.ts).
    */
   levels?: readonly LevelMeta[];
}
