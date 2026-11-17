"use client";

// The five heroes on the tower (World 6's tag-switch): each its own GLB on the shared Menu 2 animator
// (menu2/heroAnim); only the active one climbs. On a tag the one tagged out lingers a moment where it
// stood and fades (LINGER_MS), the new one appears in a colour swirl (Scene's juice). The motion is
// the ring's: the hero's velocity round the tower (a tangent) and up. A blob shadow on the ledge under it.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { LINGER_MS, TAG_ORDER, type TagHeroId } from "@/arcade3d/menu2/heroTag/rules";
import { R_PATH, STEP_ARC } from "./levels";
import { V_JUMP, V_RUN, ledgeSolid, type CbtRun } from "./rules";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   landAt: number;
   jumpAt: number;
   airJumpAt: number;
   hurtAt: number;
   hurtDir: number;
   winAt: number;
   /** the intro's landing timeline 0..1 (1 = standing), NaN when no intro runs */
   intro: number;
   /** where the hero tagged out stood (arc, height), and when (rules ms) */
   outA: number;
   outY: number;
   outHero: TagHeroId | null;
   outMs: number;
}

export function createHeroAnim(): HeroAnim {
   return { landAt: -9, jumpAt: -9, airJumpAt: -9, hurtAt: -9, hurtDir: 1, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN, outA: 0, outY: 0, outHero: null, outMs: -9999 };
}

export interface MotionMemo {
   jumpAt: number;
   airJumpAt: number;
   landAt: number;
   hurtAt: number;
   fallSpeed: number;
}

export function createMotionMemo(): MotionMemo {
   return { jumpAt: -9, airJumpAt: -9, landAt: -9, hurtAt: -9, fallSpeed: 0 };
}

export const INTRO_DROP = 14;

const POWER_KIND = { riko: "dash", nami: null, kiro: "shield", zuno: "magnet", vexa: "phase" } as const;

/** The animator's motion for the active hero this frame (pure: hero.test.ts drives it). */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: CbtRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const th = h.a / R_PATH;
   m.vx = h.va * Math.cos(th);
   m.vz = -h.va * Math.sin(th);
   m.vy = h.vy;
   m.grounded = h.grounded;
   const id = run.tag.active;
   const kind = POWER_KIND[id];
   m.power = kind && run.tag.powerUntil[id] >= ms ? kind : null;
   m.rolling = h.dashUntil >= ms;
   if (!Number.isNaN(anim.intro) && anim.intro < 0.97) {
      m.rolling = true;
      m.vy = -14 * (1 - anim.intro);
      m.grounded = false;
   }
   m.celebrating = now - anim.winAt >= 0;
   m.defeated = run.ended === "lose" || run.ended === "timeup";
   if (anim.airJumpAt !== memo.airJumpAt) {
      memo.airJumpAt = anim.airJumpAt;
      memo.jumpAt = anim.jumpAt;
      m.events.airJumped = true;
   } else if (anim.jumpAt !== memo.jumpAt) {
      memo.jumpAt = anim.jumpAt;
      m.events.jumped = true;
   }
   if (anim.landAt !== memo.landAt) {
      memo.landAt = anim.landAt;
      m.events.landed = true;
      m.events.landSpeed = memo.fallSpeed;
   }
   if (anim.hurtAt !== memo.hurtAt) {
      memo.hurtAt = anim.hurtAt;
      m.events.hurt = true;
      m.events.hurtX = anim.hurtDir * Math.cos(th);
      m.events.hurtZ = -anim.hurtDir * Math.sin(th);
   }
   if (!h.grounded) memo.fallSpeed = Math.max(0, -h.vy);
}

