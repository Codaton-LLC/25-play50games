"use client";

// The island's look: sky, sand and grass, the sea that rises with the tide, the props (palms, rock
// outcrops, crates, the beach umbrella and towel, the wrecked rowboat, the dock) and the decor crabs.
// Static except the water and the crabs. Every footprint is the rules' (rules.ts FIXED, the island's
// circles); the models are only fitted over them.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Color, Float32BufferAttribute, Matrix4, type Group, type Mesh } from "three";
import { InstancedModel, DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { SkyDome, Water } from "@/arcade3d/core/env";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { waddle, type BodyOffset } from "@/arcade3d/core/motion";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { Instanced, useCanvasTexture, type InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, palmBaseOffset } from "./assets";
import { CRAB_INSET, crabAngles, groundAt, groundHeight, waterLevel } from "./looks";
import { COLORS, CratePrimitives, PalmPrimitives, RockPrimitives, UmbrellaPrimitive, useCrabParts } from "./Primitives";
import { FIXED, ISLAND, shoreAt, type Island as IslandData, type RunState } from "./rules";

// ---------- ground ----------

/** Ring radii (rho) of the ground mesh: dense where the sand slopes and the grass ends. */
const RINGS = [0, 0.15, 0.3, 0.45, 0.6, 0.7, 0.75, 0.77, 0.79, 0.82, 0.86, 0.9, 0.94, 0.97, 1, 1.04, 1.1, 1.2, 1.4, 1.8];
const SEGMENTS = 72;

/** Deterministic speckle (no Math.random in render code: the same island every frame). */
const speckle = (i: number, j: number) => {
   const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
   return v - Math.floor(v);
};

function buildGround(): BufferGeometry {
   const positions: number[] = [];
   const colors: number[] = [];
   const index: number[] = [];
   const sand = new Color(COLORS.sand);
   const wet = new Color(COLORS.wetSand);
   const grass = new Color(COLORS.grass);
   const grassDark = new Color(COLORS.grassDark);
   const c = new Color();
   RINGS.forEach((r, i) => {
      for (let j = 0; j < SEGMENTS; j++) {
         const a = (j / SEGMENTS) * Math.PI * 2;
         // a little wobble on the outer rings only (the walkable band keeps the exact ellipse)
         const wob = r > 1.05 ? 1 + 0.03 * Math.sin(a * 5 + 1) : 1;
         positions.push(ISLAND.rx * r * wob * Math.cos(a), groundHeight(r), ISLAND.rz * r * wob * Math.sin(a));
         const n = speckle(i, j);
         // a soft per-ring shade only: per-vertex noise streaks along the long spokes near the centre
         if (r < ISLAND.grass - 0.01) c.copy(grass).lerp(grassDark, 0.15 + 0.1 * Math.sin(i * 1.7) + n * (r > 0.5 ? 0.12 : 0));
         else if (r < ISLAND.grass + 0.01) c.copy(grass).lerp(sand, 0.5);
         else c.copy(sand).lerp(wet, Math.min(1, Math.max(0, (r - 0.9) / 0.12)) * 0.9 + n * 0.08);
         colors.push(c.r, c.g, c.b);
         if (i > 0) {
            const a0 = (i - 1) * SEGMENTS + j;
            const a1 = (i - 1) * SEGMENTS + ((j + 1) % SEGMENTS);
            const b0 = i * SEGMENTS + j;
            const b1 = i * SEGMENTS + ((j + 1) % SEGMENTS);
            // counter-clockwise seen from above (the angle runs from +x towards +z): the faces look up
            index.push(a0, a1, b0, a1, b1, b0);
         }
      }
   });
   const g = new BufferGeometry();
   g.setAttribute("position", new Float32BufferAttribute(positions, 3));
   g.setAttribute("color", new Float32BufferAttribute(colors, 3));
   g.setIndex(index);
   g.computeVertexNormals();
   return g;
}

function Ground() {
   const geometry = useMemo(buildGround, []);
   useEffect(() => () => geometry.dispose(), [geometry]);
   return (
      <mesh geometry={geometry} name="island-ground">
         <meshStandardMaterial vertexColors roughness={0.95} />
      </mesh>
   );
}

// ---------- sea ----------

/** The water and its foam line rise with the tide: the drawn waterline is the rules' shore(t). */
function Sea({ run }: { run: RunState }) {
   const sea = useRef<Group>(null);
   const foam = useRef<Mesh>(null);
   useFrame(() => {
      const shore = shoreAt(run.time);
      if (sea.current) sea.current.position.y = waterLevel(shore);
      // the ring lies in its local x / y (turned flat about x): y is the world's z
      foam.current?.scale.set(ISLAND.rx * shore, ISLAND.rz * shore, 1);
   });
   return (
      <group ref={sea} name="sea">
         <Water size={[110, 110]} color={COLORS.sea} deep={COLORS.deep} amplitude={0.03} wavelength={5} opacity={0.88} />
         {/* the foam line: just above the water (the water writes no depth, so it never hides it) */}
         <mesh ref={foam} rotation-x={-Math.PI / 2} position-y={0.05} renderOrder={2}>
            <ringGeometry args={[0.985, 1.025, 96]} />
            <meshBasicMaterial color={COLORS.foam} transparent opacity={0.75} depthWrite={false} />
         </mesh>
      </group>
   );
}

// ---------- props ----------

function drawTowel(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const stripes = ["#f43f5e", "#fde68a", "#38bdf8", "#fde68a"];
   const n = 8;
   for (let i = 0; i < n; i++) {
      ctx.fillStyle = stripes[i % stripes.length];
      ctx.fillRect((i * w) / n, 0, w / n + 1, h);
   }
}

function Towel() {
   const map = useCanvasTexture(64, 32, drawTowel);
   const x = FIXED.umbrella.x - 0.9;
   const z = FIXED.umbrella.z + 0.6;
   return (
      <mesh rotation={[-Math.PI / 2, 0, 0.5]} position={[x, groundAt(x, z) + 0.02, z]} name="towel">
         <planeGeometry args={[1.8, 0.9]} />
         <meshStandardMaterial map={map} roughness={0.9} />
      </mesh>
   );
}

/** The wrecked rowboat on the rules' box (2.6 x 1.1), lying a little on its side. */
function Rowboat() {
   const { x, z } = FIXED.rowboat;
   const seats = useMemo<InstanceSpot[]>(() => [{ x: -0.45, y: 0.22, z: 0 }, { x: 0.45, y: 0.22, z: 0 }], []);
   return (
      <group position={[x, groundAt(x, z) - 0.04, z]} rotation={[0.18, 0.12, 0]} name="rowboat">
         <mesh scale={[1.3, 0.42, 0.52]} position-y={0.42} rotation-x={Math.PI}>
            <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={COLORS.hull} roughness={0.85} side={2} />
         </mesh>
         <mesh scale={[1.18, 0.42, 1]} position-y={0.12} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[1, 20]} />
            <meshStandardMaterial color={COLORS.wood} roughness={0.9} />
         </mesh>
         <Instanced spots={seats} name="rowboat-seats">
            <boxGeometry args={[0.16, 0.05, 0.95]} />
            <meshStandardMaterial color={COLORS.wood} roughness={0.85} />
         </Instanced>
      </group>
   );
}

