"use client";

// Hotel Bellboy Rush scene. One useRunFrame steps rules.ts; visuals read the run and animate with
// useGameTime. The camera follows a fixed window of the hall (looks.ts), so the door numbers stay
// readable on every level; the doors' numbers are one canvas atlas redrawn when the floor changes.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import {
   AdditiveBlending,
   BufferAttribute,
   BufferGeometry,
   CanvasTexture,
   MeshStandardMaterial,
   RepeatWrapping,
   SRGBColorSpace,
   type Group,
   type Mesh,
   type MeshBasicMaterial,
} from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { useQuality } from "@/arcade3d/core/quality";
import { BlobShadow, Instanced, useCanvasTexture } from "@/arcade3d/core/render";
import {
   HumanoidModel,
   POSE_MASK,
   aimArm,
   blendPoses,
   bodyLift,
   cheerPose,
   copyPose,
   createPose,
   gaitPhaseStep,
   idlePose,
   turnBone,
   useHumanoidPose,
   walkPose,
   wrapPhase,
   BONE,
} from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, BELLBOY_LANDMARKS, BELLBOY_SCALE, DESK_TOP } from "./assets";
import type { HotelLevel } from "./levels";
import {
   ATLAS,
   CARD_CELL,
   COLORS,
   DAMPING,
   ELEVATOR_CELL,
   FOV,
   LOOK_AHEAD,
   LOOK_Y,
   WALL_H,
   cellPx,
   cellUv,
   doorSpots,
   floorColor,
   floorRects,
   frameSpots,
   labelQuads,
   lookBounds,
   restLook,
   sconceSpots,
   trimSpots,
   viewFor,
   wallSpots,
   type LabelQuad,
} from "./looks";
import { BellPrimitive, BellboyFigure, DeskPrimitive, DoorsPrimitive, ElevatorPrimitive, GuestPrimitive, KeyCardPrimitive, PlantersPrimitive, SofasPrimitive, SuitcasePrimitive, TrolleyPrimitive } from "./Primitives";
import {
   DESK,
   DESK_POINT,
   DOOR_X,
   ELEVATOR_Z,
   HALF_W,
   MAX_SPEED,
   PAD_POINT,
   RIDE_S,
   createRun,
   doorLabel,
   doorZ,
   step,
   targetAt,
   targetUseful,
   type Run,
} from "./rules";

export const useHotelLevel = () => useLevel<HotelLevel>();

const AT = { x: 0, y: 0, z: 0 };
const MAX_CADENCE = 3.2;

// ---------- the label atlas ----------

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
   ctx.beginPath();
   ctx.moveTo(x + r, y);
   ctx.arcTo(x + w, y, x + w, y + h, r);
   ctx.arcTo(x + w, y + h, x, y + h, r);
   ctx.arcTo(x, y + h, x, y, r);
   ctx.arcTo(x, y, x + w, y, r);
   ctx.closePath();
}

/** One plate: a dark enamel face, a brass rim, the floor's colour band and big digits. */
function drawPlate(ctx: CanvasRenderingContext2D, cell: number, text: string, color: string, sub: string, dim = false) {
   const { x, y, w, h } = cellPx(cell);
   ctx.clearRect(x, y, w, h);
   roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 18);
   ctx.fillStyle = COLORS.brass;
   ctx.fill();
   roundRect(ctx, x + 10, y + 10, w - 20, h - 20, 13);
   ctx.fillStyle = dim ? "#292524" : "#1c1917";
   ctx.fill();
   roundRect(ctx, x + 10, y + 10, 34, h - 20, 12);
   ctx.fillStyle = color;
   ctx.fill();
   ctx.fillStyle = dim ? "#a8a29e" : COLORS.label;
   ctx.textAlign = "center";
   ctx.textBaseline = "middle";
   ctx.font = "800 70px system-ui, -apple-system, Segoe UI, sans-serif";
   ctx.fillText(text, x + w / 2 + 16, y + h / 2 + (sub ? -6 : 3));
   if (sub) {
      ctx.font = "700 20px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillStyle = color;
      ctx.fillText(sub, x + w / 2 + 16, y + h - 26);
   }
}

