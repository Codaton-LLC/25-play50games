"use client";

// Clean the City decoration around the maps (README "Decor around the maps"): the ground beyond the
// floor, the city's kerb, street line and parked cars, the park's pigeons. Where everything stands
// is decorSpots.ts (pure, checked against the rules data by decorSpots.test.ts). Nothing here touches the run:
// the pigeons only read the runner's position to fly off when it comes close.
// - Cars: one <InstancedModel> per kind (one draw call each), static spots at module level.
// - Pigeons: one <DynamicInstancedModel> (one draw call), placed every frame from useGameTime()
//   (pause-safe, never state.clock), no allocation in the frame loop.
// - The GLBs load in their own <Suspense>: the run never waits for decoration.
import { Suspense, memo, useCallback, useEffect, useState } from "react";
import { Color, Euler, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from "three";
import { DynamicInstancedModel, InstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
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
   pigeonHead: "#5b6b82",
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

/**
 * A pigeon stand-in at the drawn size (0.47 tall, facing -z): body and head, one sphere geometry,
 * one draw call. Fresh per Scene mount; free it with disposePigeonStandIn.
 */
export function createPigeonStandIn(): InstancePart[] {
   const sphere = new SphereGeometry(1, 12, 8);
   const body = new Matrix4().compose(new Vector3(0, 0.19, 0.02), new Quaternion(), new Vector3(0.12, 0.12, 0.2));
   const head = new Matrix4().compose(new Vector3(0, 0.38, -0.13), new Quaternion(), new Vector3(0.08, 0.08, 0.08));
   return [
      {
         geometry: sphere,
         material: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.7 }),
         locals: [body, head],
         colors: [new Color(COLORS.pigeon), new Color(COLORS.pigeonHead)],
      },
   ];
}

export function disposePigeonStandIn(parts: readonly InstancePart[]): void {
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
   // one stand-in per mount (every Retry), freed on unmount
   const [standIn] = useState(createPigeonStandIn);
   useEffect(() => () => disposePigeonStandIn(standIn), [standIn]);

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
         <DynamicInstancedModel asset={ASSETS.pigeon} count={PIGEON_HOMES.length} update={update} fallbackParts={standIn} name="pigeons" />
      </group>
   );
});

// ---------- per map ----------

/** The park's lawn beyond the floor and its pigeons. */
export const ParkDecor = memo(function ParkDecor({ run }: { run: CleanRun }) {
   return (
      <group name="decor-park">
         <Surround color={COLORS.verge} />
         <Suspense fallback={null}>
            <PigeonFlock run={run} />
         </Suspense>
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
