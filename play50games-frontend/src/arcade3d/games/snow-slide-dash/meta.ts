import { LEVEL_IDS, type ArcadeGameMeta } from "../../types";
import { LEVELS } from "./levels";
import { LIMITS } from "./rules";
export const snowSlideDashMeta: ArcadeGameMeta = {
   slug: "snow-slide-dash", title: "Snow Slide Dash", order: 80, owner: "codex", status: "dev",
   collection: "rollheroes", accent: "#facc15", thumbnail: null, difficulty: 2, orientation: "any",
   tagline: "Carve the mountain. Chain ice gates. Outrun Big Drift.",
   description: "Roll freely down the Sugarfrost Workshop's sledding slopes. Thread ice gates for speed, spin and flip off ramps, pre-aim over gripless ice, and turn Big Drift's avalanche into gold snow.",
   controls: {
      scheme: "platformer",
      keyboard: "WASD / arrows steer; hold Down to carve; Space hops; in the air Left/Right spins, Up/Down flips. E / Enter uses your hero power. Drag or Q/C orbits, wheel zooms.",
      touch: "Joystick steers; hold it down to carve. Jump hops; joystick in the air spins/flips. Power uses the hero ability. Two fingers orbit; pinch zooms.",
   },
   scoring: LIMITS[1],
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVELS[id].name, scoring: LIMITS[id] })),
};
