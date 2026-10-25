"use client";

// Robot Collector stand-ins and decoration: the sci-fi robotics warehouse,
// the deliberate primitive robot, and the modern energy battery cell.
// Modern look (2026-10-25): bevelled shapes, 2-3 tones per object from COLORS in looks.ts,
// panelled floor with light strips, outer ground plane covering all viewport sizes.
import { useEffect, useMemo, type RefObject } from "react";
import {
   AdditiveBlending,
   CircleGeometry,
   CylinderGeometry,
   DoubleSide,
   MeshBasicMaterial,
   MeshStandardMaterial,
   RepeatWrapping,
   RingGeometry,
   type Group,
} from "three";
import { useFrame } from "@react-three/fiber";
import { InstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Instanced, useCanvasTexture } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { BELTS, BELT_HALF_WIDTH, SLOW_ZONES, type Belt, type RobotLevel } from "./levels";
import { COLORS, WALL_HEIGHT, WALL_THICKNESS } from "./looks";
import { ARENA, BARREL_RADIUS, CRATE_SIZE, ROBOT_START, type Prop } from "./rules";

// Re-export COLORS and WALL for backwards compatibility
export { COLORS };
export const WALL = { thickness: WALL_THICKNESS, height: WALL_HEIGHT } as const;

// ---------- Warehouse (static) ----------

/** Small fixed wobble per prop so crates and barrels look human-staged. */
const jitter = (i: number, amount: number) => Math.sin(i * 12.9898 + 4.1414) * amount;

const BARREL_HEIGHT = 1;
const BARREL_RINGS = [0.32, 0.68];

function propSpots(props: readonly Prop[]) {
   const crates = props.flatMap((prop, i) => {
      if (prop.kind !== "crate") return [];
      const base = { x: prop.x, y: 0, z: prop.z, rotY: jitter(i, 0.05), scale: 1 };
      if (prop.stack !== 2) return [base];
      return [base, { x: prop.x + jitter(i + 3, 0.06), y: CRATE_SIZE, z: prop.z, rotY: jitter(i + 7, 0.35), scale: 0.88 }];
   });
   const crateBoxes = crates.map((spot) => ({ ...spot, y: spot.y + (CRATE_SIZE * spot.scale) / 2 }));
   const barrels = props.filter((prop) => prop.kind === "barrel").map((b, i) => ({ x: b.x, y: 0, z: b.z, rotY: jitter(i, 1) }));
   return {
      crates,
      crateBoxes,
      barrels,
      barrelBodies: barrels.map((b) => ({ x: b.x, y: BARREL_HEIGHT / 2, z: b.z })),
      barrelRings: barrels.flatMap((b) => BARREL_RINGS.map((y) => ({ x: b.x, y, z: b.z }))),
      barrelCaps: barrels.map((b) => ({ x: b.x, y: BARREL_HEIGHT + 0.02, z: b.z })),
   };
}

type PropSpots = ReturnType<typeof propSpots>;

