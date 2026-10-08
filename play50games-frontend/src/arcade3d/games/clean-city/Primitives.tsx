"use client";

// Clean the City look: three outdoor grounds, the obstacle props and the litter stand-ins.
// Decoration only. Positions come from rules.ts MAPS (the same squares the runner collides with,
// propSpots.ts). Every obstacle is an <InstancedModel> (one draw call per GLB per map) whose
// fallback is its primitive: bench, bin, lamp, palm and umbrella draw their group D GLBs fitted to
// the squares (assets.ts), one per propSpots.ts GLB_PROPS entry, its asset and spots as listed
// there (GlbProps); trees and buildings have no GLB and stay primitives. Litter stand-ins are the
// fallbackParts of one <DynamicInstancedModel> pool per kind (Scene.tsx).
import { memo, useEffect, useMemo, useState, type ComponentType, type MutableRefObject, type ReactNode } from "react";
import { BoxGeometry, CapsuleGeometry, CylinderGeometry, MeshStandardMaterial, type BufferGeometry, type Group, type Material } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { Instanced, useCanvasTexture, type CanvasDraw, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS } from "./assets";
import { CITY_BUILDING, GLB_PROPS, PARK_TREE, type GlbKind } from "./propSpots";
import { FLOOR_HALF, LITTER_KINDS, MAPS } from "./rules";

// ---------- palette ----------

const COLORS = {
   path: "rgba(120, 84, 48, 0.34)",
   sandPath: "rgba(255, 255, 255, 0.22)",
   curb: "rgba(0, 0, 0, 0.14)",
   bench: "#c4a574",
   benchLeg: "#78716c",
   trunk: "#92400e",
   leaves: "#166534",
   bin: "#475569",
   binRim: "#94a3b8",
   facade: "#64748b",
   roof: "#334155",
   window: "#e2e8f0",
   pole: "#cbd5e1",
   lamp: "#fde68a",
   palm: "#15803d",
   palmTrunk: "#a16207",
   canopy: "#38bdf8",
   vest: "#f97316",
   stripe: "#e5e7eb",
   sleeve: "#374151",
   hair: "#5b3a29",
   skin: "#fdba74",
   pants: "#1e293b",
   shoe: "#0f172a",
} as const;

// ---------- grounds (one canvas each, drawn once) ----------

const TEX = 512;

/** World (x, z) -> canvas px. The plane is rotated -90° around x, so world +z is canvas up. */
function paintGround(ctx: CanvasRenderingContext2D, w: number, h: number, map: number): void {
   const color = MAPS[map].ground;
   ctx.fillStyle = color;
   ctx.fillRect(0, 0, w, h);

   ctx.strokeStyle = "rgba(255,255,255,0.12)";
   ctx.lineWidth = 2;
   const step = (2 / (FLOOR_HALF * 2)) * w;
   for (let p = step; p < w; p += step) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, h);
      ctx.moveTo(0, p);
      ctx.lineTo(w, p);
      ctx.stroke();
   }

   const u = (x: number) => ((x + FLOOR_HALF) / (FLOOR_HALF * 2)) * w;
   // plane rotation -x maps texture +y to world +z (the camera side, the start pad)
   const v = (z: number) => ((z + FLOOR_HALF) / (FLOOR_HALF * 2)) * h;

   ctx.fillStyle = map === 2 ? COLORS.sandPath : COLORS.path;
   ctx.fillRect(u(-1.3), v(FLOOR_HALF), u(1.3) - u(-1.3), v(-2) - v(FLOOR_HALF));
   if (map === 1) {
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      for (let i = -3; i <= 3; i++) ctx.fillRect(u(i * 0.7 - 0.18), v(1.1), u(0.36) - u(0), v(-1.1) - v(1.1));
   }

   ctx.fillStyle = COLORS.curb;
   for (const o of MAPS[map].obstacles) {
      ctx.beginPath();
      ctx.ellipse(u(o.x), v(o.z), ((o.halfX + 0.15) / (FLOOR_HALF * 2)) * w, ((o.halfZ + 0.15) / (FLOOR_HALF * 2)) * h, 0, 0, Math.PI * 2);
      ctx.fill();
   }

   ctx.beginPath();
   ctx.arc(u(0), v(12), (1.05 / (FLOOR_HALF * 2)) * w, 0, Math.PI * 2);
   ctx.strokeStyle = "rgba(255,255,255,0.9)";
   ctx.lineWidth = 5;
   ctx.stroke();
}

const drawPark: CanvasDraw = (ctx, w, h) => paintGround(ctx, w, h, 0);
const drawCity: CanvasDraw = (ctx, w, h) => paintGround(ctx, w, h, 1);
const drawBeach: CanvasDraw = (ctx, w, h) => paintGround(ctx, w, h, 2);

