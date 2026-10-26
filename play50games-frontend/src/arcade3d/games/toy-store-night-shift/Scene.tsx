"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   BufferGeometry, DoubleSide, Euler, Matrix4, MeshBasicMaterial, PlaneGeometry, Quaternion, Vector3,
   type Group,
} from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { Flashlight } from "@/arcade3d/core/kit";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed, turnTowards } from "@/arcade3d/core/math";
import { hop, waddle, type BodyOffset } from "@/arcade3d/core/motion";
import { Instanced, useCanvasTexture } from "@/arcade3d/core/render";
import {
   HumanoidModel, POSE_MASK, blendPoses, carryPose, cheerPose, createPose, gaitPhaseStep, idlePose, useHumanoidPose, walkPose, wrapPhase,
} from "@/arcade3d/core/rig";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS, GUARD_LANDMARKS, GUARD_SCALE, TOY_ASSETS } from "./assets";
import { SIGN_ATLAS_W, SIGN_CELL, drawSigns } from "./glyphs";
import { CATEGORIES, type Category, type ToyLevel } from "./levels";
import {
   BACK, COLORS, DAMPING, FOLLOW, FOV, TORCH, aimBounds, aimFor, shelfTrimSpots, decorOf, lookAtFor, signBaseSpots, signSpots, slotSpot, tileSpots, viewFor, wallSpots,
} from "./looks";
import { BinStand, GuardFigure, shelfParts, toyParts, windupCarParts, windupRobotParts } from "./Primitives";
import { MAX_SPEED, SHELF_H, createRun, nextTarget, step, type Run } from "./rules";

const E = new Euler();
const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3(1, 1, 1);
const AT = { x: 0, y: 0.5, z: 0 };
const WOFF: BodyOffset = { y: 0, roll: 0, yaw: 0, squash: 1 };

/** Toys of one kind not on a shelf yet. */
function leftOf(run: Run, cat: Category): number {
   let n = 0;
   for (const t of run.toys) if (t.cat === cat && t.state !== 2) n += 1;
   return n;
}

const drawAtlas = (ctx: CanvasRenderingContext2D, w: number, h: number) => drawSigns(ctx, w, h, CATEGORIES);

/** A unit plane whose UVs cover one atlas cell; flat (faces up) or standing (faces +z). */
function signGeometry(cat: Category, flat: boolean): BufferGeometry {
   const cell = CATEGORIES.indexOf(cat);
   const g = new PlaneGeometry(1, 1);
   const uv = g.getAttribute("uv");
   for (let i = 0; i < uv.count; i++) uv.setX(i, (cell + uv.getX(i)) / (SIGN_ATLAS_W / SIGN_CELL));
   if (flat) g.rotateX(-Math.PI / 2);
   return g;
}

function Signs({ run }: { run: Run }) {
   const atlas = useCanvasTexture(SIGN_ATLAS_W, SIGN_CELL, drawAtlas);
   const mat = useMemo(() => new MeshBasicMaterial({ map: atlas, transparent: true, toneMapped: false, side: DoubleSide }), [atlas]);
   const spots = useMemo(() => signSpots(run), [run]);
   const bases = useMemo(() => signBaseSpots(run), [run]);
   const geos = useMemo(() => CATEGORIES.map((c) => signGeometry(c, true)), []);
   useEffect(() => () => { mat.dispose(); geos.forEach((g) => g.dispose()); }, [mat, geos]);
   return (
      <>
         <Instanced spots={bases} name="sign-bases">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.signBase} roughness={0.5} />
         </Instanced>
         {CATEGORIES.map((c, i) => (spots[c]?.length ? (
            <Instanced key={c} spots={spots[c]} name={`sign-${c}`}>
               <primitive object={geos[i]} attach="geometry" />
               <primitive object={mat} attach="material" />
            </Instanced>
         ) : null))}
      </>
   );
}

