"use client";

// The Core Sprite (level 5, m2CoreSprite): it wakes once the last wave is in, holding the order's last
// four cores (they orbit it, in their colours). It hops to a new spot as each telegraph begins and rears
// up, slams, and a shock ring rolls out across the floor (jump it); dazed after a slam it slumps and glows
// gold (touch it: a core comes loose); a hit flashes it; on its defeat it shrinks away. Drawn from the run.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Model } from "@/arcade3d/core/assets";
import { stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS, GLB_SIZE, SPRITE_H } from "./assets";
import { CORE_COLORS } from "./look";
import { CORE_SPRITE } from "./progression";
import { bossOpen, shockRadius, spritePos, type CoreRun } from "./rules";

export function Sprite({ run }: { run: CoreRun }) {
   const time = useGameTime();
   const g = useRef<Group>(null);
   const ring = useRef<Mesh>(null);
   const aura = useRef<Mesh>(null);
   const held = useRef<(Mesh | null)[]>([]);
   const at = useRef({ x: 0, z: 0, ready: false });
   const boss = run.course.boss;
   useFrame((_s, delta) => {
      const node = g.current;
      const b = run.boss;
      if (!node || !boss || !b) return;
      const now = time.now;
      const dt = Math.min(0.1, delta);
      const want = spritePos(run, { x: 0, z: 0 });
      const p = at.current;
      if (!p.ready) {
         p.x = want.x;
         p.z = want.z;
         p.ready = true;
      }
      const k = 1 - Math.exp(-6 * dt);
      p.x += (want.x - p.x) * k;
      p.z += (want.z - p.z) * k;
      const gone = b.step === "done" || b.step === "defeat";
      const shrink = b.defeatMs >= 0 ? Math.max(0, 1 - b.defeatMs / CORE_SPRITE.defeatMs) : 1;
      node.visible = run.bossAwake && shrink > 0.02;
      const hop = Math.hypot(want.x - p.x, want.z - p.z) > 0.2 ? Math.abs(Math.sin(now * 9)) * 1.2 : 0;
      const rear = b.step === "telegraph" ? stepProgress(b, CORE_SPRITE) * 0.8 : 0;
      const slump = b.step === "vulnerable" ? -0.4 : 0;
      node.position.set(p.x, hop + rear + slump, p.z);
      node.rotation.set(b.step === "vulnerable" ? 0.35 : 0, now * (b.step === "attack" ? 3 : 0.6), 0);
      node.scale.setScalar((SPRITE_H / GLB_SIZE.sprite.y) * shrink * (b.flashMs > 0 ? 1.08 : 1));
      const au = aura.current;
      if (au) {
         au.visible = run.bossAwake && !gone;
         au.position.set(p.x, 1.3 + hop + rear, p.z);
         const m = au.material as MeshBasicMaterial;
         const open = bossOpen(run);
         m.color.set(open ? "#fde047" : b.step === "telegraph" ? "#f43f5e" : "#c084fc");
         m.opacity = open ? 0.6 : 0.3;
         au.scale.setScalar(1 + Math.sin(now * (open ? 10 : 4)) * 0.08);
      }
      const rg = ring.current;
      if (rg) {
         const r = shockRadius(run);
         rg.visible = Number.isFinite(r);
         if (Number.isFinite(r)) {
            rg.position.set(p.x, 0.2, p.z);
            rg.scale.set(Math.max(0.05, r), Math.max(0.05, r), 1);
         }
      }
      // the cores it still holds circle it
      const left = Math.max(0, boss.colors.length - b.hits);
      held.current.forEach((m, i) => {
         if (!m) return;
         m.visible = run.bossAwake && !gone && i >= boss.colors.length - left;
         const a = now * 1.8 + (i * Math.PI * 2) / boss.colors.length;
         m.position.set(p.x + Math.cos(a) * 1.5, 1.6 + hop + Math.sin(now * 3 + i) * 0.15, p.z + Math.sin(a) * 1.5);
      });
   });
   if (!boss) return null;
   return (
      <>
         <group ref={g} visible={false}>
            <Model asset={ASSETS.sprite} />
         </group>
         <mesh ref={aura} visible={false}>
            <sphereGeometry args={[1.6, 20, 14]} />
            <meshBasicMaterial color="#c084fc" transparent opacity={0.3} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}>
            <ringGeometry args={[0.93, 1, 64]} />
            <meshBasicMaterial color="#f472b6" transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </mesh>
         {boss.colors.map((c, i) => (
            <mesh key={i} ref={(m) => { held.current[i] = m; }} visible={false}>
               <sphereGeometry args={[0.28, 16, 12]} />
               <meshBasicMaterial color={CORE_COLORS[c]} toneMapped={false} />
            </mesh>
         ))}
      </>
   );
}