function Ground({ draw }: { draw: CanvasDraw }) {
   const map = useCanvasTexture(TEX, TEX, draw);
   return (
      <mesh rotation-x={-Math.PI / 2} position-y={0} name="ground">
         <planeGeometry args={[FLOOR_HALF * 2, FLOOR_HALF * 2]} />
         <meshStandardMaterial map={map} roughness={1} />
      </mesh>
   );
}

// ---------- obstacle props (spots in propSpots.ts, module level) ----------

/** Primitive part centres: the geometry is centred, so y is the centre, not the feet. */
const atY = (spots: readonly InstanceSpot[], y: number): InstanceSpot[] => spots.map((s) => ({ ...s, y }));

/**
 * GLB copies stand on y = 0 at `spots` (turned by spot.rotY). `fallback` is the primitive (usually
 * several <Instanced>), drawn if the GLB is unlisted or fails. The group's name finds them in a playtest.
 */
function Prop({ asset, spots, fallback }: { asset: ModelAsset; spots: readonly InstanceSpot[]; fallback: ReactNode }) {
   if (spots.length === 0) return null;
   return (
      <group name={`prop-${asset.id}`}>
         <InstancedModel asset={asset} spots={spots} fallback={fallback} />
      </group>
   );
}

interface PartsProps {
   spots: readonly InstanceSpot[];
}

function BenchParts({ spots }: PartsProps) {
   const parts = useMemo(
      () => ({
         seat: atY(spots, 0.46),
         back: spots.map((s) => ({ x: s.x, y: 0.78, z: s.z - 0.34 })),
         legs: spots.flatMap((s) => [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ x: s.x + sx * 0.95, y: 0.2, z: s.z + sz * 0.26 })))),
      }),
      [spots]
   );
   return (
      <>
         <Instanced spots={parts.seat} name="bench-seat">
            <boxGeometry args={[2.4, 0.16, 0.8]} />
            <meshStandardMaterial color={COLORS.bench} roughness={0.7} />
         </Instanced>
         <Instanced spots={parts.back} name="bench-back">
            <boxGeometry args={[2.4, 0.42, 0.1]} />
            <meshStandardMaterial color={COLORS.bench} roughness={0.7} />
         </Instanced>
         <Instanced spots={parts.legs} name="bench-legs">
            <boxGeometry args={[0.12, 0.4, 0.12]} />
            <meshStandardMaterial color={COLORS.benchLeg} roughness={0.8} />
         </Instanced>
      </>
   );
}

function BinParts({ spots }: PartsProps) {
   const parts = useMemo(() => ({ drum: atY(spots, 0.5), rim: atY(spots, 1.02) }), [spots]);
   return (
      <>
         <Instanced spots={parts.drum}>
            <cylinderGeometry args={[0.62, 0.7, 1.0, 14]} />
            <meshStandardMaterial color={COLORS.bin} roughness={0.55} />
         </Instanced>
         <Instanced spots={parts.rim}>
            <cylinderGeometry args={[0.7, 0.7, 0.08, 14]} />
            <meshStandardMaterial color={COLORS.binRim} metalness={0.2} roughness={0.4} />
         </Instanced>
      </>
   );
}

function LampParts({ spots }: PartsProps) {
   const parts = useMemo(() => ({ pole: atY(spots, 0.85), globe: atY(spots, 1.85) }), [spots]);
   return (
      <>
         <Instanced spots={parts.pole}>
            <cylinderGeometry args={[0.3, 0.34, 1.7, 10]} />
            <meshStandardMaterial color={COLORS.pole} metalness={0.35} roughness={0.4} />
         </Instanced>
         <Instanced spots={parts.globe}>
            <sphereGeometry args={[0.36, 12, 10]} />
            <meshStandardMaterial color={COLORS.lamp} emissive={COLORS.lamp} emissiveIntensity={0.7} roughness={0.35} />
         </Instanced>
      </>
   );
}

function PalmParts({ spots }: PartsProps) {
   const parts = useMemo(() => ({ trunk: atY(spots, 0.7), crown: spots.map((s) => ({ ...s, y: 1.7, sy: 0.55 })) }), [spots]);
   return (
      <>
         <Instanced spots={parts.trunk}>
            <cylinderGeometry args={[0.5, 0.6, 1.4, 10]} />
            <meshStandardMaterial color={COLORS.palmTrunk} roughness={0.85} />
         </Instanced>
         <Instanced spots={parts.crown}>
            <sphereGeometry args={[1.05, 12, 10]} />
            <meshStandardMaterial color={COLORS.palm} roughness={0.75} />
         </Instanced>
      </>
   );
}

