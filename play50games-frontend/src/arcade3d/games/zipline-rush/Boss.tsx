"use client";

// Volt Eel, the storm creature living in the cables (L5). The GLB stands as an upright S, head up,
// facing +z. Visual only: rules.ts owns every hit window; this file reads them.
//   phase 1 "the cables": it swims along the line it charges, head over the cable; when it opens up
//     its head dips to the safe line in the hop window (u 0.4..0.68), ringed in the player's colour.
//   phase 2 "coiled": it winds round the lighthouse at the spiral's top, the gill glowing open.
//   phase 3 "the plunge": it thrashes in the sea under the falling lines, then rears behind the
//     Tide Bell; the last hit drops it into the sea (slow motion from the shared boss clock).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Vector3, type Group, type Mesh, type MeshBasicMaterial, type PointLight } from "three";
import { Model } from "../../core/assets";
import { useGameTime } from "../../core/gameTime";
import { bossTimeScale } from "../../menu2/boss/boss";
import { useJuice, createJuiceEmitter } from "../../menu2/juice";
import { ASSETS } from "./assets";
import { VOLT_EEL } from "./progression";
import { cablePoint, deckPoint, type ZipRun } from "./rules";
import { HANG, SEA_Y, stations } from "./layout";

/** The head's point in the eel group (m, as drawn): top front of the S. */
export const EEL_HEAD = { y: 7.1, z: 2.3 } as const;
const OWNER = ["#38bdf8", "#f472b6", "#a3e635", "#fbbf24"];

