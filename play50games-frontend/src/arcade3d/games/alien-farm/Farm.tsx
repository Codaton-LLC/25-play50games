"use client";

// The crater farm: dusk sky, starry field, low-poly distant hills,
// flat plum soil disc out to the horizon, purple beds with dark teal furrows, and surroundings decor.
import { useEffect, useMemo } from "react";
import { CylinderGeometry, Quaternion, TorusGeometry, Vector3, type Matrix4 } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SkyDome, Starfield } from "@/arcade3d/core/env";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Decor } from "./Decor";
import {
   COLORS,
   HEIGHTS,
   LOOKS,
   coloredGeometry,
   hillMesh,
   type FarmLook,
} from "./looks";
import type { AlienFarmLevel, Pool } from "./levels";
import { FARM, PLOTS } from "./rules";

const BED_SPOTS: InstanceSpot[] = PLOTS.map((p) => ({ x: p.x, y: 0, z: p.z }));

/** Channels between neighbouring beds (x runs and z runs), drawn as thin glowing conduits. */
const CHANNELS: InstanceSpot[] = [
   ...[-4, 0, 4].flatMap((z) =>
      [-2.5, 2.5].map((x) => ({ x, y: HEIGHTS.channel, z, sx: 3.0, sy: 1, sz: 0.14 }))
   ),
   ...[-5, 0, 5].flatMap((x) =>
      [-2, 2].map((z) => ({ x, y: HEIGHTS.channel, z, sx: 0.14, sy: 1, sz: 2.2 }))
   ),
];

function Beds({ look }: { look: FarmLook }) {
   const geo = useMemo(() => {
      const s = FARM.bedHalf * 2;
      // 1. Bed planter frame
      const frame = new RoundedBoxGeometry(s, 0.1, s, 2, 0.05).translate(0, 0.05, 0);

      // 2. Inner soil bed slab
      const soil = new RoundedBoxGeometry(s - 0.24, 0.04, s - 0.24, 2, 0.02).translate(
         0,
         0.08,
         0
      );

      // 3. Soft furrows: 3 parallel rounded ridges along z in each bed
      const f1 = new CylinderGeometry(0.11, 0.11, s - 0.28, 8)
         .rotateX(Math.PI / 2)
         .scale(1, 0.25, 1)
         .translate(-0.38, 0.1, 0);
      const f2 = new CylinderGeometry(0.11, 0.11, s - 0.28, 8)
         .rotateX(Math.PI / 2)
         .scale(1, 0.25, 1)
         .translate(0, 0.1, 0);
      const f3 = new CylinderGeometry(0.11, 0.11, s - 0.28, 8)
         .rotateX(Math.PI / 2)
         .scale(1, 0.25, 1)
         .translate(0.38, 0.1, 0);

      const furrows = mergeGeometries([f1, f2, f3]);
      f1.dispose();
      f2.dispose();
      f3.dispose();
      if (!furrows) throw new Error("alien-farm look: furrows");

      // 4. Glowing irrigation channel conduit
      const channel = new RoundedBoxGeometry(1, 0.024, 1, 1, 0.005);

      return {
         frame,
         soil,
         furrows,
         channel,
      };
   }, []);

   useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

   return (
      <group name="beds">
         {/* Planter frame in rich purple */}
         <Instanced spots={BED_SPOTS} name="bed-frame">
            <primitive object={geo.frame} attach="geometry" />
            <meshStandardMaterial color={look.bed} roughness={0.85} />
         </Instanced>

         {/* Soil bed base in rich plum soil */}
         <Instanced spots={BED_SPOTS} name="bed-soil-base">
            <primitive object={geo.soil} attach="geometry" />
            <meshStandardMaterial color={look.bedSoil} roughness={0.95} />
         </Instanced>

         {/* Soft furrow ridges in deep dark teal for strong crop contrast */}
         <Instanced spots={BED_SPOTS} name="bed-furrows">
            <primitive object={geo.furrows} attach="geometry" />
            <meshStandardMaterial color={look.furrow} roughness={0.8} />
         </Instanced>

         {/* Glowing irrigation channels linking the plots */}
         <Instanced spots={CHANNELS} name="channels">
            <primitive object={geo.channel} attach="geometry" />
            <meshStandardMaterial
               color={COLORS.soilDark}
               emissive={look.channel}
               emissiveIntensity={0.45}
               roughness={0.4}
            />
         </Instanced>
      </group>
   );
}