/** Modern sci-fi robotics lab floor: modular composite panels, light strips, charging pad, contact shadows. */
function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number, props: readonly Prop[]) {
   const sx = w / (ARENA.halfX * 2);
   const sz = h / (ARENA.halfZ * 2);
   const u = (x: number) => (x + ARENA.halfX) * sx;
   const v = (z: number) => (z + ARENA.halfZ) * sz;

   // 1. Base dark tech-slate floor
   ctx.fillStyle = COLORS.floor;
   ctx.fillRect(0, 0, w, h);

   // 2. Alternating modular panels (2 x 2 units)
   const tileW = 2 * sx;
   const tileH = 2 * sz;
   for (let x = -ARENA.halfX; x < ARENA.halfX; x += 2) {
      for (let z = -ARENA.halfZ; z < ARENA.halfZ; z += 2) {
         const col = Math.floor((x + ARENA.halfX) / 2);
         const row = Math.floor((z + ARENA.halfZ) / 2);
         if ((col + row) % 2 === 0) {
            ctx.fillStyle = COLORS.floorTileAlt;
            ctx.fillRect(u(x) + 2, v(z) + 2, tileW - 4, tileH - 4);
         }
      }
   }

   // 3. Panel seam grid lines
   ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
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

   // 4. Subtle rivet dots at tile corners
   ctx.fillStyle = "rgba(203, 213, 225, 0.22)";
   for (let x = -ARENA.halfX + 2; x < ARENA.halfX; x += 2) {
      for (let z = -ARENA.halfZ + 2; z < ARENA.halfZ; z += 2) {
         ctx.beginPath();
         ctx.arc(u(x), v(z), 2.5, 0, Math.PI * 2);
         ctx.fill();
      }
   }

   // 5. Embedded soft cyan LED light strips along main transit tracks
   const stripZ = [-3.8, 3.8];
   for (const szVal of stripZ) {
      // Glow halo
      ctx.strokeStyle = "rgba(6, 182, 212, 0.15)";
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(u(-ARENA.halfX + 1.2), v(szVal));
      ctx.lineTo(u(ARENA.halfX - 1.2), v(szVal));
      ctx.stroke();
      // Core bright light strip
      ctx.strokeStyle = COLORS.lightStrip;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(u(-ARENA.halfX + 1.2), v(szVal));
      ctx.lineTo(u(ARENA.halfX - 1.2), v(szVal));
      ctx.stroke();
   }

   // 6. Baked soft contact ambient occlusion under static props
   ctx.fillStyle = "rgba(2, 6, 23, 0.28)";
   for (const prop of props) {
      for (const grow of [0.42, 0.26, 0.12]) {
         ctx.beginPath();
         if (prop.kind === "crate") {
            const half = CRATE_SIZE / 2 + grow;
            ctx.rect(u(prop.x - half), v(prop.z - half), half * 2 * sx, half * 2 * sz);
         } else {
            ctx.arc(u(prop.x), v(prop.z), (BARREL_RADIUS + grow) * sx, 0, Math.PI * 2);
         }
         ctx.fill();
      }
   }

   // 7. Safety hazard border along walls (alternating amber/dark chevrons)
   ctx.strokeStyle = COLORS.floorTrim;
   ctx.lineWidth = 0.18 * sx;
   ctx.strokeRect(0.4 * sx, 0.4 * sz, w - 0.8 * sx, h - 0.8 * sz);

   // 8. Robot start charging pad: concentric tech circles & radial ticks
   const startX = u(ROBOT_START.x);
   const startZ = v(ROBOT_START.z);
   const padRadius = 1.1 * sx;

   ctx.fillStyle = COLORS.startPadGlow;
   ctx.beginPath();
   ctx.arc(startX, startZ, padRadius, 0, Math.PI * 2);
   ctx.fill();

   ctx.strokeStyle = COLORS.startPadRing;
   ctx.lineWidth = 0.09 * sx;
   ctx.beginPath();
   ctx.arc(startX, startZ, padRadius * 0.9, 0, Math.PI * 2);
   ctx.stroke();

   ctx.lineWidth = 0.04 * sx;
   ctx.beginPath();
   ctx.arc(startX, startZ, padRadius * 0.55, 0, Math.PI * 2);
   ctx.stroke();

   // Radial tick marks
   for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      ctx.beginPath();
      ctx.moveTo(startX + Math.cos(a) * padRadius * 0.65, startZ + Math.sin(a) * padRadius * 0.65);
      ctx.lineTo(startX + Math.cos(a) * padRadius * 0.85, startZ + Math.sin(a) * padRadius * 0.85);
      ctx.stroke();
   }
}

/** Outer ground texture: dark industrial yard apron. */
function drawOuterGround(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = COLORS.outerFloor;
   ctx.fillRect(0, 0, w, h);
   ctx.strokeStyle = COLORS.outerFloorGrid;
   ctx.lineWidth = 2;
   const step = 64;
   for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
   }
   for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
   }
}

