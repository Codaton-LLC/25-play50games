// Per-level look for knight-arena: pure data, no React, no three.js (docs/arcade-levels.md §6.3).
// The eight posts, the knight and the camera stay on every level (reach/timing proofs in rules.ts);
// what varies is the scenery outside the fence: sky palette, ground/floor tints, banner cloth,
// the tree/tower backdrop layout and a set of code-built props per level name. Level 1's look is
// today's scene, byte-for-byte (looks.test.ts pins it against the legacy constants).
import type { LevelId } from "../../types";
import { ARENA } from "./rules";

/** A code-built scenery prop placed outside the fence. `rotY` faces it toward the arena. */
export interface DecorSpot {
   kind: DecorKind;
   x: number;
   z: number;
   rotY: number;
}

export type DecorKind =
   | "hayBale"     // L2: straw practice bale
   | "tent"        // L2: canvas training tent
   | "spearRack"   // L2: rack of leaning spears
   | "roundel"     // L2: archery target on a stand
   | "torch"       // L3/L4: fire pole
   | "hourglass"   // L3: the Timed Course set piece
   | "bannerPole"  // L3/L5: tall pole with hanging cloth
   | "brazier"     // L4/L5: fire bowl on legs
   | "barrel"      // L4: stacked-supply barrel
   | "chest"       // L5: royal treasure chest
   | "throne";     // L5: the Royal Trial set piece

/** Conservative outer radius of each prop kind (looks.test.ts: props stay out of the play area). */
export const DECOR_RADIUS_M: Record<DecorKind, number> = {
   hayBale: 0.55, tent: 1.40, spearRack: 0.60, roundel: 0.45,
   torch: 0.20, hourglass: 0.55, bannerPole: 0.35, brazier: 0.45,
   barrel: 0.40, chest: 0.45, throne: 1.50,
};

export interface KnightLook {
   /** SkyDome gradient colours. */
   skyTop: string;
   skyBottom: string;
   /** Meadow ground / arena floor / stone curb tints. */
   grass: string;
   floor: string;
   curb: string;
   /** Fence banner cloth (and pole banners) colour. */
   banner: string;
   /** Backdrop layout: castle towers and leafy trees. */
   towers: readonly (readonly [number, number])[];
   trees: readonly (readonly [number, number])[];
   /** Scenery props outside the fence. */
   decor: readonly DecorSpot[];
}

const faceCenter = (x: number, z: number): number => Math.atan2(-x, -z);

const spot = (kind: DecorKind, x: number, z: number, rotY = faceCenter(x, z)): DecorSpot => ({ kind, x, z, rotY });

export const LEVEL_LOOKS: Record<LevelId, KnightLook> = {
   // today's game: unchanged arena, backdrop and palette
   1: {
      skyTop: "#1e1b4b",
      skyBottom: "#fdba74",
      grass: "#557a3a",
      floor: "#c7a36e",
      curb: "#8a857d",
      banner: "#2563eb",
      towers: ARENA.TOWER_POSITIONS,
      trees: ARENA.TREE_POSITIONS,
      decor: [],
   },
   // Moving Targets: a bright day on the castle meadow; practice field dressing
   2: {
      skyTop: "#2563eb",
      skyBottom: "#dbeafe",
      grass: "#5e8c43",
      floor: "#d2b47e",
      curb: "#9a938a",
      banner: "#16a34a",
      towers: ARENA.TOWER_POSITIONS,
      trees: [
         [-4.8, -1.5], [4.8, -1.5], [-4.8, 2.2], [4.8, 2.2],
         [-5.8, -3.4], [5.8, -3.4],
      ],
      decor: [
         spot("hayBale", -3.3, -3.3), spot("hayBale", 3.3, -3.3),
         spot("hayBale", -3.3, 3.3), spot("hayBale", 3.3, 3.3),
         spot("tent", -5.4, 3.4), spot("tent", 5.4, 3.4),
         spot("spearRack", -5.4, 0.6, Math.PI / 2), spot("spearRack", 5.4, 0.6, -Math.PI / 2),
         spot("roundel", -2.6, -4.6), spot("roundel", 2.6, -4.6),
      ],
   },
   // Timed Course: a deeper, dramatic sunset; a torch-lit time trial with the hourglass set piece
   3: {
      skyTop: "#2e1065",
      skyBottom: "#fb923c",
      grass: "#4e6b35",
      floor: "#c09368",
      curb: "#7d6f66",
      banner: "#dc2626",
      towers: ARENA.TOWER_POSITIONS,
      trees: ARENA.TREE_POSITIONS,
      decor: [
         spot("torch", -3.6, -2.08), spot("torch", 0, -4.15), spot("torch", 3.6, -2.08),
         spot("torch", -3.6, 2.08), spot("torch", 0, 4.15), spot("torch", 3.6, 2.08),
         spot("hourglass", 0, -5.1),
         spot("bannerPole", -5.0, 0.8, Math.PI / 2), spot("bannerPole", 5.0, 0.8, -Math.PI / 2),
      ],
   },
   // Combo Arena: night; corner braziers, supply barrels, violet cloth
   4: {
      skyTop: "#020617",
      skyBottom: "#334155",
      grass: "#3a4f2c",
      floor: "#a08256",
      curb: "#57534e",
      banner: "#7c3aed",
      towers: ARENA.TOWER_POSITIONS,
      trees: [[-5.2, -3.0], [5.2, -3.0]],
      decor: [
         spot("brazier", -3.6, -3.6), spot("brazier", 3.6, -3.6),
         spot("brazier", -3.6, 3.6), spot("brazier", 3.6, 3.6),
         spot("barrel", 0, -4.5), spot("barrel", -2.4, 4.2), spot("barrel", 2.4, 4.2), spot("barrel", 5.2, 0.4),
      ],
   },
   // Royal Trial: a dark cinematic sunset; the throne, gold braziers, treasure and purple cloth
   5: {
      skyTop: "#1c0a2e",
      skyBottom: "#ea580c",
      grass: "#4a5c33",
      floor: "#caa172",
      curb: "#8a7f72",
      banner: "#6d28d9",
      towers: [[-4.2, -3.5], [4.2, -3.5], [-6.8, -5.2], [6.8, -5.2]],
      trees: ARENA.TREE_POSITIONS,
      decor: [
         spot("throne", 0, -5.6, 0),
         spot("brazier", -2.2, -4.6), spot("brazier", 2.2, -4.6),
         spot("chest", -4.9, 1.4), spot("chest", 4.9, 1.4),
         spot("bannerPole", -5.2, -3.4), spot("bannerPole", 5.2, -3.4),
         spot("bannerPole", -5.2, 3.4), spot("bannerPole", 5.2, 3.4),
      ],
   },
};
