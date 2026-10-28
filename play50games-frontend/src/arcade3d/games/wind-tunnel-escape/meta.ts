import { LEVEL_IDS, type ArcadeGameMeta, type LevelId } from "../../types";
import { LEVELS } from "./levels";
import { limitsFor } from "./rules";
const scoring = (id: LevelId) => ({ ...limitsFor(id), base: 0, maxPointsPerSec: 0, unitLabel: "time", display: "time" as const });
export const windTunnelEscapeMeta: ArcadeGameMeta = {
   slug: "wind-tunnel-escape", title: "Wind Tunnel Escape", order: 91,
   tagline: "Build the current. Outrun the storm.",
   description: "Redirect industrial fans, ride the currents you create, and escape a violet storm. Solve crosswinds and lift shafts, jam the Gale Engine, then reach open sky.",
   collection: "rollheroes", status: "dev", difficulty: 3, orientation: "any", owner: "codex",
   controls: { scheme: "platformer", keyboard: "WASD / arrows move, Space jumps, E / Enter rotates a nearby fan or uses your power. Hold Jump + Action to toggle a fan.", touch: "Joystick, Jump and Fan / Power. Hold Jump + Fan to toggle. Two fingers orbit; pinch zooms." },
   scoring: scoring(1), levels: LEVEL_IDS.map((id) => ({ id, title: LEVELS[id].name, scoring: scoring(id) })),
   thumbnail: null, accent: "#54cce7",
};