function Ground({ look }: { look: FarmLook }) {
   // Distant hills mesh: low-poly rolling terrain outside the farm (north and flanks)
   const hills = useMemo(() => coloredGeometry(hillMesh()), []);

   useEffect(() => () => {
      hills.dispose();
   }, [hills]);

   return (
      <group name="ground">
         {/* Wide ground soil disc extending out to radius 90 in plum to prevent any void below the scene */}
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} name="soil-plane">
            <circleGeometry args={[90, 48]} />
            <meshStandardMaterial color={look.soil} roughness={1} />
         </mesh>

         {/* Distant low-poly alien hills */}
         <mesh geometry={hills} name="distant-hills">
            <meshStandardMaterial vertexColors color={look.hillTint} flatShading roughness={0.95} />
         </mesh>
      </group>
   );
}

/** Marsh pools (rules.ts POOLS slow the farmer inside): dark glowing water, a rim and reeds. */
function Pools({ pools, look }: { pools: readonly Pool[]; look: FarmLook }) {
   const water = useMemo<InstanceSpot[]>(() => pools.map((p) => ({ x: p.x, y: 0.03, z: p.z, sx: p.r, sy: 1, sz: p.r })), [pools]);
   const rims = useMemo<InstanceSpot[]>(() => pools.map((p) => ({ x: p.x, y: 0.035, z: p.z, sx: p.r, sy: 1, sz: p.r })), [pools]);
   const reeds = useMemo<InstanceSpot[]>(() => {
      const out: InstanceSpot[] = [];
      for (const p of pools) {
         for (let k = 0; k < 7; k++) {
            const a = (k / 7) * Math.PI * 2 + p.x;
            out.push({ x: p.x + Math.cos(a) * (p.r + 0.12), y: 0, z: p.z + Math.sin(a) * (p.r + 0.12), sy: 0.8 + ((k * 37) % 5) * 0.12 });
         }
      }
      return out;
   }, [pools]);
   const geo = useMemo(() => ({
      disc: new CylinderGeometry(1, 1, 0.02, 28),
      rim: new CylinderGeometry(1.08, 1.08, 0.012, 28),
      reed: new CylinderGeometry(0.025, 0.04, 0.6, 5).translate(0, 0.3, 0),
      tip: new CylinderGeometry(0.06, 0.06, 0.12, 6).translate(0, 0.62, 0),
   }), []);
   useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
   if (!pools.length) return null;
   return (
      <group name="marsh-pools">
         <Instanced spots={rims} name="pool-rims">
            <primitive object={geo.rim} attach="geometry" />
            <meshBasicMaterial color="#5eead4" toneMapped={false} />
         </Instanced>
         <Instanced spots={water} name="pool-water">
            <primitive object={geo.disc} attach="geometry" />
            <meshStandardMaterial color="#0e7490" emissive="#0d9488" emissiveIntensity={0.55} roughness={0.15} metalness={0.2} transparent opacity={0.9} />
         </Instanced>
         <Instanced spots={reeds} name="pool-reeds">
            <primitive object={geo.reed} attach="geometry" />
            <meshStandardMaterial color="#365314" roughness={0.8} />
         </Instanced>
         <Instanced spots={reeds} name="pool-reed-tips">
            <primitive object={geo.tip} attach="geometry" />
            <meshStandardMaterial color={look.plantCap} emissive={look.plantGlow} emissiveIntensity={0.8} />
         </Instanced>
      </group>
   );
}

/** Spots on a ring round the walkable farm (outside x ±10.5, z ±8.5), north and flanks only. */
function ringSpots(step: number, jitter: number): InstanceSpot[] {
   const out: InstanceSpot[] = [];
   let k = 0;
   for (let x = -12; x <= 12; x += step) out.push({ x: x + (k++ % 3) * jitter, y: 0, z: -10.2 - (k % 2) * 0.8, rotY: k * 1.3 });
   for (let z = -7; z <= 7; z += step) {
      out.push({ x: -12 - (k % 2) * 0.6, y: 0, z, rotY: k++ * 0.7 });
      out.push({ x: 12 + (k % 2) * 0.6, y: 0, z, rotY: k++ * 0.9 });
   }
   return out;
}