/** Deliberate sci-fi shipping container texture for crate stand-in. */
function drawCrate(ctx: CanvasRenderingContext2D, w: number, h: number) {
   // Main container body
   ctx.fillStyle = COLORS.crate;
   ctx.fillRect(0, 0, w, h);

   // Reinforced perimeter frame
   ctx.strokeStyle = COLORS.crateFrame;
   ctx.lineWidth = w * 0.12;
   ctx.strokeRect(w * 0.06, h * 0.06, w * 0.88, h * 0.88);

   // Horizontal reinforcement ribs
   ctx.fillStyle = "rgba(180, 83, 9, 0.4)";
   for (let y = h / 4; y < h; y += h / 4) {
      ctx.fillRect(w * 0.1, y - 3, w * 0.8, 6);
   }

   // Diagonal brace
   ctx.lineWidth = w * 0.08;
   ctx.beginPath();
   ctx.moveTo(w * 0.14, h * 0.86);
   ctx.lineTo(w * 0.86, h * 0.14);
   ctx.stroke();

   // Steel corner gussets with hex bolts
   ctx.fillStyle = COLORS.crateMetal;
   const c = w * 0.18;
   for (const [x, y] of [[0, 0], [w - c, 0], [0, h - c], [w - c, h - c]]) {
      ctx.fillRect(x, y, c, c);
   }

   // Central stencil identification label
   ctx.fillStyle = "rgba(254, 240, 138, 0.85)";
   ctx.fillRect(w * 0.35, h * 0.44, w * 0.3, h * 0.12);
}

/** Conveyor belt surface: dark industrial rubber with illuminated chevron arrows. */
function drawBelt(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = COLORS.belt;
   ctx.fillRect(0, 0, w, h);

   // Metallic guide edge rails
   ctx.fillStyle = COLORS.beltGuide;
   ctx.fillRect(0, 0, w, h * 0.08);
   ctx.fillRect(0, h * 0.92, w, h * 0.08);

   // Glowing direction chevron
   ctx.strokeStyle = COLORS.beltArrow;
   ctx.lineWidth = h * 0.14;
   ctx.lineJoin = "round";
   ctx.lineCap = "round";
   ctx.beginPath();
   ctx.moveTo(w * 0.28, h * 0.24);
   ctx.lineTo(w * 0.68, h * 0.5);
   ctx.lineTo(w * 0.28, h * 0.76);
   ctx.stroke();
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

const TRIM_SPOTS = WALL_SPOTS.map((spot) => ({
   ...spot,
   y: WALL.height + 0.04,
   sx: spot.sx + 0.08,
   sy: 0.08,
   sz: spot.sz + 0.08,
}));

/** Warehouse floor, diorama plinth, outer ground, perimeter barriers, crates and barrels. */
export function Warehouse({ props }: { props: readonly Prop[] }) {
   const spots = useMemo(() => propSpots(props), [props]);
   const draw = useMemo(() => (ctx: CanvasRenderingContext2D, w: number, h: number) => drawFloor(ctx, w, h, props), [props]);
   const floor = useCanvasTexture(1024, 1024, draw);
   const outerDraw = useMemo(() => (ctx: CanvasRenderingContext2D, w: number, h: number) => drawOuterGround(ctx, w, h), []);
   const outerFloor = useCanvasTexture(512, 512, outerDraw);

   useEffect(() => {
      outerFloor.wrapS = outerFloor.wrapT = RepeatWrapping;
      outerFloor.repeat.set(8, 7);
      outerFloor.needsUpdate = true;
   }, [outerFloor]);

   return (
      <group name="warehouse">
         {/* Extended outer ground apron: covers the entire viewport at all orientations (no void at bottom) */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.27, 0]} name="outer-ground">
            <planeGeometry args={[80, 70]} />
            <meshStandardMaterial map={outerFloor} roughness={0.95} />
         </mesh>

         {/* Diorama base plinth */}
         <mesh position-y={-0.26} name="plinth">
            <boxGeometry args={[(ARENA.halfX + WALL.thickness) * 2 + 0.4, 0.5, (ARENA.halfZ + WALL.thickness) * 2 + 0.4]} />
            <meshStandardMaterial color={COLORS.plinth} roughness={0.88} />
         </mesh>

         {/* Panelled playfield floor */}
         <mesh rotation-x={-Math.PI / 2} name="playfield-floor">
            <planeGeometry args={[ARENA.halfX * 2, ARENA.halfZ * 2]} />
            <meshStandardMaterial map={floor} roughness={0.9} />
         </mesh>

         {/* Perimeter barrier walls */}
         <Instanced spots={WALL_SPOTS} name="perimeter-walls">
            <boxGeometry />
            <meshStandardMaterial color={COLORS.wall} roughness={0.65} metalness={0.25} />
         </Instanced>

         {/* Barrier illuminated safety trim */}
         <Instanced spots={TRIM_SPOTS} name="wall-trim">
            <boxGeometry />
            <meshStandardMaterial color={COLORS.wallTrim} roughness={0.45} metalness={0.3} />
         </Instanced>

         <Crates spots={spots} />
         <Barrels spots={spots} />
      </group>
   );
}

