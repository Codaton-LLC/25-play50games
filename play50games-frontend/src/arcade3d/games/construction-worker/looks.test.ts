import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { fitView } from "@/arcade3d/core/view";
import { COLORS, contrastRatio, DECOR, FOV, LOOK, viewFor, WIDE_YAW, YAW } from "./looks";
import { ANGLE_LIM, JIB_Y, PILE_A, PILE_R, RADIUS_MAX, RADIUS_MIN, SLOT_A, SLOT_R } from "./rules";

function pxPerM(width: number, height: number, banner: number): number {
   const view = viewFor(width, height);
   const fit = fitView({
      ...view,
      width,
      height,
      fov: FOV,
      avoid: banner > 0 ? [{ left: 0, top: height - banner, right: width, bottom: height }] : [],
   });
   return height / (2 * fit.distance * Math.tan((FOV * Math.PI) / 360));
}

const VIEWPORTS: ReadonlyArray<readonly [string, number, number, number]> = [
   ["phone portrait", 390, 844, 162],
   ["phone portrait, no banner", 390, 844, 0],
   ["desktop", 1280, 800, 0],
   ["short wide phone", 844, 390, 83],
];

const LOOK_Y = [0.5, 0.9, 1.4];

interface Shot {
   camera: Vector3;
   look: Vector3;
}

function shots(): Array<{ name: string; shot: Shot }> {
   const list: Array<{ name: string; shot: Shot }> = [];
   for (const [name, width, height, banner] of VIEWPORTS) {
      const fit = fitView({
         ...viewFor(width, height),
         width,
         height,
         fov: FOV,
         avoid: banner > 0 ? [{ left: 0, top: height - banner, right: width, bottom: height }] : [],
      });
      for (const y of LOOK_Y) {
         const look = new Vector3(LOOK.x, y, LOOK.z);
         list.push({
            name: `${name}, look y ${y}`,
            shot: { camera: look.clone().add(new Vector3(...fit.offset)), look },
         });
      }
   }
   return list;
}

function crosses(a: Vector3, b: Vector3, cx: number, cz: number, r: number, top: number): boolean {
   const p = new Vector3();
   for (let i = 0; i <= 600; i++) {
      p.lerpVectors(a, b, i / 600);
      if (p.y >= 0 && p.y <= top && Math.hypot(p.x - cx, p.z - cz) <= r) return true;
   }
   return false;
}

function wedgeDistance(x: number, z: number): number {
   let best = Infinity;
   for (let i = 0; i <= 120; i++) {
      const angle = -ANGLE_LIM + (2 * ANGLE_LIM * i) / 120;
      for (let j = 0; j <= 60; j++) {
         const r = RADIUS_MIN + ((RADIUS_MAX - RADIUS_MIN) * j) / 60;
         best = Math.min(best, Math.hypot(x - r * Math.sin(angle), z - r * Math.cos(angle)));
      }
   }
   return best;
}

describe("construction-worker camera", () => {
   it("keeps YAW until the phone is short and wide", () => {
      expect(viewFor(390, 844).yaws).toEqual([YAW]);
      expect(viewFor(1280, 800).yaws).toEqual([YAW]);
      expect(viewFor(844, 390).yaws?.[0]).toBeCloseTo(WIDE_YAW, 5);
      expect(viewFor(390, 844)).toBe(viewFor(391, 800));
   });

   it("stays readable with the cookie banner open", () => {
      const portrait = pxPerM(390, 844, 162);
      const wide = pxPerM(844, 390, 83);
      expect(viewFor(390, 844).area?.max.y).toBe(10.4);
      expect(viewFor(844, 390).area?.max.y).toBe(5.7);
      expect(viewFor(390, 844).area?.min.z).toBeGreaterThan(4);
      expect((viewFor(390, 844).area?.max.x ?? 0) - (viewFor(390, 844).area?.min.x ?? 0)).toBeLessThan(10);
      expect(portrait, "portrait px/m").toBeGreaterThan(28);
      expect(wide, "landscape px/m").toBeGreaterThan(20);
   });
});

