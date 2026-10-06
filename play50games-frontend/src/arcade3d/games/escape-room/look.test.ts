// Open cupboards must show their loot to the fitted camera, and the ground marker must
// cover 24 css px through that same camera (a horizontal ring, not a facing sprite).
import { describe, expect, it } from "vitest";
import {
   BoxGeometry,
   CylinderGeometry,
   Mesh,
   MeshStandardMaterial,
   PerspectiveCamera,
   Raycaster,
   Vector3,
} from "three";
import { fitView, setLensShift, type ScreenRect } from "@/arcade3d/core/view";
import { LOOT_AT, createCupboardShell, poseCupboard } from "./cupboard";
import { MARKER_RADIUS, groundRingScale } from "./marker";
import { MARKER_PX, screenSpriteSize } from "./picker";
import { DOOR_POSITION, STATION_ANCHORS, STATION_BODY, START } from "./rules";

const PITCH = (55 * Math.PI) / 180;
const YAW = (30 * Math.PI) / 180;
const FOCUS = { x: 0, y: 0.5, z: 0 };
const ROOM = {
   min: { x: -6.2, y: -0.15, z: -5.2 },
   max: { x: 6.2, y: 2.3, z: 5.2 },
};
const JITTER = [-0.25, 0, 0.25];

function avoid(width: number, height: number): ScreenRect[] {
   return [
      { left: 0, top: 0, right: width, bottom: 64 },
      { left: 20, top: height - 152, right: 152, bottom: height - 20 },
      { left: width - 194, top: height - 56, right: width - 20, bottom: height - 20 },
   ];
}

function fittedCamera(width: number, height: number): PerspectiveCamera {
   const view = fitView({
      width,
      height,
      fov: 45,
      area: ROOM,
      pitch: PITCH,
      yaws: [YAW],
      focus: [FOCUS],
      margin: { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 },
      padding: 24,
      shift: true,
      avoid: avoid(width, height),
   });
   const camera = new PerspectiveCamera(45, width / height, 0.1, 200);
   camera.position.set(FOCUS.x + view.offset[0], FOCUS.y + view.offset[1], FOCUS.z + view.offset[2]);
   camera.lookAt(FOCUS.x, FOCUS.y, FOCUS.z);
   camera.updateMatrixWorld(true);
   setLensShift(camera, view.shift[0], view.shift[1], width, height);
   return camera;
}

function addLoot(kind: "book" | "battery"): Mesh {
   const mesh = kind === "book"
      ? new Mesh(new BoxGeometry(0.22, 0.08, 0.3), new MeshStandardMaterial())
      : new Mesh(new CylinderGeometry(0.07, 0.07, 0.24, 10), new MeshStandardMaterial());
   mesh.position.set(0, kind === "book" ? 0.06 : 0.12, 0);
   mesh.name = "loot";
   return mesh;
}

const RAY = new Raycaster();
const FROM = new Vector3();
const AT = new Vector3();
const DIR = new Vector3();

describe("escape-room opened cupboard", () => {
   const cameras = [
      ["375x812", fittedCamera(375, 812)],
      ["1280x800", fittedCamera(1280, 800)],
   ] as const;

   it("a ray from the fitted camera hits the loot of an opened cupboard before the shell", () => {
      for (const [label, camera] of cameras) {
         for (const id of [1, 3]) {
            const toward: 1 | -1 = STATION_ANCHORS[id].x < 0 ? 1 : -1;
            for (const dx of JITTER) {
               for (const dz of JITTER) {
                  const x = STATION_ANCHORS[id].x + dx;
                  const z = STATION_ANCHORS[id].z + dz;
                  const shell = createCupboardShell(toward);
                  shell.root.position.set(x + Math.sign(x) * STATION_BODY.offset, 0, z);
                  poseCupboard(shell.hinge, shell.roof, toward, 1);
                  for (const kind of ["book", "battery"] as const) {
                     const loot = addLoot(kind);
                     loot.position.x += LOOT_AT[0];
                     loot.position.y += LOOT_AT[1];
                     loot.position.z += LOOT_AT[2];
                     shell.root.add(loot);
                     shell.root.updateMatrixWorld(true);
                     loot.getWorldPosition(AT);
                     FROM.copy(camera.position);
                     DIR.copy(AT).sub(FROM).normalize();
                     RAY.set(FROM, DIR);
                     const hits = RAY.intersectObject(shell.root, true);
                     const first = hits[0];
                     expect(first, `${label} station ${id} ${kind} @ ${x},${z}`).toBeTruthy();
                     expect(first.object.name, `${label} station ${id} ${kind}`).toBe("loot");
                     shell.root.remove(loot);
                     loot.geometry.dispose();
                     (loot.material as MeshStandardMaterial).dispose();
                  }
                  shell.dispose();
               }
            }
         }
      }
   });
});

