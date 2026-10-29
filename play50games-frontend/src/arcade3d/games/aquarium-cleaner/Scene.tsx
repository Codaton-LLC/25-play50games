"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
   CylinderGeometry, DoubleSide, Euler, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3,
   type Group, type Mesh,
} from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx } from "@/arcade3d/core/audio";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import type { AABB } from "@/arcade3d/core/collision";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { Toss, useActionPop, useFx, type TossHandle } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetBeacon, TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed, turnTowards } from "@/arcade3d/core/math";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstancePart } from "@/arcade3d/core/render";
import {
   BONE, HumanoidModel, aimArm, blendPoses, createPose, gaitPhaseStep, idlePose, jumpPose, turnBone, useHumanoidPose, walkPose, wrapPhase,
} from "@/arcade3d/core/rig";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS, DIVER_LANDMARKS, DIVER_SCALE } from "./assets";
import { GUIDE, emptyGoal, hintCode, hintFor, nextGoal } from "./guide";
import type { AquariumLevel } from "./levels";
import {
   COLORS, DAMPING, FOLLOW, FOV, GLASS_H, LOOK_AHEAD, coralSpots, frameSpots, frameGlowOf, lookAtFor, lookOf, schoolsOf, aimBounds, viewFor,
} from "./looks";
import { SetPieces } from "./SetPieces";
import { TankSurroundings } from "./Tank";
import { BasketStand, CastleStand, DiverFigure, FilterStand, bottleParts, coralParts, fishParts, rockParts, sharkParts } from "./Primitives";
import {
   ALGAE_HOLD_S, COLUMN_R, FLOAT_H, HATCH_R, MAX_SPEED, createRun, step, type Run,
} from "./rules";

const E = new Euler();
const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3(1, 1, 1);
const AT = { x: 0, y: 0.5, z: 0 };
const BUBBLES = 26;

function Filters({ run }: { run: Run }) {
   const beads = useRef<Array<Mesh | null>>([]);
   const mats = useMemo(() => run.filters.map(() => new MeshStandardMaterial({ color: COLORS.gaugeOff, emissive: COLORS.gaugeOff, emissiveIntensity: 0.9, roughness: 0.4 })), [run]);
   const geo = useMemo(() => new SphereGeometry(0.11, 10, 8), []);
   useEffect(() => () => { geo.dispose(); mats.forEach((m) => m.dispose()); }, [geo, mats]);
   const time = useGameTime();
   useFrame(() => {
      run.filters.forEach((f, i) => {
         const mat = mats[i];
         const target = f.done ? COLORS.gaugeOn : COLORS.gaugeOff;
         mat.color.set(target);
         mat.emissive.set(target);
         const bead = beads.current[i];
         if (bead) bead.position.y = 1.35 + (f.done ? 0 : Math.sin(time.now * 4 + i) * 0.06);
      });
   }, FRAME_PRIORITY.visuals);
   return (
      <>
         {run.filters.map((f, i) => (
            <group key={i} position={[f.x, 0, f.z]} rotation-y={run.solids[f.solid].rotY}>
               <Model asset={ASSETS.filter} fallback={<FilterStand />} />
               <mesh ref={(m) => { beads.current[i] = m; }} geometry={geo} material={mats[i]} position={[0, 1.35, 0]} />
            </group>
         ))}
      </>
   );
}

