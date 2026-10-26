// The cement mixer on the real GLB (through core modelParts, what <Model> draws): fitted 1.5 m tall on
// y = 0, and standing clear of everything the game plays on or looks at: the camera's work area
// (looks.ts), the crane's wedge (rules.ts), the piles, the slots and the worker, and off every line of
// sight from the camera to the crane, the building and the piles (the camera of every viewport shape).
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, PerspectiveCamera, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { fitView } from "@/arcade3d/core/view";
import { ASSETS, MIXER, MIXER_GLB, MIXER_HEIGHT, MIXER_SPOTS } from "./assets";
import { FOV, LOOK, viewFor } from "./looks";
import { ANGLE_LIM, JIB_Y, PILE_A, PILE_R, RADIUS_MIN, RADIUS_MAX, SLOT_A, SLOT_R } from "./rules";

/** The GLB's vertices as the asset's fit draws them (metres, model origin; not yet placed on the site). */
async function drawn(): Promise<Vector3[]> {
   const { local, node } = await readCharacterGlb(ASSETS.cementMixer.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, ASSETS.cementMixer);
   expect(parts).toHaveLength(1);
   const points: Vector3[] = [];
   for (let i = 0; i < local.length; i += 3) points.push(new Vector3(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix));
   geometry.dispose();
   return points;
}

/** The mixer's vertices on the site: turned by MIXER.yaw and moved to (MIXER.x, MIXER.z). */
function onSite(points: Vector3[]): Vector3[] {
   const m = new Matrix4().makeRotationY(MIXER.yaw).setPosition(MIXER.x, 0, MIXER.z);
   return points.map((p) => p.clone().applyMatrix4(m));
}

const VIEWPORTS: ReadonlyArray<readonly [string, number, number, number]> = [
   ["phone portrait", 390, 844, 162],
   ["phone portrait, no banner", 390, 844, 0],
   ["desktop", 1280, 800, 0],
   ["desktop wide", 1920, 1080, 0],
   ["short wide phone", 844, 390, 83],
   ["tablet", 820, 1180, 0],
];
/** The roof (0.75 m a floor, up to 4 floors) moves the camera's look-at up: LOOK.y = 0.35 x roof. */
const LOOK_Y = [0.5, 0.9, 1.4];

interface Shot {
   camera: Vector3;
   look: Vector3;
   shift: [number, number];
   width: number;
   height: number;
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
         list.push({ name: `${name}, look y ${y}`, shot: { camera: look.clone().add(new Vector3(...fit.offset)), look, shift: fit.shift, width, height } });
      }
   }
   return list;
}

/** Does the segment a -> b pass through the vertical cylinder (centre c on the ground, radius r, from y 0 to top)? */
function crosses(a: Vector3, b: Vector3, cx: number, cz: number, r: number, top: number): boolean {
   const p = new Vector3();
   for (let i = 0; i <= 600; i++) {
      p.lerpVectors(a, b, i / 600);
      if (p.y >= 0 && p.y <= top && Math.hypot(p.x - cx, p.z - cz) <= r) return true;
   }
   return false;
}

/** The ground distance from (x, z) to the crane's wedge: radius RADIUS_MIN..RADIUS_MAX, |angle from +z| <= ANGLE_LIM. */
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

