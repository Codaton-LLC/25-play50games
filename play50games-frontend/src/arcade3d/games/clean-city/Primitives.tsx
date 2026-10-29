"use client";

// Clean the City look: three outdoor grounds, the obstacle props and the litter stand-ins.
// Decoration only. Positions come from rules.ts MAPS (the same squares the runner collides with,
// propSpots.ts). Every obstacle is an <InstancedModel> (one draw call per GLB per map; the bin the
// same through BinProp, in slate: binLook.ts) whose fallback is its primitive: bench, bin, lamp,
// palm and umbrella draw their group D GLBs fitted to the squares (assets.ts), one per propSpots.ts
// GLB_PROPS entry, its asset and spots as listed there (GlbProps); trees and buildings have no GLB and stay primitives. Litter stand-ins are the
// fallbackParts of one <DynamicInstancedModel> pool per kind (Scene.tsx).
import { memo, useEffect, useMemo, useRef, useState, type ComponentType, type MutableRefObject, type ReactNode } from "react";
import { BoxGeometry, CapsuleGeometry, CylinderGeometry, MeshStandardMaterial, type BufferGeometry, type Group, type InstancedMesh, type Material } from "three";
import { InstancedModel, modelParts, useModel, type ModelPart } from "@/arcade3d/core/assets";
import { Instanced, useCanvasTexture, useInstanceMatrices, type CanvasDraw, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, BIN_COLOR } from "./assets";
import { disposeMaterials, slateMaterials } from "./binLook";
import { BASE_SETS, CITY_BUILDING, GLB_PROPS, PARK_TREE, type GlbKind } from "./propSpots";
import { FLOOR_HALF, LITTER_KINDS, MAPS } from "./rules";

// ---------- palette ----------

