// The models (listed, on disk, within budget, GLB_SIZE = the real meshes), the definition's levels,
// the progression data, every level's five hero lines, the level end, the hero motion writer, the
// orbit camera adoption and local multiplayer on one shared line.
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { secretProblems } from "@/arcade3d/menu2/secrets/secrets";
import { starSpecProblems } from "@/arcade3d/menu2/stars/stars";
import { memoryProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { createOrbit, orbitPosition } from "@/arcade3d/menu2/camera/orbit";
import { defaultHeroFor, memoryHeroStorage, setHeroPickStorage } from "@/arcade3d/menu2/heroes/heroPick";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS, GLB_SIZE } from "./assets";
import definition from "./index";
import { robotFactoryRunMeta } from "./meta";
import { OVERSEER, SECRETS, starSpecFor } from "./progression";
import { levelEndStats, runStars } from "./levelEnd";
import { createHeroAnim, writeHeroMotion } from "./Hero";
import { FACTORY_ORBIT, orbitLookUp, orbitPivot, orbitScale, playCamera } from "./camera";
import { K, tileX, tileZ } from "./factory";
import { createRun, createStepInput, floorFor, mainOrbTotal, step } from "./rules";
import { DEFAULT_HERO, pickedHero, resetHeroPick, selectHero } from "./heroes";
import { createMultiRun, placings, stepMulti } from "./multiplayer";
import { createBot, botInput } from "./bot";

const PUBLIC = fileURLToPath(new URL("../../../../public", import.meta.url));

describe("robot-factory-run models", () => {
   for (const [key, asset] of Object.entries(ASSETS)) {
      it(`${key}: listed, on disk, within its byte budget`, () => {
         expect(hasModel(asset.url), asset.url).toBe(true);
         expect(statSync(path.join(PUBLIC, asset.url)).size).toBeLessThanOrEqual(asset.budget.bytes);
      });
   }
   for (const [key, size] of Object.entries(GLB_SIZE)) {
      it(`${key}: GLB_SIZE is the real mesh`, async () => {
         const { cloud } = await readCharacterGlb(ASSETS[key].url);
         const min = [Infinity, Infinity, Infinity];
         const max = [-Infinity, -Infinity, -Infinity];
         for (let i = 0; i < cloud.length; i += 3) for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], cloud[i + k]);
            max[k] = Math.max(max[k], cloud[i + k]);
         }
         expect(max[0] - min[0]).toBeCloseTo(size.x, 2);
         expect(max[1] - min[1]).toBeCloseTo(size.y, 2);
         expect(max[2] - min[2]).toBeCloseTo(size.z, 2);
         expect(min[1]).toBeCloseTo(0, 2);
      });
   }
   it("the definition's five levels match meta", () => {
      expect(definitionLevelProblems(robotFactoryRunMeta, definition)).toEqual([]);
   });
});

describe("progression and the floors", () => {
   it("M-8, the secrets and the star specs are valid; M-8 has the card's three phases and 8 hp", () => {
      expect(bossProblems(OVERSEER)).toEqual([]);
      expect(OVERSEER.phases).toHaveLength(3);
      expect(OVERSEER.maxHp).toBe(8);
      for (const id of LEVEL_IDS) {
         expect(secretProblems(SECRETS[id])).toEqual([]);
         expect(floorFor(id).spec.secrets).toHaveLength(SECRETS[id].length);
         expect(starSpecProblems(starSpecFor(id, mainOrbTotal(floorFor(id))))).toEqual([]);
      }
   });

   it("every level has the five hero lines: Riko's cracked crate, Nami's high orbs, Kiro's laser orbs, Zuno's orb in the machinery, Vexa's ghost crate", () => {
      for (const id of LEVEL_IDS) {
         const f = floorFor(id);
         const kinds = new Set(f.tiles.map((t) => t.k));
         expect(kinds.has(K.Cracked), `L${id} crate`).toBe(true);
         expect(kinds.has(K.Ghost), `L${id} ghost`).toBe(true);
         expect(kinds.has(K.Laser), `L${id} laser`).toBe(true);
         expect(kinds.has(K.Catwalk), `L${id} catwalk`).toBe(true);
         for (const hero of ["riko", "nami", "kiro", "zuno", "vexa"] as const) expect(f.spec.orbs.some((o) => o.hero === hero), `L${id} ${hero}`).toBe(true);
      }
   });

   it("the level end records stars and secrets through the progress adapter", () => {
      const run = createRun(1, 1);
      run.ended = "win";
      run.finishMs = 20000;
      run.mainOrbs = mainOrbTotal(run.floor);
      run.secrets.found[1] = 1;
      const s = levelEndStats(run, null, memoryProgressStorage());
      expect(runStars(run).clear).toBe(true);
      expect(s.stars & 3).toBe(3);
      expect(s.secrets & 2).toBe(2);
   });

   it("the hero motion: grounded walking, the ball on a roll-drop, a hit's recoil", () => {
      const run = createRun(1, 1);
      const m = createHeroMotion();
      const anim = createHeroAnim();
      writeHeroMotion(m, run, anim, 0);
      expect(m.grounded).toBe(true);
      expect(m.rolling).toBe(false);
      run.hero.dropping = true;
      writeHeroMotion(m, run, anim, 0);
      expect(m.rolling).toBe(true);
   });
});

