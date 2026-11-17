"use client";

// The vault's creatures. Level 3's ice slimes (m2IceSlime) slide after the tail and sit chewing after
// a bite (they wobble: that is the moment to lasso one). Level 5's Gumdrop Glutton (m2GummyMonster at
// 3x) turns to face the hero, stomps on his chase, squats wide while full (stunned: spinning stars),
// and opens his mouth in the yawn (a dark ring where you bank into it); in his split he is three
// mini-gummies (m2SlimeBlob).
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { Model } from "@/arcade3d/core/assets";
import { CHEW_MS, MOUTH_OFFSET, MOUTH_R, type GemRun } from "./rules";
import { GLUTTON } from "./progression";
import { ASSETS } from "./assets";
import type { VisualClock } from "./Vault";

export function Slimes({ run, clock }: { run: GemRun; clock: VisualClock }) {
   const refs = useRef<(Group | null)[]>([]);
   useFrame(() => {
      const ms = Math.max(0, clock.ms);
      for (let i = 0; i < run.slimeAlive.length; i++) {
         const g = refs.current[i];
         if (!g) continue;
         g.visible = run.slimeAlive[i] === 1;
         const chewing = ms - run.slimeBite[i] < CHEW_MS;
         g.position.set(run.slimeX[i], 0, run.slimeZ[i]);
         const wob = chewing ? 0.12 * Math.sin(ms / 70 + i) : 0.05 * Math.sin(ms / 200 + i);
         g.scale.set(1 + wob, 1 - wob, 1 + wob);
         const tx = run.n > 0 ? run.linkPos[(run.n - 1) * 2] : run.hero.x;
         const tz = run.n > 0 ? run.linkPos[(run.n - 1) * 2 + 1] : run.hero.z;
         g.rotation.y = Math.atan2(tx - run.slimeX[i], tz - run.slimeZ[i]);
      }
   });
   if (run.slimeAlive.length === 0) return null;
   return (
      <>
         {Array.from(run.slimeAlive).map((_, i) => (
            <group key={i} ref={(g) => {
                  refs.current[i] = g;
               }}>
               <Model asset={ASSETS.slime} />
            </group>
         ))}
      </>
   );
}

export function Glutton({ run, clock }: { run: GemRun; clock: VisualClock }) {
   const body = useRef<Group>(null);
   const stars = useRef<Group>(null);
   const mouth = useRef<Mesh>(null);
   const minis = useRef<(Group | null)[]>([]);
   useFrame(() => {
      const b = run.boss;
      if (!b) return;
      const g = run.glutton;
      const ms = Math.max(0, clock.ms);
      const grp = body.current;
      const alive = b.step !== "done";
      if (grp) {
         grp.visible = alive && b.phase !== 1;
         grp.position.set(g.x, 0, g.z);
         const face = b.phase === 2 ? Math.PI : Math.atan2(run.hero.x - g.x, run.hero.z - g.z);
         grp.rotation.y = face;
         const squat = b.step === "vulnerable" && b.phase === 0;
         const stomp = b.step === "telegraph" ? 0.05 * Math.abs(Math.sin(ms / 160)) : 0;
         const flash = b.flashMs > 0 ? 1.08 : 1;
         const sy = (squat ? 0.82 : 1 - stomp) * flash;
         const sx = (squat ? 1.15 : 1) * flash;
         grp.scale.set(sx, sy, sx);
         if (b.step === "defeat") grp.scale.multiplyScalar(Math.max(0.05, 1 - b.stepMs / GLUTTON.defeatMs));
      }
      const st = stars.current;
      if (st) {
         st.visible = g.stunUntil >= run.simMs && b.hp > 0;
         st.position.set(g.x, 3.1, g.z);
         st.rotation.y = ms / 200;
      }
      const m = mouth.current;
      if (m) {
         m.visible = b.phase === 2 && b.step === "vulnerable";
         m.position.set(g.x, 0.04, g.z - MOUTH_OFFSET);
         m.scale.setScalar(1 + 0.08 * Math.sin(ms / 120));
      }
      for (let i = 0; i < 3; i++) {
         const mg = minis.current[i];
         if (!mg) continue;
         mg.visible = b.phase === 1 && g.mAlive[i] === 1;
         mg.position.set(g.mx[i], 0, g.mz[i]);
         mg.rotation.y = Math.atan2(run.hero.x - g.mx[i], run.hero.z - g.mz[i]);
         const hop = b.step === "vulnerable" ? 0 : Math.abs(Math.sin(ms / 140 + i)) * 0.3;
         mg.position.y = hop;
      }
   });
   if (!run.boss) return null;
   return (
      <>
         <group ref={body}>
            <Model asset={ASSETS.gummy} />
         </group>
         <group ref={stars}>
            {[0, 1, 2, 3].map((k) => (
               <mesh key={k} position={[Math.sin((k / 4) * Math.PI * 2) * 0.9, 0, Math.cos((k / 4) * Math.PI * 2) * 0.9]}>
                  <octahedronGeometry args={[0.16]} />
                  <meshBasicMaterial color="#fde047" toneMapped={false} />
               </mesh>
            ))}
         </group>
         <mesh ref={mouth} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[MOUTH_R - 0.3, MOUTH_R, 40]} />
            <meshBasicMaterial color="#fb7185" transparent opacity={0.7} depthWrite={false} toneMapped={false} />
         </mesh>
         {[0, 1, 2].map((i) => (
            <group key={i} ref={(g) => {
                  minis.current[i] = g;
               }}>
               <Model asset={ASSETS.mini} />
            </group>
         ))}
      </>
   );
}
