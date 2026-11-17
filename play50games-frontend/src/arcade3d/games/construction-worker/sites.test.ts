// The five sites (levels.ts layout, looks.ts THEMES, sets.ts): every level's yard is fair (every pile
// pickable, every slot droppable with a perfect, the start clear, the worker clear of the piles and in
// frame, the proof's gates untouched), its gusts blow the way the level says, and its surroundings
// stand outside the fence, the crane's wedge and every line from the camera to the work, on the real
// GLBs (their measured sizes re-checked).
import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { fitView } from "@/arcade3d/core/view";
import { LEVEL_IDS } from "@/arcade3d/types";
import { MIXER_SPOTS } from "./assets";
import { LEVELS, type CraneLevel } from "./levels";
import { AREA, BUILDING_NAMES, DECOR, FOV, LOOK, THEMES, viewFor } from "./looks";
import {
   ANGLE_LIM, DROP_R, JIB_Y, PICK_MAX_R, PICK_R, PLAN, RADIUS_MAX, RADIUS_MIN, SLOT_R, createRun, gustDirection, pileUnder, stepRun,
   type CraneInput, type Run,
} from "./rules";
import { SETS, SET_GLB, setDrop, type SetKind } from "./sets";
import { landmarkGeometry } from "./SiteSets";

const ZERO: CraneInput = { rot: 0, radial: 0, pick: -1, actionPick: false, drop: false };

function at(run: Run, angle: number, radius: number): void {
   run.angle = angle;
   run.radius = radius;
   run.omega = 0;
   run.vr = 0;
   run.swing.x.x = 0;
   run.swing.x.v = 0;
   run.swing.z.x = 0;
   run.swing.z.v = 0;
   stepRun(run, ZERO, 1 / 120);
}

const piles = (l: CraneLevel) => l.pileA.map((a) => ({ x: l.pileR * Math.sin(a), z: l.pileR * Math.cos(a) }));
const slots = (l: CraneLevel) => l.slotA.map((a) => ({ x: SLOT_R * Math.sin(a), z: SLOT_R * Math.cos(a) }));

