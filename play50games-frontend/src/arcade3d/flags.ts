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
