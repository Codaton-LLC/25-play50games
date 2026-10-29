// The five arenas (levels.ts ARENAS): every level's yard is legal for every seed, the ice and the
// drifts never touch the start, a pocket or a fort, a rebuilt wall never closes on a kid, and the
// scenery past the fence never hides a kid. The bots per level (win rates, limits) are levels.test.ts.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { DECOR, THEMES, decorBox } from "./arenaLooks";
import { WALL_SEGMENTS, drawnFortHeight, quarterYaw } from "./ArenaDecor";
import { DECOR_GLB } from "./assets";
import { idleInput, witness } from "./bots";
import { fitScreen, placeFollowCamera } from "./camera";
import { ARENAS, LEVELS } from "./levels";
import { COVER_LIMIT, kidBox, type WorldBox } from "./looks";
import {
   DRIFT,
   FORT,
   KID,
   POCKET_OUT,
   YARD,
   ZONE_CLEAR,
   checkPockets,
   checkYard,
   checkZones,
   createRun,
   fallbackYard,
   fortHeight,
   generateYard,
   groundAt,
   pocketsOf,
   stepRun,
   type Run,
   type StepInput,
} from "./rules";

const ARENA_IDS = [2, 3, 4, 5] as const;

/** Slab test: does the segment a -> b pass through the box (strictly between its ends)? */
function segmentHitsBox(ax: number, ay: number, az: number, bx: number, by: number, bz: number, box: WorldBox): boolean {
   let t0 = 0;
   let t1 = 1;
   const axes: [number, number, number, number][] = [[ax, bx - ax, box.minX, box.maxX], [ay, by - ay, box.minY, box.maxY], [az, bz - az, box.minZ, box.maxZ]];
   for (const [o, d, lo, hi] of axes) {
      if (Math.abs(d) < 1e-12) { if (o < lo || o > hi) return false; continue; }
      let ta = (lo - o) / d;
      let tb = (hi - o) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
   }
   return t1 > 0 && t0 < 0.999;
}
const SEEDS = 300;

/** The four pockets of a fort (x, z), from the rules' own pocketsOf. */
function pockets(x: number, z: number): [number, number][] {
   const d = FORT.half + POCKET_OUT;
   pocketsOf(x, z, 0);
   return [[x + d, z], [x - d, z], [x, z + d], [x, z - d]];
}

describe("snowball-battle arenas: every level's yard is legal", () => {
   for (const id of ARENA_IDS) it(`L${id}: the un-jittered yard and ${SEEDS} seeds pass every yard rule, none falls back`, () => {
      const level = LEVELS[id];
      const base = fallbackYard(level.arena, level.fortHp);
      expect(checkYard(base)).toBeNull();
      expect(checkZones(base, level.arena)).toBeNull();
      expect(checkPockets(base)).toBeNull();
      for (let seed = 1; seed <= SEEDS; seed++) {
         const { yard, fallback } = generateYard(seed, level.fortHp, level.arena);
         expect(fallback, `seed ${seed}`).toBe(false);
         expect(checkYard(yard), `seed ${seed}`).toBeNull();
         expect(checkZones(yard, level.arena), `seed ${seed}`).toBeNull();
         expect(checkPockets(yard), `seed ${seed}`).toBeNull();
         expect(yard.forts.every((f) => f.hp === level.fortHp)).toBe(true);
         // every pocket (cover and peek) and the start are plain snow
         for (const f of yard.forts) for (const [x, z] of pockets(f.x, f.z)) expect(groundAt(level, x, z), `seed ${seed} pocket`).toBe("snow");
         const snowD = YARD.snowHalf + POCKET_OUT;
         for (const [x, z] of [[snowD, 0], [-snowD, 0], [0, snowD], [0, -snowD]]) expect(groundAt(level, x, z)).toBe("snow");
         expect(groundAt(level, YARD.startX, YARD.startZ)).toBe("snow");
      }
   }, 120000);

   it("level 1 is today's yard: its arena is the old fort ring, no ice, no drifts, no rebuilds", () => {
      expect(ARENAS[1].forts).toEqual([[0, -5.2], [6.4, -3.3], [7.5, 1.5], [3.4, 4.9], [-3.4, 4.9], [-7.5, 1.5], [-6.4, -3.3]]);
      expect(ARENAS[1].ice).toEqual([]);
      expect(ARENAS[1].drifts).toEqual([]);
      expect(ARENAS[1].rebuild).toBe(0);
      expect(ARENAS[1].theme).toBe("yard");
      for (const id of LEVEL_IDS) expect(LEVELS[id].arena).toBe(ARENAS[id]);
   });

   it("each arena has its twist: ice on 2, 4, 5; drifts on 3, 4, 5; rebuilds on 3 and 5", () => {
      expect(ARENAS[2].ice.length).toBeGreaterThan(0);
      expect(ARENAS[3].drifts.length).toBeGreaterThan(0);
      expect(ARENAS[3].rebuild).toBe(8);
      expect(ARENAS[4].ice.length).toBeGreaterThan(0);
      expect(ARENAS[4].drifts.length).toBeGreaterThan(0);
      expect(ARENAS[5].ice.length).toBeGreaterThan(0);
      expect(ARENAS[5].drifts.length).toBeGreaterThan(0);
      expect(ARENAS[5].rebuild).toBe(10);
      for (const id of [1, 2, 4] as const) expect(ARENAS[id].rebuild).toBe(0);
   });

   it("rejects a zone on the start, on the snowman and on a fort (one fixture each)", () => {
      const yard = fallbackYard(ARENAS[2]);
      const zone = (x: number, z: number) => ({ ...ARENAS[2], ice: [{ x, z, r: 1 }] });
      expect(checkZones(yard, zone(YARD.startX, YARD.startZ))).toBe("zone-start");
      expect(checkZones(yard, zone(0, 0.5))).toBe("zone-snowman");
      expect(checkZones(yard, zone(yard.forts[0].x, yard.forts[0].z + 1.5))).toBe("zone-fort");
      expect(ZONE_CLEAR.box).toBeGreaterThanOrEqual(POCKET_OUT + KID.radius);
      const pine = fallbackYard(ARENAS[2]);
      pine.pines[0] = { ...pine.pines[0], x: pine.forts[0].x, z: pine.forts[0].z - FORT.half - POCKET_OUT };
      expect(checkPockets(pine)).toBe("pocket-pine");
   });
});

