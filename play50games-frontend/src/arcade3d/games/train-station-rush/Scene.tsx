"use client";

// Train Station Rush scene. One useRunFrame steps rules.ts; visuals read the run and animate with
// useGameTime. The camera follows the worker along the station (looks.ts); trains are two pools (the
// carriage GLB and the code engine), travellers one pool, every plate one canvas atlas.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import {
   BufferAttribute,
   BufferGeometry,
   CanvasTexture,
   Euler,
   Matrix4,
   MeshStandardMaterial,
   Quaternion,
   RepeatWrapping,
   SRGBColorSpace,
   Vector3,
   type Group,
   type Mesh,
   type MeshBasicMaterial,
} from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import { playSfx } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useActionPop, useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetBeacon, TargetMarkers } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { waddle, type BodyOffset } from "@/arcade3d/core/motion";
import { useQuality } from "@/arcade3d/core/quality";
import { BlobShadow, DynamicInstanced, Instanced, useCanvasTexture } from "@/arcade3d/core/render";
import {
   HumanoidModel,
   POSE_MASK,
   blendPoses,
   bodyLift,
   carryPose,
   cheerPose,
   createPose,
   gaitPhaseStep,
   idlePose,
   useHumanoidPose,
   walkPose,
   wrapPhase,
} from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, CAR_LENGTH, WORKER_LANDMARKS, WORKER_SCALE } from "./assets";
import type { StationLevel } from "./levels";
import Decor from "./Decor";
import {
   ATLAS,
   BED_DEPTH,
   CAR_GAP,
   COLORS,
   DAMPING,
   FOV,
   LOCO_LEN,
   LOOK_Y,
   NOSE_Z,
   cellPx,
   cellUv,
   islandSpots,
   lookBounds,
   lookFor,
   platformLook,
   restLook,
   setPieceSpots,
   trackSpots,
   trainOffset,
   viewFor,
   wallSpots,
   type LabelQuad,
   type PlatformShape,
   type StationLook,
} from "./looks";
import { BackpackPrimitive, ClockPrimitive, PropsPrimitive, SuitcasePrimitive, WorkerFigure, useCarParts, useLocoParts, useTravellerParts } from "./Primitives";
import {
   CONCOURSE_DEPTH,
   MAX_SPEED,
   SPOTS,
   STATION_END,
   concourseHalf,
   createRun,
   padPoint,
   step,
   targetAt,
   trackX,
   trainIn,
   type Run,
   type Solid,
} from "./rules";

export const useStationLevel = () => useLevel<StationLevel>();

const AT = { x: 0, y: 0, z: 0 };
const V = new Vector3();
const Q = new Quaternion();
const S = new Vector3(1, 1, 1);
const E = new Euler();
const WOFF: BodyOffset = { y: 0, roll: 0, yaw: 0, squash: 1 };
const MAX_CADENCE = 3.4;

// ---------- the plate atlas ----------

function shapePath(ctx: CanvasRenderingContext2D, shape: PlatformShape, cx: number, cy: number, r: number) {
   ctx.beginPath();
   if (shape === "circle") ctx.arc(cx, cy, r, 0, Math.PI * 2);
   else if (shape === "square") ctx.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
   else if (shape === "triangle") {
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r * 0.8);
      ctx.lineTo(cx - r, cy + r * 0.8);
   } else if (shape === "diamond") {
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
   } else if (shape === "star") {
      for (let i = 0; i < 10; i++) {
         const a = -Math.PI / 2 + (i * Math.PI) / 5;
         const rr = i % 2 ? r * 0.45 : r;
         ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
   } else {
      ctx.moveTo(cx, cy - r);
      ctx.bezierCurveTo(cx + r * 0.2, cy - r * 0.4, cx + r, cy + r * 0.1, cx, cy + r);
      ctx.bezierCurveTo(cx - r, cy + r * 0.1, cx - r * 0.2, cy - r * 0.4, cx, cy - r);
   }
   ctx.closePath();
}

