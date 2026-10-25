"use client";

import { useFrame } from "@react-three/fiber";
import React, { useEffect, useRef, useSyncExternalStore } from "react";
import type { Group, Object3D } from "three";
import { createStore } from "zustand/vanilla";
import { Model } from "../../core/assets";
import { playSfx, startLoop, useMuted } from "../../core/audio";
import CameraRig from "../../core/CameraRig";
import type { AABB, Vec3Like } from "../../core/collision";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import { Trail, useFx } from "../../core/fx";
import { useGameTime } from "../../core/gameTime";
import { useInput } from "../../core/input";
import { BlobShadow } from "../../core/render";
import { HumanoidModel } from "../../core/rig/HumanoidModel";
import { createPose } from "../../core/rig/poses";
import { arcadeStore, useArcadeStore } from "../../core/useArcadeStore";
import { useLevel } from "../../core/level";
import { useFittedView } from "../../core/useFittedView";
import { useRunFrame } from "../../core/useRunFrame";
import { Arena } from "./Arena";
import { ASSETS } from "./assets";
import { Dummies } from "./Dummies";
import styles from "./Hud.module.css";
import type { KnightLevel } from "./levels";
import {
   guardPose,
   lungeStepOffset,
   SHIELD_MOUNT,
   slashPose,
   spinPose,
   spinYawOffset,
   SWORD_MOUNT,
   victoryPose,
} from "./poses";
import { FIT, PLAY_BOUNDS } from "./looks";
import { KnightPrimitive, ShieldPrimitive, SwordPrimitive } from "./Primitives";
import {
   BEAT,
   COLORS,
   createRun,
   KNIGHT,
   POSTS,
   SPIN,
   stepRun,
   type StrikeDir,
} from "./rules";

export const CAMERA_CONFIG = {
   position: [0, 7.8, 6.2] as [number, number, number],
   lookAt: [0, 0.5, 0] as [number, number, number],
   fov: FIT.fov,
};

const ARENA_BOX: AABB = {
   min: { x: PLAY_BOUNDS.x0, y: PLAY_BOUNDS.y0, z: PLAY_BOUNDS.z0 },
   max: { x: PLAY_BOUNDS.x1, y: PLAY_BOUNDS.y1, z: PLAY_BOUNDS.z1 },
};

const FOCUS: readonly Vec3Like[] = FIT.focus;
const YAWS: readonly number[] = FIT.yaws;
const PITCH = FIT.pitch;

interface HudSnapshot {
   spinMeter: number;
   spinReady: boolean;
   bpm: number;
   stage: number;
   metronome: boolean;
   toggleMetronome: () => void;
}

const hudStore = createStore<HudSnapshot>((set) => ({
   spinMeter: 0,
   spinReady: false,
   bpm: 100,
   stage: 1,
   metronome: false,
   toggleMetronome: () => set((s) => ({ metronome: !s.metronome })),
}));

let runSeedCursor = 0;
function nextRotationalSeed(): number {
   const seed = BEAT.MAP_SEEDS[runSeedCursor % BEAT.MAP_SEEDS.length];
   runSeedCursor = (runSeedCursor + 1) % BEAT.MAP_SEEDS.length;
   return seed;
}

function SwordAttachment({ tipRef }: { tipRef: React.RefObject<Object3D> }): React.ReactElement {
   return (
      <group>
         <Model
            asset={ASSETS.sword}
            position={SWORD_MOUNT.position}
            rotation={SWORD_MOUNT.rotation}
            fallback={<SwordPrimitive />}
         />
         {/* Sword tip tracker for <Trail target={tipRef} /> */}
         <object3D ref={tipRef} position={SWORD_MOUNT.position} />
      </group>
   );
}

function ShieldAttachment(): React.ReactElement {
   return (
      <Model
         asset={ASSETS.shield}
         position={SHIELD_MOUNT.position}
         rotation={SHIELD_MOUNT.rotation}
         fallback={<ShieldPrimitive />}
      />
   );
}

export const useKnightLevel = () => useLevel<KnightLevel>();

