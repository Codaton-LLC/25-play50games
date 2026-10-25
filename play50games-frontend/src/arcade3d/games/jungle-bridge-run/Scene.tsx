"use client";

// One useRunFrame steps rules.ts (and syncs the store); visuals read the run and animate on useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Euler, Matrix4, Quaternion, Vector3, type Group } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import { SkyDome, Water } from "@/arcade3d/core/env";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { BlobShadow, DynamicInstanced } from "@/arcade3d/core/render";
import { BONE, HumanoidModel, cheerPose, flailPose, gaitPhaseStep, jumpPose, turnBone, useHumanoidPose, walkPose, wrapPhase } from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, EXPLORER_LANDMARKS, EXPLORER_SCALE, FIT } from "./assets";
import { LEVELS, type JungleLevel } from "./levels";
import { COLORS, FOV, LOOK_AHEAD_Z, VIEW_CONFIG, WATER_Y, backdropFor, decorSpots, gateSpots, lavaSpots, pillarSpots, trackSpots, vineSpots } from "./looks";
import {
   ExplorerPrimitive,
   PartsInstanced,
   deckParts,
   fernParts,
   gateParts,
   gemParts,
   hangingVineParts,
   lavaCrustParts,
   lavaGlowParts,
   logParts,
   pillarParts,
   rockParts,
   ropeParts,
   stiltParts,
   treeParts,
   useParts,
   vineBarParts,
} from "./Primitives";
import { LAVA_ON, LAVA_PERIOD, createRun, finishZ, isLavaActive, logXAt, step, syncStore, type LogObstacle, type Run, type RunnerInput } from "./rules";

const V = new Vector3();
const Q = new Quaternion();
const E = new Euler();
const S = new Vector3();
const M1 = new Matrix4();
const AT = { x: 0, y: 0, z: 0 };