function AlgaePatches({ run }: { run: Run }) {
   const mats = useMemo(
      () => run.algae.map(() => ({
         a: new MeshStandardMaterial({ color: COLORS.algae, roughness: 0.9, transparent: true, opacity: 0.92, depthWrite: false, side: DoubleSide }),
         b: new MeshStandardMaterial({ color: COLORS.algaeDark, roughness: 0.9, transparent: true, opacity: 0.8, depthWrite: false, side: DoubleSide }),
      })),
      [run],
   );
   const geoA = useMemo(() => new SphereGeometry(0.62, 18, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.12, 1), []);
   const groups = useRef<Array<Group | null>>([]);
   useEffect(() => () => { geoA.dispose(); mats.forEach((m) => { m.a.dispose(); m.b.dispose(); }); }, [geoA, mats]);
   useFrame(() => {
      run.algae.forEach((a, i) => {
         const g = groups.current[i];
         if (!g) return;
         g.visible = !a.done;
         let k = 1;
         if (run.holdKind === 1 && run.holdIndex === i) k = 1 - Math.min(1, run.holdTime / ALGAE_HOLD_S);
         mats[i].a.opacity = 0.92 * k;
         mats[i].b.opacity = 0.8 * k;
      });
   }, FRAME_PRIORITY.visuals);
   return (
      <>
         {run.algae.map((a, i) => (
            <group
               key={i}
               ref={(g) => { groups.current[i] = g; }}
               position={[a.x + (a.wall === 1 ? 0.03 : a.wall === 2 ? -0.03 : 0), a.y, a.z + (a.wall === 0 ? 0.03 : 0)]}
               rotation={[Math.PI / 2, 0, a.wall === 0 ? 0 : a.wall === 1 ? -Math.PI / 2 : Math.PI / 2]}
            >
               <mesh geometry={geoA} material={mats[i].a} rotation-x={0} scale={[1, 1, 1]} />
               <mesh geometry={geoA} material={mats[i].b} position={[0.18, 0.02, -0.12]} scale={[0.55, 1, 0.55]} />
               <mesh geometry={geoA} material={mats[i].b} position={[-0.25, 0.02, 0.2]} scale={[0.4, 1, 0.4]} />
            </group>
         ))}
      </>
   );
}

function Column({ run }: { run: Run }) {
   const ring = useMemo(() => new TorusGeometry(COLUMN_R, 0.06, 8, 36), []);
   const ringMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.ring, emissive: COLORS.ring, emissiveIntensity: 0.6, roughness: 0.4 }), []);
   const tube = useMemo(() => new CylinderGeometry(0.5, 0.5, 1, 24, 1, true), []);
   const tubeMat = useMemo(() => new MeshBasicMaterial({ color: COLORS.column, transparent: true, opacity: 0.1, depthWrite: false }), []);
   const bubbleParts = useMemo<InstancePart[]>(() => [{ geometry: new SphereGeometry(0.075, 8, 6), material: new MeshStandardMaterial({ color: COLORS.bubble, emissive: COLORS.bubble, emissiveIntensity: 0.35, transparent: true, opacity: 0.8, roughness: 0.2 }) }], []);
   const time = useGameTime();
   useEffect(() => () => {
      ring.dispose(); ringMat.dispose(); tube.dispose(); tubeMat.dispose();
      for (const p of bubbleParts) { p.geometry.dispose(); (p.material as MeshStandardMaterial).dispose(); }
   }, [ring, ringMat, tube, tubeMat, bubbleParts]);
   const place = (i: number, m: Matrix4) => {
      const t = time.now * 0.9 + i / BUBBLES;
      const rise = t - Math.floor(t);
      const a = i * 2.4 + Math.floor(t) * 1.3;
      const r = 0.15 + ((i * 37) % 10) * 0.055;
      V.set(run.column.x + Math.cos(a) * r, 0.1 + rise * 3, run.column.z + Math.sin(a) * r);
      Q.identity();
      const s = 0.6 + (1 - rise) * 0.7;
      S.set(s, s, s);
      m.compose(V, Q, S);
   };
   return (
      <group position={[run.column.x, 0, run.column.z]}>
         <mesh geometry={ring} material={ringMat} position={[0, 0.05, 0]} rotation-x={Math.PI / 2} />
         <mesh geometry={tube} material={tubeMat} position={[0, 1.5, 0]} scale={[COLUMN_R * 1.7, 3, COLUMN_R * 1.7]} />
         <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[COLUMN_R - 0.1, 28]} />
            <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.35} transparent opacity={0.35} depthWrite={false} />
         </mesh>
         <group position={[-run.column.x, 0, -run.column.z]}>
            <DynamicInstanced count={BUBBLES} update={place} parts={bubbleParts} name="column-bubbles" />
         </group>
      </group>
   );
}