function drawAtlas(ctx: CanvasRenderingContext2D, run: Run) {
   const level = run.level;
   const color = floorColor(run.floor);
   for (let i = 0; i < level.doors; i++) drawPlate(ctx, i, String(doorLabel(run.floor, i + 1)), color, "");
   const riding = run.hero.ride > 0;
   drawPlate(ctx, ELEVATOR_CELL, level.floors > 1 ? (riding ? "↕" : String(run.floor)) : "1", color, level.floors > 1 ? "FLOOR" : "LOBBY", level.floors <= 1);
   const bag = run.bags[run.next];
   if (bag && run.carrying) drawPlate(ctx, CARD_CELL, String(doorLabel(bag.floor, bag.index)), floorColor(bag.floor), "");
   else {
      const { x, y, w, h } = cellPx(CARD_CELL);
      ctx.clearRect(x, y, w, h);
   }
}

/** One non-indexed geometry of quads, each with its own atlas cell. */
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

// ---------- floors ----------

function drawCarpet(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = COLORS.carpet;
   ctx.fillRect(0, 0, w, h);
   ctx.strokeStyle = COLORS.carpetDeep;
   ctx.lineWidth = 6;
   const s = w / 4;
   for (let i = -1; i <= 4; i++) {
      for (let j = -1; j <= 4; j++) {
         ctx.beginPath();
         ctx.moveTo(i * s + s / 2, j * s);
         ctx.lineTo(i * s + s, j * s + s / 2);
         ctx.lineTo(i * s + s / 2, j * s + s);
         ctx.lineTo(i * s, j * s + s / 2);
         ctx.closePath();
         ctx.stroke();
      }
   }
   ctx.fillStyle = "rgba(212,165,116,0.35)";
   for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) ctx.fillRect(i * s + s / 2 - 3, j * s + s / 2 - 3, 6, 6);
}

function drawMarble(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const s = w / 2;
   for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? COLORS.marble : "#d6d3d1";
      ctx.fillRect(i * s, j * s, s, s);
   }
   ctx.strokeStyle = "rgba(120,113,108,0.35)";
   ctx.lineWidth = 2;
   for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.moveTo((k * 97) % w, 0);
      ctx.bezierCurveTo((k * 53) % w, h * 0.3, (k * 151) % w, h * 0.6, (k * 71) % w, h);
      ctx.stroke();
   }
   ctx.strokeStyle = "rgba(161,98,7,0.5)";
   ctx.lineWidth = 3;
   ctx.strokeRect(0, 0, w, h);
}

function Floors({ level }: { level: HotelLevel }) {
   const rects = floorRects(level);
   const carpet = useCanvasTexture(256, 256, drawCarpet);
   const marble = useCanvasTexture(256, 256, drawMarble);
   const runnerLen = rects.runner.z1 - rects.runner.z0;
   const lobbyLen = rects.lobby.z1 - rects.lobby.z0;
   useMemo(() => {
      carpet.wrapS = carpet.wrapT = RepeatWrapping;
      carpet.repeat.set(2, runnerLen / 1.2);
      marble.wrapS = marble.wrapT = RepeatWrapping;
      marble.repeat.set(HALF_W, lobbyLen / 2);
      carpet.needsUpdate = true;
      marble.needsUpdate = true;
   }, [carpet, marble, runnerLen, lobbyLen]);
   return (
      <>
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, rects.runner.z1 / 2]}>
            <planeGeometry args={[30, rects.runner.z1 + 30]} />
            <meshStandardMaterial color={COLORS.void} roughness={1} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, (rects.runner.z0 + rects.runner.z1) / 2]}>
            <planeGeometry args={[HALF_W * 2, runnerLen]} />
            <meshStandardMaterial color={COLORS.marbleDark} roughness={0.5} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[-0.25, 0.004, (rects.runner.z0 + rects.runner.z1) / 2]}>
            <planeGeometry args={[2.6, runnerLen - 0.2]} />
            <meshStandardMaterial map={carpet} roughness={0.95} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, (rects.lobby.z0 + rects.lobby.z1) / 2]}>
            <planeGeometry args={[HALF_W * 2, lobbyLen]} />
            <meshStandardMaterial map={marble} roughness={0.28} metalness={0.05} />
         </mesh>
      </>
   );
}

// ---------- the bellboy ----------

