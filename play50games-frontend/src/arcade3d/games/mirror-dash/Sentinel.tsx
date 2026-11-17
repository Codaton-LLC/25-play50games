"use client";

// The Glass Sentinel (L5): the m2GlassSentinelBoss knight of mirror panes, towering over the far end of
// the runways and backing away as the pair runs (it stays ~44 m ahead). Reads rules.ts only: it winds
// up (telegraph), hurls panes (P1), raises its shield pane over one runway (P2, a tall violet pane
// standing on that runway), stoops while its knee-gem / chest crystal is open; the gem it offers is
// drawn where the rules put it: a glowing ring on its lane at jump height (P1, P2), and over both
// runways a timing ring that closes as the crystal arrives (P3). Hit flash, slow-motion shatter.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { Model } from "../../core/assets";
import { useGameTime } from "../../core/gameTime";
import { ASSETS } from "./assets";
import { laneWorldX } from "./Track";
import type { Pair } from "./rules";

export function Sentinel({ pair, ox }: { pair: Pair; ox: number }) {
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const shield = useRef<Mesh>(null);
   const gem = useRef<Group>(null);
   const ring = useRef<Mesh>(null);
   const time = useGameTime();
   const st = useRef({ fall: 0 });
   useFrame((_, delta) => {
      const g = pair.boss;
      const r = root.current;
      if (!g || !r || !body.current) return;
      const s = g.state;
      r.visible = g.active && st.current.fall < 1;
      const t = time.now;
      r.position.set(ox, 0, -(pair.s + 44));
      // wind-up: it rears back; attack: it lunges; open: it stoops low
      const lean = s.step === "telegraph" ? -0.12 + Math.sin(t * 24) * 0.02 : s.step === "attack" ? 0.18 : s.step === "vulnerable" ? 0.3 : 0;
      body.current.rotation.x += (lean - body.current.rotation.x) * Math.min(1, delta * 6);
      body.current.scale.setScalar(s.flashMs > 0 ? 1.05 : 1);
      if (s.step === "defeat" || s.step === "done") st.current.fall = Math.min(1, st.current.fall + delta * 0.5);
      body.current.position.y = -st.current.fall * 6;
      body.current.rotation.z = st.current.fall * 0.6;
      // P2: the shield pane over one runway
      if (shield.current) {
         const on = s.phase === 1 && s.step !== "transition";
         shield.current.visible = on;
         if (on) shield.current.position.set(laneWorldX(g.shield, 0, pair.merge), 0, 14);
      }
      // the gem it offers (a ring on its lane), and the chest crystal's closing ring
      const tg = g.target;
      if (gem.current) {
         const show = !!tg && !tg.done && tg.body !== 2;
         gem.current.visible = show;
         if (show && tg) {
            gem.current.position.set(ox + laneWorldX(tg.body as 0 | 1, tg.lane, pair.merge), 1.15, -tg.s);
            gem.current.rotation.z = t * 2;
         }
      }
      if (ring.current) {
         const show = !!tg && !tg.done && tg.body === 2;
         ring.current.visible = show;
         if (show && tg) {
            const k = Math.max(0.15, Math.min(1, (tg.s - pair.s) / 30));
            ring.current.position.set(ox, 1.6, -tg.s);
            ring.current.scale.set(1 + k * 4, 1 + k * 4, 1);
            (ring.current.material as MeshBasicMaterial).color.set(k < 0.3 ? "#86efac" : "#f0abfc");
         }
      }
   });
   if (!pair.boss) return null;
   return (
      <>
         <group ref={root} visible={false}>
            <group ref={body}>
               <Model asset={ASSETS.sentinel} />
            </group>
            <mesh ref={shield} visible={false}>
               <boxGeometry args={[4.6, 6.5, 0.25]} />
               <meshStandardMaterial color="#c4b5fd" emissive="#7c3aed" emissiveIntensity={0.7} transparent opacity={0.45} depthWrite={false} />
            </mesh>
         </group>
         <group ref={gem} visible={false}>
            <mesh>
               <torusGeometry args={[0.6, 0.09, 10, 32]} />
               <meshBasicMaterial color="#e879f9" />
            </mesh>
            <mesh>
               <octahedronGeometry args={[0.28, 0]} />
               <meshStandardMaterial color="#f5d0fe" emissive="#c026d3" emissiveIntensity={1.6} />
            </mesh>
         </group>
         <mesh ref={ring} visible={false}>
            <ringGeometry args={[0.92, 1, 48]} />
            <meshBasicMaterial color="#f0abfc" transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} />
         </mesh>
      </>
   );
}
