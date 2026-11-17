"use client";

// The cab and the traffic on the road: GLB bodies (their baked wheels cut out) on code-built wheels that
// roll with the distance driven and steer (the cab's front wheels follow the stick, a car's follow its
// corner turn), soft contact shadows, head and tail lights (brighter tail lights while braking or
// waiting) and, at night, a warm headlight beam on the road. Every pool is one draw call per mesh.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
   AdditiveBlending,
   BoxGeometry,
   CanvasTexture,
   Color,
   CylinderGeometry,
   Euler,
   LatheGeometry,
   Matrix4,
   MeshBasicMaterial,
   MeshStandardMaterial,
   PlaneGeometry,
   Quaternion,
   Vector2,
   Vector3,
   type BufferGeometry,
   type Group,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { DynamicInstanced, type InstancePart } from "@/arcade3d/core/render";
import { ASSETS, CAB_WHEELS, CAR_WHEELS, FIT, type WheelSet } from "./assets";
import { COLORS } from "./looks";
import { TaxiPrimitive } from "./Primitives";
import { DEAD, STOP_SPEED, TURN_R, type Run } from "./rules";

const M = new Matrix4();
const W = new Matrix4();
const Q = new Quaternion();
const Q2 = new Quaternion();
const E = new Euler();
const V = new Vector3();
const S = new Vector3();
const UP = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0);

const TINTS = [COLORS.carA, COLORS.carB, COLORS.carC, COLORS.carD, COLORS.carE, COLORS.carF].map((c) => new Color(c));
const TAIL_DIM = new Color("#7f1d1d");
const TAIL_BRAKE = new Color("#ff3b30");
const HEAD_ON = new Color(COLORS.headlight);

/** Lamp spots on each body (metres; the body faces +z): head lamps at the nose, tail lamps at the back. */
const CAB_LAMPS = { x: 0.56, headY: 0.66, headZ: FIT.cabLength / 2 - 0.2, tailY: 0.74, tailZ: -FIT.cabLength / 2 + 0.12 };
const CAR_LAMPS = { x: 0.52, headY: 0.8, headZ: FIT.carLength / 2 - 0.16, tailY: 0.86, tailZ: -FIT.carLength / 2 + 0.12 };
/** The front wheels' steer while a car drives its corner (a right turn). */
const CAR_TURN_STEER = -Math.min(0.5, Math.atan((CAR_WHEELS.front - CAR_WHEELS.rear) / TURN_R));
/** The cab's steer at full stick. */
const CAB_STEER = 0.5;

/** A unit wheel along x (radius 1, width 1, outer face at +x): a rounded tyre, a dark alloy dish, five silver spokes and a hub. */
function useWheelParts(): InstancePart[] {
   const parts = useMemo(() => {
      const profile = [
         [0.64, -0.5],
         [0.88, -0.5],
         [1.0, -0.32],
         [1.0, 0.32],
         [0.88, 0.5],
         [0.64, 0.5],
         [0.64, -0.5],
      ].map(([r, y]) => new Vector2(r, y));
      const toX = (g: BufferGeometry) => g.rotateZ(-Math.PI / 2);
      // 20 x 6 x 2 = 240 triangles of tyre, 80 of dish, 108 of spokes and hub: 428 a wheel
      const tyre = toX(new LatheGeometry(profile, 20));
      const dish = toX(new CylinderGeometry(0.66, 0.66, 0.7, 20)).translate(-0.05, 0, 0);
      const pieces: BufferGeometry[] = [toX(new CylinderGeometry(0.17, 0.2, 0.18, 12)).translate(0.36, 0, 0)];
      for (let k = 0; k < 5; k++) {
         const spoke = new BoxGeometry(0.12, 0.13, 0.5).translate(0.33, 0, 0.36);
         spoke.rotateX((k * Math.PI * 2) / 5);
         pieces.push(spoke);
      }
      const spokes = mergeGeometries(pieces.map((g) => g.toNonIndexed()));
      pieces.forEach((g) => g.dispose());
      return [
         { geometry: tyre, material: new MeshStandardMaterial({ color: "#20242b", roughness: 0.82, metalness: 0 }) },
         { geometry: dish, material: new MeshStandardMaterial({ color: "#3b4350", roughness: 0.45, metalness: 0.6 }) },
         { geometry: spokes, material: new MeshStandardMaterial({ color: "#dfe4ea", roughness: 0.28, metalness: 0.85 }) },
      ];
   }, []);
   useDispose(parts);
   return parts;
}

