"use client";

// Rollo (level 5): the shared m2ShadowArmadillo rolling round the upper table in table coordinates.
// It faces where it rolls and bobs; it glows gold and its lit pockets pulse while it is open (its
// vulnerable window), flashes white on a hit, spins in a charge, and sits on the flipper it jams (a red
// warning ring there, and the toy post that guards that side of the drain). Visual only.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Model } from "@/arcade3d/core/assets";
import { ASSETS, GLB_SIZE, fit } from "./assets";
import { COLORS } from "./look";
import { guardPost, type PinRun } from "./rules";

const LENGTH = 2.5;

export default function Rollo({ run }: { run: PinRun }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const glow = useRef<Mesh>(null);
   const jamRing = useRef<Mesh>(null);
   const post = useRef<Mesh>(null);
   const last = useRef({ x: 0, z: 0, yaw: 0 });
   const pockets = useRef<(Mesh | null)[]>([]);

   useFrame(() => {
      const g = root.current;
      const b = run.boss;
      if (!g || !b) return;
      const r = run.rollo;
      g.visible = r.visible;
      const dx = r.x - last.current.x;
      const dz = r.z - last.current.z;
      if (Math.hypot(dx, dz) > 1e-3) last.current.yaw = Math.atan2(dx, dz);
      last.current.x = r.x;
      last.current.z = r.z;
      g.position.set(r.x, Math.abs(Math.sin(time.now * 5)) * 0.15, r.z);
      g.rotation.y = last.current.yaw;
      const bd = body.current;
      if (bd) bd.rotation.x = b.step === "attack" ? time.now * 14 : 0;
      const open = b.step === "vulnerable";
      if (glow.current) {
         glow.current.visible = open || b.flashMs > 0;
         const mat = glow.current.material as MeshBasicMaterial;
         mat.color.set(b.flashMs > 0 ? "#ffffff" : b.phase === 1 ? COLORS.golden : "#fb923c");
         mat.opacity = b.flashMs > 0 ? 0.8 : 0.35 + 0.2 * Math.sin(time.now * 8);
      }
      for (let i = 0; i < pockets.current.length; i++) {
         const p = pockets.current[i];
         if (!p) continue;
         const mat = p.material as MeshBasicMaterial;
         mat.opacity = open ? 0.55 + 0.4 * Math.sin(time.now * 7 + i) : 0.15;
      }
      const gp = post.current;
      if (gp) {
         gp.visible = r.jam >= 0;
         if (r.jam >= 0) {
            const c = guardPost(r.jam);
            gp.position.set(c.x, 0.4, c.z);
         }
      }
      const jr = jamRing.current;
      if (jr) {
         jr.visible = r.jam >= 0;
         if (r.jam >= 0) {
            const f = run.table.flippers[r.jam];
            jr.position.set(f.px + f.side * 1.3, 0.08, f.pz + 0.4);
            jr.scale.setScalar(1 + 0.1 * Math.sin(time.now * 10));
         }
      }
   });

   const s = fit(GLB_SIZE.rollo.z, LENGTH);
   const t = run.table.boss;
   return (
      <>
         <group ref={root}>
            <group ref={body} position={[0, 0.75, 0]}>
               <group position={[0, -0.75, 0]}>
                  <Model asset={ASSETS.rollo} scale={s} />
               </group>
            </group>
            <mesh ref={glow} position={[0, 0.9, 0]}>
               <sphereGeometry args={[1.55, 20, 14]} />
               <meshBasicMaterial transparent opacity={0.4} depthWrite={false} toneMapped={false} />
            </mesh>
         </group>
         {/* the lit pockets on the side walls */}
         {t
            ? [
                 [-6.7, -19],
                 [5.3, -17],
                 [-6.7, -11],
              ].map(([x, z], i) => (
                 <mesh key={i} ref={(m) => { pockets.current[i] = m; }} position={[x, 0.05, z]} rotation-x={-Math.PI / 2}>
                    <circleGeometry args={[0.55, 20]} />
                    <meshBasicMaterial color="#fb923c" transparent opacity={0.2} toneMapped={false} />
                 </mesh>
              ))
            : null}
         <mesh ref={post} visible={false} castShadow>
            <cylinderGeometry args={[0.25, 0.28, 0.8, 14]} />
            <meshStandardMaterial color={COLORS.golden} emissive={COLORS.golden} emissiveIntensity={0.5} />
         </mesh>
         <mesh ref={jamRing} rotation-x={-Math.PI / 2} visible={false}>
            <ringGeometry args={[1.2, 1.45, 28]} />
            <meshBasicMaterial color={COLORS.jam} transparent opacity={0.8} toneMapped={false} />
         </mesh>
      </>
   );
}
