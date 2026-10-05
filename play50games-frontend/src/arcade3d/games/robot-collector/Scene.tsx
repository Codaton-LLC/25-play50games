"use client";

// Robot Collector scene: the warehouse, the robot, the batteries and the camera.
// Game logic lives in rules.ts (pure, tested); this file feeds it input + dt and draws the result.
//
// The pattern to copy:
// - Run state is a plain object created once per run (GameShell remounts Scene for every run).
//   The frame loop mutates it; nothing in the loop calls setState or allocates.
// - useRunFrame changes the game (it only runs while "playing"); useFrame only animates looks.
// - The store is the only way out: addScore / setStat / end(reason). GameShell does the rest.
// - Models: useModel says whether the GLB exists. Until it does, the primitives below stand in.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   AdditiveBlending,
   CanvasTexture,
   CircleGeometry,
   CylinderGeometry,
   DoubleSide,
   MeshBasicMaterial,
   MeshStandardMaterial,
   Object3D,
   PerspectiveCamera,
   RingGeometry,
   SRGBColorSpace,
   Vector3,
   type Group,
   type InstancedMesh,
   type Mesh,
} from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { Model, useModel } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import { useInput } from "@/arcade3d/core/input";
import { useCoarsePointer } from "@/arcade3d/core/TouchControls";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS } from "./assets";
import {
   ARENA,
   BARREL_RADIUS,
   BATTERY_COUNT,
   BATTERY_POINTS,
   CRATE_SIZE,
   PROPS,
   ROBOT,
   ROBOT_START,
   capScore,
   collectTouched,
   createProgress,
   createRobot,
   generateLayout,
   inputToWorld,
   isActive,
   isComplete,
   runScore,
   stepRobot,
   type Layout,
   type Progress,
   type RobotState,
} from "./rules";

// ---------- look ----------

const WALL = { thickness: 0.4, height: 0.9 } as const;
const COLORS = {
   floor: "#56698a",
   plinth: "#1b2538",
   wall: "#8ea0b8",
   trim: "#facc15",
   crate: "#d98a2b",
   barrel: "#2f6fe4",
   barrelRing: "#7cb4fb",
   barrelLid: "#a9cdfc",
   robot: "#2dd4bf",
   robotHead: "#f1f5f9",
   robotDark: "#0f172a",
   robotEye: "#67e8f9",
   robotTip: "#fbbf24",
   battery: "#22c55e",
   batteryGlow: "#4ade80",
} as const;

/** Small fixed wobble per prop, so the crates do not look machine-placed (deterministic). */
const jitter = (i: number, amount: number) => Math.sin(i * 12.9898 + 4.1414) * amount;

/** One spot per crate; a stacked crate is a second, slightly smaller one on top (looks only). */
const CRATE_SPOTS = PROPS.flatMap((prop, i) => {
   if (prop.kind !== "crate") return [];
   const base = { x: prop.x, y: CRATE_SIZE / 2, z: prop.z, rotY: jitter(i, 0.05), scale: 1 };
   if (prop.stack !== 2) return [base];
   const scale = 0.88;
   return [base, { x: prop.x + jitter(i + 3, 0.06), y: CRATE_SIZE + (CRATE_SIZE * scale) / 2, z: prop.z, rotY: jitter(i + 7, 0.35), scale }];
});
const BARREL_SPOTS = PROPS.filter((prop) => prop.kind === "barrel");
const BARREL_HEIGHT = 1;
/** heights of the two ridges */
const BARREL_RINGS = [0.33, 0.67];

// ---------- camera ----------

/** Camera tilt above the floor: a three-quarter top-down view. */
const PITCH = (56 * Math.PI) / 180;
/** The camera follows a focus point this fraction of the way from the warehouse centre to the robot. */
const FOLLOW = 0.12;
/** Screen area (NDC) the warehouse must stay inside: room for the HUD on top and the joystick below. */
const SAFE = { side: 0.96, top: 0.78, bottom: -0.86, bottomTouch: -0.6 } as const;
const ORIGIN: [number, number, number] = [0, 0, 0];

interface View {
   /** 0 = camera on the +z side (long side across the screen); PI/2 = on the +x side (portrait) */
   yaw: number;
   /** camera position relative to the focus point */
   offset: [number, number, number];
}

