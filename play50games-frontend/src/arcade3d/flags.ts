// Feature flags for the 3D Arcade. Server-safe: plain data, no imports.
// NEXT_PUBLIC_* values are inlined at build time, so each one must be read with a literal key.

const on = (value: string | undefined): boolean => value === "1" || value === "true";

/** Shows the 3D Arcade tab, links, routes and sitemap entries. */
export const ARCADE_ENABLED = on(process.env.NEXT_PUBLIC_ARCADE_ENABLED);

/** Sends scores to the WordPress leaderboard. Off = scores stay in localStorage. */
export const ARCADE_LEADERBOARD = on(process.env.NEXT_PUBLIC_ARCADE_LEADERBOARD);

/** Replaces the WordPress arcade API with an in-memory mock (development only). */
export const ARCADE_API_MOCK = on(process.env.NEXT_PUBLIC_ARCADE_API_MOCK);

/** Shows "dev" games on /3d and serves their routes (preview builds only, never on Vercel production). */
export const ARCADE_PREVIEW = on(process.env.NEXT_PUBLIC_ARCADE_PREVIEW);

/**
 * The five-level system (docs/arcade-levels.md). Off = every game plays and looks exactly as before:
 * level 1 only, no level tiles, no HUD level chip, no `level` in any request. Games without
 * `meta.levels` never show the level UI, even with the flag on.
 */
export const ARCADE_LEVELS = on(process.env.NEXT_PUBLIC_ARCADE_LEVELS);

/** Preview builds only: every level of every game is open, so a tester can jump to any level. Never set on Vercel. */
export const ARCADE_UNLOCK_ALL = on(process.env.NEXT_PUBLIC_ARCADE_UNLOCK_ALL);
