import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS, FIT, GLB_SIZE } from "./assets";
import { LEVELS } from "./levels";
import { DECOR_CLEAR_X, DECOR_PERIOD, TILE, TRACK_AFTER, TRACK_BEFORE, VISIBLE_BACK, WATER_Y, backdropFor, decorSpots, decorZ, gateSpots, trackSpots, visibleAhead } from "./looks";
import { LANE_X, LOG_HALF_X, LOG_HALF_Z, PILLAR_HALF, STAND_HEIGHT, createRun, finishZ, hits } from "./rules";

async function bounds(url: string) {
   const { cloud } = await readCharacterGlb(url);
   const min = [Infinity, Infinity, Infinity];
   const max = [-Infinity, -Infinity, -Infinity];
   for (let i = 0; i < cloud.length; i++) {
      const a = i % 3;
      min[a] = Math.min(min[a], cloud[i]);
      max[a] = Math.max(max[a], cloud[i]);
   }
   return { min, max, width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] };
}
const drawn = (a: ModelAsset, size: { width: number; height: number; depth: number }) => {
   const k = a.scale ?? 1;
   const [sx, sy, sz] = a.stretch ?? [1, 1, 1];
   return { x: size.width * k * sx, y: size.height * k * sy, z: size.depth * k * sz };
};

describe("jungle-bridge-run GLB fits (real meshes)", () => {
   it("every adopted GLB is listed and measures as recorded, pivot on the floor centre; V1s and the unusable files stay out", async () => {
      const urls: Record<keyof typeof GLB_SIZE, string> = {
         charExplorer: ASSETS.explorer.url,
         woodenBridge: ASSETS.deck.url,
         ropeBridge: ASSETS.ropeBridge.url,
         jungleRock: ASSETS.rock.url,
         templePillarV2: ASSETS.pillar.url,
         waterfallCliff: ASSETS.waterfall.url,
         ruinGateR: ASSETS.gate.url,
         jungleLogSingle: ASSETS.log.url,
         jungleFern: ASSETS.fern.url,
         volcanoBackdrop: ASSETS.volcano.url,
         hangingVine: ASSETS.hangingVine.url,
      };
      for (const [id, url] of Object.entries(urls) as [keyof typeof GLB_SIZE, string][]) {
         expect(url).toBe(`/models/3d/jungle-bridge-run/${id}.glb`);
         expect(hasModel(url)).toBe(true);
         const b = await bounds(url);
         expect(b.width).toBeCloseTo(GLB_SIZE[id].width, 3);
         expect(b.height).toBeCloseTo(GLB_SIZE[id].height, 3);
         expect(b.depth).toBeCloseTo(GLB_SIZE[id].depth, 3);
         expect(b.min[1]).toBeCloseTo(0, 3);
         expect((b.min[0] + b.max[0]) / 2).toBeCloseTo(0, 2);
         expect((b.min[2] + b.max[2]) / 2).toBeCloseTo(0, 2);
      }
      for (const skip of ["templePillar", "ruinGate", "junglePlant", "jungleLog"]) expect(hasModel(`/models/3d/jungle-bridge-run/${skip}.glb`)).toBe(false);
   });

   it("track pieces: 1 m long (a spot's sz is the length), a lane 1.9 m wide with low kerbs, the rope bridge 1.6 m wide", () => {
      const deck = drawn(ASSETS.deck, GLB_SIZE.woodenBridge);
      expect(deck.z).toBeCloseTo(1, 6);
      expect(deck.x).toBeCloseTo(FIT.deckWidth, 6);
      expect(deck.y).toBeCloseTo(FIT.deckHeight, 6);
      // the kerbs between lanes stay well under the slide height: a lane change never looks blocked
      expect(deck.y + ASSETS.deck.yOffset!).toBeLessThan(0.3);
      expect(FIT.deckWidth).toBeLessThan(LANE_X[0] - LANE_X[1]);
      const rope = drawn(ASSETS.ropeBridge, GLB_SIZE.ropeBridge);
      expect(rope.z).toBeCloseTo(1, 6);
      expect(rope.x).toBeCloseTo(FIT.ropeWidth, 6);
      expect(rope.y).toBeCloseTo(FIT.ropeHeight, 6);
   });

   it("obstacles match their hit boxes; the runner fits under a gate's lintel", () => {
      const gate = drawn(ASSETS.gate, GLB_SIZE.ruinGateR);
      expect(gate.x).toBeCloseTo(FIT.gateWidth, 6);
      expect(FIT.gateLintelGlb * (ASSETS.gate.scale ?? 1) * ASSETS.gate.stretch![1]).toBeCloseTo(FIT.gateLintel, 6);
      expect(FIT.gateLintel).toBeGreaterThan(STAND_HEIGHT + 0.15);
      const pillar = drawn(ASSETS.pillar, GLB_SIZE.templePillarV2);
      expect(pillar.x).toBeCloseTo(2 * PILLAR_HALF, 6);
      expect(pillar.y).toBeGreaterThan(STAND_HEIGHT);
      // the log lies along z after its quarter turn: its length is the hit depth, its thickness the hit width
      const log = drawn(ASSETS.log, GLB_SIZE.jungleLogSingle);
      expect(ASSETS.log.rotationY).toBeCloseTo(Math.PI / 2, 9);
      expect(log.x).toBeCloseTo(2 * LOG_HALF_Z, 6);
      expect(log.y).toBeCloseTo(FIT.logDiameter, 6);
      expect(log.z).toBeCloseTo(FIT.logDiameter, 6);
      expect(FIT.logDiameter / 2).toBeCloseTo(LOG_HALF_X, 6);
   });

   it("decor GLBs are fitted to 1 m tall: the spot's scale is the size", () => {
      for (const [a, size] of [
         [ASSETS.rock, GLB_SIZE.jungleRock],
         [ASSETS.fern, GLB_SIZE.jungleFern],
         [ASSETS.hangingVine, GLB_SIZE.hangingVine],
         [ASSETS.waterfall, GLB_SIZE.waterfallCliff],
         [ASSETS.volcano, GLB_SIZE.volcanoBackdrop],
         [ASSETS.tree, EXPANSION_GLB_SIZE.leafyTree],
      ] as [ModelAsset, { width: number; height: number; depth: number }][]) {
         expect(drawn(a, size).y).toBeCloseTo(1, 6);
         expect(a.stretch).toBeUndefined();
      }
   });
});