function minorDiameter(
   camera: PerspectiveCamera,
   x: number,
   y: number,
   z: number,
   scale: number,
   width: number,
   height: number,
): number {
   const radius = MARKER_RADIUS * scale;
   const samples = 48;
   const pts: Array<[number, number]> = [];
   const v = new Vector3();
   for (let i = 0; i < samples; i++) {
      const a = (i / samples) * Math.PI * 2;
      v.set(x + Math.cos(a) * radius, y, z + Math.sin(a) * radius).project(camera);
      pts.push([(v.x * 0.5 + 0.5) * width, (v.y * -0.5 + 0.5) * height]);
   }
   let mx = 0;
   let my = 0;
   for (const p of pts) { mx += p[0]; my += p[1]; }
   mx /= samples;
   my /= samples;
   let aa = 0;
   let bb = 0;
   let cc = 0;
   for (const p of pts) {
      const dx = p[0] - mx;
      const dy = p[1] - my;
      aa += dx * dx;
      bb += dx * dy;
      cc += dy * dy;
   }
   const trace = aa + cc;
   const det = aa * cc - bb * bb;
   const disc = Math.sqrt(Math.max(0, trace * trace * 0.25 - det));
   const minor = trace * 0.5 - disc;
   let ex = 1;
   let ey = 0;
   if (Math.abs(bb) > 1e-8 || Math.abs(aa - minor) > 1e-8) {
      ex = bb;
      ey = minor - aa;
      const len = Math.hypot(ex, ey) || 1;
      ex /= len;
      ey /= len;
   }
   let lo = Infinity;
   let hi = -Infinity;
   for (const p of pts) {
      const t = (p[0] - mx) * ex + (p[1] - my) * ey;
      if (t < lo) lo = t;
      if (t > hi) hi = t;
   }
   return hi - lo;
}

describe("escape-room runner marker", () => {
   it("the ground ring covers 24 css px through the fitted camera, on the phone and near the door", () => {
      const views = [
         { width: 375, height: 812, at: [START.x, START.z] as const },
         { width: 1280, height: 800, at: [DOOR_POSITION.x, DOOR_POSITION.z] as const },
         { width: 812, height: 375, at: [DOOR_POSITION.x, DOOR_POSITION.z] as const },
      ];
      for (const view of views) {
         const camera = fittedCamera(view.width, view.height);
         const y = 0.03;
         const scale = groundRingScale(camera, view.at[0], y, view.at[1], MARKER_PX, view.width, view.height);
         const px = minorDiameter(camera, view.at[0], y, view.at[1], scale, view.width, view.height);
         expect(px, `${view.width}x${view.height}`).toBeGreaterThan(23);
         expect(px, `${view.width}x${view.height}`).toBeLessThan(25);
         const forward = new Vector3();
         camera.getWorldDirection(forward);
         const depth = forward.dot(new Vector3(view.at[0], y, view.at[1]).sub(camera.position));
         const oldScale = screenSpriteSize(Math.abs(depth), 45, view.height, MARKER_PX);
         const oldPx = minorDiameter(camera, view.at[0], y, view.at[1], oldScale, view.width, view.height);
         expect(oldPx, `old ${view.width}x${view.height}`).toBeLessThan(22);
      }
   });
});
