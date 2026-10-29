"use client";

// Coilstone in its rhythm duel (level 5, visuals only: rules.ts runs the fight on the chart through
// menu2/boss). The serpent lies coiled round the outside of the stage: a code-built jade-and-sandstone
// body, its eight dark plates as m2CoilstoneSegment GLBs (a cracked plate turns jade and drops away),
// the m2CoilstoneHead GLB rearing over the back of the stage, swaying to the beat. P1: its tail flicks to
// the gong it calls. P2: it slams the stage on each shockwave. P3: its head bows over the Great Gong
// (menu2/props), which glows on the crescendo and swings on the last strike. Freed, its eyes turn jade
// and it settles to sleep.
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, Color, Euler, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type Group, type Matrix4 } from "three";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced, type InstancePart } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { GreatGong } from "@/arcade3d/menu2/props";
import { bossTimeScale } from "@/arcade3d/menu2/boss/boss";
import { ASSETS, GLB_SIZE } from "./assets";
import { gongAngle } from "./chart";
import { COLORS } from "./look";
import { COILSTONE } from "./progression";
import type { GongRun } from "./rules";

const BODY_N = 30;
const RING_R = 9.8;
const V = new Vector3();
const Q = new Quaternion();
const E = new Euler();
const S = new Vector3();

export default function Coilstone({ run }: { run: GongRun }) {
   if (!run.boss) return null;
   return <Serpent run={run} />;
}

function Serpent({ run }: { run: GongRun }) {
   const time = useGameTime();
   const head = useRef<Group>(null);
   const sleep = useRef(0);
   const parts = useMemo<InstancePart[]>(() => {
      const body = new SphereGeometry(0.9, 14, 10);
      body.scale(1, 0.8, 1.3);
      const belly = new BoxGeometry(1.1, 0.2, 1.5);
      belly.translate(0, -0.65, 0);
      return [
         { geometry: body, material: new MeshStandardMaterial({ color: COLORS.jadeDark, roughness: 0.55, metalness: 0.15 }) },
         { geometry: belly, material: new MeshStandardMaterial({ color: "#c9a76a", roughness: 0.85 }) },
      ];
   }, []);
   const plateDark = useMemo(() => new Color("#ffffff"), []);
   const plateJade = useMemo(() => new Color("#5fe3b0"), []);
   // the coil runs round the outside of the stage, from the tail (front left) round the back to the neck
   const along = (u: number, out: Vector3) => {
      const a = -2.2 + u * 4.4 + Math.PI;
      out.set(RING_R * Math.sin(a), 0.4 + Math.sin(u * 18 + time.now * 0.8) * 0.15, RING_R * Math.cos(a));
      return a;
   };
   useFrame(() => {
      const b = run.boss;
      const g = head.current;
      if (!b || !g) return;
      const beat = run.stage.beatMs;
      const pulse = Math.sin(((run.simMs % beat) / beat) * Math.PI);
      const k = bossTimeScale(b, COILSTONE);
      if (b.defeatMs >= 0) sleep.current = Math.min(1, sleep.current + time.delta * 0.5 * k);
      // P1: it leans over the gong it calls; P3: it bows over the Great Gong; else it sways at the back
      let ax = 0;
      let az = -RING_R + 1.2;
      let ay = 4.2 + 0.4 * pulse;
      if (b.phase === 0) {
         const call = run.chart.calls.find((c) => Math.abs(c.t - run.simMs) < 500);
         if (call && call.target.kind === "gong") {
            const a = gongAngle(run.stage, call.target.i, run.simMs);
            ax = (RING_R - 1.5) * Math.sin(a) * 0.6;
            az = (RING_R - 1.5) * Math.cos(a) * 0.9;
         }
      } else if (b.phase === 2) {
         ax = 0;
         az = -2.6;
         ay = 4.8;
      }
      ay -= 2.8 * sleep.current;
      g.position.lerp(V.set(ax, ay, az), 1 - Math.exp(-4 * time.delta));
      g.rotation.set(0.3 + sleep.current * 0.5, Math.atan2(-g.position.x, -g.position.z) + Math.PI, Math.sin(time.now * 1.3) * 0.08);
      const flash = b.flashMs > 0 ? 1.08 : 1;
      g.scale.setScalar((3.2 / GLB_SIZE.coilHead.z) * flash);
   });
   const body = (i: number, m: Matrix4) => {
      const u = i / (BODY_N - 1);
      const a = along(u, V);
      E.set(0, a + Math.PI / 2, 0);
      Q.setFromEuler(E);
      const taper = 0.55 + 0.45 * u;
      S.set(taper, taper, taper);
      m.compose(V, Q, S);
   };
   const plate = (i: number, m: Matrix4, c: Color) => {
      const b = run.boss;
      if (!b) return false;
      const u = 0.12 + (i / (COILSTONE.maxHp - 1)) * 0.8;
      const a = along(u, V);
      const cracked = i >= b.hp;
      V.y += cracked ? -0.5 : 0.5;
      E.set(0, a + Math.PI / 2, cracked ? 0.5 : 0);
      Q.setFromEuler(E);
      const s = 1.5 / GLB_SIZE.coilSegment.x;
      S.set(s, s, s);
      m.compose(V, Q, S);
      c.copy(cracked ? plateJade : plateDark);
   };
   return (
      <>
         <DynamicInstanced count={BODY_N} update={body} parts={parts} name="coilstone-coil" />
         <DynamicInstancedModel asset={ASSETS.coilSegment} count={COILSTONE.maxHp} update={plate} />
         <group ref={head} position={[0, 4, -RING_R + 1.2]}>
            <Model asset={ASSETS.coilHead} />
         </group>
         <BigGong run={run} />
      </>
   );
}

/** The Great Gong in the middle of the stage: it glows through the crescendo and swings on the last strike. */
function BigGong({ run }: { run: GongRun }) {
   const time = useGameTime();
   const [look, setLook] = useState({ glow: 0.1, strike: 0 });
   const struck = useRef(-9);
   useFrame(() => {
      const b = run.boss;
      const ev = run.ev;
      if (ev.note >= 0 && run.chart.notes[ev.note]?.target.kind === "great") struck.current = time.now;
      const glow = b && b.phase === 2 ? 0.5 + 0.5 * Math.abs(Math.sin(time.now * 4)) : b && b.defeatMs >= 0 ? 1 : 0.1;
      const strike = Math.max(0, 1 - (time.now - struck.current) * 1.2);
      const g = Math.round(glow * 10) / 10;
      const s = Math.round(strike * 10) / 10;
      if (g !== look.glow || s !== look.strike) setLook({ glow: g, strike: s });
   });
   return (
      <group position={[0, 0, -0.4]}>
         <GreatGong glow={look.glow} strike={look.strike} />
      </group>
   );
}
