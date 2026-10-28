"use client";

// Feedback round the cab: a floating guide arrow towards the active pad, tyre smoke on hard launches and
// corners, a pop of gold coins on every drop-off, and a soft room reflection on the car paint.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CylinderGeometry, Euler, Matrix4, MeshStandardMaterial, PMREMGenerator, Quaternion, Shape, ShapeGeometry, Vector3, type Group, type MeshBasicMaterial } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { DynamicInstanced, type InstancePart } from "@/arcade3d/core/render";
import { CAB_WHEELS, FIT } from "./assets";
import { COLORS } from "./looks";
import { DEAD, TOP_SPEED, activePad, type Run } from "./rules";

const E = new Euler();
const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3();
const AT = { x: 0, y: 0, z: 0 };

/** A soft studio reflection for the paint and glass (no file: three's RoomEnvironment, prefiltered once). */
export function PaintReflections({ intensity }: { intensity: number }) {
   const gl = useThree((s) => s.gl);
   const scene = useThree((s) => s.scene);
   useEffect(() => {
      const pmrem = new PMREMGenerator(gl);
      const room = new RoomEnvironment();
      const env = pmrem.fromScene(room, 0.04).texture;
      const before = scene.environment;
      const beforeIntensity = scene.environmentIntensity;
      scene.environment = env;
      scene.environmentIntensity = intensity;
      return () => {
         scene.environment = before;
         scene.environmentIntensity = beforeIntensity;
         env.dispose();
         room.dispose();
         pmrem.dispose();
      };
   }, [gl, scene, intensity]);
   return null;
}

/** A gold chevron hovering a few metres ahead of the cab, pointing at the active pad (pickup gold, drop-off green). */
export function GuideArrow({ run }: { run: Run }) {
   const ref = useRef<Group>(null);
   const mat = useRef<MeshBasicMaterial>(null);
   const time = useGameTime();
   const geo = useMemo(() => {
      const s = new Shape();
      s.moveTo(0, 0.6);
      s.lineTo(0.55, 0);
      s.lineTo(0.25, 0);
      s.lineTo(0.25, -0.5);
      s.lineTo(-0.25, -0.5);
      s.lineTo(-0.25, 0);
      s.lineTo(-0.55, 0);
      s.closePath();
      // the tip along +z once laid flat
      return new ShapeGeometry(s).rotateX(-Math.PI / 2).rotateY(Math.PI);
   }, []);
   useEffect(() => () => geo.dispose(), [geo]);
   useFrame(() => {
      const g = ref.current;
      if (!g) return;
      const pad = activePad(run);
      const dx = pad ? pad.x - run.x : 0;
      const dz = pad ? pad.z - run.z : 0;
      const d = Math.hypot(dx, dz);
      g.visible = !!pad && d > 9 && !run.over;
      if (!g.visible) return;
      const ahead = 4.2;
      g.position.set(run.x + (dx / d) * ahead, 2.1 + Math.sin(time.now * 5) * 0.12, run.z + (dz / d) * ahead);
      g.rotation.set(0, Math.atan2(dx, dz), 0);
      const s = 1.5 + Math.sin(time.now * 5) * 0.08;
      g.scale.set(s, s, s);
      mat.current?.color.set(run.phase === 0 ? COLORS.arrow : COLORS.dropPad);
   }, FRAME_PRIORITY.visuals);
   return (
      <group ref={ref}>
         <mesh geometry={geo} renderOrder={4}>
            <meshBasicMaterial ref={mat} color={COLORS.arrow} transparent opacity={0.92} depthWrite={false} toneMapped={false} side={2} />
         </mesh>
      </group>
   );
}