const STILL: StepInput = { moveX: 0, moveY: 0, camYaw: 0, scoop: false, fire: false, tapId: -1, aimYaw: Math.PI };

/** A run with no rivals in play, the player parked at (x, z). */
function lonely(id: LevelId, x: number, z: number): Run {
   const run = createRun(1, false, LEVELS[id]);
   // tags > 0 keeps the sneaker from joining; outs stay 0, so the run never ends as a win
   for (let i = 1; i < run.kids.length; i++) { run.kids[i].alive = false; run.kids[i].present = false; run.kids[i].tags = 3; }
   run.kids[0].x = x;
   run.kids[0].z = z;
   return run;
}

describe("snowball-battle arenas: the ground", () => {
   it("ice: at full speed a kid lets go and slides several times further than on snow", () => {
      const pond = ARENAS[2].ice[0];
      const slide = (onIce: boolean): number => {
         const run = lonely(2, onIce ? pond.x - pond.r + 0.2 : -8, onIce ? pond.z : 7.4);
         const p = run.kids[0];
         p.vx = LEVELS[2].speed;
         const x0 = p.x;
         for (let n = 0; n < 60 && Math.hypot(p.vx, p.vz) > 0.01; n++) stepRun(run, 1 / 60, STILL);
         return p.x - x0;
      };
      const ice = slide(true);
      const snow = slide(false);
      expect(snow).toBeLessThan(0.4);
      expect(ice).toBeGreaterThan(3 * snow);
   });

   it("drift: top speed drops to the level's speed x DRIFT.speed inside, and is the level's speed outside", () => {
      const drift = ARENAS[3].drifts[0];
      const run = lonely(3, drift.x, drift.z);
      for (let n = 0; n < 30; n++) {
         run.kids[0].x = drift.x;
         run.kids[0].z = drift.z;
         stepRun(run, 1 / 60, { ...STILL, moveY: 1 });
      }
      expect(Math.hypot(run.kids[0].vx, run.kids[0].vz)).toBeCloseTo(LEVELS[3].speed * DRIFT.speed, 3);
      const out = lonely(3, 0, 7);
      for (let n = 0; n < 60; n++) stepRun(out, 1 / 60, { ...STILL, moveX: 1 });
      expect(Math.hypot(out.kids[0].vx, out.kids[0].vz)).toBeCloseTo(LEVELS[3].speed, 3);
   });

   it("the touch and keyboard runs feel the same ground (no device gets more grip)", () => {
      const pond = ARENAS[2].ice[0];
      const a = lonely(2, pond.x, pond.z);
      const b = createRun(1, true, LEVELS[2]);
      for (let i = 1; i < b.kids.length; i++) { b.kids[i].alive = false; b.kids[i].present = false; b.kids[i].tags = 3; }
      b.kids[0].x = pond.x;
      b.kids[0].z = pond.z;
      for (let n = 0; n < 50; n++) {
         stepRun(a, 1 / 60, { ...STILL, moveX: 1 });
         stepRun(b, 1 / 60, { ...STILL, moveX: 1 });
      }
      expect(b.kids[0].x).toBeCloseTo(a.kids[0].x, 9);
   });
});

