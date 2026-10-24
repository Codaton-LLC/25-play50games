"use client";

// Food Catcher: the GameDefinition GameShell runs. The shell owns screens, the timer, pause and
// score submit. This game owns the scene, the rules and the 2x badge.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import FoodHud from "./Hud";
import { LEVELS, type FoodCatcherLevel } from "./levels";
import Scene from "./Scene";
import { LIVES, PROPOSED_LEVEL_LIMITS, ROUND_MS, finalScore } from "./rules";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Today's 90-second fruit catch; clear at 260 points.",
   2: "Catch 25 snacks, dodge more junk, and spot golden treats.",
   3: "Catch 35 mixed orders through faster drops and denser junk.",
   4: "Catch 45 orders in a night kitchen with a high-speed rush.",
   5: "Catch 60 orders for the golden Master Catch challenge.",
};

const ENVIRONMENTS: Record<LevelId, LevelSpec["environment"]> = {
   1: undefined,
   2: { background: "#21170f", lighting: "day" },
   3: { background: "#302016", lighting: "sunset" },
   4: { background: "#101018", lighting: "night" },
   5: { background: "#2a0f14", lighting: "sunset" },
};

function instructionsFor(level: FoodCatcherLevel): string[] {
   if (level.targetGood === 0) return [
      "Slide the chef and catch the good food.",
      "Five catches in a row score double.",
      "Socks and tins cost a life. Three and you are out.",
   ];
   return [
      `Catch ${level.targetGood} good items before the clock runs out.`,
      `Up to ${level.bonusLimit} golden snacks add +10 points; every ${level.goldenEvery}th drop is golden.`,
      "Five catches in a row score double; socks and tins cost a life.",
   ];
}

const definition: GameDefinition = {
   slug: "food-catcher",
   Scene,
   Hud: FoodHud,
   assets: ASSETS,
   durationMs: ROUND_MS,
   lives: LIVES,
   // only the first frame uses this: Scene's CameraRig (core useFittedView) fits the play rectangle
   // to the screen, clear of the HUD and the 2x badge
   camera: { position: [0, 3.25, 12], fov: 40, lookAt: [0, 3.25, 0] },
   environment: { background: "#1c1410", lighting: "indoor" },
   touchControls: [],
   hudStats: [{ key: "combo", label: "Combo" }],
   instructions: instructionsFor(LEVELS[1]),
   levels: LEVEL_IDS.map((id): LevelSpec<FoodCatcherLevel> => {
      const level = LEVELS[id];
      if (id === 1) return { id, description: DESCRIPTIONS[id], config: level };
      return {
         id,
         description: DESCRIPTIONS[id],
         config: level,
         instructions: instructionsFor(level),
         environment: ENVIRONMENTS[id],
         durationMs: level.durationMs,
         hudStats: [
            { key: "caught", label: "Food", max: level.targetGood },
            { key: "combo", label: "Combo" },
         ],
      };
   }),
   // The level id is an internal stat (not shown in the HUD); this keeps the final safety cap level-aware.
   finalScore: (s) => finalScore(s.score, s.elapsedMs, PROPOSED_LEVEL_LIMITS[(s.stats.foodLevel as LevelId | undefined) ?? 1]),
 };

export default definition;
