"use client";

// The Echo Storm Hawk (level 5; visuals only: rules.ts owns the fight). m2StormHawkBoss drawn in grey
// smoked glass (the W6 "echo": a tint, no new model). It flies ahead over the Fortress Bridge, dropping
// feather-locks (P1); its swoop is telegraphed by a red lane shadow, then it dives down that lane and,
// at the bottom, its wing plate glows one hero's colour (P2); for P3 it settles ahead over the bridge
// behind its five plates. The hit flash and the defeat shrink come from the shared boss state.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE, HAWK_SPAN } from "./assets";
import { laneX } from "./course";
import { COLORS, HERO_COLOURS } from "./look";
import { HAWK } from "./progression";
import type { DashRun } from "./rules";

export default function Hawk({ run }: { run: DashRun }) {
   const time = useGameTime();
   const body = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const shadowMat = useRef<MeshBasicMaterial>(null);
   const plate = useRef<Mesh>(null);
   const plateMat = useRef<MeshBasicMaterial>(null);
   const s = HAWK_SPAN / GLB_SIZE.hawk.x;
   useFrame(() => {
      const b = run.boss;
      const g = body.current;
      if (!b || !g) return;
      const h = run.hero;
      const now = time.now;
      const swoop = b.phase === 1;
      const step = b.step;
      let x = Math.sin(now * 0.7) * 2.2;
      let y = 6.5 + Math.sin(now * 1.8) * 0.6;
      let ahead = 24;
      if (swoop && (step === "attack" || step === "vulnerable")) {
         x = laneX(run.swoopLane);
         const k = step === "attack" ? Math.min(1, b.stepMs / 600) : 1;
         y = 6.5 - k * 5.2;
         ahead = 24 - k * 18;
      }
      if (b.phase === 2) {
         x = 0;
         y = 4.5;
         ahead = 30;
      }
      const dying = b.defeatMs >= 0 ? Math.max(0, 1 - b.defeatMs / HAWK.defeatMs) : 1;
      const flash = b.flashMs > 0 ? 1.12 : 1;
      g.position.set(x, y + (1 - dying) * 4, -(h.d + ahead));
      g.rotation.set(0, Math.PI, Math.sin(now * 1.3) * 0.15);
      g.scale.setScalar(s * dying * flash);
      g.visible = dying > 0.01;
      const sh = shadow.current;
      if (sh && shadowMat.current) {
         const warn = swoop && step === "telegraph";
         sh.visible = warn || (swoop && step === "attack");
         sh.position.set(laneX(run.swoopLane), 0.04, -(h.d + 9));
         shadowMat.current.opacity = 0.35 + 0.25 * Math.abs(Math.sin(now * 12));
      }
      const p = plate.current;
      if (p && plateMat.current) {
         p.visible = swoop && step === "vulnerable";
         p.position.set(x, y + 0.6, -(h.d + ahead) + 0.6);
         plateMat.current.color.set(HERO_COLOURS[run.plateColour]);
      }
   });
   if (!run.course.cfg.boss) return null;
   return (
      <>
         <group ref={body}>
            <Model asset={ASSETS.hawk} tint={COLORS.echo} />
         </group>
         <mesh ref={shadow} rotation-x={-Math.PI / 2} visible={false}>
            <planeGeometry args={[2.1, 18]} />
            <meshBasicMaterial ref={shadowMat} color="#ef4444" transparent opacity={0.4} depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh ref={plate} visible={false}>
            <circleGeometry args={[0.9, 32]} />
            <meshBasicMaterial ref={plateMat} color="#ffffff" transparent opacity={0.9} toneMapped={false} side={2} />
         </mesh>
      </>
   );
}
