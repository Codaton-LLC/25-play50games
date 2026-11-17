import { LEVEL_LIMITS, TITLES } from "./levels";
import { LEVEL_IDS } from "../../types";
import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Limits proven in README.md "Server limits and why they hold" (bots in rules.test.ts); Claude copies them
// to arcade-games.json.
export const miniGolfMeta: ArcadeGameMeta = {
   slug: "mini-golf",
   title: "Mini Golf 3D",
   tagline: "Six holes, as few strokes as you can.",
   description: "Six bite-size toy holes with ramps, tunnels and a spinning windmill: drag, aim and sink it in as few strokes as possible.",
   order: 21,
   status: "dev",
   collection: "skill",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "aim-drag",
      keyboard: "Drag to aim and putt, or arrows to aim and hold Space, release to putt",
      touch: "Pull back from anywhere, release to putt",
   },
   howTo: {
      keys: [
         { id: "drag", keys: ["Mouse"], label: "Drag to aim", main: true, role: "pointer" },
         { id: "aim", keys: ["Arrows"], label: "Aim & power", role: "move" },
         { id: "putt", keys: ["Space"], label: "Release to putt", hold: true, main: true },
         { id: "enter", keys: ["Enter"], label: "Putt shown power" },
      ],
      touch: [{ id: "drag", control: "drag", label: "Pull back, release to putt" }],
      steps: [
         { title: "Goal", text: "Six toy holes with ramps, tunnels and a windmill. Sink each one in as few strokes as you can." },
         {
            title: "Pull back",
            text: "Press anywhere and drag back, away from where the ball should go. The longer the pull, the harder the putt.",
            touchText: "Touch anywhere and pull back, away from where the ball should go. The longer the pull, the harder the putt.",
            keys: ["drag"],
            touch: ["drag"],
         },
         {
            title: "Release to putt",
            text: "Let go to putt. Or use the keys: the arrows aim and set power, hold Space and release, or press Enter.",
            touchText: "Lift your finger to putt.",
            keys: ["drag", "aim", "putt", "enter"],
            touch: ["drag"],
         },
         { title: "Win", text: "Every stroke counts: the fewer strokes on each hole, the higher your score." },
         {
            title: "Tips",
            text: "Time your putt through the windmill's gap. Esc or P pauses.",
            touchText: "Time your putt through the windmill's gap. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: {
      kind: "points",
      maxScore: 4100,
      minDurationMs: 15000,
      maxDurationMs: 602000,
      base: 1200,
      maxPointsPerSec: 200,
      unitLabel: "pts",
      display: "int",
   },
   levels: LEVEL_IDS.map(id => ({ id, title: TITLES[id - 1], scoring: LEVEL_LIMITS[id], ...(id < 5 ? { clearScore: 2000 } : {}) })),
   thumbnail: "/images/3d/mini-golf.webp",
   accent: "#86efac",
   owner: "claude",
};
