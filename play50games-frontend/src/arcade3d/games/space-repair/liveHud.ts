import { needle, type Run } from "./rules";

// Scene and DOM HUD live in separate shell trees. The shell only mounts one active game.
export const liveHud: { run: Run | null } = { run: null };
export function readNeedle(): number { return liveHud.run ? needle(liveHud.run) : 0; }
