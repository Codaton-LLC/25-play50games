"use client";

// Belts and the four diverter arrows. The spine is one Conveyor (2 draw calls), not one per segment.
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { Conveyor } from "@/arcade3d/core/kit";
import { ChuteMouths } from "./Primitives";
import { BELT, CHUTE_PATHS, DIVERTER_AT, OVERFLOW_PATH, SPINE_PATH, type RunState } from "./rules";

const GATES = DIVERTER_AT.map((at) => ({ x: at.x + 4, y: at.y, z: at.z }));

export function Belts({ run }: { run: RunState }) {
   return (
      <group name="belts">
         <Conveyor path={SPINE_PATH} width={0.92} speed={BELT.base} color="#334155" stripe="#94a3b8" />
         {CHUTE_PATHS.map((path, i) => (
            <Conveyor key={i} path={path} width={0.92} speed={BELT.base} color="#334155" stripe="#94a3b8" />
         ))}
         <Conveyor path={OVERFLOW_PATH} width={0.92} speed={BELT.base} color="#7f1d1d" stripe="#fecaca" />
         <ChuteMouths gates={GATES} />
         <Arrows run={run} />
      </group>
   );
}

function Arrows({ run }: { run: RunState }) {
   const mesh = useRef<InstancedMesh>(null);
   const [scratch] = useState(() => ({
      m: new Matrix4(),
      q: new Quaternion(),
      p: new Vector3(),
      up: new Vector3(0, 1, 0),
   }));
   useFrame(() => {
      const inst = mesh.current;
      if (!inst) return;
      const { m, q, p, up } = scratch;
      for (let i = 0; i < 4; i++) {
         const at = DIVERTER_AT[i];
         // choice 0 points down a chute (+x); choice 1 continues along the spine, D4's 1 is the overflow (−x)
         const yaw = run.choices[i] === 0 ? Math.PI / 2 : i === 3 ? -Math.PI / 2 : 0;
         q.setFromAxisAngle(up, yaw).multiply(LAY);
         p.set(at.x, at.y + 0.55, at.z);
         m.compose(p, q, ONE);
         inst.setMatrixAt(i, m);
      }
      inst.instanceMatrix.needsUpdate = true;
   });
   return (
      <instancedMesh ref={mesh} args={[undefined, undefined, 4]} name="diverter-arrows">
         <coneGeometry args={[0.16, 0.42, 6]} />
         <meshStandardMaterial color="#f8fafc" roughness={0.45} />
      </instancedMesh>
   );
}

const ONE = new Vector3(1, 1, 1);
const LAY = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
