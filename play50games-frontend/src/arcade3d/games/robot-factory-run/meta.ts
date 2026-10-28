import { LEVEL_IDS, type ArcadeGameMeta } from "../../types";
import { LEVELS } from "./levels";
import { PROPOSED_LEVEL_LIMITS } from "./rules";
export const robotFactoryRunMeta: ArcadeGameMeta = {
   slug: "robot-factory-run", title: "Robot Factory Run", tagline: "Rewire the line. Route live power cells. Overload Overseer M-8.",
   description: "Roll switches to rotate live conveyor junctions, route power cells into the charger and bring Ember Heights back to red. Five factory floors, five hero powers and a three-phase robot foreman.",
   order: 65, status: "dev", collection: "rollheroes", difficulty: 3, orientation: "any", owner: "codex",
   accent: "#ef4444", thumbnail: null,
   controls: { scheme: "platformer", keyboard: "WASD / arrows move, Space jump, Shift roll, E / Enter power. Drag / Q C orbit; wheel zoom.", touch: "Joystick, Jump, Roll and Power. Two fingers orbit, pinch zoom." },
   scoring: PROPOSED_LEVEL_LIMITS[1],
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVELS[id].name, scoring: PROPOSED_LEVEL_LIMITS[id] })),
};