/** The carried toy's plate over the guard's head: faces the camera, shows the top toy's kind. */
function CarryPlate({ run }: { run: Run }) {
   const atlas = useCanvasTexture(SIGN_ATLAS_W, SIGN_CELL, drawAtlas);
   const mat = useMemo(() => new MeshBasicMaterial({ map: atlas, transparent: true, toneMapped: false, depthTest: false }), [atlas]);
   const geos = useMemo(() => CATEGORIES.map((c) => signGeometry(c, false)), []);
   const group = useRef<Group>(null);
   const meshes = useRef<Array<Group | null>>([]);
   const camera = useThree((s) => s.camera);
   useEffect(() => () => { mat.dispose(); geos.forEach((g) => g.dispose()); }, [mat, geos]);
   useFrame(() => {
      const g = group.current;
      if (!g) return;
      const top = run.carried.length > 0 ? run.toys[run.carried[run.carried.length - 1]].cat : null;
      g.visible = top !== null;
      if (top === null) return;
      g.position.set(run.hero.x, 2.55, run.hero.z);
      g.quaternion.copy(camera.quaternion);
      CATEGORIES.forEach((c, i) => {
         const m = meshes.current[i];
         if (m) m.visible = c === top;
      });
   }, FRAME_PRIORITY.visuals);
   return (
      <group ref={group} visible={false} renderOrder={20}>
         {CATEGORIES.map((c, i) => (
            <group key={c} ref={(m) => { meshes.current[i] = m; }} scale={[0.78, 0.78, 0.78]}>
               <mesh geometry={geos[i]} material={mat} renderOrder={20} />
            </group>
         ))}
      </group>
   );
}

/** Coloured trim bands (front and back, under the top) and kick plates on the painted shelves: one colour per row. */
function ShelfTrims({ run }: { run: Run }) {
   const groups = useMemo(() => shelfTrimSpots(run), [run]);
   return (
      <>
         {groups.map((g, i) => (g.spots.length ? (
            <Instanced key={i} spots={g.spots} name={`shelf-trim-${i}`}>
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={g.color} roughness={0.45} />
            </Instanced>
         ) : null))}
      </>
   );
}

