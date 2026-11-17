// Camera views: the cycle, the saved view, the follow rules per steering (stable: a camera-steered
// chase never chases its own tail), the blend round the pivot, the rig pose round trip, and the prefs.
import { beforeEach, describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import { createOrbit, orbitDirection, orbitSnap, stepOrbit, wrapAngle } from "./orbit";
import { clipOrbitDistance } from "./orbitCollision";
import {
   CAMERA_PREFS_KEY,
   cameraPrefs,
   cameraTurned,
   liveViews,
   markCameraHintSeen,
   memoryCameraStorage,
   noteCameraTurned,
   parseCameraPrefs,
   publishViews,
   requestViewCycle,
   resetCameraSignals,
   saveView,
   savedView,
   setCameraPrefsStorage,
   viewCycleRequests,
} from "./cameraPrefs";
import {
   CHARACTER_VIEWS,
   VEHICLE_VIEWS,
   VIEW_ORDER,
   blendEase,
   blendPose,
   cameraYawOf,
   createPose,
   nextView,
   normalizeViews,
   poseFromCamera,
   startView,
   viewFraming,
   viewOrbitSettings,
   viewStartYaw,
   viewTravel,
   type ViewId,
} from "./views";

const DEG = Math.PI / 180;

describe("view lists", () => {
   it("every list holds default, keeps VIEW_ORDER and cycles round", () => {
      expect(normalizeViews(["free", "chase"])).toEqual(["default", "chase", "free"]);
      expect(normalizeViews(undefined)).toEqual(VIEW_ORDER);
      expect(CHARACTER_VIEWS).toEqual(["default", "chase", "front", "top", "free"]);
      expect(VEHICLE_VIEWS).toEqual(CHARACTER_VIEWS);
      const list = normalizeViews(VIEW_ORDER);
      let v: ViewId = "default";
      const seen: ViewId[] = [];
      for (let i = 0; i < 5; i++) seen.push((v = nextView(list, v)));
      expect(seen).toEqual(["chase", "front", "top", "free", "default"]);
   });

   it("a run starts in the saved view only when the game still offers it", () => {
      expect(startView(["default", "chase"], "chase")).toBe("chase");
      expect(startView(["default", "chase"], "free")).toBe("default");
      expect(startView(["default", "chase"], null)).toBe("default");
   });
});

describe("view follow", () => {
   const run = (view: "chase" | "front" | "top" | "free", steering: "camera" | "vehicle", heading: number, vx: number, vz: number, seconds = 4) => {
      const framing = viewFraming("character", view);
      const o = createOrbit({ yaw: 0, ...viewOrbitSettings(view, "character", steering, framing) });
      orbitSnap(o, viewStartYaw(view, 0, 0), framing.pitch, framing.distance);
      const t = { x: 0, z: 0 };
      for (let s = 0; s < seconds; s += 1 / 60) {
         viewTravel(view, steering, heading, vx, vz, t);
         stepOrbit(o, 1 / 60, t.x, t.z, o.settings.autoFollow);
      }
      return o;
   };

   it("starts behind the heading (chase), in front (front), at the fitted yaw (top)", () => {
      expect(viewStartYaw("chase", 0.3, 1)).toBeCloseTo(wrapAngle(0.3 + Math.PI), 9);
      expect(viewStartYaw("front", 0.3, 1)).toBeCloseTo(0.3, 9);
      expect(viewStartYaw("top", 0.3, 1)).toBeCloseTo(1, 9);
   });

   it("vehicle steering: chase and front lock onto the heading, even standing still or reversing", () => {
      const h = 1.2;
      const chase = run("chase", "vehicle", h, 0, 0);
      expect(wrapAngle(chase.viewYaw - (h + Math.PI))).toBeCloseTo(0, 2);
      const front = run("front", "vehicle", h, -Math.sin(h) * 3, -Math.cos(h) * 3);
      expect(wrapAngle(front.viewYaw - h)).toBeCloseTo(0, 2);
   });

   it("camera steering: chase drifts behind the travel, never swings round towards the camera", () => {
      const side = run("chase", "camera", Math.PI / 2, 3, 0, 6); // running to +x, the camera starts at +z
      expect(wrapAngle(side.viewYaw - -Math.PI / 2)).toBeCloseTo(0, 1);
      const toward = run("chase", "camera", 0, 0, 3, 6); // running at the camera (+z): no swing
      expect(toward.viewYaw).toBeCloseTo(Math.PI, 6);
   });

   it("camera steering: front and top hold their yaw, so holding a direction never spins the camera", () => {
      for (const view of ["front", "top"] as const) {
         const o = run(view, "camera", 0, 3, 0, 6);
         expect(o.viewYaw).toBeCloseTo(viewStartYaw(view, 0, 0), 9);
      }
   });

   it("the stick under the drawn yaw keeps its length: speed proofs hold in every view", () => {
      for (let yaw = -3; yaw <= 3; yaw += 0.5) {
         const d = inputToWorld(0.6, -0.8, yaw);
         expect(Math.hypot(d.x, d.z)).toBeCloseTo(1, 9);
      }
   });
});

describe("poses", () => {
   it("blends round the pivot: chase -> front passes beside the hero, never through it", () => {
      const a = createPose();
      const b = createPose();
      a.yaw = Math.PI;
      a.distance = 6;
      b.yaw = 0;
      b.distance = 5;
      const out = createPose();
      for (let k = 0; k <= 1.0001; k += 0.1) expect(blendPose(a, b, blendEase(k), out).distance).toBeGreaterThanOrEqual(5);
      expect(blendPose(a, b, 1, out).yaw).toBeCloseTo(0, 9);
      expect(blendPose(a, b, 0, out).yaw).toBeCloseTo(Math.PI, 9);
      expect(blendEase(0)).toBe(0);
      expect(blendEase(1)).toBe(1);
      expect(blendEase(0.5)).toBeCloseTo(0.5, 9);
   });

   it("a rig camera round-trips through a pose (position and view direction)", () => {
      const p = { x: 1, y: 1, z: -2 };
      const cam = { x: 4, y: 9, z: 6 };
      const look = { x: 1.5, y: 0, z: -1 };
      const len = Math.hypot(look.x - cam.x, look.y - cam.y, look.z - cam.z);
      const f = { x: (look.x - cam.x) / len, y: (look.y - cam.y) / len, z: (look.z - cam.z) / len };
      const pose = poseFromCamera(p.x, p.y, p.z, cam.x, cam.y, cam.z, f.x, f.y, f.z, createPose());
      const dir = orbitDirection(pose.yaw, pose.pitch, { x: 0, y: 0, z: 0 });
      expect(p.x + dir.x * pose.distance).toBeCloseTo(cam.x, 9);
      expect(p.y + dir.y * pose.distance).toBeCloseTo(cam.y, 9);
      expect(p.z + dir.z * pose.distance).toBeCloseTo(cam.z, 9);
      // the look point lies on the camera's own view ray
      const lx = p.x + pose.lookX - cam.x;
      const ly = p.y + pose.lookY - cam.y;
      const lz = p.z + pose.lookZ - cam.z;
      const l = Math.hypot(lx, ly, lz);
      expect(lx / l).toBeCloseTo(f.x, 9);
      expect(ly / l).toBeCloseTo(f.y, 9);
      expect(lz / l).toBeCloseTo(f.z, 9);
   });

   it("cameraYawOf is fitView's yaw (the camera at +z looking at the origin is yaw 0)", () => {
      expect(cameraYawOf(0, 5, 0, 0, 9)).toBeCloseTo(0, 9);
      expect(cameraYawOf(5, 0, 0, 0, 9)).toBeCloseTo(Math.PI / 2, 9);
      expect(cameraYawOf(0, 0, 0, 0, 9)).toBe(9); // straight down: the fallback
   });
});

describe("camera prefs and signals", () => {
   beforeEach(() => {
      setCameraPrefsStorage(memoryCameraStorage());
      resetCameraSignals();
   });

   it("defaults, bad data and unknown views fall back", () => {
      expect(cameraPrefs()).toEqual({ hintSeen: false, autoFollow: true, views: {} });
      expect(parseCameraPrefs("{nope")).toEqual({ hintSeen: false, autoFollow: true, views: {} });
      expect(parseCameraPrefs('{"views":{"postman-3d":"chase","x":"sideways","Bad Slug":"top"}}').views).toEqual({ "postman-3d": "chase" });
   });

   it("the last view per game and the hint are stored once, through the adapter only", () => {
      const store = memoryCameraStorage();
      setCameraPrefsStorage(store);
      expect(savedView("postman-3d")).toBeNull();
      saveView("postman-3d", "top");
      saveView("pizza-kitchen-3d", "free");
      markCameraHintSeen();
      setCameraPrefsStorage(store); // a reload
      expect(savedView("postman-3d")).toBe("top");
      expect(savedView("pizza-kitchen-3d")).toBe("free");
      expect(JSON.parse(store.items[CAMERA_PREFS_KEY]).hintSeen).toBe(true);
   });

   it("the button's cycle requests count up; the live list is published; the first turn is reported once", () => {
      const before = viewCycleRequests();
      requestViewCycle();
      expect(viewCycleRequests()).toBe(before + 1);
      expect(liveViews().list).toEqual([]);
      publishViews({ list: ["default", "chase"], current: "chase", key: "C", oneFinger: true });
      expect(liveViews().current).toBe("chase");
      const same = liveViews();
      publishViews({ list: ["default", "chase"], current: "chase", key: "C", oneFinger: true });
      expect(liveViews()).toBe(same); // no change, no new snapshot
      publishViews(null);
      expect(liveViews().list).toEqual([]);
      noteCameraTurned();
      noteCameraTurned();
      expect(cameraTurned()).toBe(1);
   });
});

describe("view collision", () => {
   it("a box right beside the hero does not pull the camera into its head; one further back does", () => {
      const van = { min: { x: -2, y: 0, z: 0.5 }, max: { x: 2, y: 2.2, z: 4 } }; // starts 0.5 m behind the hero
      const dir = orbitDirection(0, 22 * DEG, { x: 0, y: 0, z: 0 });
      const opts = { radius: 0.3, minDistance: 2.2, ignoreNear: 1 };
      expect(clipOrbitDistance(0, 1.1, 0, dir.x, dir.y, dir.z, 6, [van], 1, opts)).toBe(6);
      expect(clipOrbitDistance(0, 1.1, 0, dir.x, dir.y, dir.z, 6, [van], 1)).toBeLessThan(1.3); // Menu 2's default: every box
      const wall = { min: { x: -2, y: 0, z: 3 }, max: { x: 2, y: 4, z: 3.3 } };
      expect(clipOrbitDistance(0, 1.1, 0, dir.x, dir.y, dir.z, 6, [wall], 1, opts)).toBeCloseTo((3 - 0.3) / Math.cos(22 * DEG), 6);
   });
});

describe("free view settings", () => {
   it("pitch stays between just under the horizon and almost top-down", () => {
      const s = viewOrbitSettings("free", "vehicle", "vehicle", viewFraming("vehicle", "free"));
      expect(s.autoFollow).toBe(true);
      expect(viewFraming("character", "top").pitch).toBeGreaterThan(70 * DEG);
   });
});