function UmbrellaParts({ spots }: PartsProps) {
   const parts = useMemo(() => ({ pole: atY(spots, 0.8), canopy: atY(spots, 1.7) }), [spots]);
   return (
      <>
         <Instanced spots={parts.pole}>
            <cylinderGeometry args={[0.25, 0.25, 1.6, 8]} />
            <meshStandardMaterial color={COLORS.pole} roughness={0.5} />
         </Instanced>
         <Instanced spots={parts.canopy}>
            <coneGeometry args={[1.15, 0.5, 14]} />
            <meshStandardMaterial color={COLORS.canopy} roughness={0.55} />
         </Instanced>
      </>
   );
}

/** Each GLB kind's primitive: its fallback, on the same spots. */
const GLB_FALLBACK: Record<GlbKind, ComponentType<PartsProps>> = {
   bench: BenchParts,
   bin: BinParts,
   lamp: LampParts,
   palm: PalmParts,
   pole: UmbrellaParts,
};

/** Every GLB_PROPS entry of map `map`, and nothing else: its asset on its spots, its kind's primitive as the fallback. */
function GlbProps({ map }: { map: number }) {
   return (
      <>
         {GLB_PROPS.filter((set) => set.map === map).map((set) => {
            const Fallback = GLB_FALLBACK[set.kind];
            return <Prop key={set.kind} asset={set.asset} spots={set.spots} fallback={<Fallback spots={set.spots} />} />;
         })}
      </>
   );
}

function Trees() {
   return (
      <Prop
         asset={ASSETS.tree}
         spots={PARK_TREE}
         fallback={
            <>
               <Instanced spots={atY(PARK_TREE, 0.55)}>
                  <cylinderGeometry args={[0.7, 0.78, 1.1, 12]} />
                  <meshStandardMaterial color={COLORS.trunk} roughness={0.85} />
               </Instanced>
               <Instanced spots={atY(PARK_TREE, 1.45)}>
                  <sphereGeometry args={[0.95, 14, 12]} />
                  <meshStandardMaterial color={COLORS.leaves} roughness={0.8} />
               </Instanced>
            </>
         }
      />
   );
}

const drawFacade: CanvasDraw = (ctx, w, h) => {
   ctx.fillStyle = COLORS.facade;
   ctx.fillRect(0, 0, w, h);
   ctx.fillStyle = COLORS.roof;
   ctx.fillRect(0, 0, w, h * 0.12);
   ctx.fillStyle = COLORS.window;
   for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) ctx.fillRect(w * (0.16 + col * 0.26), h * (0.24 + row * 0.22), w * 0.14, h * 0.12);
   }
};

function Buildings() {
   const facade = useCanvasTexture(128, 128, drawFacade);
   const spots = CITY_BUILDING;
   return (
      <Prop
         asset={ASSETS.building}
         spots={spots}
         fallback={
            <>
               <Instanced spots={atY(spots, 1.3)}>
                  <boxGeometry args={[3.2, 2.6, 3.2]} />
                  <meshStandardMaterial map={facade} roughness={0.8} />
               </Instanced>
               <Instanced spots={atY(spots, 2.7)}>
                  <boxGeometry args={[3.45, 0.22, 3.45]} />
                  <meshStandardMaterial color={COLORS.roof} roughness={0.7} />
               </Instanced>
            </>
         }
      />
   );
}

export const Park = memo(function Park() {
   return (
      <group name="park">
         <Ground draw={drawPark} />
         <GlbProps map={0} />
         <Trees />
      </group>
   );
});

export const City = memo(function City() {
   return (
      <group name="city">
         <Ground draw={drawCity} />
         <Buildings />
         <GlbProps map={1} />
      </group>
   );
});

export const Beach = memo(function Beach() {
   return (
      <group name="beach">
         <Ground draw={drawBeach} />
         <GlbProps map={2} />
      </group>
   );
});

// ---------- litter pools ----------

const STAND_IN_COLOR = ["#4ade80", "#d6a46b", "#94a3b8", "#facc15"];

/** Moves a stand-in shape so its lowest point is on y = 0 (the copy's feet). */
function standOnFloor<T extends BufferGeometry>(geometry: T): T {
   geometry.computeBoundingBox();
   const bottom = geometry.boundingBox?.min.y ?? 0;
   return geometry.translate(0, -bottom, 0);
}

/**
 * The litter stand-ins, one part per kind in LITTER_KINDS order (bottle, bag, can, banana):
 * bottom on y = 0, about 0.8-0.9 across, already at the drawn size (DynamicInstancedModel does
 * not scale fallbackParts by asset.scale). Fresh geometries and materials: free them with
 * disposeLitterStandIns.
 */
