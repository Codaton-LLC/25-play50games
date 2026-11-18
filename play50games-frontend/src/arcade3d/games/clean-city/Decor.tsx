"use client";

// Clean the City decoration around the maps (README "Decor around the maps"): the ground beyond the
// floor, the city's kerb, street line and parked cars, the park's pigeons. Where everything stands
// is decorSpots.ts (pure, checked against the rules data by decorSpots.test.ts). Nothing here touches the run:
// the pigeons only read the runner's position to fly off when it comes close.
// - Cars: one <InstancedModel> per kind (one draw call each), static spots at module level.
// - Pigeons: a small bird built in code (createPigeonParts: six pieces of one low sphere, 600
//   triangles a bird) on one core <DynamicInstanced> (one draw call), placed every frame from
//   useGameTime() (pause-safe, never state.clock), no allocation in the frame loop. No GLB:
//   pigeon-crossing's 12,000-triangle pigeon made the flock 60,000 triangles for birds a few px
//   tall (review 2026-10-07); this flock is 3,000.
// - The car GLBs load in their own <Suspense>: the run never waits for decoration.
import { Suspense, memo, useCallback, useEffect, useState } from "react";
import { Color, Euler, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { DynamicInstanced, Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import type { LevelId } from "../../types";
import { ASSETS, FESTIVAL_STALL_SPOTS } from "./assets";
import {
   CAR_SPOTS,
   CITY_SQUARE_SPOTS,
   DASH_SPOTS,
   FESTIVAL_CLEANUP_SPOTS,
   KERB_SPOTS,
   PIGEON_HOMES,
   RIVER_WALK_SPOTS,
   SHOPPING_STREET_SPOTS,
   SURROUND_SPOTS,
   TAXI_SPOTS,
   VAN_SPOTS,
   createPigeonPose,
   pigeonPose,
   stepScare,
} from "./decorSpots";
import type { CleanRun } from "./rules";

const COLORS = {
   verge: "#3f8540",
   asphalt: "#4f5866",
   kerb: "#cbd5e1",
   line: "#f1f5f9",
   pigeon: "#8192a9",
   pigeonNeck: "#62787f",
   pigeonHead: "#5b6b82",
   pigeonTail: "#4b5568",
   pigeonLeg: "#c0616b",
} as const;

// ---------- ground and kerb ----------

function Surround({ color }: { color: string }) {
   return (
      <Instanced spots={SURROUND_SPOTS} name="decor-ground">
         <boxGeometry args={[1, 1, 1]} />
         <meshStandardMaterial color={color} roughness={1} />
      </Instanced>
   );
}

// ---------- parked cars (city) ----------

/** Stand-in boxes at the drawn size (w x h x l, long along z like the GLBs), until the GLB loads. */
const CAR_BOX = { car: [1.77, 1.49, 4.26], taxi: [1.84, 1.55, 4.72], van: [2.0, 2.06, 5.84] } as const;
const boxSpots = (spots: readonly InstanceSpot[], height: number): InstanceSpot[] => spots.map((s) => ({ ...s, y: height / 2 }));
const CAR_BOX_SPOTS = boxSpots(CAR_SPOTS, CAR_BOX.car[1]);
const TAXI_BOX_SPOTS = boxSpots(TAXI_SPOTS, CAR_BOX.taxi[1]);
const VAN_BOX_SPOTS = boxSpots(VAN_SPOTS, CAR_BOX.van[1]);

function CarBoxes({ spots, size, color }: { spots: readonly InstanceSpot[]; size: readonly [number, number, number]; color: string }) {
   return (
      <Instanced spots={spots}>
         <boxGeometry args={[size[0], size[1], size[2]]} />
         <meshStandardMaterial color={color} roughness={0.6} />
      </Instanced>
   );
}

function ParkedCars() {
   return (
      <group name="decor-cars">
         <InstancedModel asset={ASSETS.car} spots={CAR_SPOTS} fallback={<CarBoxes spots={CAR_BOX_SPOTS} size={CAR_BOX.car} color={ASSETS.car.fallbackColor} />} />
         <InstancedModel asset={ASSETS.taxi} spots={TAXI_SPOTS} fallback={<CarBoxes spots={TAXI_BOX_SPOTS} size={CAR_BOX.taxi} color={ASSETS.taxi.fallbackColor} />} />
         <InstancedModel asset={ASSETS.van} spots={VAN_SPOTS} fallback={<CarBoxes spots={VAN_BOX_SPOTS} size={CAR_BOX.van} color={ASSETS.van.fallbackColor} />} />
      </group>
   );
}

// ---------- pigeons (park) ----------

const X_AXIS = new Vector3(1, 0, 0);
/** One piece of the bird: a sphere stretched to radii (rx, ry, rz) at (x, y, z), tipped `tilt` about x. */
const piece = (x: number, y: number, z: number, rx: number, ry: number, rz: number, tilt = 0): Matrix4 =>
   new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(X_AXIS, tilt), new Vector3(rx, ry, rz));

/**
 * The park's pigeon, drawn in code at PIGEON_HEIGHT (0.475, half the runner), feet on y = 0 at the
 * origin, head at -z (yaw 0 faces away from the camera): body, neck, head, a tail tipped up and two
 * pink legs, six pieces of one 10 x 6 sphere (100 triangles each), one material, one draw call for
 * the whole flock. Fresh per Scene mount; free it with disposePigeonParts.
 */
export function createPigeonParts(): InstancePart[] {
   const sphere = new SphereGeometry(1, 10, 6);
   return [
      {
         geometry: sphere,
         material: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.7 }),
         locals: [
            piece(0, 0.19, 0, 0.11, 0.105, 0.19),
            piece(0, 0.3, -0.11, 0.07, 0.085, 0.07),
            piece(0, 0.4, -0.14, 0.075, 0.075, 0.075),
            piece(0, 0.205, 0.18, 0.06, 0.022, 0.09, -0.25),
            piece(0.035, 0.05, -0.03, 0.013, 0.05, 0.013),
            piece(-0.035, 0.05, -0.03, 0.013, 0.05, 0.013),
         ],
         colors: [COLORS.pigeon, COLORS.pigeonNeck, COLORS.pigeonHead, COLORS.pigeonTail, COLORS.pigeonLeg, COLORS.pigeonLeg].map((c) => new Color(c)),
      },
   ];
}