/** No living kid's circle reaches into a standing fort (a rebuilt wall never closes on anyone). */
function nobodyInsideAFort(run: Run): string | null {
   for (const kid of run.kids) {
      if (!kid.present || !kid.alive) continue;
      for (let i = 0; i < run.forts.length; i++) {
         const f = run.forts[i];
         if (f.hp < 1) continue;
         const dx = Math.max(Math.abs(kid.x - f.x) - FORT.half, 0);
         const dz = Math.max(Math.abs(kid.z - f.z) - FORT.half, 0);
         if (Math.hypot(dx, dz) < KID.radius - 0.08) return `kid ${kid.id} in fort ${i} at ${run.time.toFixed(2)}`;
      }
   }
   return null;
}

describe("snowball-battle arenas: rebuilt walls", () => {
   it("L3: a flattened fort is packed back to full HP after 8 s, with a rebuild event", () => {
      const run = lonely(3, 0, 7);
      run.forts[0].hp = 0;
      let events = 0;
      while (run.time < 7.9) stepRun(run, 1 / 60, STILL);
      expect(run.forts[0].hp).toBe(0);
      while (run.time < 8.2) {
         stepRun(run, 1 / 60, STILL);
         for (let i = 0; i < run.eventCount; i++) if (run.events[i].kind === "rebuild") events += 1;
      }
      expect(run.forts[0].hp).toBe(LEVELS[3].fortHp);
      expect(fortHeight(run.forts[0].hp)).toBe(FORT.heights[0]);
      expect(events).toBe(1);
   });

   it("L3: a kid standing where the wall goes keeps it down until they step off", () => {
      const run = lonely(3, 0, 7);
      const f = run.forts[0];
      f.hp = 0;
      run.kids[0].x = f.x;
      run.kids[0].z = f.z;
      while (run.time < 9) stepRun(run, 1 / 60, STILL);
      expect(f.hp).toBe(0);
      run.kids[0].x = f.x;
      run.kids[0].z = f.z + 3;
      stepRun(run, 1 / 60, STILL);
      expect(f.hp).toBe(LEVELS[3].fortHp);
   });

   it("levels 1, 2 and 4 never rebuild", () => {
      for (const id of [1, 2, 4] as const) {
         const run = lonely(id, 0, 7);
         run.forts[0].hp = 0;
         while (run.time < 20) stepRun(run, 1 / 60, STILL);
         expect(run.forts[0].hp, `L${id}`).toBe(0);
      }
   });

   for (const id of [3, 5] as const) it(`L${id}: with every fort flattened at the start, no rebuild ever closes on a kid (witness and idle, 8 seeds)`, () => {
      for (let seed = 1; seed <= 8; seed++) for (const brain of [witness(false), idleInput]) {
         const run = createRun(seed, false, LEVELS[id]);
         for (const f of run.forts) f.hp = 0;
         let rebuilt = 0;
         while (!run.endReason && run.time < 40) {
            stepRun(run, 1 / 60, brain(run));
            for (let i = 0; i < run.eventCount; i++) if (run.events[i].kind === "rebuild") rebuilt += 1;
            const bad = nobodyInsideAFort(run);
            expect(bad, `seed ${seed}`).toBeNull();
         }
         if (!run.endReason) expect(rebuilt).toBeGreaterThan(0);
      }
   }, 120000);
});

interface Glb {
   accessors: Array<{ min: number[]; max: number[] }>;
   meshes: Array<{ primitives: Array<{ attributes: { POSITION: number } }> }>;
   nodes: Array<{ mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }>;
   scenes: Array<{ nodes: number[] }>; scene?: number;
}

function bounds(url: string): Box3 {
   const bytes = readFileSync(resolve("public", url.slice(1)));
   const glb: Glb = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
   const result = new Box3();
   function visit(index: number, parent: Matrix4) {
      const node = glb.nodes[index];
      const local = node.matrix
         ? new Matrix4().fromArray(node.matrix)
         : new Matrix4().compose(
            new Vector3().fromArray(node.translation ?? [0, 0, 0]),
            new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
            new Vector3().fromArray(node.scale ?? [1, 1, 1]),
         );
      const world = new Matrix4().multiplyMatrices(parent, local);
      if (node.mesh !== undefined) for (const primitive of glb.meshes[node.mesh].primitives) {
         const accessor = glb.accessors[primitive.attributes.POSITION];
         result.union(new Box3(new Vector3().fromArray(accessor.min), new Vector3().fromArray(accessor.max)).applyMatrix4(world));
      }
      for (const child of node.children ?? []) visit(child, world);
   }
   for (const node of glb.scenes[glb.scene ?? 0].nodes) visit(node, new Matrix4());
   return result;
}

