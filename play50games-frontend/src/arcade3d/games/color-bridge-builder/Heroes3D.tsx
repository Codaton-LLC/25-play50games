"use client";

// The active hero of a team, on the shared menu2 animator: it steps cell to cell (a hop on Nyla's leap,
// a streak on Riko's dash), sinks into the abyss and pops back on its last rock, and swaps to another
// hero on a Tag (the model is re-made for the new hero with a flash of its colour). Kiro's shield
// bubble; Vexa's phase turns her see-through.
import { useMemo, useReducer, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { AnimatedHero, createHeroMotion, useHeroAnimator } from "../../menu2/heroAnim";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import { useGameTime } from "../../core/gameTime";
import type { M2HeroId } from "../../menu2/heroModels";
import { CELL } from "./levels";
import { DASH, LEAP, STEP_MS, type Team } from "./rules";
import { cellPos } from "./Board";

const YAW = [Math.PI, Math.PI / 2, 0, -Math.PI / 2];

function Body({ team, heroId, intro }: { team: Team; heroId: M2HeroId; intro?: MutableRefObject<number> }) {
   const root = useRef<Group>(null);
   const shield = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const animator = useHeroAnimator(heroId, motion, { topSpeed: CELL / (STEP_MS / 1000), yaw: 0 });
   const time = useGameTime();
   useFrame(() => {
      const t = team;
      const speed = t.moving ? CELL / ((t.moving === "walk" ? STEP_MS : t.moving === "dash" ? DASH.ms / DASH.cells : LEAP.ms / LEAP.cells) / 1000) : 0;
      motion.vx = 0;
      motion.vz = speed;
      motion.vy = 0;
      motion.grounded = t.moving !== "leap" && t.fallMs === 0;
      motion.rolling = t.moving === "dash";
      motion.celebrating = t.ended === "win";
      motion.defeated = t.ended === "timeup";
      motion.power = t.powerMs > 0 ? ({ riko: "dash", nami: null, kiro: "shield", zuno: "magnet", vexa: "phase" } as const)[t.heroId] : null;
      if (t.ev.fell) {
         motion.events.hurt = true;
         motion.events.hurtX = 0;
         motion.events.hurtZ = 1;
      }
      if (t.moving === "leap" && t.moveMs < 20) motion.events.jumped = true;
   }, FRAME_PRIORITY.pose - 0.01);
   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const t = team;
      const k = t.moving ? Math.min(1, t.moveMs / t.moveDur) : 1;
      const a = cellPos(t.fr, t.fc);
      const b = cellPos(t.r, t.c);
      const x = t.moving ? a.x + (b.x - a.x) * k : b.x;
      const z = t.moving ? a.z + (b.z - a.z) * k : b.z;
      let y = t.moving === "leap" ? Math.sin(k * Math.PI) * 1.6 : 0;
      if (t.fallMs > 0) y = -(Math.min(1, (1000 - t.fallMs) / 600) ** 2) * 12;
      g.position.set(x, y, z);
      if (intro) g.position.y += (1 - intro.current) * 8;
      g.rotation.y = YAW[t.facing];
      g.visible = !(t.heroId === "vexa" && t.powerMs > 0 && Math.floor(time.now * 12) % 2 === 0);
      if (shield.current) shield.current.visible = t.heroId === "kiro" && t.powerMs > 0;
   });
   return (
      <group ref={root}>
         <AnimatedHero animator={animator} />
         <mesh ref={shield} position={[0, 0.7, 0]} visible={false}>
            <sphereGeometry args={[0.95, 24, 16]} />
            <meshStandardMaterial color="#4ade80" emissive="#22c55e" emissiveIntensity={0.6} transparent opacity={0.3} depthWrite={false} />
         </mesh>
      </group>
   );
}

/** re-mounts the body when the team tags another hero */
export function TeamHero({ team, intro }: { team: Team; intro?: MutableRefObject<number> }) {
   const holder = useRef<{ id: M2HeroId; n: number }>({ id: team.heroId, n: 0 });
   const [, force] = useForce();
   useFrame(() => {
      if (team.heroId !== holder.current.id) {
         holder.current = { id: team.heroId, n: holder.current.n + 1 };
         force();
      }
   });
   return <Body key={`${holder.current.id}-${holder.current.n}`} team={team} heroId={holder.current.id} intro={intro} />;
}

function useForce(): [number, () => void] {
   const [n, inc] = useReducer((x: number) => x + 1, 0);
   return [n, inc as () => void];
}
