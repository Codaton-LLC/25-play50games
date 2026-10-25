"use client";

// The island's look: sky, sand and grass, the sea that rises with the tide, the props (palms, rock
// outcrops, crates, the beach umbrella and towel, the wrecked rowboat, the dock), the decor crabs
// and the surrounding decor outside the play area (outer reef rocks with surf, palms, shipwreck, gulls).
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
import { Decor } from "./Decor";
import { CRAB_INSET, crabAngles, groundAt, groundHeight, waterLevel } from "./looks";
import { COLORS, CratePrimitives, PalmPrimitives, RockPrimitives, UmbrellaPrimitive, useCrabParts } from "./Primitives";
import { FIXED, ISLAND, shoreAt, type Island as IslandData, type RunState } from "./rules";

// ---------- ground ----------

/** Ring radii (rho) of the ground mesh: dense sampling across the sand slope, ripple zone and grass edge. */
const RINGS = [
   0, 0.12, 0.24, 0.36, 0.48, 0.58, 0.66, 0.72, 0.75, 0.77, 0.79, 0.81, 0.84, 0.88, 0.92, 0.95, 0.98, 1.0, 1.03, 1.07, 1.12, 1.2, 1.35, 1.55, 1.8,
];
const SEGMENTS = 96;

/** Deterministic speckle (no Math.random in render code: identical island every frame). */
const speckle = (i: number, j: number) => {
   const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
   return v - Math.floor(v);
};

