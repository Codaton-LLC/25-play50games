// Open cupboards, the desk drawer and the under-desk box must show their loot to the fitted
// camera, and the ground marker must cover 24 css px through that same camera (a horizontal
// ring, not a facing sprite).
import { describe, expect, it } from "vitest";
import {
   Box3,
   BoxGeometry,
   CylinderGeometry,
   Group,
   Mesh,
   MeshStandardMaterial,
   PerspectiveCamera,
   Raycaster,
   Vector3,
} from "three";
import { fitView, setLensShift, type ScreenRect } from "@/arcade3d/core/view";
import { ASSETS, BOOK_DRAWN, KEY_DRAWN } from "./assets";
import { LOOT_AT, createCupboardShell, poseCupboard } from "./cupboard";
import {
   DESK_HALF_X,
   DESK_HALF_Z,
   DESK_TOP_Y,
   DRAWER,
   UNDER_DESK,
   drawerX,
   underDeskLid,
   underDeskX,
} from "./desk";
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
      ? new Mesh(new BoxGeometry(...BOOK_DRAWN.size), new MeshStandardMaterial())
      : new Mesh(new CylinderGeometry(0.07, 0.07, 0.24, 10), new MeshStandardMaterial());
   mesh.position.set(0, kind === "book" ? BOOK_DRAWN.y : 0.12, 0);
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

type DeskLoot = "key" | "book" | "battery";

/**
 * The loot as Primitives.tsx draws it: the key and book boxes (their stand-ins, and the group C GLBs
 * fitted to them: assets.test.ts), the battery GLB's measured box.
 */
function deskLoot(kind: DeskLoot): Mesh {
   let mesh: Mesh;
   if (kind === "key") {
      mesh = new Mesh(new BoxGeometry(...KEY_DRAWN.size), new MeshStandardMaterial());
      mesh.position.y = KEY_DRAWN.y;
   } else if (kind === "book") {
      mesh = new Mesh(new BoxGeometry(...BOOK_DRAWN.size), new MeshStandardMaterial());
      mesh.position.y = BOOK_DRAWN.y;
   } else {
      // shared battery.glb: 1.02 x 1.90 x 1.01, standing on y = 0, scaled in assets.ts
      const k = ASSETS.battery.scale ?? 1;
      mesh = new Mesh(new BoxGeometry(1.02 * k, 1.9 * k, 1.01 * k), new MeshStandardMaterial());
      mesh.position.y = (1.9 * k) / 2;
   }
   mesh.name = "loot";
   return mesh;
}

interface DeskStation {
   root: Group;
   loot: Mesh;
   lid: Mesh | null;
   cx: number;
   toward: 1 | -1;
}

/**
 * Station 0 (drawer) or 2 (under-desk) as Primitives.tsx builds it, posed at `open`, with the desk
 * as a solid body box up to its top (the GLB's legs could only let more through).
 */
function deskStation(id: 0 | 2, x: number, z: number, open: number, kind: DeskLoot): DeskStation {
   const toward: 1 | -1 = x < 0 ? 1 : -1;
   const cx = x + Math.sign(x) * STATION_BODY.offset;
   const root = new Group();
   root.position.set(cx, 0, z);
   const desk = new Mesh(new BoxGeometry(DESK_HALF_X * 2, DESK_TOP_Y, DESK_HALF_Z * 2), new MeshStandardMaterial());
   desk.position.y = DESK_TOP_Y / 2;
   desk.name = "desk";
   root.add(desk);
   const part = new Group();
   const holder = new Group();
   let lid: Mesh | null = null;
   if (id === 0) {
      part.position.set(toward * drawerX(open), DRAWER.y, 0);
      const drawer = new Mesh(new BoxGeometry(...DRAWER.size), new MeshStandardMaterial());
      drawer.name = "drawer";
      part.add(drawer);
      holder.position.y = DRAWER.lootY;
   } else {
      const [w, h, d] = UNDER_DESK.size;
      part.position.set(toward * underDeskX(open), UNDER_DESK.y, 0);
      const box = new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial());
      box.name = "box";
      part.add(box);
      const hinge = new Group();
      hinge.position.set(0, h / 2, -d / 2);
      hinge.rotation.x = -UNDER_DESK.lidOpen * underDeskLid(open);
      lid = new Mesh(new BoxGeometry(w, UNDER_DESK.lidThick, d), new MeshStandardMaterial());
      lid.position.set(0, UNDER_DESK.lidThick / 2, d / 2);
      lid.name = "lid";
      hinge.add(lid);
      part.add(hinge);
      holder.position.y = UNDER_DESK.lootY;
   }
   const loot = deskLoot(kind);
   holder.add(loot);
   part.add(holder);
   root.add(part);
   root.updateMatrixWorld(true);
   return { root, loot, lid, cx, toward };
}