const COLORS = {
   path: "rgba(120, 84, 48, 0.34)",
   sandPath: "rgba(255, 255, 255, 0.22)",
   curb: "rgba(0, 0, 0, 0.14)",
   bench: "#c4a574",
   benchLeg: "#78716c",
   trunk: "#92400e",
   planter: "#9b6a3e",
   soil: "#6f5232",
   awning: "#b45309",
   door: "#334155",
   leaves: "#166534",
   bin: BIN_COLOR,
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

/**
 * The bins: like <Prop>, one InstancedMesh per GLB mesh for all `spots` (core modelParts places it
 * as <InstancedModel> would), but drawn in slate (binLook.ts): <InstancedModel> draws the GLB's own
 * cached material, and the bin GLB is green, lost on the park's lawn. The slate clones are made once
 * per loaded GLB, before the first render (no needsUpdate, nothing per frame), and disposed of here;
 * the geometry and textures stay the loader cache's. The primitive while the GLB is missing or broken.
 */
export function BinProp({ spots, fallback = <BinParts spots={spots} /> }: { spots: readonly InstanceSpot[]; fallback?: ReactNode }) {
   const asset = ASSETS.bin;
   const { scene } = useModel(asset);
   const parts = useMemo(
      () => (scene ? modelParts(scene, asset).map((part) => ({ ...part, material: slateMaterials(part.material) })) : null),
      [scene, asset]
   );
   useEffect(() => () => parts?.forEach((part) => disposeMaterials(part.material)), [parts]);
   if (spots.length === 0) return null;
   return (
      <group name={`prop-${asset.id}`}>
         {parts && parts.length > 0 ? parts.map((part, i) => <BinPart key={i} part={part} spots={spots} />) : fallback}
      </group>
   );
}

function BinPart({ part, spots }: { part: ModelPart; spots: readonly InstanceSpot[] }) {
   const mesh = useRef<InstancedMesh>(null);
   useInstanceMatrices(mesh, spots, part.matrix);
   // dispose={null}: the geometry belongs to the loader cache, the material to BinProp
   return <instancedMesh ref={mesh} args={[part.geometry, part.material, spots.length]} dispose={null} />;
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
   const parts = useMemo(() => ({ base: atY(spots, 0.18), pole: atY(spots, 1.7), globe: atY(spots, 3.3) }), [spots]);
   return (
      <>
         <Instanced spots={parts.base}>
            <cylinderGeometry args={[0.26, 0.3, 0.36, 10]} />
            <meshStandardMaterial color={COLORS.pole} metalness={0.35} roughness={0.4} />
         </Instanced>
         <Instanced spots={parts.pole}>
            <cylinderGeometry args={[0.06, 0.08, 2.7, 10]} />
            <meshStandardMaterial color={COLORS.pole} metalness={0.35} roughness={0.4} />
         </Instanced>
         <Instanced spots={parts.globe}>
            <sphereGeometry args={[0.3, 12, 10]} />
            <meshStandardMaterial color={COLORS.lamp} emissive={COLORS.lamp} emissiveIntensity={0.7} roughness={0.35} />
         </Instanced>
      </>
   );
}

function PalmParts({ spots }: PartsProps) {
   const parts = useMemo(() => ({ trunk: atY(spots, 1.3), crown: spots.map((s) => ({ ...s, y: 2.75, sy: 0.55 })) }), [spots]);
   return (
      <>
         <Instanced spots={parts.trunk}>
            <cylinderGeometry args={[0.12, 0.16, 2.6, 10]} />
            <meshStandardMaterial color={COLORS.palmTrunk} roughness={0.85} />
         </Instanced>
         <Instanced spots={parts.crown}>
            <sphereGeometry args={[0.6, 12, 10]} />
            <meshStandardMaterial color={COLORS.palm} roughness={0.75} />
         </Instanced>
      </>
   );
}

function UmbrellaParts({ spots }: PartsProps) {
   const parts = useMemo(() => ({ pole: atY(spots, 1.4), canopy: atY(spots, 2.4) }), [spots]);
   return (
      <>
         <Instanced spots={parts.pole}>
            <cylinderGeometry args={[0.035, 0.035, 2.8, 8]} />
            <meshStandardMaterial color={COLORS.pole} roughness={0.5} />
         </Instanced>
         <Instanced spots={parts.canopy}>
            <coneGeometry args={[0.75, 0.6, 14]} />
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

/**
 * Every GLB_PROPS entry of map `map`, and nothing else: its asset on its spots, its kind's primitive
 * as the fallback (the bin's asset is ASSETS.bin, drawn by BinProp in slate). Then the bases of
 * BASE_SETS (the palm planters, the umbrella stands), one <Instanced> per part, drawn under the GLB
 * or its fallback alike.
 */
function GlbProps({ map }: { map: number }) {
   return (
      <>
         {GLB_PROPS.filter((set) => set.map === map).map((set) => {
            const Fallback = GLB_FALLBACK[set.kind];
            if (set.kind === "bin") return <BinProp key={set.kind} spots={set.spots} fallback={<Fallback spots={set.spots} />} />;
            return <Prop key={set.kind} asset={set.asset} spots={set.spots} fallback={<Fallback spots={set.spots} />} />;
         })}
         {BASE_SETS.filter((set) => set.map === map).map(({ kind, part, spots }, i) => (
            <Instanced key={`${kind}-base-${i}`} spots={spots} name={`${kind}-base`}>
               <cylinderGeometry args={[part.radiusTop, part.radiusBottom, part.height, part.sides]} />
               <meshStandardMaterial color={part.color} roughness={0.85} flatShading={part.sides <= 8} />
            </Instanced>
         ))}
      </>
   );
}

/**
 * The park trees (primitives, no GLB; real-world scale, README "Real-world scale"): a round planter
 * filling the 1.4 square at the ground (the runner stops at it, as at a bench), a trunk about 0.36
 * across, and a crown over the cleaner's head (from 1.75 up, top 3.55). Was a 1.4-wide stump 1.1
 * tall under a crown topping out at 2.4.
 */
export const TREE = { planter: 0.32, trunkTop: 2.0, crownY: 2.65, crown: 0.9 } as const;

function Trees() {
   return (
      <Prop
         asset={ASSETS.tree}
         spots={PARK_TREE}
         fallback={
            <>
               <Instanced spots={atY(PARK_TREE, TREE.planter / 2)}>
                  <cylinderGeometry args={[0.66, 0.7, TREE.planter, 16]} />
                  <meshStandardMaterial color={COLORS.planter} roughness={0.85} />
               </Instanced>
               <Instanced spots={atY(PARK_TREE, TREE.planter + 0.006)}>
                  <cylinderGeometry args={[0.56, 0.56, 0.012, 16]} />
                  <meshStandardMaterial color={COLORS.soil} roughness={1} />
               </Instanced>
               <Instanced spots={atY(PARK_TREE, TREE.trunkTop / 2)}>
                  <cylinderGeometry args={[0.13, 0.18, TREE.trunkTop, 10]} />
                  <meshStandardMaterial color={COLORS.trunk} roughness={0.85} />
               </Instanced>
               <Instanced spots={atY(PARK_TREE, TREE.crownY)}>
                  <sphereGeometry args={[TREE.crown, 14, 12]} />
                  <meshStandardMaterial color={COLORS.leaves} roughness={0.8} />
               </Instanced>
            </>
         }
      />
   );
}

/**
 * One face of a building (3.2 wide, 2.6 tall): a one-storey shop at real-world scale (a 3-row
 * window grid made each storey 0.87 m next to the 1.75 m cleaner). A door 0.9 x 2.0 m, a shop
 * window 1.4 x 1.1 m from 0.8 m up, an awning band over them, the parapet on top.
 */
const drawFacade: CanvasDraw = (ctx, w, h) => {
   const mx = w / 3.2;
   const my = h / 2.6;
   const fromTop = (m: number) => h - m * my;
   ctx.fillStyle = COLORS.facade;
   ctx.fillRect(0, 0, w, h);
   ctx.fillStyle = COLORS.roof;
   ctx.fillRect(0, 0, w, h * 0.12);
   ctx.fillStyle = COLORS.awning;
   ctx.fillRect(w * 0.06, fromTop(2.3), w * 0.88, 0.16 * my);
   ctx.fillStyle = COLORS.door;
   ctx.fillRect(0.35 * mx, fromTop(2.0), 0.9 * mx, 2.0 * my);
   ctx.fillStyle = COLORS.window;
   ctx.fillRect(1.55 * mx, fromTop(1.9), 1.4 * mx, 1.1 * my);
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
 * bottom on y = 0, about 0.40-0.45 across (real-world scale: knee height on the 1.75 cleaner), already at the drawn size (DynamicInstancedModel does
 * not scale fallbackParts by asset.scale). Fresh geometries and materials: free them with
 * disposeLitterStandIns.
 */
export function createLitterStandIns(): InstancePart[][] {
   const shapes: BufferGeometry[] = [
      standOnFloor(new CylinderGeometry(0.08, 0.11, 0.45, 12)),
      standOnFloor(new BoxGeometry(0.31, 0.4, 0.23)),
      standOnFloor(new CylinderGeometry(0.11, 0.12, 0.425, 12)),
      standOnFloor(new CapsuleGeometry(0.06, 0.275, 4, 8).rotateZ(0.7)),
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

/** PrimitiveRunner is built 0.90 tall; Scene draws it at this scale, the cleaner's 1.75. */
export const RUNNER_STAND_IN_SCALE = 1.75 / 0.9;

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