function Hatch({ run }: { run: Run }) {
   const ring = useRef<Mesh>(null);
   const mat = useMemo(() => new MeshStandardMaterial({ color: COLORS.hatchShut, emissive: COLORS.hatchShut, emissiveIntensity: 0.5, roughness: 0.4 }), []);
   useEffect(() => () => mat.dispose(), [mat]);
   const open = useRef(false);
   useFrame(() => {
      const now = run.done === run.tasks;
      if (now !== open.current) {
         open.current = now;
         const c = now ? COLORS.hatchOpen : COLORS.hatchShut;
         mat.color.set(c);
         mat.emissive.set(c);
      }
      if (ring.current) ring.current.scale.setScalar(now ? 1 + Math.sin(performance.now() / 260) * 0.03 : 1);
   }, FRAME_PRIORITY.visuals);
   return (
      <group position={[run.hatch.x, 0, run.hatch.z]}>
         <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[HATCH_R, HATCH_R, 0.06, 28]} />
            <meshStandardMaterial color={COLORS.hatchPlate} roughness={0.5} metalness={0.3} />
         </mesh>
         <mesh ref={ring} position={[0, 0.07, 0]} rotation-x={-Math.PI / 2} material={mat}>
            <ringGeometry args={[HATCH_R - 0.2, HATCH_R - 0.08, 32]} />
         </mesh>
      </group>
   );
}

function Glass({ run }: { run: Run }) {
   const { hx, hz } = run;
   const frames = useMemo(() => frameSpots(run.level), [run.level]);
   const mat = useMemo(() => new MeshStandardMaterial({ color: COLORS.glassPane, transparent: true, opacity: 0.12, roughness: 0.1, metalness: 0.1, depthWrite: false, side: DoubleSide }), []);
   useEffect(() => () => mat.dispose(), [mat]);
   return (
      <>
         <mesh position={[0, GLASS_H / 2, -hz]} material={mat}><planeGeometry args={[run.level.width, GLASS_H]} /></mesh>
         <mesh position={[-hx, GLASS_H / 2, 0]} rotation-y={Math.PI / 2} material={mat}><planeGeometry args={[run.level.depth, GLASS_H]} /></mesh>
         <mesh position={[hx, GLASS_H / 2, 0]} rotation-y={-Math.PI / 2} material={mat}><planeGeometry args={[run.level.depth, GLASS_H]} /></mesh>
         <Instanced spots={frames} name="glass-frame">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.frame} emissive={COLORS.frame} emissiveIntensity={frameGlowOf(run.level)} roughness={0.3} />
         </Instanced>
      </>
   );
}