function ArenaPlay(): React.ReactElement {
   const { config } = useKnightLevel();
   const phase = useArcadeStore((s) => s.phase);
   const muted = useMuted();
   const input = useInput();
   const fx = useFx();
   const gameTime = useGameTime();

   const view = useFittedView({
      area: ARENA_BOX,
      pitch: PITCH,
      yaws: YAWS,
      focus: FOCUS,
      fov: CAMERA_CONFIG.fov,
      padding: FIT.padding,
      shift: FIT.shift,
   });

   const runRef = useRef(createRun(nextRotationalSeed(), config));
   const poseRef = useRef(createPose());
   const knightGroupRef = useRef<Group>(null);
   const swordTipRef = useRef<Object3D>(null!);
   const lastMetronomeBeatRef = useRef(-1);
   const lastStatsRef = useRef({ combo: 1, spin: 0, bpm: 100, stage: 1 });

   // Warm particle pools and initialize HUD stats on mount
   useEffect(() => {
      fx.warm("sparks", "sparkle", "confetti", "puff", "score");
      const store = arcadeStore.getState();
      const run = runRef.current;
      store.setStat("combo", 1);
      store.setStat("spin", 0);
      store.setStat("bpm", run.bpm);
      hudStore.setState({ spinMeter: 0, spinReady: false, bpm: run.bpm, stage: 1 });
   }, [fx]);

   // Ambient loop during active play
   useEffect(() => {
      if (phase !== "playing" || muted) return;
      const loop = startLoop("ambient", { volume: 0.32 });
      return () => loop.stop();
   }, [phase, muted]);

   // Keyboard shortcut 'M' to toggle metronome click
   useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
         if (e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
         if (e.key === "m" || e.key === "M") {
            hudStore.getState().toggleMetronome();
         }
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
   }, []);

   useRunFrame((_, dt, time) => {
      const run = runRef.current;
      const inp = input.current;

      // Read discrete directional strike (Arrows / WASD / D-pad / Swipe; `pressed` already includes swipes)
      let strikeDir: StrikeDir | null = null;
      if (inp.pressed.up) strikeDir = "up";
      else if (inp.pressed.down) strikeDir = "down";
      else if (inp.pressed.left) strikeDir = "left";
      else if (inp.pressed.right) strikeDir = "right";

      const spin = inp.actionPressed || inp.jumpPressed;
      const prevStreak = run.streak;

      stepRun(run, { strikeDir, spin }, dt, time);

      // Optional Metronome click on each beat
      if (hudStore.getState().metronome) {
         const nextIdx = lastMetronomeBeatRef.current + 1;
         const times = run.beatTimesMs;
         if (nextIdx < times.length && run.timeMs >= times[nextIdx]) {
            lastMetronomeBeatRef.current = nextIdx;
            playSfx("click", { pitch: 1.35, volume: 0.45 });
         }
      }

      // Sync score and HUD stats when changed
      const store = arcadeStore.getState();
      if (store.score !== run.score) {
         store.setScore(run.score);
      }

      const prev = lastStatsRef.current;
      if (
         prev.combo !== run.combo ||
         prev.spin !== run.spinMeter ||
         prev.bpm !== run.bpm ||
         prev.stage !== run.stage
      ) {
         prev.combo = run.combo;
         prev.spin = run.spinMeter;
         prev.bpm = run.bpm;
         prev.stage = run.stage;
         store.setStat("combo", run.combo);
         store.setStat("spin", run.spinMeter);
         store.setStat("bpm", run.bpm);
         hudStore.setState({
            spinMeter: run.spinMeter,
            spinReady: run.spinMeter >= SPIN.MAX_METER,
            bpm: run.bpm,
            stage: run.stage,
         });
      }

      // Trigger FX & SFX for events from this step
      for (const ev of run.events) {
         const post = POSTS[ev.postIndex];
         const hitPos = { x: post.x, y: 1.1, z: post.z };
         const scorePos = { x: post.x, y: 1.65, z: post.z };
         if (ev.kind === "hit") {
            const color = ev.onBeat ? COLORS.activeRing : COLORS.regular;
            fx.burst("sparkle", hitPos, ev.onBeat ? 12 : 6);
            fx.burst("sparks", hitPos, ev.onBeat ? 14 : 8);
            fx.shake(0.1);
            fx.score(scorePos, `+${ev.points}`, { color });
            playSfx(ev.onBeat ? "pickup" : "hit", { pitch: ev.onBeat ? 1.15 : 0.95 });
            if (
               (prevStreak < 9 && run.streak >= 9) ||
               (prevStreak < 17 && run.streak >= 17) ||
               (prevStreak < 25 && run.streak >= 25)
            ) {
               playSfx("combo");
            }
         } else if (ev.kind === "shieldCrack") {
            fx.burst("sparkle", hitPos, 8);
            fx.burst("sparks", hitPos, 12);
            fx.shake(0.1);
            fx.score(scorePos, `+${ev.points}`, { color: COLORS.shield });
            playSfx("thud", { pitch: 1.25 });
         } else if (ev.kind === "spinSweep") {
            fx.burst("confetti", { x: 0, y: 1.2, z: 0 }, 24);
            fx.shake(0.28);
            fx.score({ x: 0, y: 1.95, z: 0 }, `SPIN +${ev.points}`, { color: COLORS.gold });
            playSfx("whoosh", { pitch: 1.1 });
            playSfx("chime", { pitch: 1.2 });
         } else if (ev.kind === "tomatoHit") {
            fx.burst("puff", { x: post.x, y: 1.0, z: post.z }, 14);
            fx.shake(0.35);
            fx.score(scorePos, `${ev.points}`, { color: COLORS.tomato });
            playSfx("splash", { pitch: 0.85 });
            playSfx("buzz", { pitch: 0.9 });
         } else if (ev.kind === "whiff") {
            playSfx("whoosh", { pitch: 0.9, volume: 0.65 });
         } else if (ev.kind === "miss") {
            fx.burst("puff", { x: post.x, y: 0.9, z: post.z }, 6);
         }
      }
   });

   // Update knight pose and root transform at FRAME_PRIORITY.pose (before HumanoidModel skins bones)
   useFrame(() => {
      const run = runRef.current;
      const t = gameTime.now;
      const pose = poseRef.current;
      const group = knightGroupRef.current;
      if (!group) return;

      let yaw = run.knightYaw;
      let offset = { x: 0, y: 0, z: 0 };

      if (phase === "over" && run.score > 0) {
         victoryPose(t, pose);
         offset = lungeStepOffset(0, false, 0, pose);
      } else if (run.spinTimerS > 0) {
         const u = 1 - run.spinTimerS / SPIN.DURATION_S;
         spinPose(u, pose);
         yaw += spinYawOffset(u);
         offset = lungeStepOffset(0, false, 0, pose);
      } else if (run.swingTimerS > 0) {
         const u = 1 - run.swingTimerS / KNIGHT.SWING_DURATION_S;
         slashPose(run.swingDir, u, run.swingIsFar, pose);
         offset = lungeStepOffset(u, run.swingIsFar, run.swingPostYaw, pose);
      } else {
         guardPose(t, pose);
         offset = lungeStepOffset(0, false, 0, pose);
      }

      group.position.set(offset.x, offset.y, offset.z);
      group.rotation.set(0, yaw, 0);
   }, FRAME_PRIORITY.pose);

   return (
      <group>
         <CameraRig
            camera={CAMERA_CONFIG}
            offset={view.offset}
            shift={view.shift}
         />
         <Arena />
         <Dummies runRef={runRef} />

         <group ref={knightGroupRef}>
            <BlobShadow radius={0.42} opacity={0.38} />
            <HumanoidModel
               asset={ASSETS.knight}
               pose={poseRef.current}
               applyLift={false}
               attach={{
                  handR: <SwordAttachment tipRef={swordTipRef} />,
                  handL: <ShieldAttachment />,
               }}
               fallback={<KnightPrimitive />}
            />
         </group>

         <Trail target={swordTipRef} width={0.22} length={10} color={COLORS.gold} />
      </group>
   );
}

