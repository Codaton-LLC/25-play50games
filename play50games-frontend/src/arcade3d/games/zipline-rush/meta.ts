import { LEVEL_IDS, type ArcadeGameMeta } from "../../types";
import { LEVELS } from "./levels";
import { limitsFor } from "./rules";
export const ziplineRushMeta: ArcadeGameMeta = {
   slug: "zipline-rush", title: "Zipline Rush", tagline: "Tuck the dip. Switch the line. Brake the landing.",
   description: "Ride sagging cables between coastal pine cliffs and sea-stack lighthouses. Hop between crossing lines, land on moving rafts and take on Volt Eel with five Color Roll Heroes.",
   order: 57, status: "dev", collection: "rollheroes", difficulty: 3, orientation: "any", owner: "codex",
   controls: { scheme: "platformer", keyboard: "Down/S tuck, Up/W brake, Space release, Left/Right steer, E power", touch: "Joystick: down tuck, up brake, sideways steer; Release and Power" },
   scoring: limitsFor(1), levels: LEVEL_IDS.map((id) => ({ id, title: LEVELS[id].name, scoring: limitsFor(id) })),
   thumbnail: null, accent: "#38bdf8",
};