/**
 * Finds the closest camera that keeps the whole warehouse (walls included) inside SAFE wherever
 * the follow focus goes. Tries both yaws and keeps the closer one, so a portrait phone looks
 * along the long side and the robot stays as big as possible. Runs on resize only.
 */
function fitView(aspect: number, fov: number, bottom: number): View {
   const cam = new PerspectiveCamera(fov, aspect, 0.1, 500);
   const ex = ARENA.halfX + WALL.thickness;
   const ez = ARENA.halfZ + WALL.thickness;
   const corners: Vector3[] = [];
   for (const x of [-ex, ex]) for (const z of [-ez, ez]) for (const y of [0, WALL.height]) corners.push(new Vector3(x, y, z));
   const focus = new Vector3();
   const p = new Vector3();

   const fits = (yaw: number, distance: number) => {
      const flat = Math.cos(PITCH) * distance;
      for (const sx of [-1, 1]) {
         for (const sz of [-1, 1]) {
            focus.set(sx * FOLLOW * ARENA.halfX, 0, sz * FOLLOW * ARENA.halfZ);
            cam.position.set(focus.x + Math.sin(yaw) * flat, Math.sin(PITCH) * distance, focus.z + Math.cos(yaw) * flat);
            cam.lookAt(focus);
            cam.updateMatrixWorld();
            for (const corner of corners) {
               p.copy(corner).project(cam);
               if (p.z > 1 || Math.abs(p.x) > SAFE.side || p.y > SAFE.top || p.y < bottom) return false;
            }
         }
      }
      return true;
   };

   let best: View = { yaw: 0, offset: [0, 20, 14] };
   let bestDistance = Infinity;
   for (const yaw of [0, Math.PI / 2]) {
      let near = 4;
      let far = 250;
      for (let i = 0; i < 28; i++) {
         const mid = (near + far) / 2;
         if (fits(yaw, mid)) far = mid;
         else near = mid;
      }
      if (far < bestDistance) {
         bestDistance = far;
         const flat = Math.cos(PITCH) * far;
         best = { yaw, offset: [Math.sin(yaw) * flat, Math.sin(PITCH) * far, Math.cos(yaw) * flat] };
      }
   }
   return best;
}

function useWarehouseView(): View {
   const width = useThree((state) => state.size.width);
   const height = useThree((state) => state.size.height);
   const camera = useThree((state) => state.camera);
   const coarse = useCoarsePointer();
   const fov = camera instanceof PerspectiveCamera ? camera.fov : 45;
   return useMemo(
      () => fitView(width / Math.max(1, height), fov, coarse ? SAFE.bottomTouch : SAFE.bottom),
      [width, height, fov, coarse]
   );
}

// ---------- shared helpers ----------

/** A CanvasTexture drawn once (floor markings, crate planks); disposed with the component. */
function useCanvasTexture(
   width: number,
   height: number,
   draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
): CanvasTexture {
   const gl = useThree((state) => state.gl);
   const texture = useMemo(() => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) draw(ctx, width, height);
      const map = new CanvasTexture(canvas);
      map.colorSpace = SRGBColorSpace;
      map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      return map;
   }, [gl, width, height, draw]);
   useEffect(() => () => texture.dispose(), [texture]);
   return texture;
}

interface Spot {
   x: number;
   y: number;
   z: number;
   rotY?: number;
   /** uniform scale, or per axis with sx/sy/sz */
   scale?: number;
   sx?: number;
   sy?: number;
   sz?: number;
}
const NO_SPOTS: Spot[] = [];