export function disposePigeonParts(parts: readonly InstancePart[]): void {
   for (const part of parts) {
      part.geometry.dispose();
      for (const material of Array.isArray(part.material) ? part.material : [part.material]) material.dispose();
   }
}

const P = new Vector3();
const Q = new Quaternion();
const E = new Euler(0, 0, 0, "YXZ");
const ONE = new Vector3(1, 1, 1);

interface FlockState {
   scare: Float32Array;
   fleeing: Uint8Array;
   pose: ReturnType<typeof createPigeonPose>;
}

const PigeonFlock = memo(function PigeonFlock({ run }: { run: CleanRun }) {
   const time = useGameTime();
   const [flock] = useState<FlockState>(() => ({
      scare: new Float32Array(PIGEON_HOMES.length),
      fleeing: new Uint8Array(PIGEON_HOMES.length),
      pose: createPigeonPose(),
   }));
   // one geometry and material per mount (every Retry), freed on unmount
   const [parts] = useState(createPigeonParts);
   useEffect(() => () => disposePigeonParts(parts), [parts]);

   const update = useCallback(
      (i: number, matrix: Matrix4) => {
         const home = PIGEON_HOMES[i];
         const r = run.runner;
         // only the park's runner startles them (the park group is hidden on the other maps)
         const distance = run.map === 0 ? Math.hypot(r.x - home.x, r.z - home.z) : Infinity;
         const before = flock.scare[i];
         const scare = stepScare(before, distance, time.delta);
         if (scare !== before) flock.fleeing[i] = scare > before ? 1 : 0;
         flock.scare[i] = scare;
         const pose = pigeonPose(home, time.now, scare, flock.fleeing[i] === 1, flock.pose);
         P.set(pose.x, pose.y, pose.z);
         Q.setFromEuler(E.set(pose.pitch, pose.yaw, 0, "YXZ"));
         matrix.compose(P, Q, ONE);
      },
      [run, time, flock]
   );

   return (
      <group name="decor-pigeons">
         <DynamicInstanced count={PIGEON_HOMES.length} update={update} parts={parts} name="pigeons" />
      </group>
   );
});

// ---------- per map ----------

/** The park's lawn beyond the floor and its pigeons. */
export const ParkDecor = memo(function ParkDecor({ run }: { run: CleanRun }) {
   return (
      <group name="decor-park">
         <Surround color={COLORS.verge} />
         <PigeonFlock run={run} />
      </group>
   );
});