function LevelScene() {
   const { id, config } = useLevel<ToyLevel>();
   const view = useFittedView(viewFor(id));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const [run] = useState<Run>(() => createRun(randomSeed(), config));
   const aim = useRef(aimFor(config, run.hero.x, run.hero.z, run.hero.yaw, { x: 0, y: 0.9, z: 0 })).current;
   const body = useRef<Group>(null);
   const torch = useRef<Group>(null);
   const gait = useRef({ phase: 0, amount: 0, visYaw: 0 }).current;
   const bounds = useMemo(() => aimBounds(config), [config]);
   const look = useMemo(() => lookAtFor(), []);
   const tiles = useMemo(() => tileSpots(config), [config]);
   const walls = useMemo(() => wallSpots(config), [config]);
   const decor = useMemo(() => decorOf(run), [run]);
   const shelfSpots = useMemo(() => run.shelves.map((s) => ({ x: s.x, y: 0, z: s.z })), [run]);
   const marker = useMemo<MarkerTarget[]>(() => [{ x: 0, y: 0.6, z: 0, hidden: true }], []);
   const scratch = useMemo(() => ({ a: createPose() }), []);
   const shelfP = useMemo(() => shelfParts(), []);
   const byCat = useMemo(() => {
      const out = {} as Record<Category, number[]>;
      run.toys.forEach((t, i) => (out[t.cat] ??= []).push(i));
      return out;
   }, [run]);
   const toyP = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c, toyParts(c)])) as Record<Category, ReturnType<typeof toyParts>>, []);
   const robotP = useMemo(() => windupRobotParts(), []);
   const carP = useMemo(() => windupCarParts(), []);
   useEffect(() => () => {
      const all = [...shelfP, ...robotP, ...carP, ...CATEGORIES.flatMap((c) => toyP[c])];
      for (const part of all) {
         part.geometry.dispose();
         const m = part.material;
         if (Array.isArray(m)) m.forEach((x) => x.dispose());
         else m.dispose();
      }
   }, [shelfP, robotP, carP, toyP]);
   const windupYaw = useRef<number[]>(run.windups.map((w) => w.yaw)).current;
   const robots = useMemo(() => run.windups.filter((w) => w.kind === "robot"), [run]);
   const cars = useMemo(() => run.windups.filter((w) => w.kind === "car"), [run]);
   const synced = useRef({ shelved: -1, carrying: -1, left: false }).current;

   const pose = useHumanoidPose((p) => {
      const speed = Math.hypot(run.hero.vx, run.hero.vz);
      const target = Math.min(1, speed / MAX_SPEED) * 0.75;
      gait.amount += (target - gait.amount) * (1 - Math.exp(-12 * time.delta));
      gait.phase = wrapPhase(gait.phase + gaitPhaseStep(gait.amount, GUARD_LANDMARKS, GUARD_SCALE, speed, time.delta, 4));
      if (run.over === "win") cheerPose(time.now, p);
      else {
         if (gait.amount > 0.03) walkPose(gait.phase, gait.amount, p);
         else idlePose(time.now, p);
         if (run.carried.length > 0) blendPoses(p, carryPose(0.05, scratch.a), 1, p, POSE_MASK.arms);
      }
   });

   useEffect(() => {
      fx.warm("puff", "sparkle", "splash", "score");
   }, [fx]);

   useRunFrame((_state, dt) => {
      const { moveX, moveY, actionPressed } = input.current;
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX, moveY, use: actionPressed, yaw: view.yaw }, dt, store.timeLeftMs ?? 0);
      if (ev.score) store.addScore(ev.score);
      // the HUD only hears about a change (no store write per frame)
      if (synced.shelved !== run.placed) store.setStat("shelved", (synced.shelved = run.placed));
      if (synced.carrying !== run.carried.length) store.setStat("carrying", (synced.carrying = run.carried.length));
      if (ev.right >= 0 || ev.pick >= 0 || ev.wrong || ev.hit || !synced.left) {
         synced.left = true;
         for (const cat of CATEGORIES) store.setStat(`left_${cat}`, leftOf(run, cat));
      }
      const t = nextTarget(run);
      marker[0].hidden = !t;
      if (t) {
         marker[0].x = t.x;
         marker[0].z = t.z;
      }
      aimFor(config, run.hero.x, run.hero.z, run.hero.yaw, aim);
      if (ev.pick >= 0) {
         AT.x = run.toys[ev.pick].x; AT.y = 0.5; AT.z = run.toys[ev.pick].z;
         fx.burst("puff", AT, 5);
         playSfx("pickup");
      }
      if (ev.right >= 0) {
         const sh = run.shelves[ev.right];
         AT.x = sh.x; AT.y = SHELF_H + 0.6; AT.z = sh.z;
         fx.burst("sparkle", AT, 14);
         fx.score(AT, `+${ev.score}`);
         playSfx("chime");
      }
      if (ev.wrong) {
         AT.x = run.hero.x; AT.y = 1; AT.z = run.hero.z;
         fx.burst("puff", AT, 6);
         fx.shake(0.2);
         playSfx("buzz");
      }
      if (ev.hit) {
         AT.x = run.hero.x; AT.y = 1; AT.z = run.hero.z;
         fx.burst("splash", AT, 8);
         fx.shake(0.3);
         playSfx("hit");
      }
      if (ev.won) {
         playSfx("win");
         store.end("win");
      }
   });

   useFrame((_s, delta) => {
      const g = body.current;
      if (!g) return;
      gait.visYaw = turnTowards(gait.visYaw, run.hero.yaw, Math.min(1, delta * 12));
      g.position.set(run.hero.x, 0, run.hero.z);
      g.rotation.y = gait.visYaw;
      const f = torch.current;
      if (f) {
         f.position.set(run.hero.x, 0, run.hero.z);
         f.rotation.y = gait.visYaw;
      }
   }, FRAME_PRIORITY.visuals);

   const placeToy = (cat: Category) => (i: number, m: Matrix4) => {
      const index = byCat[cat]?.[i];
      if (index === undefined) return false;
      const t = run.toys[index];
      if (t.state === 2) {
         const spot = slotSpot(run.shelves[t.shelf], t.slot);
         V.set(spot.x, spot.y + 0.06, spot.z);
         E.set(0, t.spin * 0.2, 0);
      } else if (t.state === 1) {
         const k = run.carried.indexOf(index);
         V.set(run.hero.x + Math.sin(gait.visYaw) * 0.42, 0.92 + k * 0.5, run.hero.z + Math.cos(gait.visYaw) * 0.42);
         E.set(0, gait.visYaw, 0);
      } else {
         V.set(t.x, 0.05 + (Math.sin(time.now * 2.2 + t.spin) + 1) * 0.025, t.z);
         E.set(0, t.spin + time.now * 0.4, 0);
      }
      Q.setFromEuler(E);
      S.set(1, 1, 1);
      m.compose(V, Q, S);
   };
   const placeWindup = (list: typeof robots, isRobot: boolean) => (i: number, m: Matrix4) => {
      const w = list[i];
      if (!w) return false;
      const k = run.windups.indexOf(w);
      windupYaw[k] = turnTowards(windupYaw[k] ?? w.yaw, w.yaw, Math.min(1, time.delta * 5));
      const ph = time.now * run.level.windupSpeed * 3.2 + k;
      if (isRobot) waddle(ph, 0.3, WOFF);
      else hop(ph * 0.6, 0.05, WOFF);
      E.set(WOFF.roll, windupYaw[k] + WOFF.yaw, 0);
      Q.setFromEuler(E);
      V.set(w.x, WOFF.y, w.z);
      S.set(1, WOFF.squash, 1);
      m.compose(V, Q, S);
   };

   return (
      <>
         <CameraRig
            camera={{ position: view.offset, fov: FOV, lookAt: look }}
            follow={aim}
            followFraction={FOLLOW}
            bounds={bounds}
            offset={view.offset}
            shift={view.shift}
            damping={DAMPING}
         />
         {/* the dark ground round the store reaches past the fog; the store floor is its own lighter slab */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
            <planeGeometry args={[400, 400]} />
            <meshStandardMaterial color={config.lighting === "night" ? COLORS.outsideNight : COLORS.outside} roughness={0.95} emissive={config.lighting === "night" ? COLORS.outsideGlow : "#000000"} emissiveIntensity={config.lighting === "night" ? 0.8 : 0} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, -BACK / 2]}>
            <planeGeometry args={[run.hx * 2, run.hz * 2 + BACK]} />
            <meshStandardMaterial color={COLORS.floor} roughness={0.85} />
         </mesh>
         <Instanced spots={tiles} name="floor-tiles">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.floorTile} roughness={0.85} />
         </Instanced>
         <Instanced spots={walls.walls} name="walls">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.8} />
         </Instanced>
         <Instanced spots={walls.trims} name="wall-trims">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={config.lighting === "night" ? COLORS.emergency : COLORS.wallTrim} emissive={config.lighting === "night" ? COLORS.emergency : COLORS.wallTrim} emissiveIntensity={config.lighting === "night" ? 0.9 : 0.15} roughness={0.5} />
         </Instanced>
         <InstancedModel
            asset={ASSETS.shelf}
            spots={shelfSpots}
            fallback={(
               <>
                  {shelfP.map((p, i) => (
                     <Instanced key={i} spots={shelfSpots} name={`shelf-stand-${i}`}>
                        <primitive object={p.geometry} attach="geometry" />
                        <primitive object={p.material} attach="material" />
                     </Instanced>
                  ))}
               </>
            )}
         />
         <ShelfTrims run={run} />
         <Signs run={run} />
         {decor.map((d, i) => (
            <Model
               key={i}
               asset={d.kind === "bin" ? ASSETS.bin : d.kind === "binPlush" ? ASSETS.binPlush : ASSETS.crate}
               position={[d.x, d.y, d.z]}
               rotation-y={d.rotY}
               fallback={<BinStand color={d.kind === "crate" ? COLORS.crate : d.kind === "bin" ? COLORS.bin : COLORS.binPlush} />}
            />
         ))}
         {CATEGORIES.map((c) => (byCat[c]?.length ? (
            <DynamicInstancedModel key={c} asset={TOY_ASSETS[c]} count={byCat[c].length} update={placeToy(c)} fallbackParts={toyP[c]} name={`toys-${c}`} />
         ) : null))}
         {robots.length > 0 && <DynamicInstancedModel asset={ASSETS.windupRobot} count={robots.length} update={placeWindup(robots, true)} fallbackParts={robotP} name="windup-robots" />}
         {cars.length > 0 && <DynamicInstancedModel asset={ASSETS.windupCar} count={cars.length} update={placeWindup(cars, false)} fallbackParts={carP} name="windup-cars" />}
         <group ref={torch}>
            <Flashlight halfAngle={TORCH.halfAngle} range={TORCH.range} height={1.2} light={false} color={COLORS.torch} opacity={config.lighting === "night" ? 0.45 : 0.1} />
         </group>
         <group ref={body}>
            <HumanoidModel asset={ASSETS.guard} pose={pose} fallback={<GuardFigure />} />
            {/* night levels: a dim warm fill that walks with the guard, so he keeps his colours (mounted for the whole run: no recompile) */}
            {config.lighting === "night" && <pointLight position={[0, 2.2, 0.6]} intensity={5} distance={7} decay={1.6} color={COLORS.lantern} />}
         </group>
         <CarryPlate run={run} />
         <TargetMarkers targets={marker} color={COLORS.wallTrim} />
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