export function createLitterStandIns(): InstancePart[][] {
   const shapes: BufferGeometry[] = [
      standOnFloor(new CylinderGeometry(0.16, 0.22, 0.9, 12)),
      standOnFloor(new BoxGeometry(0.62, 0.8, 0.46)),
      standOnFloor(new CylinderGeometry(0.22, 0.24, 0.85, 12)),
      standOnFloor(new CapsuleGeometry(0.12, 0.55, 4, 8).rotateZ(0.7)),
   ];
   return LITTER_KINDS.map((_, k) => [
      { geometry: shapes[k], material: new MeshStandardMaterial({ color: STAND_IN_COLOR[k], roughness: 0.5 }) },
   ]);
}

export function disposeLitterStandIns(kinds: readonly (readonly InstancePart[])[]): void {
   for (const parts of kinds) {
      for (const part of parts) {
         part.geometry.dispose();
         const materials: readonly Material[] = Array.isArray(part.material) ? part.material : [part.material];
         for (const material of materials) material.dispose();
      }
   }
}

/**
 * One stand-in set per Scene mount (every Retry), freed on unmount, like core's own primitive
 * parts. Strict mode's replayed cleanup frees it early: three uploads it again on the next draw.
 */
export function useLitterStandIns(): readonly (readonly InstancePart[])[] {
   const [kinds] = useState(createLitterStandIns);
   useEffect(() => () => disposeLitterStandIns(kinds), [kinds]);
   return kinds;
}

// ---------- the cleaner's stand-in (<HumanoidModel> fallback while cleaner.glb loads or if it fails) ----------

/** Limb pivots. The parent writes rotation.x from the one walk phase. Arms hang down. */
export interface RunnerLimbs {
   legL: Group | null;
   legR: Group | null;
   armL: Group | null;
   armR: Group | null;
   bob: Group | null;
}

/** Vinyl-toy cleaner in an orange hi-vis vest, arms down. Scene swings these groups from the humanoid pose. */
export function PrimitiveRunner({ limbs }: { limbs: MutableRefObject<RunnerLimbs> }) {
   const set = (key: keyof RunnerLimbs) => (g: Group | null) => {
      limbs.current[key] = g;
   };
   return (
      <group ref={set("bob")} name="cleaner-body">
         <mesh position={[0, 0.5, 0]} castShadow={false}>
            <boxGeometry args={[0.4, 0.36, 0.24]} />
            <meshStandardMaterial color={COLORS.vest} roughness={0.55} />
         </mesh>
         <mesh position={[0, 0.44, 0]}>
            <boxGeometry args={[0.41, 0.04, 0.25]} />
            <meshStandardMaterial color={COLORS.stripe} roughness={0.3} metalness={0.4} />
         </mesh>
         <mesh position={[0, 0.74, 0]}>
            <sphereGeometry args={[0.16, 14, 12]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.6} />
         </mesh>
         <mesh position={[0, 0.76, -0.01]} scale={[1, 0.85, 1]}>
            <sphereGeometry args={[0.168, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={COLORS.hair} roughness={0.8} />
         </mesh>
         <mesh position={[0, 0.74, 0.13]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color={COLORS.shoe} />
         </mesh>
         <group ref={set("legL")} position={[-0.1, 0.34, 0]}>
            <mesh position={[0, -0.16, 0]}>
               <capsuleGeometry args={[0.07, 0.2, 4, 8]} />
               <meshStandardMaterial color={COLORS.pants} roughness={0.7} />
            </mesh>
         </group>
         <group ref={set("legR")} position={[0.1, 0.34, 0]}>
            <mesh position={[0, -0.16, 0]}>
               <capsuleGeometry args={[0.07, 0.2, 4, 8]} />
               <meshStandardMaterial color={COLORS.pants} roughness={0.7} />
            </mesh>
         </group>
         <group ref={set("armL")} position={[-0.26, 0.6, 0]}>
            <mesh position={[0, -0.14, 0]}>
               <capsuleGeometry args={[0.05, 0.16, 4, 8]} />
               <meshStandardMaterial color={COLORS.sleeve} roughness={0.6} />
            </mesh>
         </group>
         <group ref={set("armR")} position={[0.26, 0.6, 0]}>
            <mesh position={[0, -0.14, 0]}>
               <capsuleGeometry args={[0.05, 0.16, 4, 8]} />
               <meshStandardMaterial color={COLORS.sleeve} roughness={0.6} />
            </mesh>
         </group>
      </group>
   );
}

export const RUNNER_RING = "#4ade80";