export function Boss({ run, owner = 0 }: { run: ZipRun; owner?: number }) {
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const cue = useRef<Mesh>(null);
   const halo = useRef<Mesh>(null);
   const light = useRef<PointLight>(null);
   const time = useGameTime();
   const juice = useJuice();
   const sparks = useMemo(createJuiceEmitter, []);
   const at = useMemo(() => new Vector3(), []);
   const pos = useMemo(() => new Vector3(), []);
   const target = useMemo(() => new Vector3(), []);
   const state = useRef({ init: false, defeat: 0, fall: 0, lastHp: 5, splash: false });
   const sts = useMemo(() => stations(run.cfg), [run.cfg]);
   useFrame(() => {
      const g = root.current;
      const b = run.boss;
      if (!g || !b || !body.current) return;
      const t = time.now;
      const st = state.current;
      g.visible = run.section >= 2 && b.step !== "done";
      if (!g.visible && b.hp > 0) {
         st.init = false;
         return;
      }
      let yaw = 0;
      let lean = 0;
      let rise = 0;
      if (b.phase === 0) {
         // swims along the charged line ahead of the rider; dips its head to the safe line when open
         const open = b.step === "vulnerable";
         const lane = open ? 1 - run.electricLane : run.electricLane;
         const u = open ? 0.54 : 0.5 + Math.sin(t * 0.7) * 0.22;
         const p = cablePoint(run.cfg, 2, lane, u);
         target.set(p.x + (lane === 0 ? -0.6 : 0.6), p.y - EEL_HEAD.y + (open ? -HANG + 1.1 : 1.6), p.z - EEL_HEAD.z * (open ? 1 : 0.3));
         yaw = open ? 0 : Math.cos(t * 0.7) > 0 ? Math.PI : 0;
         lean = open ? 0.18 : Math.sin(t * 2.3) * 0.08;
      } else if (b.phase === 1) {
         // wound round the lighthouse at the spiral's top (station 4), head over the landing
         const st4 = sts[4];
         const a = t * 0.6;
         target.set(11 + Math.cos(a) * 3.2, st4.landY - EEL_HEAD.y + 3 + Math.sin(t * 1.4) * 0.4, st4.land!.z - 1 + Math.sin(a) * 3.2);
         yaw = -a + Math.PI;
         lean = 0.12;
         if (run.section < 3) target.y -= 30;
      } else {
         // the plunge: in the sea beside the falling lines, rearing behind the bell at the end
         const last = sts[sts.length - 1];
         const atBell = run.mode === "bell" || run.section >= run.cfg.sections - 1;
         if (atBell) {
            target.set(-7, last.landY - EEL_HEAD.y + 6.5, last.land!.z - 7);
            yaw = 0.5;
         } else {
            const p = cablePoint(run.cfg, run.section, 0, Math.min(1, run.t + 0.28));
            target.set(-9 + Math.sin(t * 0.9) * 2, SEA_Y - 3 + Math.max(0, Math.sin(t * 1.3)) * 6, p.z);
            yaw = Math.sin(t * 0.9) * 0.5 + 0.4;
         }
         rise = Math.sin(t * 3.1) * 0.12;
      }
      if (!st.init) {
         // bursts out of the sea when it first appears
         pos.set(target.x, SEA_Y - 12, target.z);
         st.init = true;
         juice.burst("dust", { x: target.x, y: SEA_Y + 0.5, z: target.z }, 36, { color: "#e0f2fe" });
      }
      pos.lerp(target, 1 - Math.exp(-time.delta * 3));
      g.position.copy(pos);
      g.rotation.set(lean, yaw, rise);
      // the body sways like it swims; a hit flashes it bigger
      body.current.rotation.z = Math.sin(t * 2.6) * 0.07;
      body.current.rotation.x = Math.sin(t * 1.9) * 0.05;
      const flash = b.flashMs > 0 ? 1 : 0;
      body.current.scale.setScalar(1 + flash * 0.1 + Math.sin(t * 4) * 0.015);
      if (b.hp < st.lastHp) {
         st.lastHp = b.hp;
         juice.burst("hit", { x: pos.x, y: pos.y + EEL_HEAD.y, z: pos.z + EEL_HEAD.z }, 48, { color: "#67e8f9" });
         juice.shake(0.45);
      }
      // the weak point: the head (phase 1, 3) or the gill (phase 2), ringed while it is open
      const open = b.step === "vulnerable";
      if (cue.current) {
         cue.current.visible = open || b.step === "telegraph";
         cue.current.scale.setScalar(open ? 1.25 + Math.sin(t * 10) * 0.12 : 0.8);
         cue.current.rotation.z = t * 2;
         (cue.current.material as MeshBasicMaterial).opacity = open ? 0.95 : 0.35;
      }
      if (halo.current) {
         const telegraph = b.step === "telegraph" || b.step === "attack";
         (halo.current.material as MeshBasicMaterial).opacity = (telegraph ? 0.35 : 0.14) + Math.sin(t * 20) * 0.06;
      }
      if (light.current) light.current.intensity = (b.step === "attack" ? 40 : 14) + Math.sin(t * 31) * 6;
      // arcs from the eel to its charged line
      if (b.phase === 0 && (b.step === "attack" || b.step === "telegraph")) {
         const p = cablePoint(run.cfg, 2, run.electricLane, 0.3 + ((t * 0.9) % 0.5));
         at.set(p.x, p.y, p.z);
         juice.stream("hit", at, b.step === "attack" ? 90 : 25, sparks, { color: "#a5f3fc" });
      }
      // the defeat: slow-motion fall into the sea
      if (b.hp === 0) {
         st.defeat += time.delta * 1000;
         const scale = bossTimeScale({ ...b, defeatMs: st.defeat }, VOLT_EEL);
         st.fall += time.delta * scale * 5;
         g.position.y -= st.fall * st.fall * 0.6;
         g.rotation.x += st.fall * 0.5;
         if (!st.splash && g.position.y < SEA_Y + 2) {
            st.splash = true;
            juice.burst("dust", { x: g.position.x, y: SEA_Y + 0.5, z: g.position.z }, 60, { color: "#e0f2fe" });
         }
      }
   });
   if (!run.boss) return null;
   const deck = deckPoint(run.cfg, run.cfg.sections - 1, 0);
   void deck;
   return (
      <group ref={root} visible={false}>
         <group ref={body}>
            <Model asset={ASSETS.boss} />
            <mesh ref={halo} position={[0, 4, 0.5]}>
               <sphereGeometry args={[4.6, 20, 14]} />
               <meshBasicMaterial color="#22d3ee" transparent opacity={0.15} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
            </mesh>
         </group>
         <mesh ref={cue} position={[0, EEL_HEAD.y, EEL_HEAD.z + 0.4]}>
            <torusGeometry args={[0.95 + owner * 0.12, 0.09, 8, 32]} />
            <meshBasicMaterial color={OWNER[owner % 4]} transparent toneMapped={false} />
         </mesh>
         <pointLight ref={light} color="#22d3ee" intensity={14} distance={26} position={[0, 5, 1]} />
      </group>
   );
}
