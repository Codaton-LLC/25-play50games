"use client";

// Robot Collector stand-ins and decoration: the warehouse, the primitive robot and battery.
// Warehouse-specific: a new game draws its own look and does NOT copy this file (the reusable
// pattern is in Scene.tsx; the helpers it uses come from core/render and core/assets).
import { useEffect, useMemo, type RefObject } from "react";
import {
   AdditiveBlending,
   CircleGeometry,
   CylinderGeometry,
   DoubleSide,
   MeshBasicMaterial,
   MeshStandardMaterial,
   RingGeometry,
   type Group,
} from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { Instanced, useCanvasTexture } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { ARENA, BARREL_RADIUS, CRATE_SIZE, PROPS, ROBOT_START } from "./rules";

// ---------- look ----------

/** Walls stand just outside the floor (the collision bounds are ARENA in rules.ts). */
export const WALL = { thickness: 0.4, height: 0.9 } as const;

export const COLORS = {
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

// ---------- the warehouse (static) ----------

/** Small fixed wobble per prop, so the crates do not look machine-placed (deterministic). */
const jitter = (i: number, amount: number) => Math.sin(i * 12.9898 + 4.1414) * amount;

/** Where each crate stands (its feet); a stacked crate is a second, slightly smaller one on top (looks only). */
const CRATE_SPOTS = PROPS.flatMap((prop, i) => {
   if (prop.kind !== "crate") return [];
   const base = { x: prop.x, y: 0, z: prop.z, rotY: jitter(i, 0.05), scale: 1 };
   if (prop.stack !== 2) return [base];
   return [base, { x: prop.x + jitter(i + 3, 0.06), y: CRATE_SIZE, z: prop.z, rotY: jitter(i + 7, 0.35), scale: 0.88 }];
});
/** The stand-in box is centred on its spot, so it is lifted by half its height. */
const CRATE_BOX_SPOTS = CRATE_SPOTS.map((spot) => ({ ...spot, y: spot.y + (CRATE_SIZE * spot.scale) / 2 }));
const BARREL_SPOTS = PROPS.filter((prop) => prop.kind === "barrel").map((b, i) => ({ x: b.x, y: 0, z: b.z, rotY: jitter(i, 1) }));
const BARREL_HEIGHT = 1;
/** heights of the two ridges */
const BARREL_RINGS = [0.33, 0.67];

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

/** Floor, slab, walls, crates and barrels: everything that never moves. */
export function Warehouse() {
   const floor = useCanvasTexture(768, 512, drawFloor);

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
         <Instanced spots={WALL_SPOTS}>
            <boxGeometry />
            <meshStandardMaterial color={COLORS.wall} roughness={0.7} />
         </Instanced>
         <Instanced spots={TRIM_SPOTS}>
            <boxGeometry />
            <meshStandardMaterial color={COLORS.trim} roughness={0.5} />
         </Instanced>
         <Crates />
         <Barrels />
      </group>
   );
}

/** All crates: instanced (one draw call per mesh, whatever the count), the GLB once it exists. */
function Crates() {
   return <InstancedModel asset={ASSETS.crate} spots={CRATE_SPOTS} fallback={<CrateBoxes />} />;
}

/** Stand-in crates: one InstancedMesh of boxes with a canvas-drawn plank texture. */
function CrateBoxes() {
   const texture = useCanvasTexture(128, 128, drawCrate);
   return (
      <Instanced spots={CRATE_BOX_SPOTS}>
         <boxGeometry args={[CRATE_SIZE, CRATE_SIZE, CRATE_SIZE]} />
         <meshStandardMaterial map={texture} roughness={0.85} />
      </Instanced>
   );
}

const BARREL_BODY_SPOTS = BARREL_SPOTS.map((b) => ({ x: b.x, y: BARREL_HEIGHT / 2, z: b.z }));
const BARREL_RING_SPOTS = BARREL_SPOTS.flatMap((b) => BARREL_RINGS.map((y) => ({ x: b.x, y, z: b.z })));

/** All barrels: instanced, the GLB once it exists. */
function Barrels() {
   return <InstancedModel asset={ASSETS.barrel} spots={BARREL_SPOTS} fallback={<BarrelStandIns />} />;
}

/** Stand-in barrels: two InstancedMeshes (body with a lighter lid, ridges). */
function BarrelStandIns() {
   return (
      <>
         <Instanced spots={BARREL_BODY_SPOTS}>
            <cylinderGeometry args={[BARREL_RADIUS * 0.94, BARREL_RADIUS * 0.94, BARREL_HEIGHT, 20]} />
            {/* cylinder material groups: 0 = side, 1 = top, 2 = bottom */}
            <meshStandardMaterial attach="material-0" color={COLORS.barrel} roughness={0.35} metalness={0.2} />
            <meshStandardMaterial attach="material-1" color={COLORS.barrelLid} roughness={0.4} metalness={0.2} />
            <meshStandardMaterial attach="material-2" color={COLORS.barrel} />
         </Instanced>
         <Instanced spots={BARREL_RING_SPOTS}>
            <cylinderGeometry args={[BARREL_RADIUS, BARREL_RADIUS, 0.07, 20]} />
            <meshStandardMaterial color={COLORS.barrelRing} roughness={0.3} metalness={0.3} />
         </Instanced>
      </>
   );
}

// ---------- the robot ----------

/** Stand-in robot until robot.glb exists: capsule body, round head, visor with two glowing eyes. */
export function RobotPrimitive({
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

// ---------- batteries ----------

/** Geometries and materials shared by every battery (created once per run, disposed with it). */
export function useBatteryParts() {
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

export type BatteryParts = ReturnType<typeof useBatteryParts>;

/** Stand-in battery until battery.glb exists: glowing green cell, white label band, metal tip. */
export function BatteryPrimitive({ parts }: { parts: BatteryParts }) {
   return (
      <>
         <mesh geometry={parts.base} material={parts.baseMat} position-y={0.035} />
         <mesh geometry={parts.body} material={parts.bodyMat} position-y={0.36} />
         <mesh geometry={parts.band} material={parts.bandMat} position-y={0.37} />
         <mesh geometry={parts.cap} material={parts.capMat} position-y={0.705} />
      </>
   );
}