describe("construction-worker cement mixer", () => {
   it("is in the manifest, drawn 1.5 m tall on y = 0 and centred on x and z (within 3 % of the target)", async () => {
      expect(hasModel(ASSETS.cementMixer.url)).toBe(true);
      expect(ASSETS.cementMixer.url).toBe("/models/3d/construction-worker/cementMixer.glb");
      const box = new Box3().setFromPoints(await drawn());
      const size = box.getSize(new Vector3());
      expect(Math.abs(size.y / MIXER_HEIGHT - 1)).toBeLessThan(0.03);
      expect(Math.abs(box.min.y)).toBeLessThan(0.01);
      // the measured GLB bounds in assets.ts
      const k = MIXER_HEIGHT / MIXER_GLB.height;
      expect(size.x).toBeCloseTo(MIXER_GLB.width * k, 2);
      expect(size.z).toBeCloseTo(MIXER_GLB.depth * k, 2);
      const c = box.getCenter(new Vector3());
      expect(Math.abs(c.x)).toBeLessThan(0.02);
      expect(Math.abs(c.z)).toBeLessThan(0.02);
   });

   it("stands outside the work area, the crane's wedge, the piles, the slots and the worker, inside the fence", async () => {
      const points = onSite(await drawn());
      const box = new Box3().setFromPoints(points);
      const radius = Math.max(...points.map((p) => Math.hypot(p.x - MIXER.x, p.z - MIXER.z)));
      expect(radius).toBeLessThan(0.8);
      // the camera's work area (looks.ts AREA, the wedge's window): the box stays 1 m off it
      const area = viewFor(390, 844).area!;
      const gapX = Math.max(area.min.x - box.max.x, box.min.x - area.max.x, 0);
      const gapZ = Math.max(area.min.z - box.max.z, box.min.z - area.max.z, 0);
      expect(Math.hypot(gapX, gapZ), "gap to the work area").toBeGreaterThan(1);
      // the crane's wedge, grown by 1 m for the swing of a load: the circle stays out
      expect(wedgeDistance(MIXER.x, MIXER.z) - radius, "gap to the crane's wedge").toBeGreaterThan(1);
      // piles, slots and the worker
      const spots: Array<[string, number, number, number]> = [["worker", 2.6, 5.35, 0.5]];
      for (const a of PILE_A) spots.push(["pile", PILE_R * Math.sin(a), PILE_R * Math.cos(a), 0.6]);
      for (const a of SLOT_A) spots.push(["slot", SLOT_R * Math.sin(a), SLOT_R * Math.cos(a), 1.5]);
      for (const [name, x, z, r] of spots) expect(Math.hypot(MIXER.x - x, MIXER.z - z) - radius - r, `gap to a ${name}`).toBeGreaterThan(0.8);
      // the crane's mast (at the origin) and the other decor (the crate at (-6.2, 4.2), the fence at x -8)
      expect(Math.hypot(MIXER.x, MIXER.z) - radius).toBeGreaterThan(5);
      expect(Math.hypot(MIXER.x + 6.2, MIXER.z - 4.2) - radius - 0.6).toBeGreaterThan(0.5);
      expect(box.min.x, "inside the fence").toBeGreaterThan(-8 + 0.4);
      expect(box.max.z).toBeLessThan(12 - 0.4);
      expect(box.max.y).toBeLessThan(1.6);
   });

   it("is never between the camera and the crane, the building, the piles or the worker, in any viewport shape or roof height", async () => {
      const points = onSite(await drawn());
      const radius = Math.max(...points.map((p) => Math.hypot(p.x - MIXER.x, p.z - MIXER.z))) + 0.15;
      const top = Math.max(...points.map((p) => p.y)) + 0.1;
      const targets: Vector3[] = [];
      for (let y = 0; y <= JIB_Y; y += 1) targets.push(new Vector3(0, y, 0));
      for (const a of SLOT_A) for (let y = 0; y <= 6; y += 1) targets.push(new Vector3(SLOT_R * Math.sin(a), y, SLOT_R * Math.cos(a)));
      for (const a of PILE_A) for (const y of [0.25, 0.8]) targets.push(new Vector3(PILE_R * Math.sin(a), y, PILE_R * Math.cos(a)));
      targets.push(new Vector3(2.6, 0.2, 5.35), new Vector3(2.6, 1.5, 5.35));
      for (const { name, shot } of shots()) {
         for (const t of targets) expect(crosses(shot.camera, t, MIXER.x, MIXER.z, radius, top), `${name}: camera -> (${t.x.toFixed(1)}, ${t.y}, ${t.z.toFixed(1)})`).toBe(false);
      }
   });

   it("is in the frame (its middle inside 0.9 of the half-width and half-height) in every viewport shape, so the decor is seen", async () => {
      const points = onSite(await drawn());
      const centre = new Box3().setFromPoints(points).getCenter(new Vector3());
      for (const { name, shot } of shots()) {
         const camera = new PerspectiveCamera(FOV, shot.width / shot.height, 0.1, 200);
         camera.position.copy(shot.camera);
         camera.lookAt(shot.look);
         camera.updateMatrixWorld(true);
         camera.updateProjectionMatrix();
         const ndc = centre.clone().project(camera);
         // the lens shift moves the picture by `shift` in NDC
         expect(Math.abs(ndc.x + shot.shift[0]), `${name}: x`).toBeLessThan(0.9);
         expect(Math.abs(ndc.y + shot.shift[1]), `${name}: y`).toBeLessThan(0.9);
      }
   });

   it("every level 4-5 mixer spot (and the always-drawn first one) is off every camera line of sight and clear of the play area", async () => {
      expect(MIXER_SPOTS[0]).toMatchObject({ x: MIXER.x, z: MIXER.z, rotY: MIXER.yaw });
      const base = await drawn();
      const area = viewFor(390, 844).area!;
      const targets: Vector3[] = [];
      for (let y = 0; y <= JIB_Y; y += 1) targets.push(new Vector3(0, y, 0));
      for (const a of SLOT_A) for (let y = 0; y <= 6; y += 1) targets.push(new Vector3(SLOT_R * Math.sin(a), y, SLOT_R * Math.cos(a)));
      for (const a of PILE_A) for (const y of [0.25, 0.8]) targets.push(new Vector3(PILE_R * Math.sin(a), y, PILE_R * Math.cos(a)));
      targets.push(new Vector3(2.6, 0.2, 5.35), new Vector3(2.6, 1.5, 5.35));
      for (const spot of MIXER_SPOTS) {
         const m = new Matrix4().makeRotationY(spot.rotY ?? 0).setPosition(spot.x, 0, spot.z);
         const points = base.map((p) => p.clone().applyMatrix4(m));
         const box = new Box3().setFromPoints(points);
         const radius = Math.max(...points.map((p) => Math.hypot(p.x - spot.x, p.z - spot.z))) + 0.15;
         const top = Math.max(...points.map((p) => p.y)) + 0.1;
         const gapX = Math.max(area.min.x - box.max.x, box.min.x - area.max.x, 0);
         const gapZ = Math.max(area.min.z - box.max.z, box.min.z - area.max.z, 0);
         expect(Math.hypot(gapX, gapZ), `(${spot.x}, ${spot.z}): gap to the work area`).toBeGreaterThan(0.5);
         expect(wedgeDistance(spot.x, spot.z) - radius, `(${spot.x}, ${spot.z}): gap to the crane's wedge`).toBeGreaterThan(0.5);
         for (const { name, shot } of shots()) {
            for (const t of targets) expect(crosses(shot.camera, t, spot.x, spot.z, radius, top), `${name}: spot (${spot.x}, ${spot.z}) -> (${t.x.toFixed(1)}, ${t.y}, ${t.z.toFixed(1)})`).toBe(false);
         }
      }
   });
});
