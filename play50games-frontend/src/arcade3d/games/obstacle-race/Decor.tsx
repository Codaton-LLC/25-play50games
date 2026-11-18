"use client";

// Obstacle Race level decor: the per-level scenery (themes.ts holds the pure data and the
// play-area rule, this file draws it). Level 2 is a container yard — tower cranes, stacked
// containers, warning floats and a rail beacon per block row; level 3 is a harbor crossing —
// pilings and rope rails along the whole course, flags, and two overhead rope bridges the
// runner passes under; level 4 is a night arena — floodlight pylons with light cones, a
// sweeping cone tracking the bar and a dark crowd; level 5 is the sunset final — bunting over
// the course, a winners' podium with a trophy and crowds. Level 1 draws nothing (today's pool).
// Every static spot is proven to stay out of the play area (themes.ts playAreaClear,
// themes.test.ts). The dynamic pieces are looks only, never read by the rules: the beacons
// (level 2) flash as their block slides to their side, the sweep cones (level 4) rotate with
// the bar, and the confetti (level 5) bursts over the finish on a win.
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
   AdditiveBlending,
   BoxGeometry,
   Color,
   ConeGeometry,
   CylinderGeometry,
   DoubleSide,
   Euler,
   Group,
   InstancedMesh,
   Matrix4,
   MeshBasicMaterial,
   MeshStandardMaterial,
   PlaneGeometry,
   Quaternion,
   SphereGeometry,
   Vector3,
} from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInstanceMatrices, type InstanceSpot } from "@/arcade3d/core/render";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId } from "@/arcade3d/types";
import { createObstacleClock, obstacleMs, type ObstacleClock } from "./obstacleClock";
import { ColoredInstances, useDisposable } from "./Primitives";
import { barAngle, blockX, WATER_Y, type Course, type ObstacleRun } from "./rules";
import { decorOf } from "./themes";

// ---------- static pieces (one instanced mesh per shape) ----------

const boxSpots = (boxes: ReturnType<typeof decorOf>["boxes"]): { spots: InstanceSpot[]; colors: Color[] } => ({
   spots: boxes.map((b) => ({ x: b.x, y: b.y, z: b.z, rotY: b.rotY ?? 0, sx: b.sx, sy: b.sy, sz: b.sz })),
   colors: boxes.map((b) => new Color(b.color)),
});

const DecorBoxes = memo(function DecorBoxes({ boxes }: { boxes: ReturnType<typeof decorOf>["boxes"] }) {
   const { spots, colors } = useMemo(() => boxSpots(boxes), [boxes]);
   const res = useDisposable(() => ({ box: new BoxGeometry(1, 1, 1), mat: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.7 }) }));
   return <ColoredInstances spots={spots} colors={colors} geometry={res.box} material={res.mat} name="decor-boxes" />;
});

const DecorCylinders = memo(function DecorCylinders({ cylinders }: { cylinders: ReturnType<typeof decorOf>["cylinders"] }) {
   const { spots, colors } = useMemo(
      () => ({
         spots: cylinders.map((c) => ({ x: c.x, y: c.y + c.h / 2, z: c.z, sx: c.r, sy: c.h, sz: c.r })),
         colors: cylinders.map((c) => new Color(c.color)),
      }),
      [cylinders],
   );
   const res = useDisposable(() => ({ cyl: new CylinderGeometry(1, 1, 1, 12), mat: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.65 }) }));
   return <ColoredInstances spots={spots} colors={colors} geometry={res.cyl} material={res.mat} name="decor-cylinders" />;
});

const DecorTris = memo(function DecorTris({ tris }: { tris: ReturnType<typeof decorOf>["tris"] }) {
   const { spots, colors } = useMemo(
      () => ({
         spots: tris.map((t) => ({ x: t.x, y: t.y - 0.21, z: t.z })),
         colors: tris.map((t) => new Color(t.color)),
      }),
      [tris],
   );
   const res = useDisposable(() => ({
      tri: new PlaneGeometry(0.34, 0.42),
      mat: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.6, side: DoubleSide }),
   }));
   return <ColoredInstances spots={spots} colors={colors} geometry={res.tri} material={res.mat} name="decor-pennants" />;
});