/** Writes one matrix per spot into an InstancedMesh (once, before the first frame). */
function useInstanceMatrices(ref: RefObject<InstancedMesh>, spots: readonly Spot[]) {
   useLayoutEffect(() => {
      const mesh = ref.current;
      if (!mesh) return;
      const o = new Object3D();
      spots.forEach((spot, i) => {
         o.position.set(spot.x, spot.y, spot.z);
         o.rotation.set(0, spot.rotY ?? 0, 0);
         const s = spot.scale ?? 1;
         o.scale.set(spot.sx ?? s, spot.sy ?? s, spot.sz ?? s);
         o.updateMatrix();
         mesh.setMatrixAt(i, o.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
   }, [ref, spots]);
}

/** Soft dark disc under a moving object (no shadow maps: they cost a render pass on phones). */
function BlobShadow({ radius, opacity = 0.32 }: { radius: number; opacity?: number }) {
   return (
      <mesh rotation-x={-Math.PI / 2} position-y={0.012} renderOrder={1}>
         <circleGeometry args={[radius, 24]} />
         <meshBasicMaterial color="#020617" transparent opacity={opacity} depthWrite={false} />
      </mesh>
   );
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Overshoots a little, then settles: a "pop" for batteries that appear. */
const easeOutBack = (k: number) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;

// ---------- the warehouse (static) ----------

function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const s = w / (ARENA.halfX * 2); // px per unit
   const u = (x: number) => (x + ARENA.halfX) * s;
   const v = (z: number) => (z + ARENA.halfZ) * s;

   ctx.fillStyle = COLORS.floor;
   ctx.fillRect(0, 0, w, h);

   // 2 x 2 unit concrete tiles
   ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
   ctx.lineWidth = 2;
   for (let x = -ARENA.halfX + 2; x < ARENA.halfX; x += 2) {
      ctx.beginPath();
      ctx.moveTo(u(x), 0);
      ctx.lineTo(u(x), h);
      ctx.stroke();
   }
   for (let z = -ARENA.halfZ + 2; z < ARENA.halfZ; z += 2) {
      ctx.beginPath();
      ctx.moveTo(0, v(z));
      ctx.lineTo(w, v(z));
      ctx.stroke();
   }

   // soft contact shadows under every prop (baked: the props never move)
   ctx.fillStyle = "rgba(2, 6, 23, 0.14)";
   for (const prop of PROPS) {
      for (const grow of [0.45, 0.3, 0.16]) {
         ctx.beginPath();
         if (prop.kind === "crate") {
            const half = CRATE_SIZE / 2 + grow;
            ctx.rect(u(prop.x - half), v(prop.z - half), half * 2 * s, half * 2 * s);
         } else {
            ctx.arc(u(prop.x), v(prop.z), (BARREL_RADIUS + grow) * s, 0, Math.PI * 2);
         }
         ctx.fill();
      }
   }

   // yellow safety line along the walls
   ctx.strokeStyle = COLORS.trim;
   ctx.lineWidth = 0.14 * s;
   ctx.strokeRect(0.5 * s, 0.5 * s, w - s, h - s);

   // charging pad where the robot starts
   ctx.strokeStyle = COLORS.robot;
   ctx.lineWidth = 0.1 * s;
   ctx.beginPath();
   ctx.arc(u(ROBOT_START.x), v(ROBOT_START.z), 0.95 * s, 0, Math.PI * 2);
   ctx.stroke();
   ctx.fillStyle = "rgba(45, 212, 191, 0.18)";
   ctx.fill();
}

function drawCrate(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = COLORS.crate;
   ctx.fillRect(0, 0, w, h);
   // planks
   ctx.fillStyle = "rgba(120, 53, 15, 0.35)";
   for (let y = h / 4; y < h; y += h / 4) ctx.fillRect(0, y - 2, w, 4);
   // frame and diagonal brace
   ctx.strokeStyle = "#9a4d12";
   ctx.lineWidth = w * 0.12;
   ctx.strokeRect(w * 0.06, h * 0.06, w * 0.88, h * 0.88);
   ctx.lineWidth = w * 0.1;
   ctx.beginPath();
   ctx.moveTo(w * 0.12, h * 0.88);
   ctx.lineTo(w * 0.88, h * 0.12);
   ctx.stroke();
   // metal corners
   ctx.fillStyle = "#cbd5e1";
   const c = w * 0.16;
   for (const [x, y] of [[0, 0], [w - c, 0], [0, h - c], [w - c, h - c]]) ctx.fillRect(x, y, c, c);
}

const WALL_SPOTS = (() => {
   const t = WALL.thickness;
   const longX = ARENA.halfX * 2 + t * 2;
   const longZ = ARENA.halfZ * 2;
   return [
      { x: 0, y: WALL.height / 2, z: -(ARENA.halfZ + t / 2), sx: longX, sy: WALL.height, sz: t },
      { x: 0, y: WALL.height / 2, z: ARENA.halfZ + t / 2, sx: longX, sy: WALL.height, sz: t },
      { x: -(ARENA.halfX + t / 2), y: WALL.height / 2, z: 0, sx: t, sy: WALL.height, sz: longZ },
      { x: ARENA.halfX + t / 2, y: WALL.height / 2, z: 0, sx: t, sy: WALL.height, sz: longZ },
   ];
})();
const TRIM_SPOTS = WALL_SPOTS.map((spot) => ({ ...spot, y: WALL.height + 0.04, sx: spot.sx + 0.06, sy: 0.08, sz: spot.sz + 0.06 }));

function Warehouse() {
   const floor = useCanvasTexture(768, 512, drawFloor);
   const walls = useRef<InstancedMesh>(null);
   const trims = useRef<InstancedMesh>(null);
   useInstanceMatrices(walls, WALL_SPOTS);
   useInstanceMatrices(trims, TRIM_SPOTS);

   return (
      <group name="warehouse">
         <mesh rotation-x={-Math.PI / 2}>
            <planeGeometry args={[ARENA.halfX * 2, ARENA.halfZ * 2]} />
            <meshStandardMaterial map={floor} roughness={0.92} />
         </mesh>
         {/* the slab the diorama stands on */}
         <mesh position-y={-0.26}>
            <boxGeometry args={[(ARENA.halfX + WALL.thickness) * 2 + 0.3, 0.5, (ARENA.halfZ + WALL.thickness) * 2 + 0.3]} />
            <meshStandardMaterial color={COLORS.plinth} roughness={0.9} />
         </mesh>
         <instancedMesh ref={walls} args={[undefined, undefined, WALL_SPOTS.length]}>
            <boxGeometry />
            <meshStandardMaterial color={COLORS.wall} roughness={0.7} />
         </instancedMesh>
         <instancedMesh ref={trims} args={[undefined, undefined, TRIM_SPOTS.length]}>
            <boxGeometry />
            <meshStandardMaterial color={COLORS.trim} roughness={0.5} />
         </instancedMesh>
         <Crates />
         <Barrels />
      </group>
   );
}

/** All crates: one InstancedMesh (1 draw call) until the GLB exists, then one <Model> each. */
function Crates() {
   const { failed } = useModel(ASSETS.crate);
   const mesh = useRef<InstancedMesh>(null);
   const texture = useCanvasTexture(128, 128, drawCrate);
   useInstanceMatrices(mesh, failed ? CRATE_SPOTS : NO_SPOTS);

   if (!failed) {
      return (
         <>
            {CRATE_SPOTS.map((spot, i) => (
               <Model
                  key={i}
                  asset={ASSETS.crate}
                  position={[spot.x, spot.y - (CRATE_SIZE * spot.scale) / 2, spot.z]}
                  rotation-y={spot.rotY}
                  scale={spot.scale}
               />
            ))}
         </>
      );
   }
   return (
      <instancedMesh ref={mesh} args={[undefined, undefined, CRATE_SPOTS.length]}>
         <boxGeometry args={[CRATE_SIZE, CRATE_SIZE, CRATE_SIZE]} />
         <meshStandardMaterial map={texture} roughness={0.85} />
      </instancedMesh>
   );
}

const BARREL_BODY_SPOTS = BARREL_SPOTS.map((b) => ({ x: b.x, y: BARREL_HEIGHT / 2, z: b.z }));
const BARREL_RING_SPOTS = BARREL_SPOTS.flatMap((b) => BARREL_RINGS.map((y) => ({ x: b.x, y, z: b.z })));

/** All barrels: two InstancedMeshes (body with a lighter lid + ridges) until the GLB exists. */
function Barrels() {
   const { failed } = useModel(ASSETS.barrel);
   const bodies = useRef<InstancedMesh>(null);
   const rings = useRef<InstancedMesh>(null);
   useInstanceMatrices(bodies, failed ? BARREL_BODY_SPOTS : NO_SPOTS);
   useInstanceMatrices(rings, failed ? BARREL_RING_SPOTS : NO_SPOTS);

   if (!failed) {
      return (
         <>
            {BARREL_SPOTS.map((b, i) => (
               <Model key={i} asset={ASSETS.barrel} position={[b.x, 0, b.z]} rotation-y={jitter(i, 1)} />
            ))}
         </>
      );
   }
   return (
      <>
         <instancedMesh ref={bodies} args={[undefined, undefined, BARREL_BODY_SPOTS.length]}>
            <cylinderGeometry args={[BARREL_RADIUS * 0.94, BARREL_RADIUS * 0.94, BARREL_HEIGHT, 20]} />
            {/* cylinder material groups: 0 = side, 1 = top, 2 = bottom */}
            <meshStandardMaterial attach="material-0" color={COLORS.barrel} roughness={0.35} metalness={0.2} />
            <meshStandardMaterial attach="material-1" color={COLORS.barrelLid} roughness={0.4} metalness={0.2} />
            <meshStandardMaterial attach="material-2" color={COLORS.barrel} />
         </instancedMesh>
         <instancedMesh ref={rings} args={[undefined, undefined, BARREL_RING_SPOTS.length]}>
            <cylinderGeometry args={[BARREL_RADIUS, BARREL_RADIUS, 0.07, 20]} />
            <meshStandardMaterial color={COLORS.barrelRing} roughness={0.3} metalness={0.3} />
         </instancedMesh>
      </>
   );
}

// ---------- the robot ----------

interface RunData {
   robot: RobotState;
   progress: Progress;
   /** scratch for inputToWorld (no allocation per frame) */
   dir: { x: number; z: number };
}

/** Stand-in robot until robot.glb exists: capsule body, round head, visor with two glowing eyes. */
function RobotPrimitive({
   antenna,
   panel,
}: {
   antenna: RefObject<Group>;
   panel: RefObject<MeshStandardMaterial>;
}) {
   return (
      <group>
         {[-0.36, 0.36].map((x) => (
            <mesh key={x} position={[x, 0.17, 0]} rotation-z={Math.PI / 2}>
               <cylinderGeometry args={[0.17, 0.17, 0.14, 16]} />
               <meshStandardMaterial color={COLORS.robotDark} roughness={0.7} />
            </mesh>
         ))}
         <mesh position-y={0.58}>
            <capsuleGeometry args={[0.34, 0.3, 6, 16]} />
            <meshStandardMaterial color={COLORS.robot} roughness={0.4} />
         </mesh>
         {/* charge meter on the chest: glows brighter with every battery */}
         <mesh position={[0, 0.56, 0.32]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.13, 0.13, 0.05, 16]} />
            <meshStandardMaterial ref={panel} color="#bbf7d0" emissive={COLORS.batteryGlow} emissiveIntensity={0.2} />
         </mesh>
         <mesh position-y={1.12} scale={[1.15, 0.86, 1]}>
            <sphereGeometry args={[0.3, 20, 14]} />
            <meshStandardMaterial color={COLORS.robotHead} roughness={0.35} />
         </mesh>
         <mesh position={[0, 1.13, 0.15]} scale={[1.1, 0.58, 0.62]}>
            <sphereGeometry args={[0.24, 20, 12]} />
            <meshStandardMaterial color={COLORS.robotDark} roughness={0.2} />
         </mesh>
         {[-0.1, 0.1].map((x) => (
            <mesh key={x} position={[x, 1.14, 0.3]}>
               <sphereGeometry args={[0.055, 12, 8]} />
               <meshStandardMaterial color={COLORS.robotEye} emissive={COLORS.robotEye} emissiveIntensity={2.2} />
            </mesh>
         ))}
         <group ref={antenna} position-y={1.34}>
            <mesh position-y={0.12}>
               <cylinderGeometry args={[0.022, 0.022, 0.24, 8]} />
               <meshStandardMaterial color={COLORS.robotDark} />
            </mesh>
            <mesh position-y={0.27}>
               <sphereGeometry args={[0.065, 12, 8]} />
               <meshStandardMaterial color={COLORS.robotTip} emissive={COLORS.robotTip} emissiveIntensity={1.4} />
            </mesh>
         </group>
      </group>
   );
}

function Robot({ run }: { run: RunData }) {
   const { failed } = useModel(ASSETS.robot);
   const root = useRef<Group>(null);
   const rig = useRef<Group>(null);
   const antenna = useRef<Group>(null);
   const panel = useRef<MeshStandardMaterial>(null);

   // looks only: follows the simulated robot, bobs and leans with its speed
   useFrame((state, delta) => {
      const g = root.current;
      const body = rig.current;
      if (!g || !body) return;
      const { robot, progress } = run;
      const t = state.clock.elapsedTime;
      const speed = Math.min(1, Math.hypot(robot.vx, robot.vz) / ROBOT.maxSpeed);
      const { phase, endReason } = useArcadeStore.getState();
      const won = phase === "over" && endReason === "win";

      g.position.set(robot.x, 0, robot.z);
      if (won) g.rotation.y += delta * 5;
      else g.rotation.y = robot.heading;
      body.position.y = won ? Math.abs(Math.sin(t * 7)) * 0.25 : Math.abs(Math.sin(t * 15)) * 0.05 * speed + Math.sin(t * 2.2) * 0.012;
      body.rotation.x = 0.16 * speed;
      if (antenna.current) antenna.current.rotation.x = -0.3 * speed + Math.sin(t * 11) * 0.1 * speed;
      if (panel.current) panel.current.emissiveIntensity = 0.2 + (1.8 * progress.collected) / BATTERY_COUNT;
   });

   return (
      <group ref={root} name="robot">
         <BlobShadow radius={0.55} />
         {/* player marker: easy to spot on a small phone screen */}
         <mesh rotation-x={-Math.PI / 2} position-y={0.014}>
            <ringGeometry args={[0.6, 0.72, 32]} />
            <meshBasicMaterial color={COLORS.robot} transparent opacity={0.75} depthWrite={false} />
         </mesh>
         <group ref={rig}>{failed ? <RobotPrimitive antenna={antenna} panel={panel} /> : <Model asset={ASSETS.robot} />}</group>
      </group>
   );
}

// ---------- batteries ----------

/** Geometries and materials shared by every battery (created once per run, disposed with it). */
function useBatteryParts() {
   const parts = useMemo(
      () => ({
         body: new CylinderGeometry(0.28, 0.28, 0.58, 20),
         band: new CylinderGeometry(0.288, 0.288, 0.12, 20),
         cap: new CylinderGeometry(0.11, 0.11, 0.11, 12),
         base: new CylinderGeometry(0.295, 0.295, 0.07, 20),
         glow: new CircleGeometry(0.85, 32),
         beam: new CylinderGeometry(0.2, 0.38, 3.2, 16, 1, true),
         ring: new RingGeometry(0.42, 0.62, 32),
         bodyMat: new MeshStandardMaterial({ color: COLORS.battery, emissive: "#16a34a", emissiveIntensity: 0.9, roughness: 0.35 }),
         bandMat: new MeshStandardMaterial({ color: "#f0fdf4", emissive: "#bbf7d0", emissiveIntensity: 0.25, roughness: 0.5 }),
         capMat: new MeshStandardMaterial({ color: "#e2e8f0", metalness: 0.6, roughness: 0.3 }),
         baseMat: new MeshStandardMaterial({ color: "#14532d", roughness: 0.6 }),
         glowMat: new MeshBasicMaterial({ color: COLORS.batteryGlow, transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false }),
         beamMat: new MeshBasicMaterial({
            color: "#86efac",
            transparent: true,
            opacity: 0.2,
            blending: AdditiveBlending,
            depthWrite: false,
            side: DoubleSide,
         }),
         ringMat: new MeshBasicMaterial({ color: "#bbf7d0", transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
      }),
      []
   );
   useEffect(() => () => Object.values(parts).forEach((part) => part.dispose()), [parts]);
   return parts;
}

type BatteryParts = ReturnType<typeof useBatteryParts>;

/** Stand-in battery until battery.glb exists: glowing green cell, white label band, metal tip. */
function BatteryPrimitive({ parts }: { parts: BatteryParts }) {
   return (
      <>
         <mesh geometry={parts.base} material={parts.baseMat} position-y={0.035} />
         <mesh geometry={parts.body} material={parts.bodyMat} position-y={0.36} />
         <mesh geometry={parts.band} material={parts.bandMat} position-y={0.37} />
         <mesh geometry={parts.cap} material={parts.capMat} position-y={0.705} />
      </>
   );
}

const POP_S = 0.45;
const RING_S = 0.5;

function Batteries({ run, layout }: { run: RunData; layout: Layout }) {
   const { failed } = useModel(ASSETS.battery);
   const parts = useBatteryParts();
   const slots = useRef<Array<Group | null>>([]);
   const bobs = useRef<Array<Group | null>>([]);
   const ring = useRef<Mesh>(null);
   // visual bookkeeping only (the rules own the real state)
   const [fx] = useState(() => ({
      wave: -1,
      appearedAt: new Array<number>(BATTERY_COUNT).fill(0),
      shownTaken: new Array<boolean>(BATTERY_COUNT).fill(false),
      ringAt: -10,
   }));

   useFrame((state) => {
      const t = state.clock.elapsedTime;
      const { progress } = run;
      if (fx.wave !== progress.wave) {
         fx.wave = progress.wave;
         for (const b of layout.batteries) if (b.wave === progress.wave) fx.appearedAt[b.index] = t;
      }

      for (const b of layout.batteries) {
         const slot = slots.current[b.index];
         const bob = bobs.current[b.index];
         if (!slot || !bob) continue;
         if (progress.taken[b.index] && !fx.shownTaken[b.index]) {
            fx.shownTaken[b.index] = true;
            fx.ringAt = t;
            ring.current?.position.set(b.x, 0.03, b.z);
         }
         const active = isActive(progress, b);
         slot.visible = active;
         if (!active) continue;
         slot.scale.setScalar(Math.max(0.001, easeOutBack(clamp01((t - fx.appearedAt[b.index]) / POP_S))));
         bob.position.y = 0.16 + Math.sin(t * 2.6 + b.index) * 0.07;
         bob.rotation.y = t * 1.6 + b.index;
      }

      parts.glowMat.opacity = 0.36 + Math.sin(t * 4) * 0.1;
      // pickup flash: a ring that grows and fades where the battery was
      const k = (t - fx.ringAt) / RING_S;
      if (ring.current) {
         ring.current.visible = k >= 0 && k < 1;
         ring.current.scale.setScalar(0.5 + 2 * k);
         parts.ringMat.opacity = 0.9 * (1 - k);
      }
   });

   return (
      <group name="batteries">
         {layout.batteries.map((b) => (
            <group
               key={b.index}
               ref={(el) => {
                  slots.current[b.index] = el;
               }}
               position={[b.x, 0, b.z]}
               name={`battery-${b.index}`}
            >
               <mesh geometry={parts.glow} material={parts.glowMat} rotation-x={-Math.PI / 2} position-y={0.015} />
               <mesh geometry={parts.beam} material={parts.beamMat} position-y={1.6} />
               <group
                  ref={(el) => {
                     bobs.current[b.index] = el;
                  }}
               >
                  {failed ? <BatteryPrimitive parts={parts} /> : <Model asset={ASSETS.battery} />}
               </group>
            </group>
         ))}
         <mesh ref={ring} geometry={parts.ring} material={parts.ringMat} rotation-x={-Math.PI / 2} visible={false} />
      </group>
   );
}

// ---------- the scene ----------

export default function Scene() {
   const input = useInput();
   const view = useWarehouseView();
   // a new seed every run: GameShell remounts the Scene (key = runId) on start and retry
   const [layout] = useState(() => generateLayout(Math.floor(Math.random() * 2 ** 32)));
   const [run] = useState<RunData>(() => {
      const robot = createRobot();
      robot.heading = view.yaw; // face the camera on the start pad
      return { robot, progress: createProgress(), dir: { x: 0, z: 0 } };
   });
   const focus = useRef<Group>(null);

   // the game: move, collect, score, end. Runs only while "playing", dt is clamped.
   useRunFrame((_state, dt) => {
      const { moveX, moveY } = input.current;
      inputToWorld(moveX, moveY, view.yaw, run.dir);
      stepRobot(run.robot, run.dir.x, run.dir.z, dt);

      const got = collectTouched(run.progress, layout, run.robot);
      if (got === 0) return;
      const store = useArcadeStore.getState();
      store.addScore(got * BATTERY_POINTS);
      store.setStat("batteries", run.progress.collected);
      playSfx("pickup");

      if (isComplete(run.progress)) {
         // the run clock ticked before this callback, so timeLeftMs/elapsedMs are this frame's
         const { timeLeftMs, elapsedMs } = useArcadeStore.getState();
         store.setScore(capScore(runScore(BATTERY_COUNT, true, timeLeftMs ?? 0), elapsedMs));
         store.end("win");
      }
   });

   // camera focus: part of the way towards the robot, so the whole warehouse stays in frame
   useFrame(() => {
      focus.current?.position.set(run.robot.x * FOLLOW, 0, run.robot.z * FOLLOW);
   });

   return (
      <>
         <CameraRig camera={{ position: view.offset, lookAt: ORIGIN }} follow={focus} offset={view.offset} damping={4} />
         <group ref={focus} />
         <Warehouse />
         <Robot run={run} />
         <Batteries run={run} layout={layout} />
      </>
   );
}
