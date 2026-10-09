// The per-frame numbers the DOM HUD shows without a React render per frame: the Scene writes them
// in its frame loop, Hud.tsx polls them on each animation frame. One game runs at a time.
export const HUD_FEED = { power: 0.5, ready: 1, charging: false };