/** Crystal Farm: crystal clusters round the field and a shard on every bed corner. */
function Crystals() {
   const clusters = useMemo<InstanceSpot[]>(() => {
      const out: InstanceSpot[] = [];
      ringSpots(3, 0.4).forEach((c, i) => {
         out.push({ ...c, y: 0.6, sx: 0.5, sy: 1.6 + (i % 3) * 0.5, sz: 0.5 });
         out.push({ x: c.x + 0.6, y: 0.35, z: c.z + 0.3, rotY: (c.rotY ?? 0) + 0.8, sx: 0.32, sy: 0.9, sz: 0.32 });
         out.push({ x: c.x - 0.5, y: 0.3, z: c.z - 0.2, rotY: (c.rotY ?? 0) - 0.6, sx: 0.28, sy: 0.75, sz: 0.28 });
      });
      return out;
   }, []);
   const shards = useMemo<InstanceSpot[]>(() => {
      const out: InstanceSpot[] = [];
      for (const p of PLOTS) for (const [dx, dz] of [[-0.82, -0.82], [0.82, -0.82], [0.82, 0.82], [-0.82, 0.82]]) out.push({ x: p.x + dx, y: 0.22, z: p.z + dz, rotY: dx * dz, sx: 0.09, sy: 0.24, sz: 0.09 });
      return out;
   }, []);
   return (
      <group name="crystals">
         <Instanced spots={clusters} name="crystal-clusters">
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={0.55} roughness={0.15} metalness={0.3} flatShading />
         </Instanced>
         <Instanced spots={shards} name="bed-shards">
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#e0f2fe" emissive="#7dd3fc" emissiveIntensity={0.7} roughness={0.1} flatShading />
         </Instanced>
      </group>
   );
}

/** Glow Marsh: glowing mushrooms round the field (the pools are their own component). */
function MarshGlow() {
   const caps = useMemo<InstanceSpot[]>(() => ringSpots(2.5, 0.5).map((c, i) => ({ ...c, y: 0.35, sx: 0.35 + (i % 3) * 0.12, sy: 0.22, sz: 0.35 + (i % 3) * 0.12 })), []);
   const stems = useMemo<InstanceSpot[]>(() => caps.map((c) => ({ x: c.x, y: 0.17, z: c.z, sx: 0.08, sy: 0.34, sz: 0.08 })), [caps]);
   return (
      <group name="marsh-glow">
         <Instanced spots={stems} name="mushroom-stems">
            <cylinderGeometry args={[1, 1, 1, 6]} />
            <meshStandardMaterial color="#ecfccb" roughness={0.8} />
         </Instanced>
         <Instanced spots={caps} name="mushroom-caps">
            <sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#a3e635" emissive="#bef264" emissiveIntensity={0.9} roughness={0.4} />
         </Instanced>
      </group>
   );
}

const METEORS = 5;
const UP_Q = new Quaternion();
const POS = new Vector3();
const SCALE = new Vector3();

/** Meteor Field: crater rims in the lanes and round the field, and a meteor shower far to the north. */
function Meteors({ reduced }: { reduced: boolean }) {
   const time = useGameTime();
   const craters = useMemo<InstanceSpot[]>(() => [
      ...[[-2.5, -2], [2.5, 2], [-7.5, 6], [7.5, -6]].map(([x, z], i) => ({ x, y: 0.04, z, sx: 0.9 + i * 0.1, sy: 1, sz: 0.9 + i * 0.1 })),
      ...ringSpots(4, 0.6).map((c, i) => ({ ...c, y: 0.05, sx: 1.2 + (i % 3) * 0.4, sy: 1.4, sz: 1.2 + (i % 3) * 0.4 })),
   ], []);
   const rim = useMemo(() => new TorusGeometry(1, 0.14, 6, 18).rotateX(Math.PI / 2), []);
   useEffect(() => () => rim.dispose(), [rim]);
   const place = (i: number, m: Matrix4) => {
      const period = 5 + i * 0.9;
      const phase = reduced ? 0.35 : ((time.now + i * 1.7) % period) / period;
      POS.set(-30 + i * 14 + phase * 12, 34 - phase * 30, -34 - (i % 2) * 8);
      SCALE.set(0.6, 0.6, 0.6);
      m.compose(POS, UP_Q, SCALE);
   };
   const trail = (i: number, m: Matrix4) => {
      place(i, m);
      POS.x -= 2.2;
      POS.y += 5.5;
      SCALE.set(0.35, 6, 0.35);
      m.compose(POS, TRAIL_Q, SCALE);
   };
   return (
      <group name="meteor-field">
         <Instanced spots={craters} name="crater-rims">
            <primitive object={rim} attach="geometry" />
            <meshStandardMaterial color="#57534e" emissive="#7c2d12" emissiveIntensity={0.35} roughness={1} flatShading />
         </Instanced>
         <DynamicInstanced count={METEORS} update={place} name="meteors">
            <icosahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color="#fdba74" toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={METEORS} update={trail} name="meteor-trails">
            <coneGeometry args={[1, 1, 6]} />
            <meshBasicMaterial color="#f97316" transparent opacity={0.45} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
      </group>
   );
}
const TRAIL_Q = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.38);