function useDispose(parts: readonly InstancePart[]) {
   useEffect(
      () => () => {
         for (const part of parts) {
            part.geometry.dispose();
            const m = part.material;
            if (Array.isArray(m)) m.forEach((x) => x.dispose());
            else m.dispose();
            const map = (m as MeshBasicMaterial).map;
            if (map) map.dispose();
         }
      },
      [parts]
   );
}

/** A soft dark ellipse under a body (unit square, scaled per copy). */
function radialTexture(inner: string, outer: string): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = c.height = 64;
   const ctx = c.getContext("2d")!;
   const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
   g.addColorStop(0, inner);
   g.addColorStop(1, outer);
   ctx.fillStyle = g;
   ctx.fillRect(0, 0, 64, 64);
   return new CanvasTexture(c);
}

/** One wheel's matrix: the body (x, z, yaw) times the wheel's spot, steer, roll and size. */
function wheelMatrix(out: Matrix4, x: number, z: number, yaw: number, w: WheelSet, k: number, steer: number, roll: number): Matrix4 {
   const front = k < 2;
   const left = k % 2 === 0;
   // body
   E.set(0, yaw, 0);
   Q.setFromEuler(E);
   V.set(x, 0, z);
   S.set(1, 1, 1);
   M.compose(V, Q, S);
   // the wheel in the body: left (+x) wheels show their outer face at +x, right ones are turned round
   Q.setFromAxisAngle(UP, (front ? steer : 0) + (left ? 0 : Math.PI));
   Q2.setFromAxisAngle(X, left ? roll : -roll);
   Q.multiply(Q2);
   V.set(left ? w.x : -w.x, w.radius, front ? w.front : w.rear);
   S.set(w.width, w.radius, w.radius);
   W.compose(V, Q, S);
   return out.multiplyMatrices(M, W);
}

export interface CabState {
   steer: number;
   roll: number;
}