/** All crates: instanced (one draw call per mesh, whatever the count), the GLB once it exists. */
function Crates({ spots }: { spots: PropSpots }) {
   return <InstancedModel asset={ASSETS.crate} spots={spots.crates} fallback={<CrateBoxes spots={spots.crateBoxes} />} />;
}

/** Stand-in crates: one InstancedMesh of containers with crisp cargo container textures. */
function CrateBoxes({ spots }: { spots: PropSpots["crateBoxes"] }) {
   const texture = useCanvasTexture(256, 256, drawCrate);
   return (
      <Instanced spots={spots} name="crate-stand-ins">
         <boxGeometry args={[CRATE_SIZE, CRATE_SIZE, CRATE_SIZE]} />
         <meshStandardMaterial map={texture} roughness={0.78} metalness={0.2} />
      </Instanced>
   );
}

/** All barrels: instanced, the GLB once it exists. */
function Barrels({ spots }: { spots: PropSpots }) {
   return <InstancedModel asset={ASSETS.barrel} spots={spots.barrels} fallback={<BarrelStandIns spots={spots} />} />;
}

/** Stand-in barrels: high-tech dual-tone coolant/energy drum with ribbed rings, lid and valve. */
function BarrelStandIns({ spots }: { spots: PropSpots }) {
   return (
      <>
         <Instanced spots={spots.barrelBodies} name="barrel-bodies">
            <cylinderGeometry args={[BARREL_RADIUS * 0.95, BARREL_RADIUS * 0.95, BARREL_HEIGHT, 24]} />
            <meshStandardMaterial attach="material-0" color={COLORS.barrel} roughness={0.35} metalness={0.35} />
            <meshStandardMaterial attach="material-1" color={COLORS.barrelLid} roughness={0.4} metalness={0.3} />
            <meshStandardMaterial attach="material-2" color={COLORS.barrelDark} roughness={0.5} />
         </Instanced>
         <Instanced spots={spots.barrelRings} name="barrel-rings">
            <cylinderGeometry args={[BARREL_RADIUS, BARREL_RADIUS, 0.08, 24]} />
            <meshStandardMaterial color={COLORS.barrelRing} roughness={0.3} metalness={0.4} />
         </Instanced>
         <Instanced spots={spots.barrelCaps} name="barrel-valves">
            <cylinderGeometry args={[BARREL_RADIUS * 0.28, BARREL_RADIUS * 0.28, 0.04, 16]} />
            <meshStandardMaterial color={COLORS.barrelGlow} emissive={COLORS.barrelGlow} emissiveIntensity={0.6} roughness={0.3} />
         </Instanced>
      </>
   );
}

// ---------- Hazards (levels 2-5) ----------

/** Oil patches with luminescent violet glow and conveyor belts with scrolling illuminated chevrons. */
export function HazardMarks({ level }: { level: RobotLevel }) {
   const oil = useMemo(
      () =>
         SLOW_ZONES.slice(0, level.slowZones).map((zone) => ({
            x: zone.x,
            y: 0.02,
            z: zone.z,
            sx: zone.r,
            sy: 1,
            sz: zone.r,
         })),
      [level]
   );

   return (
      <group name="hazard-marks">
         {level.belts > 0 && <Belts belts={BELTS.slice(0, level.belts)} speed={level.beltSpeed} />}
         {oil.length > 0 && (
            <Instanced spots={oil} name="oil-patches">
               <cylinderGeometry args={[1, 1, 0.025, 36]} />
               <meshStandardMaterial
                  color={COLORS.oil}
                  emissive={COLORS.oilGlow}
                  emissiveIntensity={0.65}
                  roughness={0.08}
                  metalness={0.65}
               />
            </Instanced>
         )}
      </group>
   );
}

const BELT_WIDTH = BELT_HALF_WIDTH * 2;

