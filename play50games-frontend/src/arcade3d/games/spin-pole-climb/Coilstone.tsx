"use client";

// Coilstone, the Temple Serpent (level 5, visuals only: rules.ts runs the fight through menu2/boss).
// The head is the shared m2CoilstoneHead GLB; the dark plated segments (one in five) are
// m2CoilstoneSegment GLBs; the jade-and-sandstone body between them is a code-built instanced chain, so
// the whole serpent stays inside the triangle budget. It is wound round the central pole in the opposite
// spiral and turns slowly against you. Phase 1: a coil slides down the stair (a red-rimmed chunk) and a
// glowing plated segment rests ahead to stomp. Phase 2: the head swings out to the angle you stood on,
// bites, then lays its plated crown on a side pole's cap. Phase 3: the head coils under the Great Gong
// (menu2/props) on top, which glows while it can be rung. On the defeat the plates fall dark and the head
// sinks asleep, jade-lit.
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, Color, Euler, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type Group, type Matrix4 } from "three";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced, type InstancePart } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { GreatGong } from "@/arcade3d/menu2/props";
import { useJuice } from "@/arcade3d/menu2/juice";
import { bossTimeScale } from "@/arcade3d/menu2/boss/boss";
import { ASSETS, COIL_HEAD_LEN, COIL_SEG_W, GLB_SIZE } from "./assets";
import { TAU, helixEnd, helixTop, stairY } from "./course";
import { COLORS } from "./look";
import { COILSTONE } from "./progression";
import type { SpinRun } from "./rules";

const BODY_N = 36;
const PLATE_EVERY = 6;
const COIL_LAPS = 2.6;

const V = new Vector3();
const Q = new Quaternion();
const E = new Euler();
const S = new Vector3();

export default function Coilstone({ run }: { run: SpinRun }) {
   if (!run.boss) return null;
   return <CoilstoneBody run={run} />;
}