const DOCK_POSTS: InstanceSpot[] = [];
for (let z = FIXED.dock.fromZ + 0.3; z <= FIXED.dock.toZ; z += 1.4) {
   DOCK_POSTS.push({ x: -FIXED.dock.hx + 0.08, y: -1, z }, { x: FIXED.dock.hx - 0.08, y: -1, z });
}

function Dock() {
   const { hx, fromZ, toZ } = FIXED.dock;
   return (
      <group name="dock">
         <mesh position={[0, 0.12, (fromZ + toZ) / 2]}>
            <boxGeometry args={[hx * 2, 0.1, toZ - fromZ]} />
            <meshStandardMaterial color={COLORS.deck} roughness={0.85} />
         </mesh>
         <Instanced spots={DOCK_POSTS} name="dock-posts">
            <cylinderGeometry args={[0.09, 0.09, 2.3, 8]} />
            <meshStandardMaterial color={COLORS.wood} roughness={0.9} />
         </Instanced>
      </group>
   );
}

/** The crate stack on the rules' box: two side by side and one on top. */
const CRATE_SPOTS: InstanceSpot[] = [
   { x: FIXED.crates.x - 0.42, y: groundAt(FIXED.crates.x, FIXED.crates.z), z: FIXED.crates.z, rotY: 0.05 },
   { x: FIXED.crates.x + 0.42, y: groundAt(FIXED.crates.x, FIXED.crates.z), z: FIXED.crates.z, rotY: -0.08 },
   { x: FIXED.crates.x + 0.05, y: groundAt(FIXED.crates.x, FIXED.crates.z) + 0.565, z: FIXED.crates.z, rotY: 0.4 },
];

