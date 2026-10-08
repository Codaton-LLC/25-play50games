"use client";

// The cove: sky, sea, the stone fort (platform, parapet, corner tower, the wind flag), the island
// with its two palms, the harbour mouth on the right (buoy line at the rules' x, a mole with a
// lighthouse). Static except the water and the flag. Every rules volume (island, buoy line) comes
// from rules.ts; the models are fitted over them.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { LatheGeometry, Vector2, type Group, type Mesh } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { SkyDome, Water } from "@/arcade3d/core/env";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS, PALM_BASE_Z } from "./assets";
import { COLORS, FORT } from "./looks";
import { PalmPrimitives } from "./Primitives";
import { CANNON, ISLAND, LANES, SEA, type RunState } from "./rules";

const PARAPET_BLOCK = { w: 0.9, h: FORT.parapetTop - CANNON.platformY, gap: 0.5 } as const;

/** Merlons along the sea side and the two flanks of the platform. */
function parapetSpots(): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   const y = CANNON.platformY + PARAPET_BLOCK.h / 2;
   for (let x = -FORT.halfX + 0.45; x <= FORT.halfX - 0.45 + 1e-6; x += PARAPET_BLOCK.w + PARAPET_BLOCK.gap) spots.push({ x, y, z: FORT.front - FORT.parapetDepth / 2, sz: 1 });
   for (const side of [-1, 1]) for (let z = FORT.front + 1; z <= FORT.back - 0.5; z += PARAPET_BLOCK.w + PARAPET_BLOCK.gap) spots.push({ x: side * (FORT.halfX - 0.25), y, z, rotY: Math.PI / 2 });
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

/** Each palm's origin, so its drawn trunk base (PALM_BASE_Z along the model's +z) is on the rules' trunk. */
const PALM_SPOTS: InstanceSpot[] = ISLAND.palms.map((p, i) => {
   const rotY = i * 2.4;
   return { x: p.x - Math.sin(rotY) * PALM_BASE_Z, y: moundAt(Math.hypot(p.x - ISLAND.x, p.z - ISLAND.z)) - 0.05, z: p.z - Math.cos(rotY) * PALM_BASE_Z, rotY };
});

/** The mound as a lathe of the rules' profile. */
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

/** The flag on the corner tower: it streams with the wind, and comes down when the harbour falls. */
function WindFlag({ run }: { run: RunState }) {
   const time = useGameTime();
   const pole = useRef<Group>(null);
   const cloth = useRef<Mesh>(null);
   const state = useMemo(() => ({ angle: 0, drop: 0 }), []);
   useFrame(() => {
      const g = pole.current;
      const c = cloth.current;
      if (!g || !c) return;
      const target = Math.atan2(run.wind.x, run.wind.z) - Math.PI / 2;
      state.angle += (target - state.angle) * (1 - Math.exp(-3 * time.delta));
      g.rotation.y = state.angle;
      const { phase, endReason } = useArcadeStore.getState();
      const lost = phase === "over" && endReason === "lose";
      state.drop = lost ? Math.min(1, state.drop + time.delta / 1.2) : 0;
      const strength = Math.min(1, Math.hypot(run.wind.x, run.wind.z) / 3);
      g.position.y = -2.4 * state.drop * state.drop;
      c.rotation.y = 0.25 * Math.sin(time.now * (4 + 4 * strength));
      c.scale.y = 1 - 0.3 * (1 - strength);
   });
   return (
      <group position={[-FORT.halfX + 0.9, CANNON.platformY + 2.6, FORT.front + 0.9]}>
         <mesh position={[0, 1.3, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 2.6, 6]} />
            <meshStandardMaterial color="#e7e5e4" roughness={0.6} />
         </mesh>
         <group ref={pole} position={[0, 2.25, 0]}>
            <mesh ref={cloth} position={[0.6, 0, 0]}>
               <planeGeometry args={[1.2, 0.7]} />
               <meshStandardMaterial color={COLORS.flag} roughness={0.7} side={2} />
            </mesh>
         </group>
      </group>
   );
}

export function Bay({ run }: { run: RunState }) {
   const parapet = useMemo(parapetSpots, []);
   const buoys = useMemo(buoySpots, []);
   const mound = useMound();
   const fortDepth = FORT.back - FORT.front;
   const fortH = CANNON.platformY - FORT.bottom;
   return (
      <group name="bay">
         <SkyDome top="#38bdf8" bottom="#e0f2fe" />
         <Water size={[150, 110]} position={[0, 0, -40]} color={COLORS.sea} deep={COLORS.deep} amplitude={0.15} wavelength={7} />

         {/* the fort */}
         <mesh position={[0, FORT.bottom + fortH / 2, (FORT.front + FORT.back) / 2]}>
            <boxGeometry args={[FORT.halfX * 2, fortH, fortDepth]} />
            <meshStandardMaterial color={COLORS.stone} roughness={0.95} />
         </mesh>
         <Instanced spots={parapet} name="parapet">
            <boxGeometry args={[PARAPET_BLOCK.w, PARAPET_BLOCK.h, FORT.parapetDepth]} />
            <meshStandardMaterial color={COLORS.stoneDark} roughness={0.95} />
         </Instanced>
         <mesh position={[-FORT.halfX + 0.9, CANNON.platformY + 1.3, FORT.front + 0.9]}>
            <cylinderGeometry args={[0.9, 1.05, 2.6, 12]} />
            <meshStandardMaterial color={COLORS.stoneDark} roughness={0.95} />
         </mesh>
         <WindFlag run={run} />

         {/* the island */}
         <mesh position={[ISLAND.x, 0, ISLAND.z]} geometry={mound}>
            <meshStandardMaterial color={COLORS.sand} roughness={1} />
         </mesh>
         <InstancedModel asset={ASSETS.palm} spots={PALM_SPOTS} fallback={<PalmPrimitives spots={PALM_SPOTS} />} />

         {/* the harbour mouth: buoys on the rules' line, a mole and a lighthouse beyond it */}
         <Instanced spots={buoys.red} name="buoys-red">
            <cylinderGeometry args={[0.35, 0.45, 1.3, 10]} />
            <meshStandardMaterial color={COLORS.buoyRed} roughness={0.6} />
         </Instanced>
         <Instanced spots={buoys.white} name="buoys-white">
            <cylinderGeometry args={[0.35, 0.45, 1.3, 10]} />
            <meshStandardMaterial color={COLORS.buoyWhite} roughness={0.6} />
         </Instanced>
         <mesh position={[SEA.harbourX + 6, 0.4, -61]}>
            <boxGeometry args={[9, 1.6, 4]} />
            <meshStandardMaterial color={COLORS.stone} roughness={0.95} />
         </mesh>
         <mesh position={[SEA.harbourX + 4, 3.6, -61]}>
            <cylinderGeometry args={[0.7, 1, 5.6, 12]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.6} />
         </mesh>
         <mesh position={[SEA.harbourX + 4, 6.9, -61]}>
            <coneGeometry args={[0.95, 1.2, 12]} />
            <meshStandardMaterial color={COLORS.accent} roughness={0.6} />
         </mesh>
      </group>
   );
}
