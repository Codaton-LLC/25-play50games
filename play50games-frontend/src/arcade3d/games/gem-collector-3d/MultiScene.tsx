"use client";

// Gem Collector 3D with 2-4 local players (menu2/multiplayer): the same vault as solo, one hero per
// player (Hero.tsx) with a ring and a tether in the player's colour, the runs stepped together by
// multiplayer.ts with each player's own device, and the shared camera framing every hero (the orbit
// turns it). The floor's gems are one pool for everyone. Level 5 shows player 1's Glutton.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Mesh, PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { JuiceLayer, useJuice } from "@/arcade3d/menu2/juice";
import { heroAccent } from "@/arcade3d/menu2/heroAnim";
import { playSfx } from "@/arcade3d/core/audio";
import { randomSeed } from "@/arcade3d/core/math";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import type { LevelId } from "@/arcade3d/types";
import type { AABB } from "@/arcade3d/core/collision";
import { PLAYER_COLORS, playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { PlayerInputLatch, playerInputFor } from "@/arcade3d/menu2/multiplayer/MultiplayerInput";
import { SharedCamera } from "@/arcade3d/menu2/multiplayer/SharedCamera";
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitDriver } from "@/arcade3d/menu2/camera/OrbitCamera";
import { Vault, type VisualClock } from "./Vault";
import { Gems, Tethers } from "./Gems";
import { Glutton, Slimes } from "./Creatures";
import { Hero, createHeroAnim, floorUnder, type HeroAnim } from "./Hero";
import { FOV, arenaSolids, vaultOrbit } from "./camera";
import { createStepInput, type StepInput } from "./rules";
import { createMultiRun, stepMulti, type MultiRun } from "./multiplayer";
import type { HeroId } from "./heroes";
import type { ArenaSpec } from "./levels";

/** The shared camera: tilt, and the zoom limits (m). */
export const MP_CAMERA = { pitch: 0.75, minSpan: 12, maxSpan: 34, padding: 3 } as const;

function MultiSimulation({ multi, anims, clock, orbit }: { multi: MultiRun; anims: HeroAnim[]; clock: VisualClock; orbit: OrbitState }) {
   const juice = useJuice();
   const time = useGameTime();
   const inputs = useMemo<StepInput[]>(() => multi.runs.map(() => createStepInput()), [multi]);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);

   useEffect(() => {
      playersStore.getState().beginRun();
   }, [multi]);

   useRunFrame((_state, dt) => {
      for (let i = 0; i < multi.runs.length; i++) {
         const p = playerInputFor(i);
         const s = inputs[i];
         s.moveX = p.moveX;
         s.moveZ = p.moveY;
         s.yaw = orbit.viewYaw;
         s.jumpPressed = p.jumpPressed;
         s.jumpHeld = p.jump;
         s.actionPressed = p.actionPressed;
      }
      const events = stepMulti(multi, dt * 1000, inputs);
      const now = time.now;
      const players = playersStore.getState();
      for (let i = 0; i < multi.runs.length; i++) {
         const run = multi.runs[i];
         const ev = events[i];
         const anim = anims[i];
         const h = run.hero;
         chest.x = h.x;
         chest.y = h.y + 1.1;
         chest.z = h.z;
         if (ev.airJumped) anim.airJumpAt = now;
         else if (ev.jumped) anim.jumpAt = now;
         if (ev.landed) anim.landAt = now;
         if (ev.knocked || ev.fell) {
            anim.hurtAt = now;
            anim.hurtX = h.vx;
            anim.hurtZ = h.vz;
         }
         if (ev.picked >= 0) playSfx("pickup", { volume: 0.3, pitch: 0.8 + Math.min(1.2, run.n * 0.05) });
         if (ev.powered) {
            juice.burst("pickup", chest, 16, { color: heroAccent(run.heroId) });
            playSfx("whoosh", { volume: 0.4, pitch: 1.15 });
         }
         if (ev.bankPoints > 0) {
            juice.burst("checkpoint", chest, 30, { color: PLAYER_COLORS[i] });
            juice.popup(chest, `P${i + 1} +${ev.bankPoints}`, { color: PLAYER_COLORS[i], size: 0.07 });
            playSfx("chime", { pitch: 1.2 });
         }
         if (ev.cut >= 0 && ev.cutLinks > 0) juice.popup(chest, `P${i + 1} snap!`, { color: PLAYER_COLORS[i], size: 0.05 });
         if (ev.bossHit) {
            juice.popup(chest, `P${i + 1} hit!`, { color: PLAYER_COLORS[i], size: 0.07 });
            juice.shake(0.2);
         }
         players.setPosition(i, h.x, h.y, h.z);
         const p = players.players[i];
         if (p && (p.score !== run.score || p.progress !== run.score)) players.update(i, { score: run.score, progress: run.score, finished: false, finishMs: null });
      }
      if (multi.ended !== null) useArcadeStore.getState().end(multi.ended);
   });

   useFrame(() => {
      const s = useArcadeStore.getState();
      if (s.phase === "countdown") clock.ms = -s.countdownMs;
      else if (s.phase === "over") clock.ms = multi.simMs + s.overMs;
      else clock.ms = multi.simMs;
   }, FRAME_PRIORITY.camera);
   return null;
}