/** Platform plates: a dark face, the platform's colour band, its white shape and its number. */
function drawAtlas(ctx: CanvasRenderingContext2D) {
   for (let p = 0; p < 6; p++) {
      const { x, y, w, h } = cellPx(p);
      const look = platformLook(p);
      ctx.clearRect(x, y, w, h);
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 16);
      ctx.fill();
      ctx.fillStyle = look.color;
      ctx.beginPath();
      ctx.roundRect(x + 10, y + 10, h - 20, h - 20, 12);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      shapePath(ctx, look.shape, x + h / 2, y + h / 2, h * 0.28);
      ctx.fill();
      ctx.fillStyle = COLORS.label;
      ctx.font = "800 84px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(p + 1), x + h + (w - h) / 2 - 4, y + h / 2 + 4);
      ctx.strokeStyle = look.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 16);
      ctx.stroke();
   }
}

function labelGeometry(quads: readonly LabelQuad[]): BufferGeometry {
   const pos = new Float32Array(quads.length * 18);
   const nor = new Float32Array(quads.length * 18);
   const uv = new Float32Array(quads.length * 12);
   quads.forEach((q, k) => {
      const [u0, v0, u1, v1] = cellUv(q.cell);
      const n = [q.right[1] * q.up[2] - q.right[2] * q.up[1], q.right[2] * q.up[0] - q.right[0] * q.up[2], q.right[0] * q.up[1] - q.right[1] * q.up[0]];
      const corner = (sx: number, sy: number) => [0, 1, 2].map((a) => q.c[a] + q.right[a] * sx * q.w / 2 + q.up[a] * sy * q.h / 2);
      const pts = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, -1), corner(1, 1), corner(-1, 1)];
      const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]];
      pts.forEach((p, i) => {
         pos.set(p, k * 18 + i * 3);
         nor.set(n, k * 18 + i * 3);
         uv.set(uvs[i], k * 12 + i * 2);
      });
   });
   const g = new BufferGeometry();
   g.setAttribute("position", new BufferAttribute(pos, 3));
   g.setAttribute("normal", new BufferAttribute(nor, 3));
   g.setAttribute("uv", new BufferAttribute(uv, 2));
   g.computeBoundingSphere();
   return g;
}

/** Every pad's floor plate (read from the camera: text up = -z) and every sign's plate (facing +z). */
function stationQuads(level: StationLevel): LabelQuad[] {
   const out: LabelQuad[] = [];
   for (let p = 0; p < level.platforms; p++) {
      const pad = padPoint(level, p);
      out.push({ c: [pad.x, 0.014, pad.z + 0.95], right: [1, 0, 0], up: [0, 0, -1], w: 1.6, h: 0.8, cell: p });
      // the sign stands at pad.z + 2.9 (0.45 m deep): its plate on the camera's side
      out.push({ c: [pad.x, 0.86, pad.z + 3.16], right: [1, 0, 0], up: [0, 1, 0], w: 1.0, h: 0.5, cell: p });
   }
   return out;
}

function drawTerrazzo(ctx: CanvasRenderingContext2D, w: number, h: number, look: StationLook) {
   ctx.fillStyle = look.concourse;
   ctx.fillRect(0, 0, w, h);
   ctx.fillStyle = look.concourseTile;
   ctx.fillRect(0, 0, w / 2, h / 2);
   ctx.fillRect(w / 2, h / 2, w / 2, h / 2);
   ctx.strokeStyle = look.concourseLine;
   ctx.lineWidth = 2;
   ctx.strokeRect(1, 1, w - 2, h - 2);
   for (let i = 0; i < 90; i++) {
      ctx.fillStyle = i % 3 ? "rgba(100,116,139,0.25)" : "rgba(255,255,255,0.4)";
      ctx.fillRect((i * 37) % w, (i * 59) % h, 2, 2);
   }
}

// ---------- the worker ----------