function disposeTree(root: Group): void {
   root.traverse((o) => {
      if (o instanceof Mesh) {
         o.geometry.dispose();
         (o.material as MeshStandardMaterial).dispose();
      }
   });
}

const BOX = new Box3();

describe("escape-room opened desk stations", () => {
   const cameras = [
      ["375x812", fittedCamera(375, 812)],
      ["1280x800", fittedCamera(1280, 800)],
   ] as const;
   const kinds: DeskLoot[] = ["key", "book", "battery"];

   it("a ray from the fitted camera hits the opened drawer's and under-desk box's loot before the desk", () => {
      for (const [label, camera] of cameras) {
         for (const id of [0, 2] as const) {
            for (const dx of JITTER) {
               for (const dz of JITTER) {
                  const x = STATION_ANCHORS[id].x + dx;
                  const z = STATION_ANCHORS[id].z + dz;
                  for (const kind of kinds) {
                     const station = deskStation(id, x, z, 1, kind);
                     BOX.setFromObject(station.loot);
                     // the loot's centre and the middle of its top face
                     const targets = [
                        BOX.getCenter(new Vector3()),
                        new Vector3((BOX.min.x + BOX.max.x) / 2, BOX.max.y - 0.01, (BOX.min.z + BOX.max.z) / 2),
                     ];
                     for (const target of targets) {
                        DIR.copy(target).sub(camera.position).normalize();
                        RAY.set(camera.position, DIR);
                        const first = RAY.intersectObject(station.root, true)[0];
                        const where = `${label} station ${id} ${kind} @ ${x},${z}`;
                        expect(first, where).toBeTruthy();
                        expect(first.object.name, where).toBe("loot");
                     }
                     disposeTree(station.root);
                  }
               }
            }
         }
      }
   });

   it("opened loot is out past the desk top's edge, or lower than the top", () => {
      for (const id of [0, 2] as const) {
         for (const dx of JITTER) {
            for (const kind of kinds) {
               const x = STATION_ANCHORS[id].x + dx;
               const station = deskStation(id, x, STATION_ANCHORS[id].z, 1, kind);
               BOX.setFromObject(station.loot);
               const edge = station.cx + station.toward * DESK_HALF_X;
               const outside = station.toward > 0 ? BOX.min.x > edge : BOX.max.x < edge;
               expect(outside || BOX.max.y < DESK_TOP_Y, `station ${id} ${kind}`).toBe(true);
               disposeTree(station.root);
            }
         }
      }
   });

   it("the under-desk lid stays below the desk top while it is under it, through the whole open", () => {
      for (let i = 0; i <= 50; i++) {
         const open = i / 50;
         const station = deskStation(2, STATION_ANCHORS[2].x, STATION_ANCHORS[2].z, open, "battery");
         expect(station.lid).toBeTruthy();
         BOX.setFromObject(station.lid as Mesh);
         const edge = station.cx + station.toward * DESK_HALF_X;
         const underTop = station.toward > 0 ? BOX.min.x < edge : BOX.max.x > edge;
         // a tabletop is a few cm thick: the lid may not rise into it while it is under the desk
         if (underTop) expect(BOX.max.y, `open ${open}`).toBeLessThan(DESK_TOP_Y - 0.05);
         disposeTree(station.root);
      }
      // and it does open, well up, once the box is out
      const opened = deskStation(2, STATION_ANCHORS[2].x, STATION_ANCHORS[2].z, 1, "key");
      BOX.setFromObject(opened.lid as Mesh);
      expect(BOX.max.y).toBeGreaterThan(UNDER_DESK.y + UNDER_DESK.size[1] / 2 + 0.45);
      disposeTree(opened.root);
   });

   it("closed, the under-desk box hides under the desk; open, it is past the edge and short of the anchor", () => {
      expect(underDeskX(0) + UNDER_DESK.size[0] / 2).toBeLessThanOrEqual(DESK_HALF_X);
      expect(underDeskX(1) - UNDER_DESK.size[0] / 2).toBeGreaterThan(DESK_HALF_X);
      // the anchor is STATION_BODY.offset (1.0) from the body's centre
      expect(underDeskX(1) + UNDER_DESK.size[0] / 2).toBeLessThan(STATION_BODY.offset + 0.05);
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