function Belts({ belts, speed }: { belts: readonly Belt[]; speed: number }) {
   const time = useGameTime();
   const base = useCanvasTexture(128, 128, drawBelt);
   const strips = useMemo(
      () =>
         belts.map((belt) => {
            const length = Math.hypot(belt.bx - belt.ax, belt.bz - belt.az) + BELT_WIDTH;
            const map = base.clone();
            map.wrapS = RepeatWrapping;
            map.repeat.set(length / BELT_WIDTH, 1);
            map.needsUpdate = true;
            return { belt, length, map, yaw: -Math.atan2(belt.bz - belt.az, belt.bx - belt.ax) };
         }),
      [belts, base]
   );

   useEffect(() => () => strips.forEach((strip) => strip.map.dispose()), [strips]);

   useFrame(() => {
      for (const strip of strips) strip.map.offset.x = -((time.now * speed) / BELT_WIDTH) % 1;
   });

   return (
      <>
         {strips.map(({ belt, length, map, yaw }, i) => (
            <mesh key={i} position={[(belt.ax + belt.bx) / 2, 0.016, (belt.az + belt.bz) / 2]} rotation={[-Math.PI / 2, 0, yaw]}>
               <planeGeometry args={[length, BELT_WIDTH]} />
               <meshBasicMaterial map={map} transparent opacity={0.92} depthWrite={false} />
            </mesh>
         ))}
      </>
   );
}

// ---------- Robot Stand-In ----------

/**
 * Deliberate, rounded, premium sci-fi robot stand-in until robot.glb loads.
 * Features 2-3 harmonious tones from COLORS, chamfered wheels, bevelled chest plate,
 * glowing battery readout panel, curved visor and golden antenna.
 */
export function RobotPrimitive({
   antenna,
   panel,
}: {
   antenna: RefObject<Group>;
   panel: RefObject<MeshStandardMaterial>;
}) {
   return (
      <group name="robot-stand-in">
         {/* Drive chassis & tread pods */}
         {[-0.36, 0.36].map((x) => (
            <group key={x} position={[x, 0.17, 0]}>
               <mesh rotation-z={Math.PI / 2}>
                  <cylinderGeometry args={[0.17, 0.17, 0.16, 18]} />
                  <meshStandardMaterial color={COLORS.robotDark} roughness={0.65} metalness={0.4} />
               </mesh>
               {/* Wheel hubcaps */}
               <mesh position-x={x > 0 ? 0.09 : -0.09} rotation-z={Math.PI / 2}>
                  <cylinderGeometry args={[0.08, 0.08, 0.02, 16]} />
                  <meshStandardMaterial color={COLORS.robot} roughness={0.35} />
               </mesh>
            </group>
         ))}

         {/* Torso capsule body */}
         <mesh position-y={0.58}>
            <capsuleGeometry args={[0.34, 0.32, 6, 18]} />
            <meshStandardMaterial color={COLORS.robot} roughness={0.35} metalness={0.15} />
         </mesh>

         {/* Recessed chest gauge plate */}
         <mesh position={[0, 0.56, 0.31]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.16, 0.16, 0.04, 18]} />
            <meshStandardMaterial color={COLORS.robotDark} roughness={0.5} />
         </mesh>

         {/* Dynamic charge meter: glows brighter with every collected battery */}
         <mesh position={[0, 0.56, 0.33]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.12, 0.12, 0.04, 18]} />
            <meshStandardMaterial ref={panel} color="#bbf7d0" emissive={COLORS.batteryGlow} emissiveIntensity={0.25} />
         </mesh>

         {/* Neck metallic collar ring */}
         <mesh position-y={0.9}>
            <cylinderGeometry args={[0.22, 0.24, 0.08, 18]} />
            <meshStandardMaterial color={COLORS.robotChassis} roughness={0.45} metalness={0.5} />
         </mesh>

         {/* Dome head */}
         <mesh position-y={1.12} scale={[1.15, 0.88, 1]}>
            <sphereGeometry args={[0.3, 22, 16]} />
            <meshStandardMaterial color={COLORS.robotHead} roughness={0.3} />
         </mesh>

         {/* Visor bezel frame */}
         <mesh position={[0, 1.13, 0.14]} scale={[1.16, 0.62, 0.64]}>
            <sphereGeometry args={[0.24, 20, 14]} />
            <meshStandardMaterial color={COLORS.robotDark} roughness={0.2} metalness={0.3} />
         </mesh>

         {/* Dual glowing cyan digital eyes */}
         {[-0.1, 0.1].map((x) => (
            <mesh key={x} position={[x, 1.14, 0.31]}>
               <sphereGeometry args={[0.055, 14, 10]} />
               <meshStandardMaterial color={COLORS.robotEye} emissive={COLORS.robotEye} emissiveIntensity={2.5} />
            </mesh>
         ))}

         {/* Dynamic antenna stalk with golden glowing tip */}
         <group ref={antenna} position-y={1.35}>
            <mesh position-y={0.12}>
               <cylinderGeometry args={[0.022, 0.025, 0.24, 10]} />
               <meshStandardMaterial color={COLORS.robotDark} roughness={0.4} metalness={0.6} />
            </mesh>
            <mesh position-y={0.27}>
               <sphereGeometry args={[0.065, 14, 10]} />
               <meshStandardMaterial color={COLORS.robotTip} emissive={COLORS.robotTip} emissiveIntensity={1.8} />
            </mesh>
         </group>
      </group>
   );
}