function Worker({ run }: { run: Run }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const suitcase = useRef<Group>(null);
   const backpack = useRef<Group>(null);
   const [gait] = useState(() => ({ phase: 0, amount: 0, carry: 0, cheer: 0, lift: 0 }));
   const [scratch] = useState(createPose);

   const pose = useHumanoidPose((p) => {
      const dt = time.delta;
      const { phase, endReason } = useArcadeStore.getState();
      const v = phase === "playing" ? Math.hypot(run.hero.vx, run.hero.vz) : 0;
      gait.amount += (Math.min(1, v / MAX_SPEED) - gait.amount) * (1 - Math.exp(-12 * dt));
      gait.phase = wrapPhase(gait.phase + gaitPhaseStep(gait.amount, WORKER_LANDMARKS, WORKER_SCALE, v, dt, MAX_CADENCE));
      walkPose(gait.phase, gait.amount * 0.9, p);
      blendPoses(p, idlePose(time.now, scratch), 1 - Math.min(1, gait.amount * 5), p, POSE_MASK.upper);
      const bag = run.holding >= 0 && run.tasks[run.holding].kind === "bag" ? 1 : 0;
      gait.carry += (bag - gait.carry) * (1 - Math.exp(-10 * dt));
      // through the forearms-forward carry (core README): never past the T-pose
      if (gait.carry > 0.01) blendPoses(p, carryPose(0, scratch), Math.min(1, gait.carry * 1.2), p, POSE_MASK.arms);
      gait.cheer += ((phase === "over" && endReason === "win" ? 1 : 0) - gait.cheer) * (1 - Math.exp(-8 * dt));
      if (gait.cheer > 0.001) blendPoses(p, cheerPose(time.now, scratch), gait.cheer, p);
      gait.lift = bodyLift(p, WORKER_LANDMARKS) * WORKER_SCALE;
   });

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      g.position.set(run.hero.x, 0, run.hero.z);
      g.rotation.y = run.hero.yaw;
      if (body.current) body.current.position.y = gait.lift;
      const task = run.holding >= 0 ? run.tasks[run.holding] : null;
      const showBag = !!task && task.kind === "bag" && gait.carry > 0.5;
      if (suitcase.current) suitcase.current.visible = showBag && task.look === 0;
      if (backpack.current) backpack.current.visible = showBag && task.look === 1;
   }, FRAME_PRIORITY.visuals);

   return (
      <group ref={root} name="worker">
         <BlobShadow radius={0.42} />
         <mesh rotation-x={-Math.PI / 2} position-y={0.016}>
            <ringGeometry args={[0.48, 0.58, 36]} />
            <meshBasicMaterial color={COLORS.accent} transparent opacity={0.75} depthWrite={false} />
         </mesh>
         <group ref={body}>
            <HumanoidModel asset={ASSETS.worker} pose={pose} applyLift={false} fallback={<WorkerFigure />} />
            {/* the bag held at the chest, between the forearms of the carry */}
            <group ref={suitcase} position={[0, 0.68, 0.4]} visible={false}>
               <Model asset={ASSETS.heldSuitcase} rotation-y={Math.PI / 2} fallback={<SuitcasePrimitive />} />
            </group>
            <group ref={backpack} position={[0, 0.78, 0.4]} visible={false}>
               <Model asset={ASSETS.heldBackpack} fallback={<BackpackPrimitive />} />
            </group>
         </group>
      </group>
   );
}

// ---------- the tasks waiting at the entrance ----------

function Waiting({ run, slot, atlas }: { run: Run; slot: number; atlas: MeshStandardMaterial }) {
   const spot = (SPOTS[run.level.parallel] ?? SPOTS[1])[slot];
   const suitcase = useRef<Group>(null);
   const backpack = useRef<Group>(null);
   const card = useRef<Group>(null);
   const time = useGameTime();
   const [geometries] = useState(() => Array.from({ length: 6 }, (_, p) => labelGeometry([{ c: [0, 0, 0], right: [1, 0, 0], up: [0, 1, 0], w: 0.84, h: 0.42, cell: p }])));
   useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
   const plate = useRef<Mesh>(null);
   useFrame(() => {
      const task = run.tasks.find((t) => t.state === "open" && t.spot === slot);
      if (suitcase.current) suitcase.current.visible = !!task && task.kind === "bag" && task.look === 0;
      if (backpack.current) backpack.current.visible = !!task && task.kind === "bag" && task.look === 1;
      if (card.current) {
         card.current.visible = !!task;
         card.current.position.y = (task?.kind === "passenger" ? 2.15 : 1.15) + Math.sin(time.now * 3 + slot) * 0.05;
      }
      if (task && plate.current) plate.current.geometry = geometries[task.platform];
   }, FRAME_PRIORITY.visuals);
   return (
      <group position={[spot.x, 0, spot.z]}>
         <mesh rotation-x={-Math.PI / 2} position-y={0.012}>
            <ringGeometry args={[0.55, 0.68, 32]} />
            <meshBasicMaterial color={COLORS.edge} transparent opacity={0.8} depthWrite={false} />
         </mesh>
         <group ref={suitcase} visible={false}>
            <Model asset={ASSETS.suitcase} fallback={<SuitcasePrimitive />} />
         </group>
         <group ref={backpack} visible={false}>
            <Model asset={ASSETS.backpack} fallback={<BackpackPrimitive />} />
         </group>
         <group ref={card} position={[0, 1.15, 0]} visible={false}>
            <Billboard>
               <mesh ref={plate} geometry={geometries[0]} material={atlas} />
            </Billboard>
         </group>
      </group>
   );
}