function Bellboy({ run }: { run: Run }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const [gait] = useState(() => ({ phase: 0, amount: 0, pull: 0, cheer: 0, lift: 0, flinch: 0 }));
   const [scratch] = useState(createPose);
   const [pull] = useState(createPose);

   const pose = useHumanoidPose((p) => {
      const dt = time.delta;
      const { phase, endReason } = useArcadeStore.getState();
      const v = phase === "playing" ? Math.hypot(run.hero.vx, run.hero.vz) : 0;
      gait.amount += (Math.min(1, v / MAX_SPEED) - gait.amount) * (1 - Math.exp(-12 * dt));
      gait.phase = wrapPhase(gait.phase + gaitPhaseStep(gait.amount, BELLBOY_LANDMARKS, BELLBOY_SCALE, v, dt, MAX_CADENCE));
      walkPose(gait.phase, gait.amount * 0.85, p);
      blendPoses(p, idlePose(time.now, scratch), 1 - Math.min(1, gait.amount * 5), p, POSE_MASK.upper);
      // the right hand back on the trolley's handle (it trails 1.1 m behind), the left arm swings
      const tdx = run.trolley.x.x - run.hero.x;
      const tdz = run.trolley.z.x - run.hero.z;
      const behind = Math.hypot(tdx, tdz) < 1.8 ? 1 : 0;
      gait.pull += (behind - gait.pull) * (1 - Math.exp(-6 * dt));
      if (gait.pull > 0.01) {
         copyPose(p, pull);
         aimArm(pull, -1, 0.18, -0.78, -0.6, 0.08, -0.45, -0.9);
         blendPoses(p, pull, gait.pull, p, POSE_MASK.arms);
      }
      // a wrong door: a short flinch back
      gait.flinch = Math.max(0, gait.flinch - dt * 3);
      if (run.hero.stun > 0) gait.flinch = 1;
      if (gait.flinch > 0) turnBone(p, BONE.spine, -0.18 * gait.flinch, 0, 0);
      gait.cheer += ((phase === "over" && endReason === "win" ? 1 : 0) - gait.cheer) * (1 - Math.exp(-8 * dt));
      if (gait.cheer > 0.001) blendPoses(p, cheerPose(time.now, scratch), gait.cheer, p);
      gait.lift = bodyLift(p, BELLBOY_LANDMARKS) * BELLBOY_SCALE;
   });

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      g.position.set(run.hero.x, 0, run.hero.z);
      g.rotation.y = run.hero.yaw;
      if (body.current) body.current.position.y = gait.lift;
   }, FRAME_PRIORITY.visuals);

   return (
      <group ref={root} name="bellboy">
         <BlobShadow radius={0.45} />
         <mesh rotation-x={-Math.PI / 2} position-y={0.016}>
            <ringGeometry args={[0.5, 0.6, 36]} />
            <meshBasicMaterial color={COLORS.accent} transparent opacity={0.7} depthWrite={false} />
         </mesh>
         <group ref={body}>
            <HumanoidModel asset={ASSETS.bellboy} pose={pose} applyLift={false} fallback={<BellboyFigure />} />
         </group>
      </group>
   );
}

// ---------- the trolley ----------

function Trolley({ run, atlas, quality }: { run: Run; atlas: MeshStandardMaterial; quality: number }) {
   const root = useRef<Group>(null);
   const bag = useRef<Group>(null);
   const card = useRef<Group>(null);
   const time = useGameTime();
   const cardGeometry = useMemo(() => labelGeometry([{ c: [0, 0, 0], right: [1, 0, 0], up: [0, 1, 0], w: 0.62, h: 0.31, cell: CARD_CELL }]), []);
   useEffect(() => () => cardGeometry.dispose(), [cardGeometry]);
   useFrame(() => {
      const g = root.current;
      if (!g) return;
      g.position.set(run.trolley.x.x, 0, run.trolley.z.x);
      g.rotation.y = run.trolley.yaw;
      if (bag.current) bag.current.visible = run.carrying;
      if (card.current) {
         card.current.visible = run.carrying;
         card.current.position.y = 1.75 + Math.sin(time.now * 3) * 0.04 * quality;
      }
   }, FRAME_PRIORITY.visuals);
   return (
      <group ref={root} name="trolley">
         <BlobShadow radius={0.55} opacity={0.26} />
         <Model asset={ASSETS.trolley} fallback={<TrolleyPrimitive />} />
         <group ref={bag} position={[0, 0.29, 0]} visible={false}>
            <Model asset={ASSETS.suitcase} rotation-y={Math.PI / 2} fallback={<SuitcasePrimitive />} />
         </group>
         <group ref={card} position={[0, 1.75, 0]} visible={false}>
            <Billboard>
               <mesh geometry={cardGeometry} material={atlas} />
            </Billboard>
         </group>
      </group>
   );
}