/** The cab body (a GLB on code wheels), its shadow and lamps; the traffic pool with its wheels, shadows and lamps. */
/** `lamps`: head lamps lit (sunset and night); brake lamps light whenever a car brakes or waits. */
export function Vehicles({ run, night, lamps, cab }: { run: Run; night: boolean; lamps: boolean; cab: CabState }) {
   const time = useGameTime();
   const body = useRef<Group>(null);
   const traffic = Math.max(1, run.cars.length);
   const wheels = useWheelParts();
   const shadowParts = useMemo<InstancePart[]>(
      () => [{ geometry: new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), material: new MeshBasicMaterial({ map: radialTexture("rgba(0,0,0,0.55)", "rgba(0,0,0,0)"), transparent: true, depthWrite: false }) }],
      []
   );
   useDispose(shadowParts);
   const lampParts = useMemo<InstancePart[]>(() => {
      const lamp = new BoxGeometry(0.4, 0.1, 0.04);
      const pair = (x: number) => [new Matrix4().makeTranslation(x, 0, 0), new Matrix4().makeTranslation(-x, 0, 0)];
      return [
         { geometry: lamp, material: new MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), locals: pair(1) },
      ];
   }, []);
   useDispose(lampParts);
   const beamParts = useMemo<InstancePart[]>(
      () => [{ geometry: new PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), material: new MeshBasicMaterial({ map: radialTexture("rgba(255,243,196,0.55)", "rgba(255,243,196,0)"), transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false }) }],
      []
   );
   useDispose(beamParts);

   // the cab body follows the run (the rules own its position)
   useFrame(() => {
      const g = body.current;
      if (!g) return;
      g.position.set(run.x, 0, run.z);
      g.rotation.y = run.yaw;
      // a little body roll into the turn and pitch under braking / acceleration
      const lean = cab.steer * Math.min(1, Math.abs(run.speed) / 10) * 0.05;
      g.rotation.z = -lean;
      const dt = Math.min(0.05, time.delta || 0);
      cab.steer += (-run.moveX * CAB_STEER - cab.steer) * Math.min(1, dt * 10);
      cab.roll += (run.speed * dt) / CAB_WHEELS.radius;
   }, FRAME_PRIORITY.visuals - 0.02);

   const placeCar = (i: number, m: Matrix4, color: Color) => {
      const car = run.cars[i];
      if (!car) return false;
      E.set(0, car.yaw, 0);
      Q.setFromEuler(E);
      V.set(car.x, 0, car.z);
      S.set(1, 1, 1);
      m.compose(V, Q, S);
      color.copy(TINTS[(i * 7 + run.seed) % TINTS.length]);
   };
   // wheels: 4 of the cab, then 4 per car (front-left, front-right, rear-left, rear-right)
   const placeWheel = (i: number, m: Matrix4) => {
      const v = (i / 4) | 0;
      const k = i % 4;
      if (v === 0) {
         wheelMatrix(m, run.x, run.z, run.yaw, CAB_WHEELS, k, cab.steer, cab.roll);
         return;
      }
      const car = run.cars[v - 1];
      if (!car) return false;
      wheelMatrix(m, car.x, car.z, car.yaw, CAR_WHEELS, k, car.turn > 0 ? CAR_TURN_STEER : 0, car.odo / CAR_WHEELS.radius);
   };
   const placeShadow = (i: number, m: Matrix4) => {
      const cabCopy = i === 0;
      const car = cabCopy ? null : run.cars[i - 1];
      if (!cabCopy && !car) return false;
      E.set(0, cabCopy ? run.yaw : car!.yaw, 0);
      Q.setFromEuler(E);
      V.set(cabCopy ? run.x : car!.x, 0.02, cabCopy ? run.z : car!.z);
      S.set(cabCopy ? 2.5 : 2.5, 1, (cabCopy ? FIT.cabLength : FIT.carLength) * 1.12);
      m.compose(V, Q, S);
   };
   const lampMatrix = (m: Matrix4, x: number, z: number, yaw: number, lx: number, ly: number, lz: number) => {
      E.set(0, yaw, 0);
      Q.setFromEuler(E);
      // the copy stands at the lamps' centre line; its two pieces sit at +-1 in x, so the x scale spreads them to +-lx
      V.set(0, ly, lz).applyQuaternion(Q);
      V.x += x;
      V.z += z;
      S.set(lx, 1, 1);
      m.compose(V, Q, S);
   };
   // head lamps: copy 0 the cab, then the cars
   const placeHead = (i: number, m: Matrix4, color: Color) => {
      const car = i === 0 ? null : run.cars[i - 1];
      if (!lamps || (i > 0 && !car)) return false;
      const L = i === 0 ? CAB_LAMPS : CAR_LAMPS;
      lampMatrix(m, car ? car.x : run.x, car ? car.z : run.z, car ? car.yaw : run.yaw, L.x, L.headY, L.headZ);
      color.copy(HEAD_ON).multiplyScalar(night ? 1.6 : 1.1);
   };
   const placeTail = (i: number, m: Matrix4, color: Color) => {
      const car = i === 0 ? null : run.cars[i - 1];
      if (i > 0 && !car) return false;
      const L = i === 0 ? CAB_LAMPS : CAR_LAMPS;
      lampMatrix(m, car ? car.x : run.x, car ? car.z : run.z, car ? car.yaw : run.yaw, L.x, L.tailY, L.tailZ);
      const braking = car ? car.v === 0 : (run.moveY > DEAD && run.speed > 0) || Math.abs(run.speed) < STOP_SPEED;
      // by day only the brake lamps show; at sunset and night the tail lamps glow dim between brakes
      if (!braking && !lamps) return false;
      color.copy(braking ? TAIL_BRAKE : TAIL_DIM).multiplyScalar(braking ? 1.4 : 1);
   };
   const placeBeam = (i: number, m: Matrix4) => {
      const car = i === 0 ? null : run.cars[i - 1];
      if (i > 0 && !car) return false;
      const yaw = car ? car.yaw : run.yaw;
      const nose = (i === 0 ? FIT.cabLength : FIT.carLength) / 2;
      E.set(0, yaw, 0);
      Q.setFromEuler(E);
      V.set(0, 0.03, nose).applyQuaternion(Q);
      V.x += car ? car.x : run.x;
      V.z += car ? car.z : run.z;
      S.set(4.2, 1, 9);
      m.compose(V, Q, S);
   };

   return (
      <>
         <group ref={body}>
            <Model asset={ASSETS.taxiCab} fallback={<TaxiPrimitive />} />
         </group>
         <DynamicInstancedModel asset={ASSETS.trafficCar} count={traffic} update={placeCar} tinted name="traffic" />
         <DynamicInstanced count={4 * (1 + traffic)} update={placeWheel} parts={wheels} name="wheels" />
         <DynamicInstanced count={1 + traffic} update={placeShadow} parts={shadowParts} name="car-shadows" />
         <DynamicInstanced count={1 + traffic} update={placeHead} parts={lampParts} tinted name="head-lamps" />
         <DynamicInstanced count={1 + traffic} update={placeTail} parts={lampParts} tinted name="tail-lamps" />
         {night && <DynamicInstanced count={1 + traffic} update={placeBeam} parts={beamParts} name="beams" />}
      </>
   );
}