export function KnightArenaScene(): React.ReactElement {
   const { id } = useKnightLevel();
   return <ArenaPlay key={id} />;
}

export function KnightArenaHud(): React.ReactElement {
   const spinReady = useSyncExternalStore(
      hudStore.subscribe,
      () => hudStore.getState().spinReady,
      () => false,
   );
   const metronome = useSyncExternalStore(
      hudStore.subscribe,
      () => hudStore.getState().metronome,
      () => false,
   );
   const stage = useSyncExternalStore(
      hudStore.subscribe,
      () => hudStore.getState().stage,
      () => 1,
   );

   return (
      // below the shell's chip row; a right-hand column in phone landscape (Hud.module.css)
      <div data-arcade-safe-area className={styles.panel}>
         <span
            style={{
               padding: "4px 10px",
               borderRadius: 999,
               background: "rgba(15, 23, 42, 0.78)",
               border: "1px solid rgba(248, 250, 252, 0.18)",
               color: "#f8fafc",
               fontSize: 12,
               fontWeight: 700,
               letterSpacing: "0.04em",
            }}
         >
            STAGE {stage}/4
         </span>

         {spinReady && (
            <span
               role="status"
               aria-live="polite"
               style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #f59e0b, #facc15)",
                  color: "#0f172a",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  boxShadow: "0 0 14px rgba(250, 204, 21, 0.65)",
               }}
            >
               SPIN READY! [SPACE / SPIN]
            </span>
         )}

         <button
            type="button"
            onClick={() => hudStore.getState().toggleMetronome()}
            aria-pressed={metronome}
            title="Toggle beat metronome click (M)"
            style={{
               padding: "4px 10px",
               borderRadius: 999,
               background: metronome ? "rgba(37, 99, 235, 0.88)" : "rgba(15, 23, 42, 0.78)",
               border: "1px solid rgba(248, 250, 252, 0.22)",
               color: "#f8fafc",
               fontSize: 12,
               fontWeight: 600,
               cursor: "pointer",
            }}
         >
            Metronome [M]: {metronome ? "ON" : "OFF"}
         </button>
      </div>
   );
}
