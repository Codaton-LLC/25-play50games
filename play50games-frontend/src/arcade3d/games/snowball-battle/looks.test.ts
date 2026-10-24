// Decor must not hide a kid. Pines are drawn past the far fence; the snowman hides on the frames
// it would cover. The fitted follow camera is the one Scene uses.
import { describe, expect, it } from "vitest";
import { PerspectiveCamera } from "three";
import { FOV, fitScreen, placeFollowCamera } from "./camera";
import {
   BANK,
   COVER_LIMIT,
   FORT_BLOCKS,
   FORT_ICICLES,
   FORT_TONES,
   SNOWMAN_BOX,
   bankBox,
   bankSpots,
   coverFraction,
   FORT_BASE,
   FORT_LIT,
   FORT_SHADOW,
   fortBlockColor,
   fortBlockScale,
   kidBox,
   pineBox,
   pineHalf,
   pineSpots,
   rulesPineBox,
   snowmanCovers,
   type WorldBox,
} from "./looks";
import { FORT, PINE, YARD, createRun, fallbackYard, type Run } from "./rules";

const VIEWS: readonly (readonly [number, number])[] = [
   [390, 844],
   [844, 390],
   [1280, 800],
];

const CAM = new PerspectiveCamera(FOV, 1, 0.1, 200);
const BOX: WorldBox = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
const KID_AT: WorldBox = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };

function coverAt(decor: WorldBox, x: number, z: number, view: ReturnType<typeof fitScreen>, w: number, h: number): number {
   placeFollowCamera(CAM, view, x, z, w, h);
   return coverFraction(decor, kidBox(x, z, KID_AT), CAM, w, h);
}

/** Cover pockets: the face of each fort that points away from the snowman. */
function rivalSpots(run: Run): Array<{ x: number; z: number }> {
   const out: Array<{ x: number; z: number }> = [];
   const d = FORT.half + 0.45;
   for (let i = 0; i < run.forts.length; i++) {
      const f = run.forts[i];
      const len = Math.hypot(f.x, f.z) || 1;
      out.push({ x: f.x + (f.x / len) * d, z: f.z + (f.z / len) * d });
   }
   return out;
}

