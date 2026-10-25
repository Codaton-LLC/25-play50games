"use client";

// The cove: sky dome, turquoise water, the stone fort (battered seawall, timber gun deck,
// coping merlons, flagpole + streaming wind flag), the island with palms and coastal surf,
// the harbour mouth (buoys, stone mole with bollards, banded lighthouse with beacon),
// and instanced surroundings (Decor).
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
   BoxGeometry,
   CylinderGeometry,
   LatheGeometry,
   RingGeometry,
   Vector2,
   type Group,
   type Mesh,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { SkyDome, Water } from "@/arcade3d/core/env";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS, LIGHTHOUSE_AT, PALM_BASE_Z } from "./assets";
import { Decor } from "./Decor";
import { COLORS, FORT } from "./looks";
import { PalmPrimitives } from "./Primitives";
import { CANNON, ISLAND, LANES, SEA, type RunState } from "./rules";

const PARAPET_BLOCK = { w: 0.9, h: FORT.parapetTop - CANNON.platformY, gap: 0.5 } as const;

/** Merlons along the sea front and the two flanks of the fort platform. */
function parapetSpots(): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   const y = CANNON.platformY + PARAPET_BLOCK.h / 2;
   for (let x = -FORT.halfX + 0.45; x <= FORT.halfX - 0.45 + 1e-6; x += PARAPET_BLOCK.w + PARAPET_BLOCK.gap) {
      spots.push({ x, y, z: FORT.front - FORT.parapetDepth / 2, sz: 1 });
   }
   for (const side of [-1, 1]) {
      for (let z = FORT.front + 1; z <= FORT.back - 0.5; z += PARAPET_BLOCK.w + PARAPET_BLOCK.gap) {
         spots.push({ x: side * (FORT.halfX - 0.25), y, z, rotY: Math.PI / 2 });
      }
   }
   return spots;
}

/** Buoys on the harbour line: one each side of every lane, alternating red and white. */
function buoySpots(): { red: InstanceSpot[]; white: InstanceSpot[] } {
   const red: InstanceSpot[] = [];
   const white: InstanceSpot[] = [];
   LANES.forEach((z, i) => {
      (i % 2 ? white : red).push({ x: SEA.harbourX, y: 0, z: z + 5.5 });
      (i % 2 ? red : white).push({ x: SEA.harbourX, y: 0, z: z - 5.5 });
   });
   return { red, white };
}

/** The mound's height at distance d from the island centre (the rules' parabola). */
const moundAt = (d: number) => ISLAND.h * Math.max(0, 1 - (d / ISLAND.r) ** 2);

/** Each palm's origin, so its drawn trunk base is on the rules' trunk. */
const PALM_SPOTS: InstanceSpot[] = ISLAND.palms.map((p, i) => {
   const rotY = i * 2.4;
   return {
      x: p.x - Math.sin(rotY) * PALM_BASE_Z,
      y: moundAt(Math.hypot(p.x - ISLAND.x, p.z - ISLAND.z)) - 0.05,
      z: p.z - Math.cos(rotY) * PALM_BASE_Z,
      rotY,
   };
});

/** The island mound profile as a lathe of the rules' parabola. */
function useMound(): LatheGeometry {
   const g = useMemo(() => {
      const pts: Vector2[] = [];
      for (let k = 0; k <= 12; k++) pts.push(new Vector2(ISLAND.r * (1 - k / 12) + 0.001, moundAt(ISLAND.r * (1 - k / 12))));
      pts.push(new Vector2(0, ISLAND.h));
      return new LatheGeometry(pts, 28);
   }, []);
   useEffect(() => () => g.dispose(), [g]);
   return g;
}

/** The flag on the fort's pole: streams with the wind, fluttering, and drops when lost. */
function WindFlag({ run, reduced }: { run: RunState; reduced: boolean }) {
   const time = useGameTime();
   const pole = useRef<Group>(null);
   const cloth = useRef<Mesh>(null);
   const state = useMemo(() => ({ angle: 0, drop: 0 }), []);

   useFrame(() => {
      const g = pole.current;
      const c = cloth.current;
      if (!g || !c) return;
      const target = Math.atan2(run.wind.x, run.wind.z) - Math.PI / 2;
      const turn = Math.atan2(Math.sin(target - state.angle), Math.cos(target - state.angle));
      state.angle += turn * (1 - Math.exp(-3 * time.delta));
      g.rotation.y = state.angle;
      const { phase, endReason } = useArcadeStore.getState();
      const lost = phase === "over" && endReason === "lose";
      state.drop = lost ? Math.min(1, state.drop + time.delta / 1.2) : 0;
      const strength = Math.min(1, Math.hypot(run.wind.x, run.wind.z) / 3);
      g.position.y = -2.4 * state.drop * state.drop;
      c.rotation.y = reduced ? 0 : 0.28 * Math.sin(time.now * (4 + 4 * strength));
      c.scale.y = 1 - 0.3 * (1 - strength);
   });

   return (
      <group position={[-FORT.halfX + 0.4, CANNON.platformY, FORT.back - 0.4]}>
         {/* Pole base mount */}
         <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.16, 0.22, 0.24, 8]} />
            <meshStandardMaterial color={COLORS.bronze} roughness={0.4} metalness={0.6} />
         </mesh>
         {/* Tapered mast pole */}
         <mesh position={[0, 1.8, 0]}>
            <cylinderGeometry args={[0.06, 0.09, 3.6, 8]} />
            <meshStandardMaterial color="#f5f5f4" roughness={0.5} />
         </mesh>
         {/* Gilded finial ball */}
         <mesh position={[0, 3.65, 0]}>
            <sphereGeometry args={[0.12, 10, 8]} />
            <meshStandardMaterial color={COLORS.chestGold} roughness={0.3} metalness={0.8} />
         </mesh>
         <group ref={pole} position={[0, 3.3, 0]}>
            <mesh ref={cloth} position={[0.65, 0, 0]}>
               <planeGeometry args={[1.3, 0.72]} />
               <meshStandardMaterial color={COLORS.flag} roughness={0.65} side={2} />
            </mesh>
         </group>
      </group>
   );
}