/** The city block's streets: asphalt, kerb, the far street's centre line and the parked cars. */
export const CityDecor = memo(function CityDecor() {
   return (
      <group name="decor-city">
         <Surround color={COLORS.asphalt} />
         <Instanced spots={KERB_SPOTS} name="decor-kerb">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.kerb} roughness={0.85} />
         </Instanced>
         <Instanced spots={DASH_SPOTS} name="decor-line">
            <boxGeometry args={[1, 0.004, 1]} />
            <meshStandardMaterial color={COLORS.line} roughness={0.9} />
         </Instanced>
         <Suspense fallback={null}>
            <ParkedCars />
         </Suspense>
      </group>
   );
});

// ---------- per-level district scenery (Levels 2–5) ----------

/** Level 2 — City Square: limestone plaza surround, civic balustrade, fountain, townhouses, Victorian lamps & hedges. */
export const CitySquareDecor = memo(function CitySquareDecor({ map, run }: { map: number; run: CleanRun }) {
   const surround = map === 0 ? "#466e56" : map === 1 ? "#5c6877" : "#c7b282";
   return (
      <group name="decor-city-square">
         <Surround color={surround} />
         <Instanced spots={KERB_SPOTS} name="decor-square-kerb">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.75} />
         </Instanced>
         <Instanced spots={CITY_SQUARE_SPOTS.pillars} name="decor-square-pillars">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
         </Instanced>
         {/* Fountain water basin plinth on the north civic terrace */}
         <mesh position={[0, 0.12, -17.6]} name="decor-square-basin">
            <cylinderGeometry args={[1.65, 1.8, 0.24, 16]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.6} />
         </mesh>
         <mesh position={[0, 0.25, -17.6]} rotation-x={-Math.PI / 2} name="decor-square-water">
            <circleGeometry args={[1.45, 20]} />
            <meshStandardMaterial color="#38bdf8" roughness={0.25} metalness={0.15} />
         </mesh>
         {map === 0 && <PigeonFlock run={run} />}
         <Suspense fallback={null}>
            <InstancedModel asset={ASSETS.parkFountain} spots={CITY_SQUARE_SPOTS.fountain} fallback={null} />
            <InstancedModel asset={ASSETS.townhouseBlock} spots={CITY_SQUARE_SPOTS.townhouses} fallback={null} />
            <InstancedModel asset={ASSETS.victorianLamp} spots={CITY_SQUARE_SPOTS.lamps} fallback={null} />
            <InstancedModel asset={ASSETS.parkBush} spots={CITY_SQUARE_SPOTS.bushes} fallback={null} />
         </Suspense>
      </group>
   );
});

/** Level 3 — Shopping Street: brick promenade surround, corner shops, café kiosks, bus shelter, traffic lights & parked vehicles. */
export const ShoppingStreetDecor = memo(function ShoppingStreetDecor({ map }: { map: number }) {
   const surround = map === 0 ? "#4d6b44" : map === 1 ? "#574f4a" : "#cfa96e";
   return (
      <group name="decor-shopping-street">
         <Surround color={surround} />
         <Instanced spots={KERB_SPOTS} name="decor-shopping-kerb">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#fed7aa" roughness={0.8} />
         </Instanced>
         <Instanced spots={DASH_SPOTS} name="decor-shopping-line">
            <boxGeometry args={[1, 0.004, 1]} />
            <meshStandardMaterial color="#fde047" roughness={0.85} />
         </Instanced>
         <Instanced spots={SHOPPING_STREET_SPOTS.bollards} name="decor-shopping-bollards">
            <cylinderGeometry args={[0.5, 0.55, 1, 10]} />
            <meshStandardMaterial color="#b45309" roughness={0.6} metalness={0.25} />
         </Instanced>
         <Suspense fallback={null}>
            <InstancedModel asset={ASSETS.cornerShop} spots={SHOPPING_STREET_SPOTS.cornerShops} fallback={null} />
            <InstancedModel asset={ASSETS.zooKiosk} spots={SHOPPING_STREET_SPOTS.kiosks} fallback={null} />
            <InstancedModel asset={ASSETS.busStop} spots={SHOPPING_STREET_SPOTS.busStop} fallback={null} />
            <InstancedModel asset={ASSETS.trafficLight} spots={SHOPPING_STREET_SPOTS.trafficLights} fallback={null} />
            {map === 1 && <ParkedCars />}
         </Suspense>
      </group>
   );
});