/** One light cone per entry: a translucent additive shaft, the apex at the entry's position. */
const DecorCones = memo(function DecorCones({ cones }: { cones: ReturnType<typeof decorOf>["cones"] }) {
   const res = useDisposable(() => ({
      // a unit cone (apex up) moved so the apex sits at the origin and it opens downward
      cone: new ConeGeometry(1, 1, 20, 1, true).translate(0, -0.5, 0),
      mat: new MeshBasicMaterial({ color: "#93c5fd", transparent: true, opacity: 0.1, depthWrite: false, blending: AdditiveBlending, side: DoubleSide }),
   }));
   return (
      <group name="decor-light-cones">
         {cones.map((c, k) => (
            <mesh key={k} geometry={res.cone} material={res.mat} position={[c.x, c.y, c.z]} rotation-z={c.rotZ} scale={[c.r, c.h, c.r]} />
         ))}
      </group>
   );
});

// ---------- dynamic pieces (looks only) ----------

/** The rules ms the obstacles are drawn at this frame (the same clock Scene.tsx uses). */
function useVisualObstacleMs(run: ObstacleRun, clock: ObstacleClock): () => number {
   const time = useGameTime();
   return () => {
      const { phase, countdownMs } = useArcadeStore.getState();
      return obstacleMs(phase, countdownMs, run.simMs, clock, time.now);
   };
}

/**
 * The level-2 rail beacons (the twist): one light per block row per side. A beacon glows amber
 * as its block slides toward its side, telegraphing the blocks' rhythm without touching the rules.
 */