export function Bay({ run }: { run: RunState }) {
   const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
   const parapet = useMemo(parapetSpots, []);
   const buoys = useMemo(buoySpots, []);
   const mound = useMound();

   const fortDepth = FORT.back - FORT.front;
   const fortH = CANNON.platformY - FORT.bottom;

   // Merlon geometry with bevelled stone coping: total height = PARAPET_BLOCK.h (0.35), so top stays 2.55
   const merlonGeo = useMemo(() => {
      const block = new BoxGeometry(PARAPET_BLOCK.w, 0.28, FORT.parapetDepth).translate(0, -0.035, 0);
      const cap = new BoxGeometry(PARAPET_BLOCK.w + 0.04, 0.07, FORT.parapetDepth + 0.04).translate(0, 0.14, 0);
      const m = mergeGeometries([block, cap]);
      block.dispose();
      cap.dispose();
      if (!m) throw new Error("pirate bay: merlon merge");
      return m;
   }, []);

   // Buoy geometry: tapered conical body + cage top
   const buoyGeo = useMemo(() => {
      const body = new CylinderGeometry(0.32, 0.48, 1.1, 10).translate(0, 0.55, 0);
      const ring = new CylinderGeometry(0.52, 0.52, 0.15, 10).translate(0, 0.35, 0);
      const top = new CylinderGeometry(0.12, 0.22, 0.45, 8).translate(0, 1.3, 0);
      const full = mergeGeometries([body, ring, top]);
      body.dispose();
      ring.dispose();
      top.dispose();
      if (!full) throw new Error("pirate bay: buoy merge");
      return full;
   }, []);

   useEffect(
      () => () => {
         merlonGeo.dispose();
         buoyGeo.dispose();
      },
      [merlonGeo, buoyGeo]
   );

   return (
      <group name="bay">
         {/* Sunny Caribbean SkyDome overhead */}
         <SkyDome top={COLORS.skyTop} bottom={COLORS.sky} exponent={0.7} />

         {/* Flat far ocean plane fogging cleanly into the horizon with no visible edges */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.28, -260]} name="far-sea">
            <planeGeometry args={[1800, 1200]} />
            <meshBasicMaterial color={COLORS.farSea} />
         </mesh>

         {/* Luminous Caribbean sea waves with white crest foam and shoreline edge */}
         <Water
            size={[500, 360]}
            position={[0, 0, -80]}
            color={COLORS.sea}
            deep={COLORS.deep}
            foam={COLORS.foam}
            amplitude={reduced ? 0 : 0.16}
            wavelength={6.5}
            speed={reduced ? 0 : 0.75}
            foamEdge={0.06}
            opacity={0.96}
         />

         {/* Surroundings outside play area: distant cliffs, citadel, islets, gulls, clouds */}
         <Decor reduced={reduced} />

         {/* -------------------- The Fort -------------------- */}
         {/* Submerged stone foundation and seawall, deep into the water */}
         <mesh position={[0, (FORT.bottom - 1.2 + 0.4) / 2, (FORT.front + FORT.back) / 2]}>
            <boxGeometry args={[FORT.halfX * 2 + 0.5, 0.4 - (FORT.bottom - 1.2), fortDepth + 0.5]} />
            <meshStandardMaterial color={COLORS.stoneDark} roughness={0.95} />
         </mesh>

         {/* Main limestone fort rampart walls */}
         <mesh position={[0, FORT.bottom + fortH / 2, (FORT.front + FORT.back) / 2]}>
            <boxGeometry args={[FORT.halfX * 2, fortH, fortDepth]} />
            <meshStandardMaterial color={COLORS.stone} roughness={0.9} />
         </mesh>

         {/* Bevelled stone stringcourse moulding beneath the gun platform rim */}
         <mesh position={[0, CANNON.platformY - 0.08, (FORT.front + FORT.back) / 2]}>
            <boxGeometry args={[FORT.halfX * 2 + 0.18, 0.16, fortDepth + 0.18]} />
            <meshStandardMaterial color={COLORS.stoneTrim} roughness={0.85} />
         </mesh>

         {/* Warm timber planked gun deck */}
         <mesh position={[0, CANNON.platformY + 0.005, (FORT.front + FORT.back) / 2]}>
            <boxGeometry args={[FORT.halfX * 2 - 0.15, 0.02, fortDepth - 0.15]} />
            <meshStandardMaterial color={COLORS.woodDeck} roughness={0.7} />
         </mesh>

         {/* Merlons / parapet blocks with bevelled coping stones */}
         <Instanced spots={parapet} name="parapet">
            <primitive object={merlonGeo} attach="geometry" />
            <meshStandardMaterial color={COLORS.stone} roughness={0.9} />
         </Instanced>

         {/* Flagpole and wind-streaming flag */}
         <WindFlag run={run} reduced={reduced} />

         {/* -------------------- The Island (Rules) -------------------- */}
         {/* Sandy island mound */}
         <mesh position={[ISLAND.x, 0, ISLAND.z]} geometry={mound}>
            <meshStandardMaterial color={COLORS.sand} roughness={1} />
         </mesh>
         {/* Wet-sand shoreline rim ring */}
         <mesh position={[ISLAND.x, 0.02, ISLAND.z]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[ISLAND.r - 0.4, ISLAND.r + 0.25, 28]} />
            <meshStandardMaterial color={COLORS.sandWet} roughness={0.8} />
         </mesh>
         {/* Island shoreline surf foam ring */}
         <mesh position={[ISLAND.x, 0.035, ISLAND.z]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[ISLAND.r - 0.1, ISLAND.r + 0.65, 32]} />
            <meshStandardMaterial color={COLORS.surf} transparent opacity={0.7} depthWrite={false} />
         </mesh>
         {/* Island palms */}
         <InstancedModel asset={ASSETS.palm} spots={PALM_SPOTS} fallback={<PalmPrimitives spots={PALM_SPOTS} />} />

         {/* -------------------- The Harbour -------------------- */}
         {/* Channel buoys: red and white channel markers */}
         <Instanced spots={buoys.red} name="buoys-red">
            <primitive object={buoyGeo} attach="geometry" />
            <meshStandardMaterial color={COLORS.buoyRed} roughness={0.5} />
         </Instanced>
         <Instanced spots={buoys.white} name="buoys-white">
            <primitive object={buoyGeo} attach="geometry" />
            <meshStandardMaterial color={COLORS.buoyWhite} roughness={0.5} />
         </Instanced>

         {/* Stone harbour mole / breakwater */}
         <mesh position={[SEA.harbourX + 6, 0.4, -61]}>
            <boxGeometry args={[9, 1.6, 4]} />
            <meshStandardMaterial color={COLORS.stone} roughness={0.9} />
         </mesh>
         {/* Mole coping rim */}
         <mesh position={[SEA.harbourX + 6, 1.25, -61]}>
            <boxGeometry args={[9.3, 0.12, 4.3]} />
            <meshStandardMaterial color={COLORS.stoneTrim} roughness={0.85} />
         </mesh>

         {/* Banded lighthouse. Feet on the mole, south of the play sea. */}
         <Model
            asset={ASSETS.lighthouse}
            position={[SEA.harbourX + LIGHTHOUSE_AT.dx, 0, LIGHTHOUSE_AT.z]}
            fallback={
               <group>
                  <mesh position={[0, 0.9, 0]} castShadow>
                     <cylinderGeometry args={[1.2, 1.45, 1.8, 12]} />
                     <meshStandardMaterial color={COLORS.stone} roughness={0.9} />
                  </mesh>
                  <mesh position={[0, 4, 0]}>
                     <cylinderGeometry args={[0.72, 1.15, 4.4, 12]} />
                     <meshStandardMaterial color="#f8fafc" roughness={0.5} />
                  </mesh>
                  <mesh position={[0, 6.3, 0]}>
                     <cylinderGeometry args={[0.95, 0.95, 0.22, 12]} />
                     <meshStandardMaterial color={COLORS.bronze} roughness={0.4} metalness={0.5} />
                  </mesh>
                  <mesh position={[0, 6.85, 0]}>
                     <cylinderGeometry args={[0.65, 0.65, 0.9, 10]} />
                     <meshStandardMaterial color={COLORS.beacon} emissive={COLORS.beacon} emissiveIntensity={0.65} roughness={0.2} />
                  </mesh>
                  <mesh position={[0, 7.8, 0]}>
                     <cylinderGeometry args={[0.01, 0.85, 0.95, 12]} />
                     <meshStandardMaterial color={COLORS.accent} roughness={0.5} />
                  </mesh>
               </group>
            }
         />
      </group>
   );
}