// ---------- Batteries ----------

/** Geometries and materials shared by every battery (created once per run, disposed with it). */
export function useBatteryParts() {
   const parts = useMemo(
      () => ({
         body: new CylinderGeometry(0.28, 0.28, 0.58, 24),
         band: new CylinderGeometry(0.288, 0.288, 0.12, 24),
         cap: new CylinderGeometry(0.12, 0.12, 0.12, 16),
         base: new CylinderGeometry(0.295, 0.295, 0.08, 24),
         tipButton: new CylinderGeometry(0.06, 0.06, 0.04, 12),
         glow: new CircleGeometry(0.85, 32),
         beam: new CylinderGeometry(0.2, 0.38, 3.2, 16, 1, true),
         ring: new RingGeometry(0.42, 0.62, 32),
         bodyMat: new MeshStandardMaterial({
            color: COLORS.battery,
            emissive: COLORS.batteryDark,
            emissiveIntensity: 0.95,
            roughness: 0.3,
         }),
         bandMat: new MeshStandardMaterial({
            color: COLORS.batteryBand,
            emissive: "#bbf7d0",
            emissiveIntensity: 0.3,
            roughness: 0.45,
         }),
         capMat: new MeshStandardMaterial({
            color: COLORS.batteryCap,
            metalness: 0.75,
            roughness: 0.25,
         }),
         baseMat: new MeshStandardMaterial({
            color: "#14532d",
            metalness: 0.4,
            roughness: 0.5,
         }),
         tipMat: new MeshStandardMaterial({
            color: COLORS.batteryTip,
            emissive: COLORS.batteryTip,
            emissiveIntensity: 0.8,
            metalness: 0.8,
            roughness: 0.2,
         }),
         glowMat: new MeshBasicMaterial({
            color: COLORS.batteryGlow,
            transparent: true,
            opacity: 0.32,
            blending: AdditiveBlending,
            depthWrite: false,
         }),
         beamMat: new MeshBasicMaterial({
            color: "#86efac",
            transparent: true,
            opacity: 0.22,
            blending: AdditiveBlending,
            depthWrite: false,
            side: DoubleSide,
         }),
         ringMat: new MeshBasicMaterial({
            color: "#bbf7d0",
            transparent: true,
            opacity: 0,
            blending: AdditiveBlending,
            depthWrite: false,
         }),
      }),
      []
   );

   useEffect(() => () => Object.values(parts).forEach((part) => part.dispose()), [parts]);
   return parts;
}

export type BatteryParts = ReturnType<typeof useBatteryParts>;

/** Stand-in battery: radiant green energy cell with metallic contacts and status band. */
export function BatteryPrimitive({ parts }: { parts: BatteryParts }) {
   return (
      <group name="battery-stand-in">
         <mesh geometry={parts.base} material={parts.baseMat} position-y={0.04} />
         <mesh geometry={parts.body} material={parts.bodyMat} position-y={0.36} />
         <mesh geometry={parts.band} material={parts.bandMat} position-y={0.37} />
         <mesh geometry={parts.cap} material={parts.capMat} position-y={0.71} />
         <mesh geometry={parts.tipButton} material={parts.tipMat} position-y={0.79} />
      </group>
   );
}