describe("construction-worker sites: each yard is fair", () => {
   for (const id of LEVEL_IDS) {
      const level = LEVELS[id];
      it(`L${id} (${level.site}): piles inside the pickup gate and apart, slots on the ring, the worker clear and in frame`, () => {
         // the proof's gates: piles at most 7.8 out (minus the pickup disc), slots past the drop gate
         expect(level.pileR).toBeGreaterThanOrEqual(RADIUS_MIN + 1);
         expect(level.pileR + PICK_R).toBeLessThanOrEqual(PICK_MAX_R + 1e-9);
         expect(SLOT_R).toBeGreaterThan(DROP_R);
         expect(SLOT_R).toBeLessThanOrEqual(RADIUS_MAX);
         // in the crane's reach, with room for the hook's swing, and inside the drop band's arc (±0.7 rad)
         for (const a of level.pileA) expect(Math.abs(a)).toBeLessThanOrEqual(ANGLE_LIM - 0.05);
         for (const a of level.slotA) expect(Math.abs(a)).toBeLessThanOrEqual(0.55);
         // pickup discs never overlap; slots far enough apart for the widest piece (1.35 m) plus 0.4
         const p = piles(level);
         for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) expect(Math.hypot(p[i].x - p[j].x, p[i].z - p[j].z)).toBeGreaterThan(2 * PICK_R + 0.1);
         const s = slots(level);
         for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) expect(Math.hypot(s[i].x - s[j].x, s[i].z - s[j].z)).toBeGreaterThan(1.75);
         // the worker: a metre off every pile, inside the camera's work area, off the trolley's start
         for (const q of p) expect(Math.hypot(level.worker.x - q.x, level.worker.z - q.z)).toBeGreaterThan(1);
         expect(Math.abs(level.worker.x)).toBeLessThanOrEqual(AREA.max.x - 0.5);
         expect(level.worker.z).toBeGreaterThanOrEqual(AREA.min.z);
         expect(Math.hypot(level.worker.x, level.worker.z - RADIUS_MIN)).toBeGreaterThan(0.8);
      });

      it(`L${id}: every pile is picked from right over it and every slot takes a perfect drop`, () => {
         for (let kind = 0; kind < 5; kind++) {
            const run = createRun(4, level);
            run.planIndex = PLAN.findIndex((step) => step.kind === kind);
            // between gusts (a gust swings the hook; the player picks in the calm, as the bots do)
            run.towerTime = 1.2;
            at(run, level.pileA[kind], level.pileR);
            expect(pileUnder(run)).toBe(kind);
            stepRun(run, { ...ZERO, actionPick: true }, 1 / 120);
            for (let n = 0; n < 40 && run.carried < 0; n++) stepRun(run, ZERO, 1 / 120);
            expect(run.carried, `L${id} pile ${kind}`).toBe(kind);
         }
         for (let i = 0; i < 4; i++) {
            const run = createRun(4, level);
            run.planIndex = i;
            const step = PLAN[i];
            at(run, level.slotA[step.slot], SLOT_R);
            run.carried = step.kind;
            stepRun(run, { ...ZERO, drop: true }, 1 / 120);
            expect(run.dropRating, `L${id} slot ${step.slot}`).toBe(0);
         }
         // the start: the trolley in at 4.5, nothing carried, nothing armed
         const start = createRun(5, level);
         expect(start.radius).toBe(RADIUS_MIN);
         expect(pileUnder(start)).toBe(-1);
      });
   }

   it("the gusts blow the level's way: level 1 always +x, level 2 from the east, level 4 flips, level 5 comes round diagonally", () => {
      const o = { x: 0, z: 0 };
      for (const t of [0, 3, 7.5, 30, 100]) expect(gustDirection(LEVELS[1], t, o)).toEqual({ x: 1, z: 0 });
      expect(gustDirection(LEVELS[2], 0, o).x).toBeCloseTo(-1, 9);
      expect(gustDirection(LEVELS[2], 14, o).x).toBeCloseTo(-1, 9);
      expect(gustDirection(LEVELS[4], 0.5, o).x).toBeCloseTo(1, 9);
      expect(gustDirection(LEVELS[4], 7.5, o).x).toBeCloseTo(-1, 9);
      expect(gustDirection(LEVELS[4], 14.5, o).x).toBeCloseTo(1, 9);
      const round = [0.5, 6.5, 12.5, 18.5].map((t) => ({ ...gustDirection(LEVELS[5], t, o) }));
      expect(round.map((w) => [Math.sign(Math.round(w.x * 10)), Math.sign(Math.round(w.z * 10))])).toEqual([[1, 1], [-1, 1], [-1, -1], [1, -1]]);
      for (const w of round) expect(Math.hypot(w.x, w.z)).toBeCloseTo(1, 9);
      // and the run really blows that way: an idle crane on level 4 swings to +x, then to -x
      const swingX = (t: number) => {
         const run = createRun(2, LEVELS[4]);
         for (let n = 0; n < Math.round(t * 120); n++) stepRun(run, ZERO, 1 / 120);
         return run.swing.x.x;
      };
      expect(swingX(0.6)).toBeLessThan(0);
      expect(swingX(7.6)).toBeGreaterThan(0);
   });

   it("the five levels are five different sites: layout, light, sky, surroundings and building names", () => {
      const sites = new Set(LEVEL_IDS.map((id) => LEVELS[id].site));
      expect(sites.size).toBe(5);
      const layouts = new Set(LEVEL_IDS.map((id) => JSON.stringify([LEVELS[id].pileR, LEVELS[id].pileA, LEVELS[id].slotA])));
      expect(layouts.size).toBe(5);
      expect(new Set(LEVEL_IDS.map((id) => THEMES[LEVELS[id].site].skyTop)).size).toBe(5);
      expect(new Set(LEVEL_IDS.map((id) => THEMES[LEVELS[id].site].lighting)).size).toBeGreaterThanOrEqual(3);
      expect(new Set(LEVEL_IDS.map((id) => JSON.stringify(SETS[LEVELS[id].site].spots))).size).toBe(5);
      expect(new Set(LEVEL_IDS.map((id) => BUILDING_NAMES[LEVELS[id].site][2])).size).toBe(5);
      expect(BUILDING_NAMES.shed).toEqual(["House", "Shop", "Tower"]);
      expect(THEMES.shed.lighting).toBe("day");
   });
});