function LevelScene() {
   const { id, config } = useLevel<AquariumLevel>();
   const view = useFittedView(viewFor(id));
   const input = useInput();
   const fx = useFx();
   const pop = useActionPop();
   const time = useGameTime();
   const quality = useQuality();
   const [run] = useState<Run>(() => createRun(randomSeed(), config));
   // camera views (core/camera): the rules get the drawn camera's yaw; the three glass walls keep
   // the chase / front / free camera inside the tank
   const cam = useCameraViews({
      slug: "aquarium-cleaner",
      subject: "character",
      steering: "camera",
      defaultYaw: view.yaw,
      target: (o) => {
         const h = run.hero;
         o.x = h.x;
         o.y = h.y + 1.1;
         o.z = h.z;
         o.heading = h.yaw;
         o.vx = h.vx;
         o.vz = h.vz;
      },
      solids: (out: AABB[]) => {
         const t = 0.15;
         let n = 0;
         const wall = (minX: number, maxX: number, minZ: number, maxZ: number) => {
            const b = out[n++];
            b.min.x = minX;
            b.max.x = maxX;
            b.min.y = 0;
            b.max.y = GLASS_H;
            b.min.z = minZ;
            b.max.z = maxZ;
         };
         wall(-run.hx - t, -run.hx, -run.hz, run.hz);
         wall(run.hx, run.hx + t, -run.hz, run.hz);
         wall(-run.hx - t, run.hx + t, -run.hz - t, -run.hz);
         return n;
      },
   });
   const aim = useRef({ x: run.hero.x, y: 0.9, z: run.hero.z }).current;
   const body = useRef<Group>(null);
   const gait = useRef({ phase: 0, amount: 0, visYaw: 0, scrub: 0 }).current;
   const bubbleAt = useRef(0);
   const bounds = useMemo(() => aimBounds(config), [config]);
   const look = useMemo(() => lookOf(config), [config]);
   const corals = useMemo(() => coralSpots(run, look.coralCount).slice(0, Math.max(2, scaledCount(look.coralCount, quality.decor))), [run, look, quality.decor]);
   const schools = useMemo(() => schoolsOf(run, look.schoolCount), [run, look]);
   const fishCount = schools.reduce((n, s) => n + s.count, 0);
   const rocks = useMemo(() => run.solids.filter((s) => s.kind === "rock").map((s) => ({ x: s.x, y: 0, z: s.z, rotY: s.rotY, scale: s.scale })), [run]);
   const castle = useMemo(() => run.solids.find((s) => s.kind === "castle"), [run]);
   const marker = useMemo<MarkerTarget[]>(() => [{ x: 0, y: 0.6, z: 0, hidden: true }], []);
   const scratch = useMemo(() => ({ a: createPose() }), []);
   const goal = useRef(emptyGoal()).current;
   const pickBeacon = useRef({ x: 0, y: 0.4, z: 0, hidden: true }).current;
   const dropBeacon = useRef({ x: 0, y: 0.9, z: 0, hidden: true }).current;
   const guideCode = useRef(-1);
   const binToss = useRef<TossHandle>(null);
   const HAND = useRef({ x: 0, y: 0, z: 0 }).current;

   const trashParts = useMemo(() => bottleParts(), []);
   const fishP = useMemo(() => fishParts(), []);
   const sharkP = useMemo(() => sharkParts(), []);
   const rockP = useMemo(() => rockParts(), []);
   const coralP = useMemo(() => coralParts(), []);
   useEffect(() => () => {
      for (const part of [...trashParts, ...fishP, ...sharkP, ...rockP, ...coralP]) {
         part.geometry.dispose();
         const m = part.material;
         if (Array.isArray(m)) m.forEach((x) => x.dispose());
         else m.dispose();
      }
   }, [trashParts, fishP, sharkP, rockP, coralP]);

   const sharkYaw = useRef<number[]>(run.sharks.map((s) => s.yaw)).current;
   const synced = useRef({ tasks: -1, air: -1, algae: -1, trash: -1, filters: -1 }).current;

   const pose = useHumanoidPose((p) => {
      const speed = Math.hypot(run.hero.vx, run.hero.vz);
      const target = Math.min(1, speed / MAX_SPEED) * 0.4;
      gait.amount += (target - gait.amount) * (1 - Math.exp(-10 * time.delta));
      gait.phase = wrapPhase(gait.phase + gaitPhaseStep(gait.amount, DIVER_LANDMARKS, DIVER_SCALE, speed * 0.6, time.delta, 3));
      if (gait.amount > 0.03) walkPose(gait.phase, gait.amount, p);
      else idlePose(time.now, p);
      if (run.hero.y > 0.04) {
         const tuck = Math.min(1, run.hero.y / FLOAT_H);
         blendPoses(p, jumpPose(tuck * 0.5, scratch.a), 0.9, p);
      }
      if (run.ev.working && run.holdKind !== 0) {
         gait.scrub += time.delta * 11;
         const high = run.holdKind === 1 && run.algae[run.holdIndex]?.high;
         const wob = Math.sin(gait.scrub) * 0.12;
         aimArm(p, -1, 0.1, high ? 0.62 : 0.08, 0.85, 0.05, (high ? 0.55 : 0.02) + wob, 1);
      }
      turnBone(p, BONE.spine, 0.17, 0, 0);
   });

   useEffect(() => {
      fx.warm("puff", "sparkle", "splash", "score");
      useArcadeStore.getState().setStat("air", 100);
   }, [fx]);

   useEffect(() => {
      nextGoal(run, goal);
      guideCode.current = hintCode(run, goal);
      GUIDE.set(hintFor(run, goal));
      return () => GUIDE.reset();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [run]);

   useRunFrame((_state, dt) => {
      const { moveX, moveY, action, jumpPressed } = input.current;
      const store = useArcadeStore.getState();
      const carriedBefore = run.carried.length;
      const ev = step(run, { moveX, moveY, action, jumpPressed, yaw: cam.yaw() }, dt, store.timeLeftMs ?? 0);
      if (ev.score) store.addScore(ev.score);
      // the HUD re-renders only when a value changes
      const air = Math.round(Math.max(0, run.hero.air));
      if (synced.tasks !== run.done) store.setStat("tasks", (synced.tasks = run.done));
      if (synced.air !== air) store.setStat("air", (synced.air = air));
      if (synced.algae !== run.algaeDone) store.setStat("algae", (synced.algae = run.algaeDone));
      if (synced.trash !== run.trashDone) store.setStat("trash", (synced.trash = run.trashDone));
      if (synced.filters !== run.filtersDone) store.setStat("filters", (synced.filters = run.filtersDone));
      aim.x = run.hero.x + Math.sin(run.hero.yaw) * LOOK_AHEAD;
      aim.z = run.hero.z + Math.cos(run.hero.yaw) * LOOK_AHEAD;
      aim.y = 0.9;
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, aim.x));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, aim.z));
      if (ev.float) {
         AT.x = run.hero.x; AT.y = 0.2; AT.z = run.hero.z;
         fx.burst("puff", AT, 6);
         playSfx("whoosh");
      }
      if (ev.pick) {
         AT.x = run.hero.x; AT.y = 0.5; AT.z = run.hero.z;
         fx.burst("splash", AT, 8);
         playSfx("pickup");
      }
      if (ev.task) {
         AT.x = ev.taskX; AT.y = ev.task === 1 ? 1.2 : 1; AT.z = ev.taskZ;
         fx.burst("sparkle", AT, 14);
         fx.score(AT, `+${ev.score}`);
         playSfx(ev.task === 3 ? "chime" : "combo");
      }
      if (ev.bin && carriedBefore > 0) {
         for (let k = 0; k < carriedBefore; k++) {
            HAND.x = run.hero.x;
            HAND.y = run.hero.y + 1.95 + k * 0.5;
            HAND.z = run.hero.z;
            binToss.current?.play(HAND, { x: run.basket.x, y: 0.7, z: run.basket.z }, { duration: 0.35 + k * 0.08, height: 0.8, scaleFrom: 1, scaleTo: 0.7 });
         }
      }
      if (ev.sharkHit) {
         AT.x = run.hero.x; AT.y = 2; AT.z = run.hero.z;
         pop.fail(AT, "Shark! -30 air", { shake: 0.35 });
         playSfx("hit");
      }
      if (ev.airOut) {
         AT.x = run.hero.x; AT.y = 2; AT.z = run.hero.z;
         pop.fail(AT, "Out of air! -1 life", { shake: 0.4 });
         playSfx("buzz");
      }
      if (ev.lifeLost) store.loseLife();
      if (ev.won) {
         playSfx("win");
         store.end("win");
      }
      // the beacon, the work readout and the hint line follow the step; the hint is rebuilt only on a change
      nextGoal(run, goal);
      const picking = goal.kind === "trash" || goal.kind === "algae" || goal.kind === "filter" || goal.kind === "column";
      const dropping = goal.kind === "basket" || goal.kind === "hatch";
      pickBeacon.hidden = !picking;
      dropBeacon.hidden = !dropping;
      const live = picking ? pickBeacon : dropBeacon;
      marker[0].hidden = goal.kind === "none";
      marker[0].x = goal.x;
      marker[0].z = goal.z;
      live.x = goal.x;
      live.y = goal.y;
      live.z = goal.z;
      const code = hintCode(run, goal);
      if (code !== guideCode.current) {
         guideCode.current = code;
         GUIDE.set(hintFor(run, goal));
      }
      if (run.time - bubbleAt.current > 1.5) {
         bubbleAt.current = run.time;
         AT.x = run.hero.x; AT.y = run.hero.y + 1.7; AT.z = run.hero.z;
         fx.burst("puff", AT, 3);
      }
   });

   useFrame((_s, delta) => {
      const g = body.current;
      if (!g) return;
      let want = run.hero.yaw;
      if (run.holdKind !== 0) {
         const target = run.holdKind === 1 ? run.algae[run.holdIndex] : run.filters[run.holdIndex];
         if (target) want = Math.atan2(target.x - run.hero.x, target.z - run.hero.z);
      }
      gait.visYaw = turnTowards(gait.visYaw, want, Math.min(1, delta * 12));
      g.position.set(run.hero.x, run.hero.y, run.hero.z);
      g.rotation.y = gait.visYaw;
   }, FRAME_PRIORITY.visuals);

   const placeTrash = (i: number, m: Matrix4) => {
      const t = run.trash[i];
      if (!t || t.state === 2) return false;
      if (t.state === 1) {
         const k = run.carried.indexOf(i);
         V.set(run.hero.x, run.hero.y + 1.95 + k * 0.5, run.hero.z);
         E.set(0, time.now * 2 + k, 0);
      } else {
         V.set(t.x, 0.13 + Math.sin(time.now * 2 + t.spin) * 0.03, t.z);
         E.set(Math.PI / 2, t.spin + Math.sin(time.now + t.spin) * 0.2, 0);
      }
      Q.setFromEuler(E);
      S.set(1, 1, 1);
      m.compose(V, Q, S);
   };
   const placeShark = (i: number, m: Matrix4) => {
      const s = run.sharks[i];
      if (!s) return false;
      sharkYaw[i] = turnTowards(sharkYaw[i] ?? s.yaw, s.yaw, Math.min(1, time.delta * 4));
      E.set(0, sharkYaw[i], Math.sin(time.now * 2.4 + i) * 0.05);
      Q.setFromEuler(E);
      V.set(s.x, 1.1 + Math.sin(time.now * 1.5 + i) * 0.08, s.z);
      S.set(1, 1, 1);
      m.compose(V, Q, S);
   };
   const placeFish = (i: number, m: Matrix4) => {
      let k = i;
      for (const s of schools) {
         if (k < s.count) {
            const a = s.phase + time.now * s.speed + k * 0.55;
            const dx = -Math.sin(a) * s.rx;
            const dz = Math.cos(a) * s.rz;
            V.set(s.cx + Math.cos(a) * s.rx, s.y + Math.sin(a * 2 + k) * 0.2, s.cz + Math.sin(a) * s.rz);
            E.set(0, Math.atan2(dx, dz), 0);
            Q.setFromEuler(E);
            S.set(1, 1, 1);
            m.compose(V, Q, S);
            return;
         }
         k -= s.count;
      }
      return false;
   };

   return (
      <>
         <CameraRig
            camera={{ position: view.offset, fov: FOV, lookAt: lookAtFor(config) }}
            follow={aim}
            followFraction={FOLLOW}
            bounds={bounds}
            offset={view.offset}
            shift={view.shift}
            damping={DAMPING}
         />
         <TankSurroundings level={config} />
         <Glass run={run} />
         <SetPieces run={run} look={look} />
         <AlgaePatches run={run} />
         <Column run={run} />
         <Hatch run={run} />
         <Model asset={ASSETS.basket} position={[run.basket.x, 0, run.basket.z]} fallback={<BasketStand />} />
         <Filters run={run} />
         {castle && <Model asset={ASSETS.castle} position={[castle.x, 0, castle.z]} rotation-y={castle.rotY} scale={castle.scale} fallback={<CastleStand />} />}
         {rocks.length > 0 && (
            <InstancedModel asset={ASSETS.rock} spots={rocks} fallback={<Instanced spots={rocks} name="rocks-stand"><primitive object={rockP[0].geometry} attach="geometry" /><primitive object={rockP[0].material} attach="material" /></Instanced>} />
         )}
         {corals.length > 0 && (
            <InstancedModel asset={ASSETS.coral} spots={corals} fallback={<Instanced spots={corals} name="coral-stand"><primitive object={coralP[0].geometry} attach="geometry" /><primitive object={coralP[0].material} attach="material" /></Instanced>} />
         )}
         <DynamicInstancedModel asset={ASSETS.fish} count={fishCount} update={placeFish} fallbackParts={fishP} name="fish" />
         <DynamicInstancedModel asset={ASSETS.bottle} count={Math.max(1, run.trash.length)} update={placeTrash} fallbackParts={trashParts} name="trash" />
         {run.sharks.length > 0 && <DynamicInstancedModel asset={ASSETS.shark} count={run.sharks.length} update={placeShark} fallbackParts={sharkP} name="sharks" />}
         <group ref={body}>
            <pointLight position={[0, 2.6, 0.8]} intensity={config.lighting === "night" ? 9 : 0} distance={8} decay={1.6} color="#7dd3fc" />
            <HumanoidModel
               asset={ASSETS.diver}
               pose={pose}
               fallback={<DiverFigure />}
               attach={{
                  handR: <group rotation={[0, 0, Math.PI / 2]}><Model asset={ASSETS.scrubber} position={[0, -0.12, 0]} /></group>,
                  chest: <Model asset={ASSETS.tank} position={[0, -0.25, -0.18]} />,
               }}
            />
         </group>
         <TargetMarkers targets={marker} color={COLORS.accent} />
         <TargetBeacon target={pickBeacon} variant="pick" color={COLORS.accent} radius={0.8} height={0.9} />
         <TargetBeacon target={dropBeacon} variant="drop-here" radius={1.0} height={0.9} />
         <Toss ref={binToss} slots={3} spin={5}>
            <Model asset={ASSETS.bottle} fallback={<mesh><cylinderGeometry args={[0.1, 0.1, 0.3, 8]} /><meshStandardMaterial color="#38bdf8" /></mesh>} />
         </Toss>
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
