"use client";

// One useRunFrame steps rules.ts (and syncs the store); visuals read the run and animate on useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Euler, Matrix4, Quaternion, Vector3, type Group, type Material, type Mesh } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import { SkyDome, Water } from "@/arcade3d/core/env";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { Toss, useActionPop, useFx, type TossHandle } from "@/arcade3d/core/fx";
import { TargetBeacon } from "@/arcade3d/core/hud";
import { useCoarsePointer } from "@/arcade3d/core/TouchControls";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { BlobShadow, DynamicInstanced, type InstanceSpot } from "@/arcade3d/core/render";
import { BONE, HumanoidModel, cheerPose, flailPose, gaitPhaseStep, jumpPose, turnBone, useHumanoidPose, walkPose, wrapPhase } from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, EXPLORER_LANDMARKS, EXPLORER_SCALE, FIT } from "./assets";
import { LEVELS, type JungleLevel } from "./levels";
import { COLORS, FOV, LOOK_AHEAD_Z, TILE, VIEW_CONFIG, VISIBLE_BACK, WATER_Y, backdropFor, decorSpots, decorZ, firstAtOrAfter, gateOpacity, gateSpots, lavaSpots, pillarSpots, poolSize, trackSpots, vineSpots, visibleAhead } from "./looks";
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
import { GUIDE, cueCode, cueHint, hitText, nextCue, type Cue } from "./guide";
import { LANE_X, LAVA_ON, LAVA_PERIOD, createRun, finishZ, isLavaActive, logXAt, step, syncStore, type LogObstacle, type Run, type RunnerInput } from "./rules";

const V = new Vector3();
const Q = new Quaternion();
const E = new Euler();
const S = new Vector3();
const M1 = new Matrix4();
const AT = { x: 0, y: 0, z: 0 };

/** A spot's matrix (translate, turn about y, per-axis scale), written into m. */
function spotInto(m: Matrix4, spot: InstanceSpot, z = spot.z): void {
   E.set(0, spot.rotY ?? 0, 0);
   Q.setFromEuler(E);
   V.set(spot.x, spot.y, z);
   const k = spot.scale ?? 1;
   S.set(spot.sx ?? k, spot.sy ?? k, spot.sz ?? k);
   m.compose(V, Q, S);
}

/**
 * A pool that draws only the spots of a z-sorted list inside the visible stretch around the runner:
 * copy i is spot first + i, where first is found once per frame (copy 0). `skip` hides a spot.
 */
function windowPool(sorted: readonly InstanceSpot[], run: Run, back: number, ahead: number, reach: number, skip?: (spot: InstanceSpot) => boolean) {
   let first = 0;
   return (i: number, m: Matrix4) => {
      if (i === 0) first = firstAtOrAfter(sorted, run.z - back - reach);
      const spot = sorted[first + i];
      if (!spot || spot.z > run.z + ahead + reach) return false;
      if (skip && skip(spot)) return false;
      spotInto(m, spot);
   };
}

