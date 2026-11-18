// The solo run the scene is stepping now, for the HUD's mini-map (read only, polled a few times a
// second). Plain module state: no React, no three.js; the scene sets it on mount and clears it on unmount.
import type { PaintRun } from "./rules";

export const LIVE: { run: PaintRun | null } = { run: null };