/** A ring in the player's colour under each hero, so everyone finds their own. */
function PlayerRing({ multi, index }: { multi: MultiRun; index: number }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const r = multi.runs[index];
      const h = r.hero;
      m.position.set(h.x, Math.max(0, floorUnder(r)) + 0.06, h.z);
      const pulse = 1 + Math.sin(time.now * 4 + index) * 0.06;
      m.scale.set(pulse, pulse, pulse);
   });
   return (
      <mesh ref={ref} rotation-x={-Math.PI / 2} renderOrder={2}>
         <ringGeometry args={[0.7, 0.9, 32]} />
         <meshBasicMaterial color={PLAYER_COLORS[index]} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<ArenaSpec>();
   const levelId: LevelId = config?.id ?? 1;
   const mode = usePlayers((s) => s.mode);
   const heroKey = usePlayers((s) => s.players.map((p) => p.heroId).join(","));
   const multi = useMemo(
      () => createMultiRun(randomSeed(), levelId, heroKey.split(",").filter(Boolean) as HeroId[], mode),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [runId, levelId, heroKey, mode],
   );
   const anims = useMemo(() => multi.runs.map(createHeroAnim), [multi]);
   const clock = useMemo<VisualClock>(() => ({ ms: 0 }), [multi]);
   const points = useMemo(() => multi.runs.map((r) => r.hero), [multi]);
   const active = useMemo(() => {
      const out: boolean[] = [];
      return () => {
         for (let i = 0; i < multi.runs.length; i++) out[i] = multi.runs[i].ended === null;
         return out;
      };
   }, [multi]);
   const anchor = useMemo(() => () => "centroid" as const, []);
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   useEffect(() => {
      camera.fov = FOV;
      camera.updateProjectionMatrix();
   }, [camera]);
   const view = multi.runs[0];
   const orbit = useMemo(() => createOrbit({ ...vaultOrbit(view.arena), pitch: MP_CAMERA.pitch }), [view]);
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         out.x = 0;
         out.z = 0;
      },
      [],
   );
   const solids = useMemo(() => (out: AABB[]) => arenaSolids(view, camera.position.x, camera.position.z, out), [view, camera]);
   return (
      <JuiceLayer>
         <Vault run={view} clock={clock} />
         <Gems key={levelId} runs={multi.runs} clock={clock} />
         <Tethers runs={multi.runs} colors={PLAYER_COLORS} />
         <Slimes run={view} clock={clock} />
         <Glutton run={view} clock={clock} />
         {multi.runs.map((r, i) => (
            <Hero key={i} run={r} anim={anims[i]} />
         ))}
         {multi.runs.map((_r, i) => (
            <PlayerRing key={i} multi={multi} index={i} />
         ))}
         <PlayerInputLatch />
         <MultiSimulation multi={multi} anims={anims} clock={clock} orbit={orbit} />
         <OrbitDriver orbit={orbit} travel={travel} />
         <SharedCamera
            points={points}
            active={active}
            anchor={anchor}
            pitch={MP_CAMERA.pitch}
            minSpan={MP_CAMERA.minSpan}
            maxSpan={MP_CAMERA.maxSpan}
            padding={MP_CAMERA.padding}
            fov={FOV}
            orbit={orbit}
            solids={solids}
         />
      </JuiceLayer>
   );
}