// ---------- the scene ----------

function LevelScene() {
   const { id, config } = useHotelLevel();
   const portrait = useThree((s) => s.size.height > s.size.width);
   const view = useFittedView(viewFor(id, portrait));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const quality = useQuality();
   const gl = useThree((s) => s.gl);
   const [run] = useState<Run>(() => createRun(randomSeed(), config));
   const aim = useRef({ x: 0, y: LOOK_Y, z: run.hero.z + LOOK_AHEAD }).current;
   const markers = useRef<{ x: number; y: number; z: number; hidden: boolean }[]>([{ x: DESK_POINT.x, y: 1.2, z: DESK_POINT.z, hidden: true }]).current;
   const bounds = useMemo(() => lookBounds(config, portrait), [config, portrait]);
   const rest = restLook(portrait);

   // ---- static decor ----
   const walls = useMemo(() => wallSpots(config), [config]);
   const trims = useMemo(() => trimSpots(config), [config]);
   const frames = useMemo(() => frameSpots(config), [config]);
   const doors = useMemo(() => doorSpots(config), [config]);
   const allSconces = useMemo(() => sconceSpots(config), [config]);
   const sconces = useMemo(() => allSconces.slice(0, Math.max(2, Math.round(allSconces.length * quality.decor))), [allSconces, quality.decor]);
   const glow = useMemo(() => sconces.map((s) => ({ ...s, x: s.x - 0.05, y: s.y + 0.02, sx: 0.04, sy: 0.24, sz: 0.14 })), [sconces]);
   const planters = useMemo(() => run.solids.filter((s) => s.kind === "planter").map((s) => ({ x: s.x, y: 0, z: s.z, rotY: s.rotY })), [run]);
   const sofas = useMemo(() => run.solids.filter((s) => s.kind === "sofa").map((s) => ({ x: s.x, y: 0, z: s.z, rotY: s.rotY })), [run]);
   const guests = useMemo(() => run.solids.filter((s) => s.kind === "guest"), [run]);

   // ---- the label atlas: one canvas, one material, redrawn when the floor, the ride or the card changes ----
   const atlas = useMemo(() => {
      const canvas = document.createElement("canvas");
      canvas.width = ATLAS.width;
      canvas.height = ATLAS.height;
      const map = new CanvasTexture(canvas);
      map.colorSpace = SRGBColorSpace;
      map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      const material = new MeshStandardMaterial({ map, emissiveMap: map, emissive: "#ffffff", emissiveIntensity: 0.55, roughness: 0.45, transparent: true, alphaTest: 0.05 });
      return { canvas, ctx: canvas.getContext("2d"), map, material, key: "" };
   }, [gl]);
   useEffect(() => () => {
      atlas.map.dispose();
      atlas.material.dispose();
   }, [atlas]);
   const labels = useMemo(() => labelGeometry(labelQuads(config, view.yaw)), [config, view.yaw]);
   useEffect(() => () => labels.dispose(), [labels]);

   const padMat = useRef<MeshBasicMaterial>(null);
   const beam = useRef<Mesh>(null);
   const ring = useRef<Group>(null);
   const ringMat = useRef<MeshBasicMaterial>(null);
   const beacon = useRef<Group>(null);
   const guestRefs = useRef<(Group | null)[]>([]);

   useEffect(() => {
      fx.warm("sparkle", "confetti", "puff", "score");
   }, [fx]);

   useRunFrame((_state, dt) => {
      const { moveX, moveY, actionPressed } = input.current;
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX, moveY, actionPressed, yaw: view.yaw }, dt, store.timeLeftMs ?? 0);
      if (ev.score) store.addScore(ev.score);
      store.setStat("bags", run.delivered);
      store.setStat("floor", run.floor);
      const bag = run.bags[run.next];
      store.setStat("card", bag ? doorLabel(bag.floor, bag.index) : 0);
      store.setStat("cardFloor", bag ? bag.floor : 0);
      store.setStat("carrying", run.carrying ? 1 : 0);
      store.setStat("clock", Math.ceil(run.bagClock));
      store.setStat("riding", run.hero.ride > 0 ? 1 : 0);
      aim.x = 0;
      aim.y = LOOK_Y;
      aim.z = run.hero.z + Math.cos(run.hero.yaw) * LOOK_AHEAD;
      // the off-screen marker: the desk while the trolley is empty, the elevator while a ride is due
      const goalPad = !!bag && run.carrying && run.level.floors > 1 && run.floor !== bag.floor;
      markers[0].hidden = !bag || (run.carrying && !goalPad);
      markers[0].x = goalPad ? PAD_POINT.x : DESK_POINT.x;
      markers[0].z = goalPad ? PAD_POINT.z : DESK_POINT.z;
      if (ev.took) {
         AT.x = run.hero.x; AT.y = 1.4; AT.z = run.hero.z;
         fx.burst("sparkle", AT, 10);
         playSfx("pickup");
      }
      if (ev.rideStart) playSfx("whoosh", { pitch: 0.8 });
      if (ev.arrived) {
         playSfx("chime");
         for (let i = 0; i < run.level.doors; i++) {
            AT.x = DOOR_X - 0.9; AT.y = 0.3; AT.z = doorZ(i);
            fx.burst("sparkle", AT, 5);
         }
      }
      if (ev.delivered >= 0) {
         AT.x = DOOR_X - 0.5; AT.y = 1.6; AT.z = doorZ(ev.delivered);
         fx.burst("confetti", AT, 22);
         fx.score(AT, `+${ev.score}`, { color: "#fde68a" });
         playSfx(ev.won ? "win" : "combo");
      }
      if (ev.wrong >= 0) {
         AT.x = run.hero.x; AT.y = 1; AT.z = run.hero.z;
         fx.burst("puff", AT, 8);
         fx.shake(0.22);
         playSfx("buzz");
      }
      if (ev.buzz) playSfx("click", { volume: 0.5 });
      if (ev.lifeLost) store.loseLife();
      if (ev.won) store.end("win");
   });

   useFrame(() => {
      // atlas
      const bag = run.bags[run.next];
      const key = `${run.floor}|${run.hero.ride > 0 ? 1 : 0}|${run.carrying && bag ? doorLabel(bag.floor, bag.index) : 0}`;
      if (key !== atlas.key && atlas.ctx) {
         atlas.key = key;
         drawAtlas(atlas.ctx, run);
         atlas.map.needsUpdate = true;
      }
      // the elevator pad: dark on level 1, the bag's floor colour while a ride is due, pulsing on the ride
      const t = time.now;
      const due = !!bag && run.carrying && config.floors > 1 && run.floor !== bag.floor;
      if (padMat.current) {
         padMat.current.color.set(config.floors <= 1 ? COLORS.padOff : due && bag ? floorColor(bag.floor) : floorColor(run.floor));
         padMat.current.opacity = config.floors <= 1 ? 0.35 : due ? 0.55 + Math.sin(t * 6) * 0.25 : 0.4;
      }
      if (beam.current) {
         const k = run.hero.ride > 0 ? 1 - run.hero.ride / RIDE_S : 0;
         beam.current.visible = run.hero.ride > 0;
         beam.current.scale.set(1, 0.2 + k * 0.8, 1);
         beam.current.position.y = (0.2 + k * 0.8) * 1.3;
      }
      // the Use ring on whatever Use would reach now
      const target = targetAt(run, run.hero.x, run.hero.z);
      if (ring.current && ringMat.current) {
         ring.current.visible = !!target && !run.over && run.hero.ride <= 0;
         if (target) {
            const x = target.kind === "desk" ? DESK_POINT.x : target.kind === "pad" ? PAD_POINT.x : DOOR_X - 0.75;
            const z = target.kind === "desk" ? DESK_POINT.z + 0.45 : target.kind === "pad" ? PAD_POINT.z : doorZ(target.index);
            ring.current.position.set(x, 0.02, z);
            const s = 1 + Math.sin(t * 5) * 0.06;
            ring.current.scale.set(s, s, s);
            ringMat.current.color.set(targetUseful(run, target) ? COLORS.ok : COLORS.marbleDark);
         }
      }
      if (beacon.current) {
         beacon.current.visible = !run.carrying && !!bag;
         beacon.current.position.y = DESK_TOP + 0.75 + Math.sin(t * 2.4) * 0.06;
         beacon.current.rotation.y = t * 1.2;
      }
      guestRefs.current.forEach((g, i) => {
         if (g) g.rotation.y = Math.PI / 2 + Math.sin(t * 0.7 + i * 2) * 0.12;
      });
   }, FRAME_PRIORITY.visuals);

   const length = run.length;
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
         <Floors level={config} />
         <Instanced spots={walls} name="walls">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.85} />
         </Instanced>
         <Instanced spots={trims.wainscot} name="wainscot">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wainscot} roughness={0.6} />
         </Instanced>
         <Instanced spots={[...trims.brass, ...frames]} name="brass">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.brass} metalness={0.7} roughness={0.32} />
         </Instanced>
         <Instanced spots={sconces} name="sconces">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.brassDeep} metalness={0.6} roughness={0.4} />
         </Instanced>
         <Instanced spots={glow} name="sconce-glow">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.glow} emissive={COLORS.glow} emissiveIntensity={config.lighting === "night" ? 2.2 : 1.2} />
         </Instanced>
         <mesh geometry={labels} material={atlas.material} name="door-labels" />
         <InstancedModel asset={ASSETS.door} spots={doors} fallback={<DoorsPrimitive spots={doors} />} />
         {planters.length > 0 && <InstancedModel asset={ASSETS.planter} spots={planters} fallback={<PlantersPrimitive spots={planters} />} />}
         <InstancedModel asset={ASSETS.sofa} spots={sofas} fallback={<SofasPrimitive spots={sofas} />} />
         {guests.map((g, i) => (
            <group key={i} position={[g.x, 0, g.z]} ref={(el) => { guestRefs.current[i] = el; }}>
               <Model asset={ASSETS.guest} fallback={<GuestPrimitive />} />
            </group>
         ))}
         {/* the lobby: desk, bell, the key card beacon */}
         <Model asset={ASSETS.desk} position={[0, 0, (DESK.min.z + DESK.max.z) / 2]} fallback={<DeskPrimitive />} />
         <Model asset={ASSETS.bell} position={[0.7, DESK_TOP, 0.55]} fallback={<BellPrimitive />} />
         <group ref={beacon} position={[0, DESK_TOP + 0.75, (DESK.min.z + DESK.max.z) / 2 + 0.1]}>
            <group rotation-x={-1.05}>
               <Model asset={ASSETS.keyCard} position={[0, 0, 0]} fallback={<KeyCardPrimitive />} />
            </group>
         </group>
         {/* the elevator: door, pad, the ride's light */}
         <Model asset={ASSETS.elevator} position={[HALF_W - 0.17, 0, ELEVATOR_Z]} fallback={<ElevatorPrimitive />} />
         <mesh rotation-x={-Math.PI / 2} position={[PAD_POINT.x, 0.014, PAD_POINT.z]}>
            <ringGeometry args={[0.5, 0.78, 40]} />
            <meshBasicMaterial ref={padMat} color={COLORS.padOff} transparent opacity={0.4} depthWrite={false} />
         </mesh>
         <mesh ref={beam} position={[PAD_POINT.x, 1.3, PAD_POINT.z]} visible={false}>
            <cylinderGeometry args={[0.62, 0.7, 2.6, 28, 1, true]} />
            <meshBasicMaterial color={COLORS.glow} transparent opacity={0.22} blending={AdditiveBlending} depthWrite={false} side={2} />
         </mesh>
         <group ref={ring} visible={false}>
            <mesh rotation-x={-Math.PI / 2}>
               <ringGeometry args={[0.36, 0.46, 32]} />
               <meshBasicMaterial ref={ringMat} color={COLORS.ok} transparent opacity={0.85} depthWrite={false} />
            </mesh>
         </group>
         {/* the far end: a tall window of light */}
         <mesh position={[0, WALL_H * 0.55, length - 0.005]}>
            <planeGeometry args={[2.2, 1.6]} />
            <meshStandardMaterial color={COLORS.glow} emissive={COLORS.glow} emissiveIntensity={config.lighting === "night" ? 0.25 : 0.6} side={2} />
         </mesh>
         <Bellboy run={run} />
         <Trolley run={run} atlas={atlas.material} quality={quality.decor} />
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
