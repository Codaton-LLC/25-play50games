"use client";

// King Bonbon (level 5, m2CandyKingBoss): he retreats ahead of you down the palace road, turned back to
// face you, bobbing as he runs; he rears up through each telegraph and stamps on the attack (the Scene
// shakes). A gold glow rings him while a hit is charged and pulses while he is open. On his defeat he
// sinks aside and lets you pass. Drawn from the run alone.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Model } from "@/arcade3d/core/assets";
import { stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS, GLB_SIZE, KING_H } from "./assets";
import { KING_BONBON } from "./progression";
import { bossVulnerable, visualS, type CandyRun } from "./rules";

export function King({ run }: { run: CandyRun }) {
   const time = useGameTime();
   const g = useRef<Group>(null);
   const ring = useRef<Mesh>(null);
   const loop = run.course.loop;
   useFrame((_s, delta) => {
      const node = g.current;
      const b = run.boss;
      if (!node || !loop || !b) return;
      const now = time.now;
      const dt = Math.min(0.1, delta);
      const s = visualS(run);
      node.visible = s > loop.s0 - 70 && (b.step !== "done" || b.defeatMs < KING_BONBON.defeatMs + 2000);
      const done = b.step === "done" || b.step === "defeat";
      const ahead = run.bossAwake ? 26 : loop.s0 - run.runner.s + 10;
      const lift = b.step === "telegraph" ? stepProgress(b, KING_BONBON) * 1.2 : 0;
      const sink = b.defeatMs >= 0 ? Math.min(1, b.defeatMs / KING_BONBON.defeatMs) : 0;
      const wantX = done ? 7 : 0;
      node.position.x += (wantX - node.position.x) * (1 - Math.exp(-3 * dt));
      node.position.y = lift + Math.abs(Math.sin(now * 5)) * 0.35 * (run.bossAwake && !done ? 1 : 0) - sink * 2;
      node.position.z = -(s + ahead);
      node.rotation.y = Math.PI + Math.sin(now * 1.3) * 0.1;
      const k = (KING_H / GLB_SIZE.king.y) * (b.flashMs > 0 ? 1.04 : 1);
      node.scale.setScalar(k);
      const rg = ring.current;
      if (rg) {
         rg.visible = run.bossAwake && !done && (run.pending > 0 || bossVulnerable(run));
         rg.position.set(node.position.x, 0.08, node.position.z);
         rg.scale.setScalar(1 + Math.sin(now * (bossVulnerable(run) ? 10 : 4)) * 0.08);
         (rg.material as MeshBasicMaterial).opacity = bossVulnerable(run) ? 0.9 : 0.5;
      }
   });
   if (!loop) return null;
   return (
      <>
         <group ref={g}>
            <Model asset={ASSETS.king} />
         </group>
         <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}>
            <ringGeometry args={[2.2, 3.0, 40]} />
            <meshBasicMaterial color="#fde047" transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </mesh>
      </>
   );
}