function LevelScene() {
   const { id, config } = useLevel<JungleLevel>();
   const level = config ?? LEVELS[1];
   const view = useFittedView(VIEW_CONFIG);
   const input = useInput();
   const time = useGameTime();
   const fx = useFx();
   const quality = useQuality();
   const camera = useThree((s) => s.camera);
   const [run] = useState<Run>(() => createRun(randomSeed(), level, id));
   const aim = useRef({ x: 0, y: 0, z: LOOK_AHEAD_Z }).current;
   const body = useRef<Group>(null);
   const backdropRef = useRef<Group>(null);
   const gait = useRef({ phase: 0 }).current;
   const runnerInput = useRef<RunnerInput>({}).current;

   const track = useMemo(() => trackSpots(run), [run]);
   const gates = useMemo(() => gateSpots(run), [run]);
   const pillars = useMemo(() => pillarSpots(run), [run]);
   const vines = useMemo(() => vineSpots(run), [run]);
   const lavas = useMemo(() => lavaSpots(run), [run]);
   const logs = useMemo(() => run.sections.flatMap((s) => s.obstacles.filter((o): o is LogObstacle => o.kind === "log")), [run]);
   const decor = useMemo(() => {
      const d = decorSpots(id, level);
      const keep = <T,>(a: T[]) => a.slice(0, scaledCount(a.length, quality.decor));
      return { ...d, trees: keep(d.trees), ferns: keep(d.ferns), vines: keep(d.vines) };
   }, [id, level, quality.decor]);
   const backdrop = useMemo(() => backdropFor(level), [level]);
   const trackEnd = finishZ(level);

   const parts = {
      deck: useParts(deckParts),
      rope: useParts(ropeParts),
      gate: useParts(gateParts),
      pillar: useParts(pillarParts),
      log: useParts(logParts),
      rock: useParts(rockParts),
      tree: useParts(treeParts),
      fern: useParts(fernParts),
      hanging: useParts(hangingVineParts),
      vine: useParts(vineBarParts),
      crust: useParts(lavaCrustParts),
      glow: useParts(lavaGlowParts),
      gem: useParts(gemParts),
      stilt: useParts(stiltParts),
   };

   useEffect(() => {
      fx.warm("sparkle", "splash", "smoke", "sparks", "confetti", "score");
   }, [fx]);

   useRunFrame((_state, dt) => {
      const { pressed, jumpPressed } = input.current;
      // one press = one move; `pressed` already carries the swipes (never read `swipe` too)
      runnerInput.left = pressed.left;
      runnerInput.right = pressed.right;
      runnerInput.jump = jumpPressed || pressed.up;
      runnerInput.slide = pressed.down;
      const store = useArcadeStore.getState();
      const ev = step(run, runnerInput, dt, store.timeLeftMs ?? 0);
      syncStore(run, ev, useArcadeStore);
      AT.x = run.x;
      AT.y = 0.9 + run.y;
      AT.z = run.z;
      if (ev.jump) playSfx("jump", { volume: 0.4 });
      if (ev.slide) playSfx("whoosh", { volume: 0.4 });
      if (ev.gemCollected) {
         playSfx("pickup", { volume: 0.45 });
         fx.burst("sparkle", AT, 12);
         fx.score(AT, "+20", { color: COLORS.gem });
      }
      if (ev.sectionCleared) {
         playSfx("chime", { volume: 0.5 });
         AT.y = 2.6;
         fx.score(AT, "+100", { color: COLORS.accent });
      }
      if (ev.lifeLost) {
         playSfx(run.lastHit === "gap" || run.lastHit === "bridge" ? "splash" : "hit", { volume: 0.5 });
         fx.shake(0.35);
         fx.burst(run.lastHit === "lava" ? "sparks" : "splash", AT, 14);
      }
      if (ev.won) {
         playSfx("win");
         AT.y = 2.2;
         fx.burst("confetti", AT, 36);
      }
      aim.z = run.z + LOOK_AHEAD_Z;
   });

   const pose = useHumanoidPose((p) => {
      if (run.over === "win") {
         cheerPose(time.now, p);
         return;
      }
      if (run.respawning || run.over === "lose") {
         flailPose(time.now, p);
         return;
      }
      if (run.jumpTimer > 0) {
         jumpPose(Math.min(1, run.y / 0.9), p);
         return;
      }
      gait.phase = wrapPhase(gait.phase + gaitPhaseStep(1, EXPLORER_LANDMARKS, EXPLORER_SCALE, run.speed, time.delta, 3.2));
      walkPose(gait.phase, 1, p);
      if (run.slideTimer > 0) {
         // the slide: a long lean back through the spine and chest (the group also tips back)
         turnBone(p, BONE.spine, -0.5, 0, 0);
         turnBone(p, BONE.chest, -0.3, 0, 0);
      }
   });

   useFrame(() => {
      const g = body.current;
      if (g) {
         // a fall into a gap or off a bridge drops the runner during the respawn wait
         const falling = run.respawning && (run.lastHit === "gap" || run.lastHit === "bridge");
         const drop = falling ? Math.min(6, (0.8 - run.respawnTimer) * 9) : 0;
         g.position.set(run.x, run.y - drop, run.z);
         g.rotation.set(run.slideTimer > 0 && !run.respawning ? -0.9 : 0, 0, (run.laneToX - run.x) * -0.12);
      }
      if (backdropRef.current && backdrop) backdropRef.current.position.set(backdrop.x, backdrop.y, camera.position.z + backdrop.dz);
   }, FRAME_PRIORITY.visuals);

   const placeLog = (i: number, m: Matrix4) => {
      const log = logs[i];
      if (!log) return false;
      const x = logXAt(log, run.time);
      // rolls about its own axis (z) as it crosses: roll angle = distance / radius
      E.set(0, 0, -x / (FIT.logDiameter / 2));
      Q.setFromEuler(E);
      V.set(x, FIT.logDiameter / 2, log.z);
      S.set(1, 1, 1);
      m.compose(V, Q, S);
      M1.makeTranslation(0, -FIT.logDiameter / 2, 0);
      m.multiply(M1);
   };
   const placeGem = (i: number, m: Matrix4) => {
      const g = run.gems[i];
      if (!g || g.collected || g.z < run.z - 4) return false;
      E.set(0, time.now * 1.8 + i, 0);
      Q.setFromEuler(E);
      V.set(g.x, g.y + 0.25 + Math.sin(time.now * 2.6 + i) * 0.06, g.z);
      S.set(1, 1, 1);
      m.compose(V, Q, S);
   };
   const placeGlow = (i: number, m: Matrix4) => {
      const spot = lavas[i];
      if (!spot || !isLavaActive(run.time)) return false;
      const k = (run.time % LAVA_PERIOD) / LAVA_ON;
      Q.identity();
      V.set(spot.x, 0, spot.z);
      S.set(1, 0.4 + Math.sin(k * Math.PI) * 0.9, 1);
      m.compose(V, Q, S);
   };

   return (
      <>
         <CameraRig camera={{ position: view.offset, fov: FOV, lookAt: [0, 0, LOOK_AHEAD_Z] }} follow={aim} offset={view.offset} shift={view.shift} damping={8} />
         <SkyDome top={level.lighting === "sunset" ? "#7c2d12" : "#0ea5e9"} bottom={level.background} />
         <Water position={[0, WATER_Y, trackEnd / 2]} size={[160, trackEnd + 160]} color={COLORS.water} deep={COLORS.waterDeep} />

         {/* the track: plank lanes, rope bridges, gates */}
         <InstancedModel asset={ASSETS.deck} spots={track.deck} fallback={<PartsInstanced spots={track.deck} parts={parts.deck} name="deck" />} />
         {track.rope.length > 0 && <InstancedModel asset={ASSETS.ropeBridge} spots={track.rope} fallback={<PartsInstanced spots={track.rope} parts={parts.rope} name="rope" />} />}
         <InstancedModel asset={ASSETS.gate} spots={gates} fallback={<PartsInstanced spots={gates} parts={parts.gate} name="gate" />} />
         <PartsInstanced spots={decor.stilts} parts={parts.stilt} name="stilts" />

         {/* obstacles */}
         {pillars.length > 0 && <InstancedModel asset={ASSETS.pillar} spots={pillars} fallback={<PartsInstanced spots={pillars} parts={parts.pillar} name="pillar" />} />}
         {logs.length > 0 && <DynamicInstancedModel asset={ASSETS.log} count={logs.length} update={placeLog} fallbackParts={parts.log} name="logs" />}
         <PartsInstanced spots={vines} parts={parts.vine} name="vine" />
         {lavas.length > 0 && (
            <>
               <PartsInstanced spots={lavas} parts={parts.crust} name="lava-crust" />
               <DynamicInstanced count={lavas.length} update={placeGlow} parts={parts.glow} name="lava-glow" />
            </>
         )}
         <DynamicInstanced count={run.gems.length} update={placeGem} parts={parts.gem} name="gems" />

         {/* the canyon */}
         <InstancedModel asset={ASSETS.rock} spots={decor.rocks} fallback={<PartsInstanced spots={decor.rocks} parts={parts.rock} name="rock" />} />
         <InstancedModel asset={ASSETS.tree} spots={decor.trees} fallback={<PartsInstanced spots={decor.trees} parts={parts.tree} name="tree" />} />
         <InstancedModel asset={ASSETS.fern} spots={decor.ferns} fallback={<PartsInstanced spots={decor.ferns} parts={parts.fern} name="fern" />} />
         {decor.vines.length > 0 && <InstancedModel asset={ASSETS.hangingVine} spots={decor.vines} fallback={<PartsInstanced spots={decor.vines} parts={parts.hanging} name="hanging" />} />}
         {backdrop && (
            <group ref={backdropRef} rotation-y={backdrop.rotY} scale={backdrop.scale}>
               <Model asset={backdrop.kind === "volcano" ? ASSETS.volcano : ASSETS.waterfall} />
            </group>
         )}

         <group ref={body}>
            <BlobShadow radius={0.4} />
            <HumanoidModel asset={ASSETS.explorer} pose={pose} fallback={<ExplorerPrimitive />} />
         </group>
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
