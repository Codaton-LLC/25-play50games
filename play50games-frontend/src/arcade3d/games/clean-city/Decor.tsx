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
import { ASSETS } from "./assets";
import {
   CAR_SPOTS,
   DASH_SPOTS,
   KERB_SPOTS,
   PIGEON_HOMES,
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
const CAR_BOX = { car: [0.91, 0.8, 2.18], taxi: [0.95, 0.9, 2.42], van: [1.03, 1.0, 3.0] } as const;
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
