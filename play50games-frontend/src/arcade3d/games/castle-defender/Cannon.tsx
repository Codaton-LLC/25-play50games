"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Matrix4, type Mesh, type Group } from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { DynamicInstanced, type InstancePart } from "@/arcade3d/core/render";
import { BoxGeometry, MeshStandardMaterial } from "three";
import { useEffect } from "react";
import { ASSETS } from "./assets";
import { LANE_X, ROCK_FLIGHT, TUNING, splash, type CastleRun } from "./rules";

export function Cannon({ run, reduced }: { run: CastleRun; reduced: boolean }) {
   const time = useGameTime(), ring = useRef<Group>(null), rear = useRef<Mesh>(null);
   const parts = useMemo<InstancePart[]>(() => [{ geometry: new BoxGeometry(1, 1, 1), material: new MeshStandardMaterial({ color: "#92400e" }), locals: [
      new Matrix4().makeScale(0.1, 2, 0.1).setPosition(-0.55, 1.08, 0),
      new Matrix4().makeScale(0.1, 2, 0.1).setPosition(0.55, 1.08, 0),
      ...Array.from({ length: 7 }, (_, n) => new Matrix4().makeScale(1.2, 0.07, 0.1).setPosition(0, 0.2 + n * 0.28, 0)),
   ] }], []);
   useEffect(() => () => { parts[0].geometry.dispose(); (parts[0].material as MeshStandardMaterial).dispose(); }, [parts]);
   useFrame(() => {
      if (ring.current) { ring.current.position.set(run.aim.x, 0.04, -run.aim.y); ring.current.scale.setScalar(splash(run)); }
      if (rear.current) { rear.current.visible = !reduced && run.time - run.rear.at < 0.5; rear.current.position.set(run.rear.x, 0.07, run.rear.z - 0.4); }
   });
   function ball(i: number, m: Matrix4) {
      const b = run.balls[i]; if (!b.active) return false;
      const t = Math.min(b.impact - b.launched, Math.max(0, time.play - b.launched));
      m.makeTranslation(b.x + b.vx * t, b.y + b.vy * t - TUNING.gravity * t * t / 2, b.z + b.vz * t);
   }
   function rock(_i: number, m: Matrix4) {
      if (!run.rock.active) return false;
      const t = Math.min(ROCK_FLIGHT, Math.max(0, time.play - run.rock.launched));
      const c = run.crews[run.rock.crew];
      m.makeTranslation(LANE_X[c.lane], Math.max(0, TUNING.rockHeight - TUNING.gravity * t * t / 2), 2);
   }
   function ladder(i: number, m: Matrix4) {
      const c = run.crews[i]; if (c.erected < 0 || c.destroyed || c.wave !== run.wave || run.time >= c.erected + TUNING.climb) return false;
      m.makeTranslation(LANE_X[c.lane], 0, 2);
   }
   function progress(i: number, m: Matrix4) {
      const c = run.crews[i]; if (c.erected < 0 || c.destroyed || c.wave !== run.wave || run.time >= c.erected + TUNING.climb) return false;
      const fraction = Math.max(0.001, Math.min(1, (run.time - c.erected) / TUNING.climb));
      m.makeScale(fraction, 1, 1).setPosition(LANE_X[c.lane] - (1 - fraction) * 0.6, 2.23, 2);
   }
   return <group>
      <DynamicInstanced count={8} update={ball}><sphereGeometry args={[0.125, 10, 8]} /><meshStandardMaterial color="#334155" /></DynamicInstanced>
      <DynamicInstancedModel asset={ASSETS.rock} count={1} update={rock} />
      <DynamicInstanced count={4} update={ladder} parts={parts} />
      <DynamicInstanced count={4} update={progress}><boxGeometry args={[1.2, 0.08, 0.12]} /><meshBasicMaterial color="#fbbf24" /></DynamicInstanced>
      <group ref={ring}>
         <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}><ringGeometry args={[0.97, 1, 48]} /><meshBasicMaterial color="#f8fafc" transparent opacity={0.7} depthWrite={false} /></mesh>
      </group>
      <mesh ref={rear} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}><ringGeometry args={[0.38, 0.48, 24]} /><meshBasicMaterial color="#34d399" transparent opacity={0.9} depthWrite={false} /></mesh>
   </group>;
}