/** Tyre smoke behind the rear wheels on a hard launch or a fast, hard corner (fx puffs, rate limited). */
export function TyreSmoke({ run }: { run: Run }) {
   const fx = useFx();
   const time = useGameTime();
   const wait = useRef(0);
   useFrame(() => {
      const dt = Math.min(0.05, time.delta || 0);
      wait.current -= dt;
      if (wait.current > 0 || run.over) return;
      const speed = run.speed;
      const launch = run.moveY < -DEAD && speed > 0.5 && speed < 0.4 * TOP_SPEED;
      const corner = Math.abs(run.moveX) > 0.75 && speed > 0.55 * TOP_SPEED;
      if (!launch && !corner) return;
      wait.current = launch ? 0.09 : 0.12;
      const fx0 = Math.sin(run.yaw);
      const fz0 = Math.cos(run.yaw);
      for (const side of [-1, 1]) {
         AT.x = run.x + fx0 * CAB_WHEELS.rear + fz0 * side * CAB_WHEELS.x;
         AT.y = 0.25;
         AT.z = run.z + fz0 * CAB_WHEELS.rear - fx0 * side * CAB_WHEELS.x;
         fx.burst("puff", AT, 1);
      }
   }, FRAME_PRIORITY.visuals);
   return null;
}

const COINS = 10;
/** A 0.42 m gold coin standing on its rim (a short cylinder with its faces along z): 72 triangles, not the 1000 of the coin GLB. */
const COIN_D = 0.42;

interface Coin {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   age: number;
   spin: number;
}

/** Call `pop(x, z)` on a drop-off: gold coins burst out of the cab roof, spin and fall back. */
export function useCoinPop() {
   const coins = useMemo<Coin[]>(() => Array.from({ length: COINS }, () => ({ x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0, age: 9, spin: 0 })), []);
   const pop = (x: number, z: number) => {
      for (let i = 0; i < COINS; i++) {
         const a = (i / COINS) * Math.PI * 2 + i * 0.37;
         const c = coins[i];
         c.x = x;
         c.y = 1.7;
         c.z = z;
         c.vx = Math.cos(a) * (1.4 + (i % 3) * 0.5);
         c.vz = Math.sin(a) * (1.4 + (i % 3) * 0.5);
         c.vy = 6 + (i % 4) * 0.8;
         c.age = 0;
         c.spin = (i % 2 ? 1 : -1) * (8 + i);
      }
   };
   return { coins, pop };
}

export function CoinPop({ coins }: { coins: Coin[] }) {
   const time = useGameTime();
   const parts = useMemo<InstancePart[]>(
      () => [{ geometry: new CylinderGeometry(COIN_D / 2, COIN_D / 2, 0.06, 18).rotateX(Math.PI / 2), material: new MeshStandardMaterial({ color: "#fbbf24", emissive: "#b45309", emissiveIntensity: 0.35, metalness: 0.8, roughness: 0.3 }) }],
      []
   );
   useEffect(
      () => () => {
         parts[0].geometry.dispose();
         (parts[0].material as MeshStandardMaterial).dispose();
      },
      [parts]
   );
   useFrame(() => {
      const dt = Math.min(0.05, time.delta || 0);
      for (const c of coins) {
         if (c.age > 1.4) continue;
         c.age += dt;
         c.vy -= 16 * dt;
         c.x += c.vx * dt;
         c.y += c.vy * dt;
         c.z += c.vz * dt;
         if (c.y < 0.25) {
            c.y = 0.25;
            c.vy = Math.abs(c.vy) * 0.35;
            c.vx *= 0.6;
            c.vz *= 0.6;
         }
      }
   }, FRAME_PRIORITY.visuals - 0.01);
   const place = (i: number, m: Matrix4) => {
      const c = coins[i];
      if (c.age > 1.4) return false;
      E.set(0, c.age * c.spin, 0);
      Q.setFromEuler(E);
      V.set(c.x, c.y, c.z);
      const k = c.age < 1.1 ? Math.min(1, c.age * 8) : Math.max(0, (1.4 - c.age) / 0.3);
      S.set(k, k, k);
      m.compose(V, Q, S);
   };
   return <DynamicInstanced count={COINS} update={place} parts={parts} name="coin-pop" />;
}

/** The cab's height for fx (its roof). */
export const CAB_ROOF = FIT.cabLength * 0.33;