// ---------- the surroundings ----------

/** The ground distance from (x, z) to the crane's wedge: radius RADIUS_MIN..RADIUS_MAX, |angle| <= ANGLE_LIM. */
function wedgeDistance(x: number, z: number): number {
   let best = Infinity;
   for (let i = 0; i <= 60; i++) {
      const angle = -ANGLE_LIM + (2 * ANGLE_LIM * i) / 60;
      for (let j = 0; j <= 30; j++) {
         const r = RADIUS_MIN + ((RADIUS_MAX - RADIUS_MIN) * j) / 30;
         best = Math.min(best, Math.hypot(x - r * Math.sin(angle), z - r * Math.cos(angle)));
      }
   }
   return best;
}

const VIEWPORTS: ReadonlyArray<readonly [number, number, number]> = [
   [390, 844, 162],
   [1280, 800, 0],
   [844, 390, 83],
];

function cameras(): Vector3[] {
   const out: Vector3[] = [];
   for (const [width, height, banner] of VIEWPORTS) {
      const fit = fitView({ ...viewFor(width, height), width, height, fov: FOV, avoid: banner > 0 ? [{ left: 0, top: height - banner, right: width, bottom: height }] : [] });
      for (const y of [0.5, 1.4]) out.push(new Vector3(LOOK.x, y, LOOK.z).add(new Vector3(...fit.offset)));
   }
   return out;
}

function crosses(a: Vector3, b: Vector3, cx: number, cz: number, r: number, top: number): boolean {
   const p = new Vector3();
   for (let i = 0; i <= 300; i++) {
      p.lerpVectors(a, b, i / 300);
      if (p.y >= 0 && p.y <= top && Math.hypot(p.x - cx, p.z - cz) <= r) return true;
   }
   return false;
}

/** Each placed thing as a vertical cylinder: centre, radius and top. */
function footprints(id: (typeof LEVEL_IDS)[number]): Array<{ name: string; x: number; z: number; r: number; top: number }> {
   const set = SETS[LEVELS[id].site];
   const out: Array<{ name: string; x: number; z: number; r: number; top: number }> = set.spots.map((s) => {
      const g = SET_GLB[s.kind];
      return { name: s.kind, x: s.x, z: s.z, r: (Math.max(g.width, g.depth) / g.height) * s.h * 0.5, top: s.h };
   });
   const L = { gardenShed: [1.8, 3.1], garage: [4.4, 3.8], neonSign: [2.4, 6.3], towerCrane: [1.6, 20] } as const;
   if (set.landmark) out.push({ name: set.landmark, x: set.landmarkAt.x, z: set.landmarkAt.z, r: L[set.landmark][0], top: L[set.landmark][1] });
   return out;
}

