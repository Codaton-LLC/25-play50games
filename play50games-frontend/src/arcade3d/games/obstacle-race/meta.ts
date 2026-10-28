import { LEVEL_IDS, type ArcadeGameMeta, type LevelId } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Training Course",
   2: "Moving Blocks",
   3: "Bridge Run",
   4: "Spinner Arena",
   5: "Championship Course",
};

export const obstacleRaceMeta: ArcadeGameMeta = {
   slug: "obstacle-race",
   title: "Obstacle Race",
   tagline: "Spinning bars, moving blocks, one finish line.",
   description: "Race through a physics obstacle course. Beat your best time and climb the leaderboard.",
   order: 10,
   status: "live",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD to move, Space to jump",
      touch: "Joystick + Jump button"
   },
   howTo: {
      keys: [
         { id: "move", keys: ["WASD"], label: "Move", main: true, role: "move" },
         { id: "jump", keys: ["Space"], label: "Jump", main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Move" },
         { id: "jump", control: "jump", label: "Jump" },
      ],
      steps: [
         { title: "Goal", text: "Race to the finish arch. Your finish time is your score." },
         { title: "Move", text: "Use WASD to run.", touchText: "Push the joystick to run.", keys: ["move"], touch: ["joystick"] },
         {
            title: "Jump",
            text: "Space jumps the bar, the platforms and onto the moving blocks.",
            touchText: "Tap Jump to clear the bar, the platforms and the moving blocks.",
            keys: ["jump"],
            touch: ["jump"],
         },
         { title: "Watch out", text: "A fall sends you back to the last checkpoint, and the clock runs on." },
         {
            title: "Tips",
            text: "Cross the beam slowly: a fall costs more than a pause. Esc or P pauses.",
            touchText: "Cross the beam slowly: a fall costs more than a pause. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: {
      kind: "time",
      maxScore: 28150,
      minDurationMs: 18500,
      maxDurationMs: 300000,
      base: 0,
      maxPointsPerSec: 0,
      timeBaseMs: 300000,
      unitLabel: "time",
      display: "time"
   },
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: PROPOSED_LEVEL_LIMITS[id] })),
   thumbnail: "/images/3d/obstacle-race.webp",
   accent: "#6366f1",
   owner: "claude"
};