/** Level 4 — River Walk: deep river channel, stone embankment quay wall, bollards, wooden footbridge, rowboats, buoys & night lamps. */
export const RiverWalkDecor = memo(function RiverWalkDecor({ map }: { map: number }) {
   const surround = map === 0 ? "#1e3a5f" : map === 1 ? "#172554" : "#1e40af";
   return (
      <group name="decor-river-walk">
         <Surround color={surround} />
         {/* Stone quay embankment wall along the north river edge (outside DECOR_KEEP_OUT) */}
         <Instanced spots={KERB_SPOTS} name="decor-river-quay">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.8} />
         </Instanced>
         <Instanced spots={RIVER_WALK_SPOTS.quayBollards} name="decor-river-bollards">
            <cylinderGeometry args={[0.45, 0.55, 1, 10]} />
            <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.4} />
         </Instanced>
         {/* Shimmering river channel strip beyond the north quay wall */}
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -18.2]} name="decor-river-water">
            <planeGeometry args={[36, 6.4]} />
            <meshStandardMaterial color="#0284c7" roughness={0.2} metalness={0.3} />
         </mesh>
         <Suspense fallback={null}>
            <InstancedModel asset={ASSETS.woodenFootbridge} spots={RIVER_WALK_SPOTS.bridge} fallback={null} />
            <InstancedModel asset={ASSETS.rowboat} spots={RIVER_WALK_SPOTS.rowboats} fallback={null} />
            <InstancedModel asset={ASSETS.harbourBuoy} spots={RIVER_WALK_SPOTS.buoys} fallback={null} />
            <InstancedModel asset={ASSETS.streetLampNight} spots={RIVER_WALK_SPOTS.nightLamps} fallback={null} />
            <InstancedModel asset={ASSETS.beachRocks} spots={RIVER_WALK_SPOTS.rocks} fallback={null} />
         </Suspense>
      </group>
   );
});

/** Level 5 — Festival Cleanup: festival stalls, tents, entrance arch, stage deck & colourful bunting posts. */
export const FestivalCleanupDecor = memo(function FestivalCleanupDecor({ map }: { map: number }) {
   const surround = map === 0 ? "#3f6a3a" : map === 1 ? "#584c63" : "#c99b62";
   return (
      <group name="decor-festival-cleanup">
         <Surround color={surround} />
         <Instanced spots={KERB_SPOTS} name="decor-festival-kerb">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.7} />
         </Instanced>
         <Instanced spots={FESTIVAL_CLEANUP_SPOTS.buntingPosts} name="decor-festival-posts">
            <cylinderGeometry args={[0.5, 0.5, 1, 8]} />
            <meshStandardMaterial color="#fef08a" roughness={0.5} />
         </Instanced>
         <Instanced spots={FESTIVAL_CLEANUP_SPOTS.pennants} name="decor-festival-pennants">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={0.35} roughness={0.5} />
         </Instanced>
         {/* Festival stage deck behind the arch */}
         <mesh position={[0, 0.18, -17.5]} name="decor-festival-stage">
            <boxGeometry args={[7.2, 0.36, 2.2]} />
            <meshStandardMaterial color="#7c2d12" roughness={0.75} />
         </mesh>
         <Suspense fallback={null}>
            <InstancedModel asset={ASSETS.festivalStall} spots={FESTIVAL_STALL_SPOTS} fallback={null} />
            <InstancedModel asset={ASSETS.festivalTent} spots={FESTIVAL_CLEANUP_SPOTS.tents} fallback={null} />
            <InstancedModel asset={ASSETS.finishArch} spots={FESTIVAL_CLEANUP_SPOTS.arch} fallback={null} />
         </Suspense>
      </group>
   );
});

export const DistrictDecor = memo(function DistrictDecor({ levelId, map, run }: { levelId: LevelId; map: number; run: CleanRun }) {
   if (levelId === 1) {
      if (map === 0) return <ParkDecor run={run} />;
      if (map === 1) return <CityDecor />;
      return null;
   }
   if (levelId === 2) return <CitySquareDecor map={map} run={run} />;
   if (levelId === 3) return <ShoppingStreetDecor map={map} />;
   if (levelId === 4) return <RiverWalkDecor map={map} />;
   return <FestivalCleanupDecor map={map} />;
});