describe("jungle-bridge-run track and decor spots", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: the deck exists exactly where the rules hold the runner (40 seeds); decor clear of the track`, () => {
         const level = LEVELS[id];
         for (let seed = 1; seed <= 40; seed++) {
            const run = createRun(seed, level, id);
            const { deck, rope } = trackSpots(run);
            const covered = (lane: number, z: number) =>
               [...deck, ...rope].some((s) => s.x === LANE_X[lane] && Math.abs(s.z - z) <= (s.sz ?? 1) / 2 + 1e-6);
            for (let lane = 0; lane < 3; lane++) {
               for (let z = -TRACK_BEFORE + 0.25; z < finishZ(level) + TRACK_AFTER; z += 0.5) {
                  // a grounded runner standing here falls (gap hole, off a bridge) iff no deck is drawn under it
                  const probe = { ...run, z, lane, x: LANE_X[lane], y: 0, jumpTimer: 0, slideTimer: 0 };
                  const sec = run.sections.find((s) => z >= s.startZ && z < s.gateZ);
                  const falls = !!sec && sec.obstacles.some((o) => (o.kind === "gap" || o.kind === "bridge") && hits(probe, o));
                  if (falls) expect(covered(lane, z)).toBe(false);
                  else if (!sec || !sec.obstacles.some((o) => (o.kind === "gap" || o.kind === "bridge") && z >= o.z - 0.05 && z <= o.z + o.length + 0.05)) expect(covered(lane, z)).toBe(true);
               }
            }
            for (const s of [...deck, ...rope]) expect(s.sz!).toBeLessThanOrEqual(TILE + 1e-9);
            for (let i = 1; i < deck.length; i++) expect(deck[i].z).toBeGreaterThanOrEqual(deck[i - 1].z);
            expect(gateSpots(run).length).toBe(3 * (level.sections + 1));
         }
         const d = decorSpots(id, level);
         expect(JSON.stringify(decorSpots(id, level))).toBe(JSON.stringify(d));
         // the canyon is one band DECOR_PERIOD long, wrapped into the visible stretch (longer than any level's)
         for (const list of Object.values(d)) for (const spot of list) {
            expect(spot.z).toBeGreaterThanOrEqual(0);
            expect(spot.z).toBeLessThan(DECOR_PERIOD);
         }
         expect(DECOR_PERIOD).toBeGreaterThanOrEqual(VISIBLE_BACK + 6 + visibleAhead(level));
         expect(Math.max(...d.rocks.map((r) => r.z)) - Math.min(...d.rocks.map((r) => r.z))).toBeGreaterThan(DECOR_PERIOD - 14);
         for (const runnerZ of [0, 37.5, 200]) {
            for (const r of d.rocks) {
               const z = decorZ(r.z, runnerZ);
               expect(z).toBeGreaterThanOrEqual(runnerZ - VISIBLE_BACK - 6);
               expect(z).toBeLessThan(runnerZ - VISIBLE_BACK - 6 + DECOR_PERIOD);
               expect(((z - r.z) / DECOR_PERIOD) % 1).toBeCloseTo(0, 9);
            }
         }
         // nothing decorative above the deck within DECOR_CLEAR_X: the camera (x = 0) can never see it in front of the runner
         for (const r of d.rocks) {
            const halfW = (GLB_SIZE.jungleRock.width / GLB_SIZE.jungleRock.height) * (r.sx ?? r.scale ?? 1) / 2;
            const top = r.y + (r.sy ?? r.scale ?? 1);
            if (top > -0.3) expect(Math.abs(r.x) - halfW).toBeGreaterThanOrEqual(DECOR_CLEAR_X - 0.5);
            expect(top).toBeLessThanOrEqual(-0.3);
         }
         for (const t of d.trees) expect(Math.abs(t.x) - (t.scale ?? 1) * 0.5).toBeGreaterThanOrEqual(DECOR_CLEAR_X);
         for (const f of [...d.ferns, ...d.vines]) expect(Math.abs(f.x)).toBeGreaterThanOrEqual(DECOR_CLEAR_X);
         for (const s of d.stilts) expect(s.y + (s.sy ?? 1) / 2).toBeLessThanOrEqual(-0.3);
         for (const s of d.stilts) expect(s.y - (s.sy ?? 1) / 2).toBeLessThanOrEqual(WATER_Y);
         const b = backdropFor(level);
         if (b) {
            const size = b.kind === "volcano" ? GLB_SIZE.volcanoBackdrop : GLB_SIZE.waterfallCliff;
            expect(Math.abs(b.x) - (Math.max(size.width, size.depth) / size.height) * b.scale / 2).toBeGreaterThanOrEqual(DECOR_CLEAR_X);
         }
         expect(b?.kind ?? null).toBe(id === 5 ? "volcano" : id === 3 ? "waterfall" : null);
      });
   }
});
