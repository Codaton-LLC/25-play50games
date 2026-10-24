"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Object3D } from "three";
import type { InstancedMesh } from "three";
import { COLORS } from "./Primitives";
import type { Ball, Run } from "./rules";

function place(mesh: InstancedMesh, dummy: Object3D, index: number, ball: Ball | null, radius: number) {
   if (!ball) {
      dummy.position.set(0, -8, 0);
      dummy.scale.set(0, 0, 0);
   } else {
      dummy.position.set(ball.x, ball.y, ball.z);
      dummy.scale.set(radius, radius, radius);
   }
   dummy.rotation.set(0, 0, 0);
   dummy.updateMatrix();
   mesh.setMatrixAt(index, dummy.matrix);
}

export default function Balls({ run }: { run: Run }) {
   const lobs = useRef<InstancedMesh>(null);
   const rollers = useRef<InstancedMesh>(null);
   const rings = useRef<InstancedMesh>(null);
   const dummy = useMemo(() => new Object3D(), []);
   const count = run.balls.length;
   useFrame(() => {
      const a = lobs.current;
      const b = rollers.current;
      const c = rings.current;
      if (!a || !b || !c) return;
      for (let i = 0; i < count; i++) {
         const ball = run.balls[i];
         const flying = ball.alive && !ball.roller ? ball : null;
         const rolling = ball.alive && ball.roller ? ball : null;
         place(a, dummy, i, flying, 0.25);
         place(b, dummy, i, rolling, 0.45);
         if (ball.alive && !ball.roller) {
            dummy.position.set(ball.ix, 0.04, ball.iz);
            dummy.scale.set(1, 1, 1);
            dummy.rotation.set(-Math.PI / 2, 0, 0);
         } else {
            dummy.position.set(0, -8, 0);
            dummy.scale.set(0, 0, 0);
            dummy.rotation.set(0, 0, 0);
         }
         dummy.updateMatrix();
         c.setMatrixAt(i, dummy.matrix);
      }
      a.instanceMatrix.needsUpdate = true;
      b.instanceMatrix.needsUpdate = true;
      c.instanceMatrix.needsUpdate = true;
   });
   return (
      <group>
         <instancedMesh ref={lobs} args={[undefined, undefined, count]} frustumCulled={false}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshStandardMaterial color={COLORS.snow} roughness={0.45} emissive={COLORS.ice} emissiveIntensity={0.2} />
         </instancedMesh>
         <instancedMesh ref={rollers} args={[undefined, undefined, count]} frustumCulled={false}>
            <sphereGeometry args={[1, 14, 12]} />
            <meshStandardMaterial color={COLORS.snow} roughness={0.55} />
         </instancedMesh>
         <instancedMesh ref={rings} args={[undefined, undefined, count]} frustumCulled={false}>
            <ringGeometry args={[0.28, 0.46, 16]} />
            <meshBasicMaterial color={COLORS.fortCap} transparent opacity={0.85} />
         </instancedMesh>
      </group>
   );
}