describe("construction-worker sites: the surroundings", () => {
   it("each code-built landmark merges into one coloured mesh that stands on the ground inside its footprint", () => {
      const L = { gardenShed: [1.8, 3.1], garage: [4.4, 3.8], towerCrane: [1.6, 20] } as const;
      for (const kind of ["gardenShed", "garage", "towerCrane"] as const) {
         const geo = landmarkGeometry(kind);
         expect(geo.getAttribute("color").count).toBe(geo.getAttribute("position").count);
         geo.computeBoundingBox();
         const box = geo.boundingBox!;
         expect(box.min.y).toBeGreaterThanOrEqual(-1e-6);
         expect(box.max.y).toBeLessThanOrEqual(L[kind][1] + 1e-6);
         // the mast or the walls stay within the footprint the sightline test uses (the crane's jib is up at 16 m)
         if (kind !== "towerCrane") expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThanOrEqual(L[kind][0] + 1e-6);
         geo.dispose();
      }
   });

   it("every GLB is in the manifest and measures what sets.ts says (it stands on y = 0 after setDrop)", async () => {
      for (const kind of Object.keys(SET_GLB) as SetKind[]) {
         const g = SET_GLB[kind] as { url: string; width: number; height: number; depth: number; minY?: number };
         expect(hasModel(g.url), g.url).toBe(true);
         const { cloud } = await readCharacterGlb(g.url);
         const mn = [Infinity, Infinity, Infinity];
         const mx = [-Infinity, -Infinity, -Infinity];
         for (let i = 0; i < cloud.length; i++) {
            mn[i % 3] = Math.min(mn[i % 3], cloud[i]);
            mx[i % 3] = Math.max(mx[i % 3], cloud[i]);
         }
         expect(mx[0] - mn[0], `${kind} width`).toBeCloseTo(g.width, 2);
         expect(mx[1] - mn[1], `${kind} height`).toBeCloseTo(g.height, 2);
         expect(mx[2] - mn[2], `${kind} depth`).toBeCloseTo(g.depth, 2);
         expect(mn[1], `${kind} min y`).toBeCloseTo(g.minY ?? 0, 2);
         expect(setDrop({ kind, x: 0, z: 0, h: 2 }) - (2 * (g.minY ?? 0)) / g.height).toBeCloseTo(0, 9);
      }
   }, 120_000);

   for (const id of LEVEL_IDS) {
      it(`L${id}: everything stands outside the fence, the wedge and the work area, and off every camera line to the work`, () => {
         const level = LEVELS[id];
         const targets: Vector3[] = [];
         for (let y = 0; y <= JIB_Y; y += 2) targets.push(new Vector3(0, y, 0));
         for (const s of slots(level)) for (let y = 0; y <= 6; y += 1.5) targets.push(new Vector3(s.x, y, s.z));
         for (const p of piles(level)) targets.push(new Vector3(p.x, 0.25, p.z), new Vector3(p.x, 0.8, p.z));
         targets.push(new Vector3(level.worker.x, 0.2, level.worker.z), new Vector3(level.worker.x, 1.5, level.worker.z));
         const cams = cameras();
         for (const f of footprints(id)) {
            const outside = Math.abs(f.x) - f.r >= 8.2 || f.z + f.r <= -2.3 || f.z - f.r >= 12.3;
            expect(outside, `${f.name} at (${f.x}, ${f.z}) outside the fence`).toBe(true);
            expect(wedgeDistance(f.x, f.z) - f.r, `${f.name}: gap to the wedge`).toBeGreaterThan(1);
            for (const cam of cams) for (const t of targets) expect(crosses(cam, t, f.x, f.z, f.r, f.top), `${f.name} hides (${t.x.toFixed(1)}, ${t.y}, ${t.z.toFixed(1)})`).toBe(false);
         }
         // the site's own yard keeps today's decor and mixer clear of its piles and its worker
         const ground = DECOR.filter((d) => d.kind === "cone" || d.kind === "barrier" || d.kind === "pipes");
         for (const d of [...ground, ...MIXER_SPOTS]) {
            for (const p of piles(level)) expect(Math.hypot(d.x - p.x, d.z - p.z)).toBeGreaterThan(1);
            expect(Math.hypot(d.x - level.worker.x, d.z - level.worker.z)).toBeGreaterThan(1);
         }
      });
   }
});