describe("construction-worker decor placement and sightlines", () => {
   const groundDecor = DECOR.filter((d) => d.kind === "cone" || d.kind === "barrier" || d.kind === "pipes");

   it("places every ground decor item outside the work area, crane wedge, piles, slots and worker", () => {
      const area = viewFor(390, 844).area!;
      for (const d of groundDecor) {
         // Outside the work area box
         const inAreaX = d.x >= area.min.x && d.x <= area.max.x;
         const inAreaZ = d.z >= area.min.z && d.z <= area.max.z;
         expect(inAreaX && inAreaZ, `decor ${d.kind} at (${d.x}, ${d.z}) inside work area`).toBe(false);

         // Outside the crane wedge
         expect(wedgeDistance(d.x, d.z), `decor ${d.kind} at (${d.x}, ${d.z}) too close to wedge`).toBeGreaterThan(0.6);

         // Outside the worker disc
         expect(Math.hypot(d.x - 2.6, d.z - 5.35), `decor ${d.kind} too close to worker`).toBeGreaterThan(0.8);

         // Outside every pile disc (radius 0.45m + margin)
         for (const a of PILE_A) {
            const px = PILE_R * Math.sin(a);
            const pz = PILE_R * Math.cos(a);
            expect(Math.hypot(d.x - px, d.z - pz), `decor ${d.kind} too close to pile`).toBeGreaterThan(0.8);
         }

         // Outside every slot disc
         for (const a of SLOT_A) {
            const sx = SLOT_R * Math.sin(a);
            const sz = SLOT_R * Math.cos(a);
            expect(Math.hypot(d.x - sx, d.z - sz), `decor ${d.kind} too close to slot`).toBeGreaterThan(1.2);
         }
      }
   });

   it("never occludes the worker, the hook, the building, or the piles from any viewport camera", () => {
      const targets: Vector3[] = [];
      // Crane mast up to jib
      for (let y = 0; y <= JIB_Y; y += 1) targets.push(new Vector3(0, y, 0));
      // Building slots and placed pieces
      for (const a of SLOT_A) for (let y = 0; y <= 6; y += 1) targets.push(new Vector3(SLOT_R * Math.sin(a), y, SLOT_R * Math.cos(a)));
      // Material piles
      for (const a of PILE_A) for (const y of [0.25, 0.8]) targets.push(new Vector3(PILE_R * Math.sin(a), y, PILE_R * Math.cos(a)));
      // Worker
      targets.push(new Vector3(2.6, 0.2, 5.35), new Vector3(2.6, 1.5, 5.35));
      // Hook working range
      for (const r of [5.0, 7.0, 9.2]) {
         for (const a of [-0.4, 0, 0.4]) {
            for (const y of [4.0, 5.5]) {
               targets.push(new Vector3(r * Math.sin(a), y, r * Math.cos(a)));
            }
         }
      }

      for (const d of groundDecor) {
         const radius = d.kind === "barrier" ? 0.9 : d.kind === "pipes" ? 1.2 : 0.3;
         const top = d.kind === "barrier" ? 0.85 : d.kind === "pipes" ? 0.95 : 0.6;

         for (const { name, shot } of shots()) {
            for (const t of targets) {
               expect(
                  crosses(shot.camera, t, d.x, d.z, radius, top),
                  `${name}: decor ${d.kind} at (${d.x}, ${d.z}) crosses line to (${t.x.toFixed(1)}, ${t.y.toFixed(1)}, ${t.z.toFixed(1)})`,
               ).toBe(false);
            }
         }
      }
   });

   it("has high contrast for worker, crane hook and pieces against background and ground", () => {
      // Worker safety vest vs ground
      expect(contrastRatio(COLORS.safetyOrange, COLORS.dirt)).toBeGreaterThan(2.0);
      // Crane yellow vs dark steel frame
      expect(contrastRatio(COLORS.craneYellow, COLORS.craneDark)).toBeGreaterThan(6.5);
      // Crane hook yellow vs sky/fog
      expect(contrastRatio(COLORS.craneDark, COLORS.fog)).toBeGreaterThan(7.0);
      // Pieces have high contrast against ground
      expect(contrastRatio(COLORS.piecePillar, COLORS.dirt)).toBeGreaterThan(2.0);
      expect(contrastRatio(COLORS.pieceWall, COLORS.dirt)).toBeGreaterThan(2.0);
      // Window glass contrast against dark structural frame
      expect(contrastRatio(COLORS.pieceWindow, COLORS.craneDark)).toBeGreaterThan(6.0);
   });
});