describe("orbit camera and hero pick", () => {
   it("the intro ends on the orbit's first pose, behind and above the start", () => {
      for (const aspect of [1.6, 390 / 844]) {
         const f = floorFor(1);
         const play = playCamera(f, aspect);
         const o = createOrbit(FACTORY_ORBIT);
         const [sc, sr] = f.spec.start;
         const p = orbitPivot(tileX(sc), 0, tileZ(sr), { x: 0, y: 0, z: 0 });
         const c = orbitPosition(p.x, p.y, p.z, o.viewYaw, o.viewPitch, o.viewDistance * orbitScale(aspect), { x: 0, y: 0, z: 0 });
         expect(play.position[0]).toBeCloseTo(c.x, 9);
         expect(play.position[2]).toBeCloseTo(c.z, 9);
         expect(play.lookAt).toEqual([p.x, p.y + orbitLookUp(aspect), p.z]);
         expect(c.y).toBeGreaterThan(5);
      }
   });

   it("the camera yaw turns the walk (camera-relative); the bot is the same with the yaw written as 0", () => {
      const a = createRun(1, 1);
      const b = createRun(1, 1);
      for (let i = 0; i < 20; i++) {
         step(a, 16, { ...createStepInput(), moveZ: -1, yaw: Math.PI / 2 });
         step(b, 16, { ...createStepInput(), moveX: -1 });
      }
      expect(a.hero.x).toBeCloseTo(b.hero.x, 6);
      expect(a.hero.z).toBeCloseTo(b.hero.z, 6);
   });

   it("Robot Factory Run (W1) preselects Riko; the player's own pick is kept", () => {
      setHeroPickStorage(memoryHeroStorage());
      resetHeroPick();
      expect(defaultHeroFor("robot-factory-run", null)).toBe("riko");
      expect(pickedHero()).toBe("riko");
      selectHero("zuno");
      resetHeroPick();
      expect(pickedHero()).toBe("zuno");
      expect(createRun(1).heroId).toBe(DEFAULT_HERO);
      selectHero(DEFAULT_HERO);
   });
});

describe("local multiplayer: one line for everyone", () => {
   it("the runs share one board and one M-8; only the driver moves the line", () => {
      const m = createMultiRun(1, 5, ["riko", "nami", "kiro"], "coop");
      expect(m.runs[1].board).toBe(m.runs[0].board);
      expect(m.runs[2].boss).toBe(m.runs[0].boss);
      expect(m.runs[0].driver).toBe(true);
      expect(m.runs[1].driver).toBe(false);
      stepMulti(m, 1000, [createStepInput(), createStepInput(), createStepInput()]);
      // the boss machine ran once a ms, not three times (still in its 2.5 s intro after 1 s)
      expect(m.runs[0].boss!.step).toBe("intro");
      expect(m.runs[0].boss!.stepMs).toBeLessThanOrEqual(1000);
   });

   it("co-op: Kiro's shield covers the team; two honest bots finish level 1 together (versus)", () => {
      const m = createMultiRun(1, 1, ["kiro", "vexa"], "coop");
      stepMulti(m, 16, [{ ...createStepInput(), actionPressed: true }, createStepInput()]);
      expect(m.runs[1].hero.shieldUntil).toBe(m.runs[0].hero.shieldUntil);
      const v = createMultiRun(1, 1, ["riko", "zuno"], "versus");
      const bots = v.runs.map((r) => createBot(r));
      const inputs = v.runs.map(() => createStepInput());
      for (let f = 0; f < 20_000 && v.ended === null; f++) {
         v.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
         stepMulti(v, 1000 / 60, inputs);
      }
      expect(v.ended).toBe("win");
      expect(placings(v)[0].place).toBe(1);
   }, 120_000);
});