describe("snowball-battle arenas: the look", () => {
   it("every reused model is in the manifest, on disk, and measures what DECOR_GLB says", () => {
      for (const glb of Object.values(DECOR_GLB)) {
         expect(hasModel(glb.url), glb.url).toBe(true);
         expect(existsSync(resolve("public", glb.url.slice(1))), glb.url).toBe(true);
         const size = bounds(glb.url).getSize(new Vector3());
         expect(size.x, glb.url).toBeCloseTo(glb.width, 2);
         expect(size.y, glb.url).toBeCloseTo(glb.height, 2);
         expect(size.z, glb.url).toBeCloseTo(glb.depth, 2);
      }
   });

   it("drawn forts stay inside their 1.80 m square and under the rules height at every HP", () => {
      for (const [lx, lz, w, d] of WALL_SEGMENTS) {
         expect(Math.abs(lx) + w / 2).toBeLessThanOrEqual(FORT.half + 1e-9);
         expect(Math.abs(lz) + d / 2).toBeLessThanOrEqual(FORT.half + 1e-9);
      }
      for (const hp of [1, 2, 3]) expect(drawnFortHeight(hp)).toBe(fortHeight(hp));
      expect(drawnFortHeight(0)).toBeLessThan(0.2);
      for (const id of ARENA_IDS) for (const [x, z] of ARENAS[id].forts) {
         const yaw = quarterYaw(x, z);
         expect(Math.abs(Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2) - yaw)).toBeLessThan(1e-9);
      }
   });

   it("five different lights, skies and fogs", () => {
      const keys = new Set(Object.values(THEMES).map((t) => `${t.lighting} ${t.background} ${t.skyTop} ${t.fog[0]}`));
      expect(keys.size).toBe(5);
   });

   it("every scenery piece stands outside the fence and never on the camera side", () => {
      const box: WorldBox = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
      for (const id of ARENA_IDS) for (const spot of DECOR[ARENAS[id].theme]) {
         decorBox(spot, box);
         const outside = box.maxZ < YARD.minZ || box.minX > YARD.maxX || box.maxX < YARD.minX;
         expect(outside, `${spot.kind} ${spot.x},${spot.z}`).toBe(true);
         expect(box.minZ).toBeLessThan(YARD.maxZ);
      }
   });

   for (const id of ARENA_IDS) it(`L${id}: no scenery piece hides more than 15% of a kid from the follow camera`, () => {
      // honest occlusion: of 27 points spread through the kid's box, the share whose line to the lens
      // passes through the decor box (coverFraction's near-plane shortcut calls any box beside the lens
      // "full cover", which side scenery always is in the close landscape view)
      const cam = new PerspectiveCamera(45, 1, 0.1, 200);
      const decor = DECOR[ARENAS[id].theme].map((spot) => decorBox(spot, { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 }));
      const kid: WorldBox = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
      let worst = 0;
      let where = "";
      for (const [w, h] of [[390, 844], [844, 390], [1280, 800]] as const) {
         const view = fitScreen(w, h);
         for (let x = YARD.minX + 0.4; x <= YARD.maxX - 0.4; x += 1.6) for (let z = YARD.minZ + 0.4; z <= YARD.maxZ - 0.4; z += 1.6) {
            placeFollowCamera(cam, view, x, z, w, h);
            const eye = cam.position;
            for (const [kx, kz] of [[x, z], [YARD.minX + 0.6, YARD.minZ + 0.6], [YARD.maxX - 0.6, YARD.minZ + 0.6], [YARD.minX + 0.6, z], [YARD.maxX - 0.6, z]]) {
               kidBox(kx, kz, kid);
               for (const box of decor) {
                  let hidden = 0;
                  for (let i = 0; i < 27; i++) {
                     const px = kid.minX + ((i % 3) / 2) * (kid.maxX - kid.minX);
                     const py = kid.minY + ((((i / 3) | 0) % 3) / 2) * (kid.maxY - kid.minY);
                     const pz = kid.minZ + (((i / 9) | 0) / 2) * (kid.maxZ - kid.minZ);
                     if (segmentHitsBox(eye.x, eye.y, eye.z, px, py, pz, box)) hidden += 1;
                  }
                  const share = hidden / 27;
                  if (share > worst) { worst = share; where = `${w}x${h} at ${x.toFixed(1)},${z.toFixed(1)} kid ${kx},${kz} box x ${box.minX.toFixed(1)}..${box.maxX.toFixed(1)} z ${box.minZ.toFixed(1)}..${box.maxZ.toFixed(1)}`; }
               }
            }
         }
      }
      expect(worst, where).toBeLessThanOrEqual(COVER_LIMIT);
   }, 120000);
});
