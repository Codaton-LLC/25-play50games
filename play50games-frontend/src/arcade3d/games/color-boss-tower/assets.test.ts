// The models: every GLB this game draws is in the manifest and on disk, inside its budget, and each
// fit puts it where the rules play: a ledge's drawn top is the rules' ledge top, along LEDGE_LEN of
// arc, from the wall to past the walking ring; the guardian fits the shaft; the hazard orb is the
// rules' size; claws and cannons sit on their ledges, clear of the walking line.
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS, CANNON_R, CLAW_R, GLB_SIZE, GRAND_H, LEDGE_DEPTH, LEDGE_R, LEDGE_SCALE, LEDGE_THICK, STONE_H } from "./assets";
import { LEDGE_LEN, R_PATH, R_WALL } from "./levels";
import { HORB_R, towerFor } from "./rules";

const PUBLIC = path.join(__dirname, "../../../../public");

describe("models", () => {
   it("every asset url is in the manifest and on disk, inside its byte budget", () => {
      for (const [key, a] of Object.entries(ASSETS)) {
         expect(hasModel(a.url), key).toBe(true);
         const file = path.join(PUBLIC, a.url);
         expect(existsSync(file), key).toBe(true);
         if (a.budget) expect(statSync(file).size, key).toBeLessThanOrEqual(a.budget.bytes);
      }
   });

   it("a ledge is drawn LEDGE_LEN long, LEDGE_THICK thick (its top the rules' top), from the wall past the walking ring", () => {
      expect(GLB_SIZE.ledge.x * LEDGE_SCALE.x).toBeCloseTo(LEDGE_LEN, 6);
      expect(GLB_SIZE.ledge.y * LEDGE_SCALE.y).toBeCloseTo(LEDGE_THICK, 6);
      expect(GLB_SIZE.ledge.z * LEDGE_SCALE.z).toBeCloseTo(LEDGE_DEPTH, 6);
      expect(LEDGE_R + LEDGE_DEPTH / 2).toBeLessThanOrEqual(R_WALL + 0.01);
      expect(LEDGE_R - LEDGE_DEPTH / 2).toBeLessThan(R_PATH - 0.8);
   });

   it("the guardians fit the shaft and the hazard orb is the rules' size", () => {
      const stoneHalf = (GLB_SIZE.stone.x * (STONE_H / GLB_SIZE.stone.y)) / 2;
      const grandHalf = (GLB_SIZE.grand.x * (GRAND_H / GLB_SIZE.grand.y)) / 2;
      expect(stoneHalf).toBeLessThan(R_PATH - 2.5);
      expect(grandHalf).toBeLessThan(R_PATH - 2.5);
      expect(GLB_SIZE.horb.y * (ASSETS.horb.scale ?? 1)).toBeCloseTo(HORB_R * 2, 6);
   });

   it("claws stand against the wall and cannons on the inner edge, both off the walking line", () => {
      expect(Math.abs(CLAW_R - R_PATH)).toBeGreaterThan(0.6);
      expect(Math.abs(CANNON_R - R_PATH)).toBeGreaterThan(0.6);
      expect(CLAW_R).toBeLessThan(R_WALL);
      expect(CANNON_R).toBeGreaterThan(LEDGE_R - LEDGE_DEPTH / 2);
      for (const id of LEVEL_IDS) for (const c of towerFor(id).claws) expect(c.ledge).toBeLessThan(towerFor(id).la.length);
   });
});