/** The gate row the runner is passing, drawn on its own with its materials faded: it never hides the runner. */
function FadingGateRow({ run, rows }: { run: Run; rows: readonly number[] }) {
   const group = useRef<Group>(null);
   const faded = useRef<Material[]>([]);
   useEffect(
      () => () => {
         for (const m of faded.current) m.dispose();
         faded.current = [];
      },
      []
   );
   useFrame(() => {
      const g = group.current;
      if (!g) return;
      let row = -1;
      let alpha = 1;
      for (const z of rows) {
         const a = gateOpacity(z, run.z);
         if (a < 1) {
            row = z;
            alpha = a;
            break;
         }
      }
      g.visible = row >= 0;
      if (row < 0) return;
      g.position.z = row;
      g.traverse((o) => {
         const mesh = o as Mesh;
         if (!mesh.isMesh) return;
         if (!mesh.userData.faded) {
            const mat = (mesh.material as Material).clone();
            mat.transparent = true;
            mat.depthWrite = false;
            mesh.material = mat;
            mesh.userData.faded = true;
            faded.current.push(mat);
         }
         (mesh.material as Material).opacity = alpha;
      });
   }, FRAME_PRIORITY.visuals);
   return (
      <group ref={group} visible={false}>
         {[0, 1, 2].map((lane) => (
            <Model key={lane} asset={ASSETS.gate} position={[LANE_X[lane], 0, 0]} />
         ))}
      </group>
   );
}

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
   // clarity (visual only): the cue beacon on the obstacle ahead, the hint line, gem flights, fail pops
   const pop = useActionPop();
   const touch = useCoarsePointer();
   const cue = useRef<Cue>({ obstacle: null, lane: -1, action: null, x: 0, z: 0 }).current;
   const beacon = useRef({ x: 0, y: 0, z: 0, hidden: true }).current;
   const runnerAt = useRef({ x: 0, y: 1, z: 0 }).current;
   const gemToss = useRef<TossHandle>(null);
   const gemSeen = useRef<boolean[]>([]).current;
   const guideCode = useRef(-1);
   const shownAction = useRef<Cue["action"]>(null);
   const [beaconAction, setBeaconAction] = useState<Cue["action"]>(null);
   useEffect(() => () => GUIDE.reset(), []);

   const track = useMemo(() => trackSpots(run), [run]);
   const gates = useMemo(() => gateSpots(run), [run]);
   const pillars = useMemo(() => pillarSpots(run), [run]);
   const vines = useMemo(() => vineSpots(run), [run]);
   const lavas = useMemo(() => lavaSpots(run), [run]);
   const logs = useMemo(() => run.sections.flatMap((s) => s.obstacles.filter((o): o is LogObstacle => o.kind === "log")), [run]);
   const decor = useMemo(() => {
      const d = decorSpots(id, level);
      const keep = <T,>(a: T[]) => a.slice(0, scaledCount(a.length, quality.decor));
      return { ...d, rocks: keep(d.rocks), trees: keep(d.trees), ferns: keep(d.ferns), plants: keep(d.plants), vines: keep(d.vines) };
   }, [id, level, quality.decor]);
   const backdrop = useMemo(() => backdropFor(level), [level]);
   const ahead = visibleAhead(level);
   const pools = useMemo(() => {
      const fadingRow = (spot: InstanceSpot) => gateOpacity(spot.z, run.z) < 1;
      return {
         deck: { count: poolSize(track.deck, VISIBLE_BACK, ahead, TILE / 2), update: windowPool(track.deck, run, VISIBLE_BACK, ahead, TILE / 2) },
         rope: { count: poolSize(track.rope, VISIBLE_BACK, ahead, 1.5), update: windowPool(track.rope, run, VISIBLE_BACK, ahead, 1.5) },
         gate: { count: poolSize(gates, VISIBLE_BACK, ahead, 0.5), update: windowPool(gates, run, VISIBLE_BACK, ahead, 0.5, fadingRow) },
         pillar: { count: poolSize(pillars, VISIBLE_BACK, ahead, 0.6), update: windowPool(pillars, run, VISIBLE_BACK, ahead, 0.6) },
         gateRows: Array.from(new Set(gates.map((g) => g.z))),
      };
   }, [track, gates, pillars, run, ahead]);
   const decorUpdate = useMemo(() => {
      const wrap = (list: readonly InstanceSpot[]) => (i: number, m: Matrix4) => {
         const spot = list[i];
         if (!spot) return false;
         spotInto(m, spot, decorZ(spot.z, run.z));
      };
      return { rocks: wrap(decor.rocks), trees: wrap(decor.trees), ferns: wrap(decor.ferns), plants: wrap(decor.plants), vines: wrap(decor.vines), stilts: wrap(decor.stilts) };
   }, [decor, run]);
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
      plant: useParts(fernParts),
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
      runnerAt.x = run.x;
      runnerAt.y = 1 + run.y;
      runnerAt.z = run.z;
      if (ev.gemCollected) {
         playSfx("pickup", { volume: 0.45 });
         fx.burst("sparkle", AT, 12);
         fx.score(AT, "+20", { color: COLORS.gem });
         // the gem flies into the runner's hands instead of vanishing
         for (const g of run.gems) {
            if (!g.collected || gemSeen[g.id]) continue;
            gemSeen[g.id] = true;
            gemToss.current?.play({ x: g.x, y: g.y + 0.25, z: g.z }, runnerAt, { duration: 0.3, height: 0.5, scaleFrom: 1.1, scaleTo: 0.3 });
         }
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
         AT.y = 2.4;
         pop.fail(AT, hitText(run.lastHit, run.lives > 0), { shake: 0 });
      }
      // the obstacle ahead: beacon + hint (rebuilt only when it changes)
      nextCue(run, cue);
      beacon.x = cue.x;
      beacon.y = 0.05;
      beacon.z = cue.z;
      beacon.hidden = !cue.obstacle || run.over !== false || run.respawning;
      if (cue.action !== shownAction.current) setBeaconAction((shownAction.current = cue.action));
      const code = cueCode(run, cue);
      if (code !== guideCode.current) {
         guideCode.current = code;
         GUIDE.set(cueHint(code, touch));
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

         {/* the track: only the visible stretch, pooled and recycled along z */}
         <DynamicInstancedModel asset={ASSETS.deck} count={pools.deck.count} update={pools.deck.update} fallbackParts={parts.deck} name="deck" />
         {pools.rope.count > 0 && <DynamicInstancedModel asset={ASSETS.ropeBridge} count={pools.rope.count} update={pools.rope.update} fallbackParts={parts.rope} name="rope" />}
         <DynamicInstancedModel asset={ASSETS.gate} count={pools.gate.count} update={pools.gate.update} fallbackParts={parts.gate} name="gates" />
         <FadingGateRow run={run} rows={pools.gateRows} />
         <DynamicInstanced count={decor.stilts.length} update={decorUpdate.stilts} parts={parts.stilt} name="stilts" />

         {/* obstacles */}
         {pools.pillar.count > 0 && <DynamicInstancedModel asset={ASSETS.pillar} count={pools.pillar.count} update={pools.pillar.update} fallbackParts={parts.pillar} name="pillars" />}
         {logs.length > 0 && <DynamicInstancedModel asset={ASSETS.log} count={logs.length} update={placeLog} fallbackParts={parts.log} name="logs" />}
         <PartsInstanced spots={vines} parts={parts.vine} name="vine" />
         {lavas.length > 0 && (
            <>
               <PartsInstanced spots={lavas} parts={parts.crust} name="lava-crust" />
               <DynamicInstanced count={lavas.length} update={placeGlow} parts={parts.glow} name="lava-glow" />
            </>
         )}
         <DynamicInstanced count={run.gems.length} update={placeGem} parts={parts.gem} name="gems" />

         {/* the canyon: one seeded band, wrapped into the visible stretch */}
         {decor.rocks.length > 0 && <DynamicInstancedModel asset={ASSETS.rock} count={decor.rocks.length} update={decorUpdate.rocks} fallbackParts={parts.rock} name="rocks" />}
         {decor.trees.length > 0 && <DynamicInstancedModel asset={ASSETS.tree} count={decor.trees.length} update={decorUpdate.trees} fallbackParts={parts.tree} name="trees" />}
         {decor.ferns.length > 0 && <DynamicInstancedModel asset={ASSETS.fern} count={decor.ferns.length} update={decorUpdate.ferns} fallbackParts={parts.fern} name="ferns" />}
         {decor.plants.length > 0 && <DynamicInstancedModel asset={ASSETS.plant} count={decor.plants.length} update={decorUpdate.plants} fallbackParts={parts.plant} name="plants" />}
         {decor.vines.length > 0 && <DynamicInstancedModel asset={ASSETS.hangingVine} count={decor.vines.length} update={decorUpdate.vines} fallbackParts={parts.hanging} name="hanging" />}
         {backdrop && (
            <group ref={backdropRef} rotation-y={backdrop.rotY} scale={backdrop.scale}>
               <Model asset={backdrop.kind === "volcano" ? ASSETS.volcano : ASSETS.waterfall} />
            </group>
         )}

         {/* clarity: "take this lane" or "jump / slide here" on the obstacle ahead; the gem's flight */}
         <TargetBeacon
            target={beacon}
            variant={beaconAction === "go" ? "pick" : "danger"}
            color={beaconAction === "go" ? COLORS.accent : "#f97316"}
            radius={0.85}
            height={1.3}
            label={beaconAction === "jump" ? "JUMP" : beaconAction === "slide" ? "SLIDE" : "GO"}
         />
         <Toss ref={gemToss} slots={3} spin={10}>
            {parts.gem.map((part, i) => (
               <mesh key={i} geometry={part.geometry} material={part.material} />
            ))}
         </Toss>

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