// ---------- crabs ----------

const CRAB_POOL = 3;

function Crabs({ island, run }: { island: IslandData; run: RunState }) {
   const time = useGameTime();
   const { tier, decor } = useQuality();
   const shown = tier === "low" ? 0 : scaledCount(CRAB_POOL, decor);
   const angles = useMemo(() => crabAngles(island), [island]);
   const parts = useCrabParts();
   const offset = useMemo<BodyOffset>(() => ({ y: 0, roll: 0, yaw: 0, squash: 1 }), []);
   const update = (i: number, m: Matrix4) => {
      if (i >= shown || i >= angles.length) return false;
      const a = angles[i];
      const t = time.now;
      // scuttle sideways along the waterline (which moves in with the tide)
      const r = shoreAt(run.time) - CRAB_INSET;
      const along = Math.sin(t * 0.7 + i * 2.1) * 0.08;
      const x = ISLAND.rx * r * Math.cos(a + along);
      const z = ISLAND.rz * r * Math.sin(a + along);
      waddle(t * 9 + i, 0.22, offset);
      // facing the sea (claws +z towards the camera's side when on the south beach)
      const yaw = Math.atan2(x / ISLAND.rx, z / ISLAND.rz) + offset.yaw;
      CRAB_M.makeRotationY(yaw);
      CRAB_R.makeRotationZ(offset.roll);
      m.multiplyMatrices(CRAB_M, CRAB_R).setPosition(x, groundHeight(r) + offset.y * 0.3, z);
   };
   return <DynamicInstancedModel asset={ASSETS.crab} count={CRAB_POOL} update={update} fallbackParts={parts} name="crabs" />;
}

// module-level scratch for the crab matrices (no allocation per frame)
const CRAB_M = new Matrix4();
const CRAB_R = new Matrix4();

// ---------- the island ----------

export function IslandScene({ island, run }: { island: IslandData; run: RunState }) {
   const palmSpots = useMemo<InstanceSpot[]>(
      () =>
         island.palms.map((p) => {
            const o = palmBaseOffset(p.yaw, p.size);
            return { x: p.x - o.x, y: groundAt(p.x, p.z) - 0.05, z: p.z - o.z, rotY: p.yaw, scale: p.size };
         }),
      [island]
   );
   const rockSpots = useMemo<InstanceSpot[]>(
      () => island.rocks.map((r) => ({ x: r.x, y: groundAt(r.x, r.z) - 0.06 * r.size, z: r.z, rotY: r.yaw, scale: r.size })),
      [island]
   );
   const umbrellaY = groundAt(FIXED.umbrella.x, FIXED.umbrella.z);
   return (
      <group name="island">
         <SkyDome top="#1e3a8a" bottom="#fdba74" />
         <Ground />
         <Sea run={run} />
         <InstancedModel asset={ASSETS.palm} spots={palmSpots} fallback={<PalmPrimitives spots={palmSpots} />} />
         <InstancedModel asset={ASSETS.rock} spots={rockSpots} fallback={<RockPrimitives spots={rockSpots} />} />
         <InstancedModel asset={ASSETS.crate} spots={CRATE_SPOTS} fallback={<CratePrimitives spots={CRATE_SPOTS} />} />
         <group position={[FIXED.umbrella.x, umbrellaY - 0.05, FIXED.umbrella.z]} rotation-y={0.6}>
            <Model asset={ASSETS.umbrella} fallback={<UmbrellaPrimitive />} />
         </group>
         <Towel />
         <Rowboat />
         <Dock />
         <Crabs island={island} run={run} />
      </group>
   );
}