/** The surface under the hero for the shadow (a solid ledge, a skip ledge, the floor ring). */
export function floorUnder(run: CbtRun): number {
   const h = run.hero;
   const t = run.tower;
   let best = 0;
   const i = Math.round(h.a / STEP_ARC);
   for (const k of [i - 1, i, i + 1]) {
      if (k < 0 || k >= t.la.length || !ledgeSolid(run, k)) continue;
      if (Math.abs(h.a - t.la[k]) <= 2 && t.ly[k] <= h.y + 0.3 && t.ly[k] > best) best = t.ly[k];
   }
   for (let k = 0; k < t.skipA.length; k++) if (Math.abs(h.a - t.skipA[k]) <= 1.2 && t.skipY[k] <= h.y + 0.3 && t.skipY[k] > best) best = t.skipY[k];
   return best;
}

function OneHero({ id, run, anim, animator }: { id: TagHeroId; run: CbtRun; anim: HeroAnim; animator: HeroAnimator }) {
   const root = useRef<Group>(null);
   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      const active = run.tag.active === id;
      const lingering = !active && anim.outHero === id && run.simMs - anim.outMs < LINGER_MS;
      let a = h.a;
      let y = h.y;
      let visible = active;
      if (lingering) {
         a = anim.outA;
         y = anim.outY;
         visible = true;
         const k = 1 - (run.simMs - anim.outMs) / LINGER_MS;
         g.scale.setScalar(Math.max(0.05, k));
      } else g.scale.setScalar(1);
      if (active && !Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += INTRO_DROP * (1 - k) * (1 - k);
      }
      g.visible = visible;
      const th = a / R_PATH;
      g.position.set(Math.sin(th) * R_PATH, y, Math.cos(th) * R_PATH);
   });
   return (
      <group ref={root}>
         <AnimatedHero animator={animator} visible />
      </group>
   );
}

export function Heroes({ run, anim }: { run: CbtRun; anim: HeroAnim }) {
   const time = useGameTime();
   const shadow = useRef<Mesh>(null);
   const motions = useMemo(() => ({ riko: createHeroMotion(), nami: createHeroMotion(), kiro: createHeroMotion(), zuno: createHeroMotion(), vexa: createHeroMotion() }), []);
   const memo = useMemo(createMotionMemo, []);
   const opts = { topSpeed: V_RUN, jumpSpeed: V_JUMP, yaw: Math.PI / 2 };
   // one animator per hero (hooks in a fixed order), each with its own motion
   const riko = useHeroAnimator("riko", motions.riko, opts);
   const nami = useHeroAnimator("nami", motions.nami, opts);
   const kiro = useHeroAnimator("kiro", motions.kiro, opts);
   const zuno = useHeroAnimator("zuno", motions.zuno, opts);
   const vexa = useHeroAnimator("vexa", motions.vexa, opts);
   const animators: Record<TagHeroId, HeroAnimator> = { riko, nami, kiro, zuno, vexa };

   useFrame(() => {
      for (const id of TAG_ORDER) {
         const m = motions[id];
         if (id === run.tag.active) writeHeroMotion(m, memo, run, anim, time.now);
         else {
            // benched: standing (the lingering one keeps its last facing)
            m.vx = m.vy = m.vz = 0;
            m.grounded = true;
            m.power = null;
            m.rolling = false;
         }
      }
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame(() => {
      const s = shadow.current;
      if (!s) return;
      const h = run.hero;
      const floor = floorUnder(run);
      const above = h.y - floor;
      const th = h.a / R_PATH;
      s.visible = above < 10 && Number.isNaN(anim.intro);
      s.position.set(Math.sin(th) * R_PATH, floor + 0.06, Math.cos(th) * R_PATH);
      const k = Math.max(0.35, 1 - above / 6);
      s.scale.set(k, k, k);
      (s.material as MeshBasicMaterial).opacity = 0.34 * k;
   });

   return (
      <>
         {TAG_ORDER.map((id) => (
            <OneHero key={id} id={id} run={run} anim={anim} animator={animators[id]} />
         ))}
         <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
            <circleGeometry args={[0.5, 20]} />
            <meshBasicMaterial color="#0b0a12" transparent opacity={0.3} depthWrite={false} />
         </mesh>
      </>
   );
}