const BeaconLights = memo(function BeaconLights({ beacons, run }: { beacons: ReturnType<typeof decorOf>["beacons"]; run: ObstacleRun }) {
   const readMs = useVisualObstacleMs(run, useState(createObstacleClock)[0]);
   const ref = useRef<InstancedMesh>(null);
   const res = useDisposable(() => ({ sphere: new SphereGeometry(0.16, 10, 8), mat: new MeshBasicMaterial({ color: "#ffffff" }) }));
   const spots = useMemo(() => beacons.map((b) => ({ x: b.x, y: WATER_Y + 0.75, z: -b.p })), [beacons]);
   const dim = useMemo(() => new Color("#475569"), []);
   const bright = useMemo(() => new Color("#fbbf24"), []);
   const scratch = useMemo(() => new Color(), []);
   useInstanceMatrices(ref, spots);
   useLayoutEffect(() => {
      const mesh = ref.current;
      if (!mesh) return;
      for (let i = 0; i < beacons.length; i++) mesh.setColorAt(i, dim);
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
   }, [beacons, dim]);
   useFrame(() => {
      const mesh = ref.current;
      if (!mesh) return;
      const ms = readMs();
      for (let i = 0; i < beacons.length; i++) {
         const b = beacons[i];
         const target = Math.sign(b.x) * run.timing.blockTravel;
         const proximity = Math.max(0, 1 - Math.abs(blockX(b.block, ms, run.timing) - target) / 1.8);
         mesh.setColorAt(i, scratch.copy(dim).lerp(bright, proximity));
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
   });
   return <instancedMesh ref={ref} args={[res.sphere, res.mat, beacons.length]} name="decor-beacons" />;
});

/** A level-4 sweep cone: a light shaft from a floodlight pylon that rotates with the bar. */
const SweepCone = memo(function SweepCone({ apex, run }: { apex: { x: number; y: number; z: number; side: 1 | -1 }; run: ObstacleRun }) {
   const readMs = useVisualObstacleMs(run, useState(createObstacleClock)[0]);
   const group = useRef<Group>(null);
   const res = useDisposable(() => ({
      cone: new ConeGeometry(1, 1, 20, 1, true).translate(0, -0.5, 0),
      mat: new MeshBasicMaterial({ color: "#bfdbfe", transparent: true, opacity: 0.14, depthWrite: false, blending: AdditiveBlending, side: DoubleSide }),
   }));
   useFrame(() => {
      const g = group.current;
      if (!g) return;
      g.rotation.set(0, barAngle(readMs(), run.timing) * 0.75 + apex.side, -apex.side * 0.85);
   });
   return (
      <group ref={group} position={[apex.x, apex.y, apex.z]} name="decor-sweep-cone">
         <mesh geometry={res.cone} material={res.mat} scale={[3.4, 13.2, 3.4]} />
      </group>
   );
});

const CONFETTI = 90;
const CONFETTI_COLORS = ["#f59e0b", "#ef4444", "#f8fafc", "#fbbf24", "#a78bfa"];

/** The level-5 celebration: a confetti burst over the finish line through a win's result delay. */
const Confetti = memo(function Confetti({ line }: { line: number }) {
   const time = useGameTime();
   const ref = useRef<InstancedMesh>(null);
   const [state] = useState(() => ({ startedAt: -1 }));
   const res = useDisposable(() => ({
      quad: new PlaneGeometry(0.09, 0.14),
      mat: new MeshBasicMaterial({ color: "#ffffff", side: DoubleSide }),
   }));
   const colors = useMemo(() => Array.from({ length: CONFETTI }, (_u, i) => new Color(CONFETTI_COLORS[i % CONFETTI_COLORS.length])), []);
   const m = useMemo(() => new Matrix4(), []);
   const p = useMemo(() => new Vector3(), []);
   const q = useMemo(() => new Quaternion(), []);
   const e = useMemo(() => new Euler(), []);
   const one = useMemo(() => new Vector3(1, 1, 1), []);
   useLayoutEffect(() => {
      const mesh = ref.current;
      if (!mesh) return;
      for (let i = 0; i < CONFETTI; i++) mesh.setColorAt(i, colors[i]);
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
   }, [colors]);
   useFrame(() => {
      const mesh = ref.current;
      if (!mesh) return;
      const { phase, endReason } = useArcadeStore.getState();
      if (phase === "over" && endReason === "win") {
         if (state.startedAt < 0) state.startedAt = time.now;
      } else {
         state.startedAt = -1;
      }
      const el = state.startedAt < 0 ? -1 : time.now - state.startedAt;
      mesh.visible = el >= 0 && el < 2.2;
      if (!mesh.visible) return;
      for (let i = 0; i < CONFETTI; i++) {
         const a = (i / CONFETTI) * Math.PI * 2 + (i % 7);
         const speed = 2 + (i % 5) * 0.7;
         const drift = 1 - 0.2 * el;
         p.set(Math.cos(a) * speed * el * drift, 2.6 + 2.8 * el - 2.2 * el * el + Math.sin(el * 6 + i) * 0.15, Math.sin(a) * speed * el * 0.7 * drift - line);
         q.setFromEuler(e.set(el * (2 + (i % 3)), i, el * (1.5 + (i % 4))));
         mesh.setMatrixAt(i, m.compose(p, q, one));
      }
      mesh.instanceMatrix.needsUpdate = true;
   });
   return <instancedMesh ref={ref} args={[res.quad, res.mat, CONFETTI]} visible={false} frustumCulled={false} name="decor-confetti" />;
});

// ---------- the level's decor ----------

/** One level's scenery (themes.ts). Level 1: nothing — today's pool is the look. */
export default function LevelDecor({ level, course, run }: { level: LevelId; course: Course; run: ObstacleRun }) {
   const data = useMemo(() => decorOf(level, course), [level, course]);
   return (
      <group name="decor">
         {data.boxes.length > 0 && <DecorBoxes boxes={data.boxes} />}
         {data.cylinders.length > 0 && <DecorCylinders cylinders={data.cylinders} />}
         {data.cones.length > 0 && <DecorCones cones={data.cones} />}
         {data.tris.length > 0 && <DecorTris tris={data.tris} />}
         {data.beacons.length > 0 && <BeaconLights beacons={data.beacons} run={run} />}
         {data.sweepers.map((apex, k) => (
            <SweepCone key={k} apex={apex} run={run} />
         ))}
         {level === 5 && <Confetti line={course.finish.line} />}
      </group>
   );
}
