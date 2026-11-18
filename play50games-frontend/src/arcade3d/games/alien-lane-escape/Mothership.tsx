"use client";

// The Mothership (m2AlienMothership) and, on level 4, the scanner drone (m2ScannerDrone). On every level
// the ship hangs behind you over the valley and sends the scan lines: its belly glows violet while a
// line sweeps. Level 5 is the fight: it follows you (phase 1, the abduction beams), lowers ahead of you
// over the track (phase 2, its glowing underside), then flees ahead to the launch pad (phase 3); a hit
// flashes it, a charged hit rings it gold, and on its defeat it tilts and falls into the valley. The
// drone hovers beside the track and sweeps its lateral lines. Drawn from the run alone.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Model } from "@/arcade3d/core/assets";
import { ASSETS, GLB_SIZE, MOTHERSHIP_W } from "./assets";
import { MOTHERSHIP } from "./progression";
import { visualS, type AlienRun } from "./rules";

function bossOpen(run: AlienRun): boolean {
   const b = run.boss;
   return !!b && b.step === "vulnerable" && b.hp > 0;
}

export function Mothership({ run }: { run: AlienRun }) {
   const time = useGameTime();
   const g = useRef<Group>(null);
   const belly = useRef<Mesh>(null);
   const ring = useRef<Mesh>(null);
   const pos = useRef({ x: 0, y: 10, ahead: -24, tilt: 0 });
   useFrame((_s, delta) => {
      const node = g.current;
      if (!node) return;
      const now = time.now;
      const dt = Math.min(0.1, delta);
      const b = run.boss;
      const s = visualS(run);
      const p = pos.current;
      let wantX = Math.sin(now * 0.4) * 2;
      let wantY = 10 + Math.sin(now * 0.9) * 0.5;
      let wantAhead = -24;
      let tilt = 0;
      if (b && run.bossAwake) {
         const done = b.step === "done" || b.step === "defeat";
         if (done) {
            const k = Math.min(1, Math.max(0, b.defeatMs) / MOTHERSHIP.defeatMs);
            wantAhead = 46;
            wantY = 12 - 16 * k;
            wantX = 6 + 10 * k;
            tilt = 0.6 * k;
         } else if (b.phase === 0) {
            wantAhead = -16;
            wantY = 9 + Math.sin(now * 1.1) * 0.6;
         } else if (b.phase === 1) {
            wantAhead = 28;
            wantY = b.step === "vulnerable" ? 4.2 : 6;
         } else {
            wantAhead = 46;
            wantY = 9;
         }
      }
      const k = 1 - Math.exp(-2.2 * dt);
      p.x += (wantX - p.x) * k;
      p.y += (wantY - p.y) * k;
      p.ahead += (wantAhead - p.ahead) * k;
      p.tilt += (tilt - p.tilt) * k;
      node.position.set(p.x, p.y, -(s + p.ahead));
      // it faces you: ahead of you, turned round
      node.rotation.set(p.tilt, now * 0.15, p.tilt * 0.5);
      const flash = b && b.flashMs > 0 ? 1.05 : 1;
      node.scale.setScalar((MOTHERSHIP_W / GLB_SIZE.mothership.x) * flash);
      const bl = belly.current;
      if (bl) {
         const sweeping = run.active >= 0;
         bl.position.set(p.x, p.y + 0.3, -(s + p.ahead));
         const pulse = sweeping ? 0.75 + Math.sin(now * 18) * 0.2 : 0.25 + Math.sin(now * 2) * 0.08;
         (bl.material as MeshBasicMaterial).opacity = bossOpen(run) ? 0.95 : pulse;
         bl.scale.setScalar(bossOpen(run) ? 1.15 + Math.sin(now * 10) * 0.08 : 1);
         bl.visible = !(b && (b.step === "done" || b.step === "defeat"));
      }
      const rg = ring.current;
      if (rg) {
         rg.visible = !!b && run.bossAwake && b.step !== "done" && b.step !== "defeat" && (run.pending > 0 || bossOpen(run));
         rg.position.set(p.x, p.y - 0.2, -(s + p.ahead));
         rg.scale.setScalar(1 + Math.sin(now * (bossOpen(run) ? 10 : 4)) * 0.08);
      }
   });
   return (
      <>
         <group ref={g}>
            <Model asset={ASSETS.mothership} />
         </group>
         {/* the belly's scanner glow (under the hull) */}
         <mesh ref={belly} rotation-x={Math.PI / 2}>
            <circleGeometry args={[2.6, 32]} />
            <meshBasicMaterial color="#e879f9" transparent opacity={0.4} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}>
            <ringGeometry args={[5.2, 6.2, 48]} />
            <meshBasicMaterial color="#fde047" transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </mesh>
      </>
   );
}

/** Level 4's scanner drone: it hovers beside the track and sweeps the lateral lines. */
export function ScannerDrone({ run }: { run: AlienRun }) {
   const time = useGameTime();
   const g = useRef<Group>(null);
   useFrame(() => {
      const node = g.current;
      if (!node) return;
      const now = time.now;
      const i = run.active;
      const sc = i >= 0 ? run.course.scans[i] : null;
      const s = visualS(run);
      const lateral = !!sc && sc.kind === "lateral";
      node.position.set(lateral ? 7.5 : 9, 3.2 + Math.sin(now * 2.2) * 0.25, -(s + (lateral ? Math.max(4, sc.meet - run.runner.s) : 12)));
      node.rotation.set(0, -Math.PI / 2 + Math.sin(now * 1.4) * 0.15, Math.sin(now * 3) * 0.05);
      node.scale.setScalar(1.6 / GLB_SIZE.drone.x);
   });
   if (!run.course.scans.some((s) => s.kind === "lateral")) return null;
   return (
      <group ref={g}>
         <Model asset={ASSETS.drone} />
      </group>
   );
}