function CoilstoneBody({ run }: { run: SpinRun }) {
   const c = run.course;
   const central = c.helices[0];
   const pole = c.poles[central.pole];
   const top = helixTop(central);
   const radius = pole.walk + 1.15;
   const time = useGameTime();
   const juice = useJuice();
   const head = useRef<Group>(null);
   const gongStrike = useRef(0);
   const lastHp = useRef(COILSTONE.maxHp);
   const spin = useRef(0);
   const headPos = useMemo(() => new Vector3(0, top + 1.5, 0), [top]);
   const target = useMemo(() => new Vector3(), []);
   const asleep = useRef(0);
   const glowCol = useMemo(() => new Color(COLORS.plateGlow), []);
   const dark = useMemo(() => new Color("#ffffff"), []);

   const parts = useMemo<InstancePart[]>(() => {
      const body = new SphereGeometry(0.62, 14, 10);
      body.scale(1, 0.85, 1.25);
      const belly = new BoxGeometry(0.75, 0.16, 1.1);
      belly.translate(0, -0.5, 0);
      return [
         { geometry: body, material: new MeshStandardMaterial({ color: COLORS.coil, roughness: 0.55, metalness: 0.15, emissive: COLORS.jadeDark, emissiveIntensity: 0.12 }) },
         { geometry: belly, material: new MeshStandardMaterial({ color: COLORS.coilSand, roughness: 0.85 }) },
      ];
   }, []);

   // a point on the serpent's own spiral (u 0 tail .. 1 neck), turning against the climb
   const along = (u: number, out: Vector3) => {
      const a = -u * COIL_LAPS * TAU + spin.current;
      out.set(pole.x + radius * Math.sin(a), 0.8 + u * (top - 0.4), pole.z + radius * Math.cos(a));
      return a;
   };

   useFrame(() => {
      const b = run.boss;
      if (!b) return;
      const scale = bossTimeScale(b, COILSTONE);
      const dt = Math.min(0.05, time.delta) * scale;
      spin.current -= 0.12 * dt;
      // the head's pose by phase
      const h = run.hero;
      if (b.defeatMs >= 0) {
         asleep.current = Math.min(1, asleep.current + dt * 0.6);
         target.set(pole.x + radius * 0.9, top - 3 - 2 * asleep.current, pole.z + radius * 0.4);
      } else if (b.phase === 1 && (b.step === "telegraph" || b.step === "attack")) {
         const a = run.biteA;
         const r = b.step === "attack" ? pole.walk + 0.5 : pole.walk + 2.2;
         target.set(pole.x + r * Math.sin(a), run.biteY + 1, pole.z + r * Math.cos(a));
      } else if (b.phase === 1 && b.step === "vulnerable") {
         const side = c.poles[run.crownPole];
         let sideTop = 0;
         for (const hx of c.helices) if (hx.pole === side.id) sideTop = Math.max(sideTop, helixTop(hx));
         target.set(side.x, sideTop + 0.9, side.z);
      } else if (b.phase === 2) {
         target.set(pole.x + 1.6, top - 0.6, pole.z - 1.4);
      } else {
         const a = Math.atan2(h.x - pole.x, h.z - pole.z);
         target.set(pole.x + (radius + 0.6) * Math.sin(a + 0.9), Math.min(top + 1.5, h.y + 4), pole.z + (radius + 0.6) * Math.cos(a + 0.9));
      }
      headPos.lerp(target, 1 - Math.exp(-(b.step === "attack" ? 12 : 3) * dt));
      const g = head.current;
      if (g) {
         g.position.copy(headPos);
         const look = Math.atan2(h.x - headPos.x, h.z - headPos.z);
         g.rotation.set(asleep.current * 0.6, look, 0);
         const flash = b.flashMs > 0 ? 1.08 : 1;
         g.scale.setScalar((COIL_HEAD_LEN / GLB_SIZE.coilHead.z) * flash);
      }
      if (b.hp < lastHp.current) {
         lastHp.current = b.hp;
         if (b.phase === 2 || b.hp === 0) gongStrike.current = 1;
      }
      gongStrike.current = Math.max(0, gongStrike.current - dt * 1.4);
      void juice;
   });

   const body = (i: number, m: Matrix4) => {
      if (i % PLATE_EVERY === 0) return false;
      const u = i / (BODY_N - 1);
      const a = along(u, V);
      E.set(0, a - Math.PI / 2, 0.3);
      Q.setFromEuler(E);
      S.set(1, 1, 1);
      m.compose(V, Q, S);
   };
   const plates = Math.ceil(BODY_N / PLATE_EVERY);
   const plate = (i: number, m: Matrix4, col: Color) => {
      const u = (i * PLATE_EVERY) / (BODY_N - 1);
      if (u > 1) return false;
      const a = along(u, V);
      E.set(0, a - Math.PI / 2, 0.3);
      Q.setFromEuler(E);
      const s = COIL_SEG_W / GLB_SIZE.coilSegment.x;
      S.set(s, s, s);
      V.y -= 0.6;
      m.compose(V, Q, S);
      const b = run.boss;
      col.copy(b && b.defeatMs >= 0 ? dark.set("#5a8f7a") : dark.set("#ffffff"));
   };
   // phase 1's hazards on the stair itself: the sliding coil (red rim) and the plated segment to stomp
   const stairChunk = (i: number, m: Matrix4, col: Color) => {
      const b = run.boss;
      if (!b || b.phase !== 0) return false;
      const a = i === 0 ? run.coilA : run.plateA;
      if (Number.isNaN(a) || a < central.a0 || a > helixEnd(central)) return false;
      const r = pole.walk;
      V.set(pole.x + r * Math.sin(a), stairY(central, a), pole.z + r * Math.cos(a));
      E.set(0, a, 0);
      Q.setFromEuler(E);
      const s = (i === 0 ? 1.15 : 1) * (COIL_SEG_W / GLB_SIZE.coilSegment.x);
      S.set(s, s * 0.7, s);
      m.compose(V, Q, S);
      if (i === 0) col.set(b.step === "telegraph" && Math.sin(time.now * 20) > 0 ? "#ff8a8a" : "#ffffff");
      else col.copy(glowCol).multiplyScalar(1 + 0.5 * Math.sin(time.now * 8));
   };

   return (
      <>
         <DynamicInstanced count={BODY_N} update={body} parts={parts} name="coilstone-body" />
         <DynamicInstancedModel asset={ASSETS.coilSegment} count={plates} update={plate} />
         <DynamicInstancedModel asset={ASSETS.coilSegment} count={2} update={stairChunk} />
         <group ref={head}>
            <Model asset={ASSETS.coilHead} />
         </group>
         <group position={[pole.x, top, pole.z]}>
            <Gong run={run} strike={gongStrike} />
         </group>
      </>
   );
}

/** The Great Gong on the central cap (menu2/props): it glows while it can be rung and swings on a hit.
 *  Its props are plain numbers, so it re-renders only when their rounded values change. */
function Gong({ run, strike }: { run: SpinRun; strike: { current: number } }) {
   const time = useGameTime();
   const [look, setLook] = useState({ glow: 0.1, strike: 0 });
   useFrame(() => {
      const b = run.boss;
      const g = b && b.phase === 2 && b.step === "vulnerable" ? 0.6 + 0.4 * Math.sin(time.now * 5) : b && b.defeatMs >= 0 ? 1 : 0.1;
      const glow = Math.round(g * 10) / 10;
      const st = Math.round(strike.current * 10) / 10;
      if (glow !== look.glow || st !== look.strike) setLook({ glow, strike: st });
   });
   return (
      <group scale={0.9}>
         <GreatGong glow={look.glow} strike={look.strike} />
      </group>
   );
}