// ---------- the scene ----------

function LevelScene() {
   const { id, config } = useStationLevel();
   const look = lookFor(config);
   const portrait = useThree((s) => s.size.height > s.size.width);
   const view = useFittedView(viewFor(id, portrait));
   const [run] = useState<Run>(() => createRun(randomSeed(), config));
   // camera views (core/camera): the rules get the drawn camera's yaw
   const cam = useCameraViews({
      slug: "train-station-rush",
      subject: "character",
      steering: "camera",
      defaultYaw: view.yaw,
      target: (o) => {
         const h = run.hero;
         o.x = h.x;
         o.y = 1.1;
         o.z = h.z;
         o.heading = h.yaw;
         o.vx = h.vx;
         o.vz = h.vz;
      },
   });
   const input = useInput();
   const fx = useFx();
   const pop = useActionPop();
   const padBeacon = useRef({ x: 0, y: 0.5, z: 0, hidden: true }).current;
   const time = useGameTime();
   const quality = useQuality();
   const gl = useThree((s) => s.gl);
   const rest = restLook(portrait);
   const bounds = useMemo(() => lookBounds(config, portrait), [config, portrait]);
   const aim = useRef({ x: 0, y: LOOK_Y, z: rest[2] }).current;
   const markers = useRef<{ x: number; y: number; z: number; hidden: boolean }[]>([{ x: 0, y: 0.5, z: 0, hidden: true }]).current;
   const half = concourseHalf(config);

   // ---- static geometry ----
   const islands = useMemo(() => islandSpots(config), [config]);
   const tracks = useMemo(() => trackSpots(config), [config]);
   const sleepers = useMemo(() => tracks.sleepers.filter((_, i) => i % (quality.decor < 0.75 ? 2 : 1) === 0), [tracks, quality.decor]);
   const walls = useMemo(() => wallSpots(config), [config]);
   const beds = useMemo(() => Array.from({ length: config.platforms }, (_, p) => ({ x: trackX(config, p), y: -BED_DEPTH, z: (CONCOURSE_DEPTH + STATION_END + 30) / 2, sx: 2.4, sy: 0.02, sz: STATION_END + 30 - CONCOURSE_DEPTH })), [config]);
   const pieces = useMemo(() => setPieceSpots(config), [config]);
   const { canopies, signs, benches, tickets, lamps, trolleys } = useMemo(() => {
      const of = (kind: Solid["kind"]) => run.solids.filter((s) => s.kind === kind).map((s) => ({ x: s.x, y: 0, z: s.z, rotY: s.rotY }));
      return { canopies: of("canopy"), signs: of("sign"), benches: of("bench"), tickets: of("ticket"), lamps: of("lamp"), trolleys: of("trolley") };
   }, [run]);
   const lampGlow = useMemo(() => lamps.map((l) => ({ x: l.x, y: 2.62, z: l.z, sx: 0.36, sy: 0.12, sz: 0.36 })), [lamps]);
   const pads = useMemo(() => Array.from({ length: config.platforms }, (_, p) => padPoint(config, p)), [config]);
   const drawFloor = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => drawTerrazzo(ctx, w, h, look), [look]);
   const terrazzo = useCanvasTexture(256, 256, drawFloor);
   useMemo(() => {
      terrazzo.wrapS = terrazzo.wrapT = RepeatWrapping;
      terrazzo.repeat.set(half, CONCOURSE_DEPTH / 2);
      terrazzo.needsUpdate = true;
   }, [terrazzo, half]);

   // ---- the plate atlas: drawn once ----
   const atlas = useMemo(() => {
      const canvas = document.createElement("canvas");
      canvas.width = ATLAS.width;
      canvas.height = ATLAS.height;
      const ctx = canvas.getContext("2d");
      if (ctx) drawAtlas(ctx);
      const map = new CanvasTexture(canvas);
      map.colorSpace = SRGBColorSpace;
      map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      const material = new MeshStandardMaterial({ map, emissiveMap: map, emissive: "#ffffff", emissiveIntensity: 0.45, roughness: 0.5, transparent: true, alphaTest: 0.05 });
      return { map, material };
   }, [gl]);
   useEffect(() => () => {
      atlas.map.dispose();
      atlas.material.dispose();
   }, [atlas]);
   const labels = useMemo(() => labelGeometry(stationQuads(config)), [config]);
   useEffect(() => () => labels.dispose(), [labels]);

   const locoParts = useLocoParts();
   const carParts = useCarParts();
   const travellerParts = useTravellerParts();
   const padRings = useRef<MeshBasicMaterial[]>([]);
   const useRing = useRef<Group>(null);
   const useRingMat = useRef<MeshBasicMaterial>(null);

   useEffect(() => {
      fx.warm("sparkle", "confetti", "puff", "score");
   }, [fx]);

   useRunFrame((_state, dt) => {
      const { moveX, moveY, actionPressed } = input.current;
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX, moveY, actionPressed, yaw: cam.yaw() }, dt, store.timeLeftMs ?? 0);
      if (ev.score) store.addScore(ev.score);
      store.setStat("delivered", run.delivered);
      store.setStat("dwell", run.level.dwellS);
      // the departures board: the open tasks in their spot order
      for (let slot = 0; slot < 2; slot++) {
         const i = run.tasks.findIndex((t) => (t.state === "open" || t.state === "taken") && t.spot === slot);
         const t = i >= 0 ? run.tasks[i] : null;
         store.setStat(`t${slot}p`, t ? t.platform : -1);
         store.setStat(`t${slot}k`, t?.kind === "passenger" ? 1 : 0);
         store.setStat(`t${slot}l`, t ? Math.max(0, Math.ceil((t.leaveAt - run.time) * 4)) : 0);
         store.setStat(`t${slot}h`, t && run.holding === i ? 1 : 0);
         store.setStat(`t${slot}a`, t && trainIn(t, run.time) ? 1 : 0);
      }
      aim.x = run.hero.x;
      aim.y = LOOK_Y;
      aim.z = run.hero.z;
      const held = run.holding >= 0 ? run.tasks[run.holding] : null;
      markers[0].hidden = !held;
      if (held) {
         const pad = padPoint(run.level, held.platform);
         markers[0].x = pad.x;
         markers[0].z = pad.z;
         padBeacon.x = pad.x;
         padBeacon.z = pad.z;
      }
      padBeacon.hidden = !held;
      if (ev.took >= 0) {
         AT.x = run.hero.x; AT.y = 1.3; AT.z = run.hero.z;
         fx.burst("sparkle", AT, 10);
         playSfx("pickup");
      }
      if (ev.delivered >= 0) {
         const pad = padPoint(run.level, run.tasks[ev.delivered].platform);
         AT.x = pad.x; AT.y = 1.4; AT.z = pad.z;
         fx.burst("confetti", AT, 22);
         fx.score(AT, `+${ev.score}`, { color: "#fde68a" });
         playSfx(ev.won ? "win" : "chime");
      }
      if (ev.missed >= 0) {
         const pad = padPoint(run.level, run.tasks[ev.missed].platform);
         AT.x = pad.x; AT.y = 1; AT.z = pad.z;
         fx.burst("puff", AT, 10);
         AT.y = 1.6;
         pop.fail(AT, "Train left! -1 life", { shake: 0.2 });
         playSfx("alarm");
      }
      if (ev.opened >= 0) playSfx("click", { volume: 0.4 });
      if (ev.buzz) {
         playSfx("buzz", { volume: 0.5 });
         AT.x = run.hero.x; AT.y = 1.6; AT.z = run.hero.z;
         pop.fail(AT, "Not here: hands full, wrong pad or no train", { shake: 0 });
      }
      if (ev.lifeLost) store.loseLife();
      if (ev.won) store.end("win");
      if (ev.lost && useArcadeStore.getState().phase !== "over") store.end("lose");
   });

   useFrame(() => {
      const t = time.now;
      // pads: bright while their train is in for a task, dim otherwise
      for (let p = 0; p < config.platforms; p++) {
         const m = padRings.current[p];
         if (!m) continue;
         const live = run.tasks.some((task) => task.platform === p && trainIn(task, run.time));
         m.opacity = live ? 0.6 + Math.sin(t * 5 + p) * 0.25 : 0.25;
      }
      const target = targetAt(run, run.hero.x, run.hero.z);
      if (useRing.current && useRingMat.current) {
         useRing.current.visible = !!target && !run.over;
         if (target) {
            const at = target.kind === "pad" ? padPoint(run.level, target.platform) : (SPOTS[run.level.parallel] ?? SPOTS[1])[run.tasks[target.task].spot];
            useRing.current.position.set(at.x, 0.02, at.z);
            const held = run.holding >= 0 ? run.tasks[run.holding] : null;
            const useful = target.kind === "spot" ? run.holding < 0 : !!held && held.platform === target.platform && trainIn(held, run.time);
            useRingMat.current.color.set(useful ? COLORS.ok : COLORS.dim);
            const s = 1 + Math.sin(t * 5) * 0.06;
            useRing.current.scale.set(s, s, s);
         }
      }
   }, FRAME_PRIORITY.visuals);

   // trains: two carriages behind an engine, per platform
   const placeCar = (i: number, m: Matrix4) => {
      const p = i >> 1;
      const off = trainOffset(run, p, run.time);
      if (off < 0) return false;
      const z = NOSE_Z + off + LOCO_LEN + CAR_GAP + CAR_LENGTH / 2 + (i & 1) * (CAR_LENGTH + CAR_GAP);
      V.set(trackX(run.level, p), -BED_DEPTH + 0.12, z);
      Q.identity();
      S.set(1, 1, 1);
      m.compose(V, Q, S);
   };
   const placeLoco = (p: number, m: Matrix4) => {
      const off = trainOffset(run, p, run.time);
      if (off < 0) return false;
      V.set(trackX(run.level, p), -BED_DEPTH + 0.12, NOSE_Z + off + LOCO_LEN / 2);
      Q.identity();
      S.set(1, 1, 1);
      m.compose(V, Q, S);
   };
   // travellers: the crowd, the passengers waiting at the entrance and the one following
   const crowdCount = run.crowd.length;
   const placeTraveller = (i: number, m: Matrix4) => {
      let x = 0;
      let z = 0;
      let yaw = 0;
      let phase = 0;
      let moving = 0;
      if (i < crowdCount) {
         const a = run.crowd[i];
         x = a.x; z = a.z; yaw = a.yaw; phase = a.phase; moving = Math.hypot(a.vx, a.vz);
      } else if (i < crowdCount + 2) {
         const slot = i - crowdCount;
         const task = run.tasks.find((t) => t.state === "open" && t.spot === slot && t.kind === "passenger");
         if (!task) return false;
         const s = (SPOTS[run.level.parallel] ?? SPOTS[1])[slot];
         x = s.x; z = s.z; yaw = Math.sin(time.now * 0.8 + slot) * 0.2; phase = time.now;
      } else {
         const f = run.follower;
         if (f.task < 0) return false;
         x = f.x; z = f.z; yaw = f.yaw; phase = f.phase; moving = Math.hypot(f.vx, f.vz);
      }
      waddle(phase, moving > 0.2 ? 0.3 : 0.06, WOFF);
      E.set(WOFF.roll, yaw + WOFF.yaw, 0);
      Q.setFromEuler(E);
      V.set(x, WOFF.y, z);
      S.set(1, WOFF.squash, 1);
      m.compose(V, Q, S);
   };

   return (
      <>
         <CameraRig
            camera={{ position: [rest[0] + view.offset[0], rest[1] + view.offset[1], rest[2] + view.offset[2]], fov: FOV, lookAt: rest }}
            follow={aim}
            bounds={bounds}
            offset={view.offset}
            shift={view.shift}
            damping={DAMPING}
         />
         <TargetMarkers targets={markers} color={COLORS.accent} />
         <TargetBeacon target={padBeacon} variant="drop-here" radius={1.1} height={1.0} label="DROP" />
         {/* ground: the concourse, the bed below everything, the islands */}
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, CONCOURSE_DEPTH / 2]}>
            <planeGeometry args={[half * 2, CONCOURSE_DEPTH]} />
            <meshStandardMaterial map={terrazzo} roughness={0.35} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, -BED_DEPTH - 0.02, (STATION_END + 40) / 2]}>
            <planeGeometry args={[half * 2 + 30, STATION_END + 40]} />
            <meshStandardMaterial color={look.ballast} roughness={1} />
         </mesh>
         <Instanced spots={beds} name="beds">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={look.trackBed} roughness={0.95} />
         </Instanced>
         <Instanced spots={islands.tops} name="islands">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={look.platform} roughness={0.7} />
         </Instanced>
         <Instanced spots={islands.sides} name="island-sides">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={look.platformSide} roughness={0.8} />
         </Instanced>
         <Instanced spots={islands.edges} name="edges">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={look.edge} emissive={look.edge} emissiveIntensity={config.lighting === "night" ? 0.55 : config.lighting === "sunset" ? 0.35 : 0.15} roughness={0.5} />
         </Instanced>
         <Instanced spots={tracks.rails} name="rails">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.rail} metalness={0.7} roughness={0.35} />
         </Instanced>
         <Instanced spots={sleepers} name="sleepers">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.sleeper} roughness={0.9} />
         </Instanced>
         <Instanced spots={tracks.buffers} name="buffers">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.buffer} roughness={0.5} />
         </Instanced>
         <Instanced spots={walls} name="walls">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={look.wall} roughness={0.8} />
         </Instanced>
         {/* the entrance: glowing doors in the back wall */}
         <mesh position={[0, 1.4, 0.02]}>
            <planeGeometry args={[4.2, 2.8]} />
            <meshStandardMaterial color={look.doorGlow} emissive={look.doorGlow} emissiveIntensity={config.lighting === "night" ? 0.9 : config.lighting === "indoor" ? 0.65 : 0.45} />
         </mesh>
         {/* Clocks: one over the doors; Central Station adds a ticket-hall pair; Mega lifts the main clock */}
         <Model asset={ASSETS.clock} position={[0, config.theme === "central" || config.theme === "mega" ? 3.55 : 2.95, 0.05]} fallback={<ClockPrimitive />} />
         {config.theme === "central" ? (
            <>
               <Model asset={ASSETS.clock} position={[-4.8, 2.6, 0.05]} fallback={<ClockPrimitive />} />
               <Model asset={ASSETS.clock} position={[4.8, 2.6, 0.05]} fallback={<ClockPrimitive />} />
            </>
         ) : null}
         <InstancedModel asset={ASSETS.ticket} spots={tickets} fallback={<PropsPrimitive kind="ticket" spots={tickets} />} />
         <InstancedModel asset={ASSETS.bench} spots={benches} fallback={<PropsPrimitive kind="bench" spots={benches} />} />
         {trolleys.map((t, i) => (
            <Model key={i} asset={ASSETS.trolley} position={[t.x, 0, t.z]} rotation-y={t.rotY} fallback={<PropsPrimitive kind="bench" spots={[{ x: 0, y: 0, z: 0 }]} />} />
         ))}
         <InstancedModel asset={ASSETS.canopy} spots={canopies} fallback={<PropsPrimitive kind="canopy" spots={canopies} />} />
         <InstancedModel asset={ASSETS.sign} spots={signs} fallback={<PropsPrimitive kind="sign" spots={signs} />} />
         <InstancedModel asset={ASSETS.lamp} spots={lamps} fallback={<PropsPrimitive kind="lamp" spots={lamps} />} />
         {config.lighting === "night" || config.lighting === "sunset" || config.lighting === "indoor" ? (
            <Instanced spots={lampGlow} name="lamp-glow">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={COLORS.glow} emissive={COLORS.glow} emissiveIntensity={config.lighting === "indoor" ? 1.1 : config.lighting === "sunset" ? 1.4 : 1.6} />
            </Instanced>
         ) : null}
         {/* Per-theme set pieces: hall roof, sunset lanterns, mega gantries (visual only) */}
         {pieces.roofs.length > 0 ? (
            <Instanced spots={pieces.roofs} name="set-roofs">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial
                  color={look.scenery === "hall" ? "#d6d3d1" : look.scenery === "city" ? "#1e293b" : "#94a3b8"}
                  roughness={look.scenery === "hall" ? 0.35 : 0.7}
                  metalness={look.scenery === "hall" ? 0.15 : 0.05}
                  transparent={look.scenery === "hall"}
                  opacity={look.scenery === "hall" ? 0.55 : 1}
               />
            </Instanced>
         ) : null}
         {pieces.beams.length > 0 ? (
            <Instanced spots={pieces.beams} name="set-beams">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={look.scenery === "hall" ? "#a8a29e" : COLORS.buildingDark} roughness={0.65} />
            </Instanced>
         ) : null}
         {pieces.lanterns.length > 0 ? (
            <Instanced spots={pieces.lanterns} name="set-lanterns">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial
                  color={look.scenery === "hall" ? "#fef3c7" : "#fdba74"}
                  emissive={look.scenery === "hall" ? "#fde68a" : "#f97316"}
                  emissiveIntensity={look.scenery === "hall" ? 1.1 : 1.5}
                  roughness={0.4}
               />
            </Instanced>
         ) : null}
         {pieces.gantries.length > 0 ? (
            <Instanced spots={pieces.gantries} name="set-gantries">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color="#0f172a" metalness={0.55} roughness={0.4} emissive={COLORS.neon} emissiveIntensity={0.25} />
            </Instanced>
         ) : null}
         <Decor level={config} />
         {/* pads and plates */}
         {pads.map((pad, p) => (
            <mesh key={p} rotation-x={-Math.PI / 2} position={[pad.x, 0.016, pad.z]}>
               <ringGeometry args={[0.55, 0.78, 36]} />
               <meshBasicMaterial ref={(m) => { if (m) padRings.current[p] = m; }} color={platformLook(p).color} transparent opacity={0.3} depthWrite={false} />
            </mesh>
         ))}
         <mesh geometry={labels} material={atlas.material} name="plates" />
         <group ref={useRing} visible={false}>
            <mesh rotation-x={-Math.PI / 2}>
               <ringGeometry args={[0.36, 0.46, 32]} />
               <meshBasicMaterial ref={useRingMat} color={COLORS.ok} transparent opacity={0.85} depthWrite={false} />
            </mesh>
         </group>
         {/* trains, travellers, the tasks at the entrance, the worker */}
         <DynamicInstancedModel asset={ASSETS.loco} count={config.platforms} update={placeLoco} fallbackParts={locoParts} name="engines" />
         <DynamicInstancedModel asset={ASSETS.car} count={config.platforms * 2} update={placeCar} fallbackParts={carParts} name="cars" />
         <DynamicInstancedModel asset={ASSETS.traveller} count={crowdCount + 3} update={placeTraveller} fallbackParts={travellerParts} name="travellers" />
         {(SPOTS[config.parallel] ?? SPOTS[1]).map((_, slot) => (
            <Waiting key={slot} run={run} slot={slot} atlas={atlas.material} />
         ))}
         <Worker run={run} />
      </>
   );
}

/** Keyed by the level: the start card's backdrop rebuilds its run when another level is picked. */
export default function Scene() {
   const { id } = useStationLevel();
   return <LevelScene key={id} />;
}