/** Grand Alien Harvest: lantern posts round the field with glowing lanterns and festival banners. */
function Festival() {
   const posts = useMemo<InstanceSpot[]>(() => {
      const out: InstanceSpot[] = [];
      for (let z = -8; z <= 8; z += 4) {
         out.push({ x: -10.9, y: 1.1, z });
         out.push({ x: 10.9, y: 1.1, z });
      }
      for (let x = -6; x <= 6; x += 4) out.push({ x, y: 1.1, z: -9 });
      return out;
   }, []);
   const lanternsA = useMemo(() => posts.filter((_p, i) => i % 2 === 0).map((p) => ({ x: p.x, y: 2.3, z: p.z, sx: 0.22, sy: 0.3, sz: 0.22 })), [posts]);
   const lanternsB = useMemo(() => posts.filter((_p, i) => i % 2 === 1).map((p) => ({ x: p.x, y: 2.3, z: p.z, sx: 0.22, sy: 0.3, sz: 0.22 })), [posts]);
   const banners = useMemo(() => posts.map((p, i) => ({ x: p.x + (p.x < 0 ? 0.25 : p.x > 0 && Math.abs(p.x) > 10 ? -0.25 : 0), y: 1.5, z: p.z + (Math.abs(p.x) < 10 ? 0.25 : 0), rotY: Math.abs(p.x) > 10 ? Math.PI / 2 : 0, sx: 0.5, sy: 0.8, sz: 1, tone: i % 3 })), [posts]);
   return (
      <group name="festival">
         <Instanced spots={posts} name="lantern-posts">
            <cylinderGeometry args={[0.06, 0.08, 2.2, 6]} />
            <meshStandardMaterial color="#78350f" roughness={0.8} />
         </Instanced>
         <Instanced spots={lanternsA} name="lanterns-gold">
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial color="#fde047" toneMapped={false} />
         </Instanced>
         <Instanced spots={lanternsB} name="lanterns-pink">
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial color="#f472b6" toneMapped={false} />
         </Instanced>
         <Instanced spots={banners} name="banners">
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial color="#22d3ee" emissive="#0891b2" emissiveIntensity={0.4} side={2} roughness={0.6} />
         </Instanced>
      </group>
   );
}

function Scenery({ look, reduced }: { look: FarmLook; reduced: boolean }) {
   if (look.scenery === "crystals") return <Crystals />;
   if (look.scenery === "marsh") return <MarshGlow />;
   if (look.scenery === "meteors") return <Meteors reduced={reduced} />;
   if (look.scenery === "festival") return <Festival />;
   return null;
}

export function FarmScene({ level }: { level: AlienFarmLevel }) {
   const { particles } = useQuality();
   const look = LOOKS[level.theme];
   const reduced = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

   return (
      <group name="farm">
         {/* The level's sky dome */}
         <SkyDome top={look.skyTop} bottom={look.skyBottom} offset={-0.02} exponent={0.7} />
         {look.stars > 0 && <Starfield count={scaledCount(look.stars, particles)} seed={21} upperOnly size={2} />}
         <Ground look={look} />
         <Beds look={look} />
         <Pools pools={level.pools} look={look} />
         <Scenery look={look} reduced={reduced} />
         <Decor look={look} pools={level.pools} />
      </group>
   );
}
