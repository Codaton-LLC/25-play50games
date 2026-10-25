"use client";

// Penalty Hero: the GameDefinition GameShell runs. The shell owns screens, pause and score
// submit. Level 1 keeps today's untimed ten-shot game; LevelSpecs only add the later configs.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import PenaltyHud from "./Hud";
import Scene from "./Scene";
import { LEVELS, type PenaltyLevel } from "./levels";
import { PROPOSED_LEVEL_LIMITS, SHOTS, finalScore } from "./rules";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Ten shots on the training pitch.",
   2: "12 shots, 6 goals to win; moving targets and a reading keeper.",
   3: "14 shots, 7 goals; faster targets and 175-point streaks.",
   4: "16 shots, 8 goals; night gusts and smaller targets.",
   5: "18 shots, 9 goals; every hazard and 200-point streaks.",
};

const ENVIRONMENTS: Record<LevelId, LevelSpec["environment"]> = {
   1: undefined,
   2: { background: "#12304a", fog: ["#12304a", 40, 90], lighting: "day" },
   3: { background: "#1f1530", fog: ["#1f1530", 40, 90], lighting: "sunset" },
   4: { background: "#050816", fog: ["#050816", 40, 90], lighting: "night" },
   5: { background: "#2a0f14", fog: ["#2a0f14", 40, 90], lighting: "sunset" },
};

function instructionsFor(level: PenaltyLevel): string[] {
   const lines = [
      `${level.shots} shots. Score ${level.goalsToWin} goals to clear the level.`,
      "Arrow keys pick a zone, Space shoots. On touch, tap a zone: the shot goes as your finger lands.",
      "Shoot when the ring is inside the white band, or the ball goes wide.",
   ];
   if (level.movePeriodMs > 0) lines.push("Targets drift; follow the moving ring.");
   if (level.keeperRead > 0) lines.push("The keeper can read a shot and change its dive.");
   if (level.wind > 0) lines.push("Crosswind adds a visible gust to the ring; timing is identical on touch and keyboard.");
   lines.push(`Goals in a row score ${level.nextGoalPoints} instead of 100.`);
   return lines;
}

const definition: GameDefinition<PenaltyLevel> = {
   slug: "penalty-hero",
   Scene,
   Hud: PenaltyHud,
   assets: ASSETS,
   camera: { position: [0, 4, 20], fov: 40, lookAt: [0, 1.22, 0] },
   environment: { background: "#0b1226", fog: ["#0b1226", 40, 90], lighting: "day" },
   touchControls: ["tap"],
   hudStats: [{ key: "shots", label: "Shots", max: SHOTS }],
   instructions: [
      "Arrow keys pick a zone, Space shoots. On touch, tap a zone: the shot goes as your finger lands.",
      "Shoot when the ring is inside the white band, or the ball goes wide.",
      "Ten shots. Goals in a row score 150 instead of 100.",
   ],
   levels: LEVEL_IDS.map((id): LevelSpec<PenaltyLevel> => {
      const level = LEVELS[id];
      if (id === 1) return { id, description: DESCRIPTIONS[id], config: level };
      return {
         id,
         description: DESCRIPTIONS[id],
         config: level,
         instructions: instructionsFor(level),
         environment: ENVIRONMENTS[id],
         hudStats: [{ key: "shots", label: "Shots", max: level.shots }],
      };
   }),
   finalScore: (state) => finalScore(state.score, state.elapsedMs, PROPOSED_LEVEL_LIMITS[(state as typeof state & { levelId?: LevelId }).levelId ?? 1]),
};

export default definition;
