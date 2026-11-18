"use client";

// Greyout, the Street Sweeper (level 5): m2GreySweeperBoss driven by the rules' truck pose, with the
// parts the fight reads: two spinning roof brush units (phase 1's target, they glow while it is
// open), the tank valves on its back (phase 2's target, pulsing red while open), headlights that
// flare on every telegraph, a white hit flash, the spin-out when a gate slams it, and the tumble on
// its defeat. Its drone cones are m2FactoryDrone. Visual only: the rules own every hit.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, Matrix4, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { bossTimeScale, stepProgress } from "@/arcade3d/menu2/boss/boss";
import { TRUCK_HALF_L, TRUCK_HALF_W, TRUCK_ROOF } from "./city";
import { ASSETS } from "./assets";
import { GREYOUT } from "./progression";
import type { CityRun } from "./rules";
import type { VisualClock } from "./Course";

const m4 = new Matrix4();
const BRISTLE = new Color("#facc15");
const OPEN = new Color("#fef08a");
void m4;

export function Boss({ run, clock }: { run: CityRun; clock: VisualClock }) {
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const brushes = useRef<Group>(null);
   const valves = useRef<Group>(null);
   const lights = useRef<Group>(null);
   const state = useRef({ yaw: Number.NaN, spin: 0, tip: 0, spinAngle: 0 });
   const brushMat = useMemo(() => ({ current: null as MeshStandardMaterial | null }), []);
   useFrame((_s, delta) => {
      const b = run.boss;
      const g = root.current;
      if (!b || !g) return;
      const t = run.truck;
      const dt = Math.min(0.1, delta) * bossTimeScale(b, GREYOUT);
      const st = state.current;
      if (Number.isNaN(st.yaw)) st.yaw = t.yaw;
      let d = t.yaw - st.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      st.yaw += d * (1 - Math.exp(-8 * dt));
      // a slammed gate spins it out
      const spinning = run.simMs < t.spinUntil;
      st.spinAngle += spinning ? dt * 9 : 0;
      if (!spinning) st.spinAngle *= 1 - Math.min(1, dt * 4);
      g.position.set(t.x, 0, t.z);
      g.rotation.y = st.yaw + st.spinAngle;
      const defeat = b.defeatMs >= 0 ? Math.min(1, b.defeatMs / GREYOUT.defeatMs) : 0;
      st.tip += (defeat - st.tip) * (1 - Math.exp(-3 * dt));
      const bd = body.current;
      if (bd) {
         bd.rotation.z = st.tip * 1.3;
         bd.position.y = -st.tip * 0.8;
         // a hit's flash: a quick swell
         const f = b.flashMs > 0 ? b.flashMs / GREYOUT.hitFlashMs : 0;
         const s = 1 + 0.06 * f;
         bd.scale.set(s, s, s);
         // the engine's idle shake while it drives
         bd.position.x = t.moving ? Math.sin(clock.ms / 30) * 0.03 : 0;
      }
      const open = b.step === "vulnerable";
      const br = brushes.current;
      if (br) {
         br.visible = b.phase === 0 && b.hp > 0;
         const speed = b.step === "attack" ? 18 : open ? 4 : 9;
         for (const child of br.children) child.rotation.y += dt * speed;
         const mat = brushMat.current;
         if (mat) mat.emissive.copy(open ? OPEN : BRISTLE).multiplyScalar(open ? 0.9 + 0.4 * Math.sin(clock.ms / 90) : 0.15);
      }
      const vv = valves.current;
      if (vv) {
         vv.visible = b.phase <= 1 && b.hp > 0;
         const pulse = b.phase === 1 && open ? 0.6 + 0.4 * Math.sin(clock.ms / 80) : 0.15;
         for (const child of vv.children) ((child as Mesh).material as MeshBasicMaterial).opacity = pulse;
      }
      const ls = lights.current;
      if (ls) {
         const tele = b.step === "telegraph" ? stepProgress(b, GREYOUT) : 0;
         const on = b.hp > 0 ? 0.25 + tele * 0.75 * (0.6 + 0.4 * Math.sin(clock.ms / 60)) : 0;
         for (const child of ls.children) ((child as Mesh).material as MeshBasicMaterial).opacity = on;
      }
   });
   const drones = (i: number, m: Matrix4) => {
      const d = run.drones[i];
      if (!d) return false;
      const bob = Math.sin(clock.ms / 200 + i) * 0.15;
      m.makeRotationY(clock.ms / 700 + i);
      m.setPosition(d.x, 0.4 + bob, d.z);
   };
   if (!run.boss) return null;
   const hl = TRUCK_HALF_L;
   const hw = TRUCK_HALF_W;
   return (
      <>
         <group ref={root}>
            <group ref={body}>
               <Model asset={ASSETS.boss} />
               <group ref={brushes}>
                  {[-1, 1].map((s) => (
                     <group key={s} position={[s * hw * 0.5, TRUCK_ROOF + 0.12, -hl * 0.25]}>
                        <mesh>
                           <cylinderGeometry args={[0.75, 0.75, 0.22, 16]} />
                           <meshStandardMaterial
                              ref={(mm) => {
                                 if (mm) brushMat.current = mm;
                              }}
                              color="#eab308"
                              emissive="#facc15"
                              emissiveIntensity={1}
                              roughness={0.9}
                           />
                        </mesh>
                     </group>
                  ))}
               </group>
               {/* one glow strip each: the tank valves (back) and the headlights (front) */}
               <group ref={valves}>
                  <mesh position={[0, 1.5, -hl - 0.08]}>
                     <boxGeometry args={[hw * 1.3, 0.45, 0.2]} />
                     <meshBasicMaterial color="#ef4444" transparent opacity={0.2} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
                  </mesh>
               </group>
               <group ref={lights}>
                  <mesh position={[0, 1.2, hl + 0.1]}>
                     <boxGeometry args={[hw * 1.5, 0.5, 0.2]} />
                     <meshBasicMaterial color="#fde68a" transparent opacity={0.3} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
                  </mesh>
               </group>
            </group>
         </group>
         <DynamicInstancedModel asset={ASSETS.drone} count={2} update={drones} name="drones" />
      </>
   );
}
