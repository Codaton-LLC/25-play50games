"use client";

// Penalty Hero: the GameDefinition GameShell runs. The shell owns screens, pause and score
// submit. This game owns the scene, the rules and the shot Hud. No run timer and no lives:
// the run ends with end("win") after the tenth shot.
import type { GameDefinition } from "@/arcade3d/core/types";
import { ASSETS } from "./assets";
import PenaltyHud from "./Hud";
import Scene from "./Scene";
import { SHOTS, finalScore } from "./rules";

const definition: GameDefinition = {
   slug: "penalty-hero",
   Scene,
   Hud: PenaltyHud,
   assets: ASSETS,
   camera: { position: [0, 4, 20], fov: 40, lookAt: [0, 1.22, 0] },
   environment: { background: "#0b1226", fog: ["#0b1226", 40, 90], lighting: "day" },
   touchControls: ["tap"],
   hudStats: [{ key: "shots", label: "Shots", max: SHOTS }],
   instructions: [
      "Arrow keys pick a zone, Space shoots. On touch, tap a zone.",
      "Shoot when the ring is inside the white band, or the ball goes wide.",
      "Ten shots. Goals in a row score 150 instead of 100.",
   ],
   finalScore: (state) => finalScore(state.score, state.elapsedMs),
};

export default definition;