describe("snowball-battle looks", () => {
   it("draws every pine outside the far fence and leaves the rules trunks where they are", () => {
      const yards = [fallbackYard(), ...[1, 2, 7, 11].map((seed) => createRun(seed, false))];
      for (const yard of yards) {
         const pines = "pines" in yard && !("kids" in yard) ? yard.pines : (yard as Run).pines;
         expect(pines.some((p) => p.z >= PINE.bandZ || Math.abs(p.x) >= PINE.bandX)).toBe(true);
         const spots = pineSpots(pines);
         expect(spots).toHaveLength(PINE.count);
         for (const spot of spots) {
            const half = pineHalf(spot.scale ?? 1);
            expect(spot.z + half).toBeLessThan(YARD.minZ);
            expect(spot.y).toBe(0);
         }
         for (const bank of bankSpots(pines)) {
            expect(bank.y * 2).toBeLessThanOrEqual(BANK.height + 1e-9);
            expect(bank.z).toBeLessThanOrEqual(4.5);
         }
      }
   });

   it("the near-edge rules pine hides the kid at the start; the draw spot does not", () => {
      const yard = fallbackYard();
      const near = yard.pines.find((p) => Math.abs(p.x) < 0.2 && p.z > 6);
      expect(near).toBeTruthy();
      const view = fitScreen(1280, 800);
      const rulesBox = rulesPineBox(near!.x, near!.z, near!.scale, BOX);
      expect(coverAt(rulesBox, YARD.startX, YARD.startZ, view, 1280, 800)).toBeGreaterThan(COVER_LIMIT);
      const drawn = pineBox(pineSpots(yard.pines).find((s) => Math.abs(s.x) < 2) ?? pineSpots(yard.pines)[0], BOX);
      expect(coverAt(drawn, YARD.startX, YARD.startZ, view, 1280, 800)).toBeLessThanOrEqual(COVER_LIMIT);
   });

   it("no drawn pine, bank or visible snowman covers more than 15% of a kid", () => {
      const run = createRun(1, false);
      const empty = (): WorldBox => ({ minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 });
      const pines = pineSpots(run.pines).map((spot) => pineBox(spot, empty()));
      const banks = bankSpots(run.pines).map((spot) => bankBox(spot, empty()));
      const rivals = rivalSpots(run);
      const player = empty();
      const rivalBox = empty();
      let worstDecor = 0;
      let worstWhere = "";
      let snowmanMiss = "";
      for (const [w, h] of VIEWS) {
         const view = fitScreen(w, h);
         for (let x = YARD.minX + YARD.inset; x <= YARD.maxX - YARD.inset; x += 2.4) {
            for (let z = YARD.minZ + YARD.inset; z <= YARD.maxZ - YARD.inset; z += 2.2) {
               placeFollowCamera(CAM, view, x, z, w, h);
               const kids = [kidBox(x, z, player)];
               run.kids[0].x = x;
               run.kids[0].z = z;
               run.kids[1].present = true;
               run.kids[1].alive = true;
               for (const rival of rivals) {
                  kids.push(kidBox(rival.x, rival.z, empty()));
                  run.kids[1].x = rival.x;
                  run.kids[1].z = rival.z;
                  const hidden = snowmanCovers(run, view, w, h);
                  placeFollowCamera(CAM, view, x, z, w, h);
                  const share = coverFraction(SNOWMAN_BOX, kidBox(rival.x, rival.z, rivalBox), CAM, w, h);
                  const playerShare = coverFraction(SNOWMAN_BOX, kidBox(x, z, player), CAM, w, h);
                  if ((share > COVER_LIMIT || playerShare > COVER_LIMIT) && !hidden) {
                     snowmanMiss = `${w}x${h} player ${x.toFixed(1)},${z.toFixed(1)} rival ${rival.x.toFixed(1)},${rival.z.toFixed(1)} ${Math.max(share, playerShare).toFixed(2)}`;
                  }
               }
               for (const box of [...pines, ...banks]) {
                  for (const kid of kids) {
                     const share = coverFraction(box, kid, CAM, w, h);
                     if (share > worstDecor) {
                        worstDecor = share;
                        worstWhere = `${w}x${h} player ${x.toFixed(1)},${z.toFixed(1)} decorY ${box.maxY.toFixed(2)} decorZ ${box.minZ.toFixed(1)}..${box.maxZ.toFixed(1)} kidZ ${kid.minZ.toFixed(1)}..${kid.maxZ.toFixed(1)} = ${share.toFixed(3)}`;
                     }
                  }
               }
            }
         }
      }
      expect(worstDecor, worstWhere).toBeLessThanOrEqual(COVER_LIMIT);
      expect(snowmanMiss).toBe("");
      placeFollowCamera(CAM, fitScreen(1280, 800), YARD.startX, YARD.startZ, 1280, 800);
      expect(coverFraction(SNOWMAN_BOX, kidBox(YARD.startX, YARD.startZ, player), CAM, 1280, 800)).toBeLessThanOrEqual(COVER_LIMIT);
   });

   it("packs the fort into the collision square: horseshoe, three tones, icicles, top at 1.40", () => {
      const tones = new Set(FORT_BLOCKS.map((b) => b.tone));
      expect(tones.size).toBe(FORT_TONES.length);
      expect(FORT_BLOCKS.some((b) => b.z > 0.2 && Math.abs(b.x) >= 0.3)).toBe(true);
      expect(FORT_BLOCKS.some((b) => Math.abs(b.x) < 0.15 && b.z > 0.2)).toBe(false);
      expect(FORT_BLOCKS.some((b) => b.z < -0.3 && b.tier === 2)).toBe(true);
      expect(FORT_ICICLES.length).toBeGreaterThan(2);
      for (const block of FORT_BLOCKS) {
         expect(Math.hypot(block.x, block.z) + block.r).toBeLessThanOrEqual(FORT.half + 1e-6);
         expect(block.y + block.r * block.sy).toBeLessThanOrEqual(FORT.heights[0] + 1e-6);
         expect(block.y - block.r * block.sy).toBeGreaterThanOrEqual(-0.02);
      }
      for (const spike of FORT_ICICLES) {
         expect(Math.hypot(spike.x, spike.z) + spike.r).toBeLessThanOrEqual(FORT.half + 1e-6);
         expect(spike.y - spike.len).toBeGreaterThan(0);
      }
      const run = fallbackYard();
      for (const fort of run.forts) {
         const yaw = Math.atan2(-fort.x, -fort.z);
         const c = Math.cos(yaw);
         const s = Math.sin(yaw);
         for (const block of FORT_BLOCKS) {
            const x = fort.x + block.x * c + block.z * s;
            const z = fort.z - block.x * s + block.z * c;
            expect(Math.abs(x - fort.x) + block.r).toBeLessThanOrEqual(FORT.half + 1e-6);
            expect(Math.abs(z - fort.z) + block.r).toBeLessThanOrEqual(FORT.half + 1e-6);
         }
      }
      expect(FORT_BASE).not.toBe(FORT_LIT);
      expect(FORT_SHADOW).not.toBe(FORT_LIT);
      expect(fortBlockColor(FORT_BLOCKS[0])).toBe(FORT_BASE);
      expect(FORT_BLOCKS.some((block) => block.tier > 0 && fortBlockColor(block) === FORT_SHADOW)).toBe(true);
      expect(fortBlockScale(3, 2)).toBe(1);
      expect(fortBlockScale(0, 2)).toBe(0);
      expect(fortBlockScale(0, 0)).toBeGreaterThan(0);
      expect(fortBlockScale(0, 0)).toBeLessThan(0.2);
   });
});