function buildGround(): BufferGeometry {
   const positions: number[] = [];
   const colors: number[] = [];
   const index: number[] = [];
   const sand = new Color(COLORS.sand);
   const sandSun = new Color(COLORS.sandSun);
   const sandRipple = new Color(COLORS.sandRipple);
   const wet = new Color(COLORS.wetSand);
   const grass = new Color(COLORS.grass);
   const grassSun = new Color(COLORS.grassSun);
   const grassDark = new Color(COLORS.grassDark);
   const jungleEdge = new Color(COLORS.jungleEdge);
   const underwater = new Color(COLORS.underwaterSand);
   const deepLagoon = new Color(COLORS.deepLagoon);
   const oceanBed = new Color(COLORS.oceanBed);
   const c = new Color();

   RINGS.forEach((r, i) => {
      for (let j = 0; j < SEGMENTS; j++) {
         const a = (j / SEGMENTS) * Math.PI * 2;
         // subtle wobble on outer rings only (walkable band keeps the exact ellipse)
         const wob = r > 1.05 ? 1 + 0.03 * Math.sin(a * 5 + 1) : 1;
         positions.push(ISLAND.rx * r * wob * Math.cos(a), groundHeight(r), ISLAND.rz * r * wob * Math.sin(a));
         const n = speckle(i, j);

         // Organic jungle edge scalloping around ISLAND.grass (0.78)
         const edgeOffset = Math.sin(a * 14 + 1.2) * 0.024 + Math.sin(a * 29) * 0.012;
         const grassCutoff = ISLAND.grass + edgeOffset;

         if (r < grassCutoff - 0.04) {
            // Interior lush tropical jungle
            const sunlit = 0.5 + 0.5 * Math.sin(a * 3 + r * 10);
            c.copy(grass).lerp(grassSun, sunlit * 0.35).lerp(grassDark, 0.2 + n * 0.12);
         } else if (r < grassCutoff) {
            // Dense jungle edge fringe
            c.copy(jungleEdge).lerp(grassDark, 0.4 + n * 0.15);
         } else if (r < 0.90) {
            // Rich golden sand with subtle wind ripples
            const ripple = Math.sin(r * 52 + Math.sin(a * 8) * 1.5);
            const rippleBlend = 0.5 + 0.5 * ripple;
            c.copy(sand).lerp(sandSun, rippleBlend * 0.4).lerp(sandRipple, (1 - rippleBlend) * 0.35 + n * 0.08);
         } else if (r < 1.02) {
            // Glistening wet shoreline sand
            const wetK = Math.min(1, Math.max(0, (r - 0.90) / 0.12));
            c.copy(sand).lerp(wet, wetK * 0.92 + n * 0.06);
         } else if (r < 1.18) {
            // Turquoise shallows over submerged sand
            const shallowK = Math.min(1, (r - 1.02) / 0.16);
            c.copy(wet).lerp(underwater, shallowK * 0.85).lerp(deepLagoon, shallowK * 0.4);
         } else {
            // Deeper lagoon slope transitioning into ocean floor
            const deepK = Math.min(1, (r - 1.18) / 0.62);
            c.copy(deepLagoon).lerp(oceanBed, deepK * 0.85 + n * 0.05);
         }

         colors.push(c.r, c.g, c.b);

         if (i > 0) {
            const a0 = (i - 1) * SEGMENTS + j;
            const a1 = (i - 1) * SEGMENTS + ((j + 1) % SEGMENTS);
            const b0 = i * SEGMENTS + j;
            const b1 = i * SEGMENTS + ((j + 1) % SEGMENTS);
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
         <meshStandardMaterial vertexColors roughness={0.92} />
      </mesh>
   );
}

// ---------- sea ----------

/** The water and its foam line rise with the tide: the drawn waterline is the rules' shore(t). */
function Sea({ run }: { run: RunState }) {
   const sea = useRef<Group>(null);
   const foam = useRef<Mesh>(null);
   const innerFoam = useRef<Mesh>(null);

   useFrame(() => {
      const shore = shoreAt(run.time);
      if (sea.current) sea.current.position.y = waterLevel(shore);
      const rx = ISLAND.rx * shore;
      const rz = ISLAND.rz * shore;
      foam.current?.scale.set(rx, rz, 1);
      innerFoam.current?.scale.set(rx * 0.992, rz * 0.992, 1);
   });

   return (
      <group ref={sea} name="sea">
         {/* Deep turquoise sea surface (extended to 180x180 to guarantee no void at screen edges) */}
         <Water size={[180, 180]} color={COLORS.sea} deep={COLORS.deep} amplitude={0.035} wavelength={5.2} opacity={0.88} />

         {/* Ocean seabed plane underneath the water so no sky/void can ever show through */}
         <mesh rotation-x={-Math.PI / 2} position-y={-1.35} name="sea-bed">
            <planeGeometry args={[180, 180]} />
            <meshStandardMaterial color={COLORS.oceanBed} roughness={0.95} />
         </mesh>

         {/* Shore foam: double-layered foam ring that rises with the tide */}
         <mesh ref={foam} rotation-x={-Math.PI / 2} position-y={0.045} renderOrder={2}>
            <ringGeometry args={[0.985, 1.025, 96]} />
            <meshBasicMaterial color={COLORS.foam} transparent opacity={0.8} depthWrite={false} />
         </mesh>
         <mesh ref={innerFoam} rotation-x={-Math.PI / 2} position-y={0.04} renderOrder={2}>
            <ringGeometry args={[0.97, 0.995, 96]} />
            <meshBasicMaterial color={COLORS.surfFoam} transparent opacity={0.5} depthWrite={false} />
         </mesh>
      </group>
   );
}

// ---------- props ----------

function drawTowel(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const stripes = COLORS.towelStripes;
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
      <group position={[x, groundAt(x, z) + 0.02, z]} rotation={[-Math.PI / 2, 0, 0.5]} name="towel">
         <mesh>
            <planeGeometry args={[1.8, 0.9]} />
            <meshStandardMaterial map={map} roughness={0.9} />
         </mesh>
         {/* Fringe ends */}
         <mesh position={[-0.92, 0, 0]}>
            <planeGeometry args={[0.05, 0.9]} />
            <meshStandardMaterial color="#fef08a" roughness={0.9} />
         </mesh>
         <mesh position={[0.92, 0, 0]}>
            <planeGeometry args={[0.05, 0.9]} />
            <meshStandardMaterial color="#fef08a" roughness={0.9} />
         </mesh>
      </group>
   );
}

/** The wrecked rowboat on the rules' box (2.6 x 1.1), lying a little on its side with two-tone hull. */
function Rowboat() {
   const { x, z } = FIXED.rowboat;
   const seats = useMemo<InstanceSpot[]>(() => [{ x: -0.45, y: 0.22, z: 0 }, { x: 0.45, y: 0.22, z: 0 }], []);
   return (
      <group position={[x, groundAt(x, z) - 0.04, z]} rotation={[0.18, 0.12, 0]} name="rowboat">
         {/* Caribbean teal lower hull */}
         <mesh scale={[1.3, 0.42, 0.52]} position-y={0.42} rotation-x={Math.PI}>
            <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={COLORS.boatTeal} roughness={0.8} side={2} />
         </mesh>
         {/* Cream gunwale rim */}
         <mesh position-y={0.43} scale={[1.31, 0.06, 0.53]}>
            <torusGeometry args={[1, 0.04, 6, 24]} />
            <meshStandardMaterial color={COLORS.boatCream} roughness={0.75} />
         </mesh>
         {/* Wooden floor */}
         <mesh scale={[1.18, 0.42, 1]} position-y={0.12} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[1, 20]} />
            <meshStandardMaterial color={COLORS.woodLight} roughness={0.88} />
         </mesh>
         {/* Seats with brass rowlocks */}
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
         {/* Main deck */}
         <mesh position={[0, 0.12, (fromZ + toZ) / 2]}>
            <boxGeometry args={[hx * 2, 0.1, toZ - fromZ]} />
            <meshStandardMaterial color={COLORS.deck} roughness={0.85} />
         </mesh>
         {/* Deck edge beams */}
         <mesh position={[-hx + 0.04, 0.06, (fromZ + toZ) / 2]}>
            <boxGeometry args={[0.08, 0.12, toZ - fromZ]} />
            <meshStandardMaterial color={COLORS.deckPlank} roughness={0.9} />
         </mesh>
         <mesh position={[hx - 0.04, 0.06, (fromZ + toZ) / 2]}>
            <boxGeometry args={[0.08, 0.12, toZ - fromZ]} />
            <meshStandardMaterial color={COLORS.deckPlank} roughness={0.9} />
         </mesh>
         {/* Wooden posts with iron caps */}
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
         <SkyDome top={COLORS.skyTop} bottom={COLORS.skyBottom} offset={0.06} exponent={0.72} />
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
         {/* Surroundings decor outside the play area: outer rocks with surf, palms, shipwreck, gulls */}
         <Decor />
      </group>
   );
}
