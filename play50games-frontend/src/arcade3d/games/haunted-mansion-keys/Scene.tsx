"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, Color, Euler, Fog, Matrix4, MeshStandardMaterial, Quaternion, RepeatWrapping, Vector3, type Group, type MeshStandardMaterial as Mat } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import type { AABB } from "@/arcade3d/core/collision";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import { playSfx } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { Toss, useActionPop, useFx, type TossHandle } from "@/arcade3d/core/fx";
import { TargetBeacon } from "@/arcade3d/core/hud";
import { useCoarsePointer } from "@/arcade3d/core/TouchControls";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { Instanced, useCanvasTexture, type InstancePart } from "@/arcade3d/core/render";
import { HumanoidModel, POSE_MASK, blendPoses, cheerPose, createPose, gaitPhaseStep, idlePose, useHumanoidPose, walkPose, wrapPhase } from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, DETECTIVE_LANDMARKS, DETECTIVE_SCALE, FIT } from "./assets";
import type { MansionLevel } from "./levels";
import { COLORS, DAMPING, FOV, LOOK_AHEAD, aimBounds, cameraSolidList, capSpots, fogFor, groundsSpots, paintingSpots, propSpots, viewFor, wallSpots } from "./looks";
import {
   ArmourStandPrimitive,
   BookshelfPrimitive,
   ChairPrimitive,
   DetectiveFigure,
   GrandfatherClockPrimitive,
   PaintingPrimitive,
   PedestalParts,
   ShapePlate,
   TablePrimitive,
} from "./Primitives";
import { GUIDE, keyName, lockedDoorInReach, nextObjective, objectiveHint, type Objective } from "./guide";
import { ACTION_RANGE, HERO_SPEED, KEY_COLORS, PEDESTAL_TOP, ROOM_D, ROOM_W, createRun, step, type Run } from "./rules";

const E = new Euler();
const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3(1, 1, 1);
const AT = { x: 0, y: 0.6, z: 0 };
const KEY_TINTS = KEY_COLORS.map((c) => new Color(c));
const EXIT_GREEN = "#4ade80";

/** Dark oak planks, one board per 64 px. */
function drawPlanks(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = COLORS.floor;
   ctx.fillRect(0, 0, w, h);
   for (let row = 0; row < h / 32; row++) {
      ctx.fillStyle = row % 2 ? COLORS.floor : COLORS.floorPlank;
      ctx.fillRect(0, row * 32, w, 31);
      ctx.fillStyle = COLORS.floorSeam;
      ctx.fillRect(0, row * 32 + 31, w, 1);
      const off = (row * 53) % w;
      ctx.fillRect(off, row * 32, 1, 31);
      ctx.fillRect((off + w / 2) % w, row * 32, 1, 31);
   }
}

const DOOR_SLAB = new BoxGeometry(1.4, FIT.doorHeight, 0.12).translate(0, FIT.doorHeight / 2, 0);
const DOOR_PANEL = new BoxGeometry(1.1, FIT.doorHeight * 0.7, 0.14).translate(0, FIT.doorHeight * 0.45, 0);
const DOOR_PARTS: InstancePart[] = [
   { geometry: DOOR_SLAB, material: new MeshStandardMaterial({ color: COLORS.door, roughness: 0.7 }) },
   { geometry: DOOR_PANEL, material: new MeshStandardMaterial({ color: COLORS.doorTrim, roughness: 0.6 }) },
];

function LevelScene() {
   const { id, config } = useLevel<MansionLevel>();
   const portrait = useThree((state) => state.size.width < state.size.height);
   const view = useFittedView(viewFor(id, portrait));
   const scene = useThree((state) => state.scene);
   const fx = useFx();
   const time = useGameTime();
   const input = useInput();
   const [run] = useState<Run>(() => createRun(randomSeed(), config));
   // camera views (core/camera): the rules get the drawn camera's yaw; the walls and the furniture block the camera
   const cameraSolids = useMemo(() => cameraSolidList(run.walls, run.solids), [run]);
   const cam = useCameraViews({
      slug: "haunted-mansion-keys",
      subject: "character",
      steering: "camera",
      defaultYaw: view.yaw,
      target: (o) => {
         const h = run.hero;
         o.x = h.x;
         o.y = 1.1;
         o.z = h.z;
         o.heading = h.yaw;
         o.vx = h.vx;
         o.vz = h.vz;
      },
      solids: (out: AABB[]) => {
         let n = 0;
         for (const w of cameraSolids) {
            if (n >= out.length) break;
            const b = out[n++];
            b.min.x = w.min.x; b.max.x = w.max.x;
            b.min.y = w.min.y; b.max.y = w.max.y;
            b.min.z = w.min.z; b.max.z = w.max.z;
         }
         return n;
      },
   });
   const body = useRef<Group>(null);
   const armourBody = useRef<Group>(null);
   const keyBadges = useRef<(Group | null)[]>([]);
   const plaques = useRef<(Group | null)[]>([]);
   const leverHandle = useRef<Group>(null);
   const exitGlow = useRef<Mat>(null);
   const gait = useRef({ phase: 0, amount: 0 }).current;
   const [scratch] = useState(createPose);
   const synced = useRef({ keys: -1, mask: -1 }).current;
   // clarity (visual only): the beacon over the next step, the hint line, the key flights, fail pops
   const pop = useActionPop();
   const touch = useCoarsePointer();
   const goal = useRef<Objective>({ kind: "key", index: 0, x: 0, y: 0, z: 0 }).current;
   const beacon = useRef({ x: 0, y: 0, z: 0, hidden: true }).current;
   const hand = useRef({ x: run.hero.x, y: 1.1, z: run.hero.z }).current;
   const guideCode = useRef(-1);
   const lockedPopAt = useRef(-10);
   const keyTosses = useRef<(TossHandle | null)[]>([]);
   const [look, setLook] = useState<{ kind: Objective["kind"]; index: number }>({ kind: "key", index: 0 });
   useEffect(() => () => GUIDE.reset(), []);

   const bounds = useMemo(() => aimBounds(config, portrait), [config, portrait]);
   // the fog starts past the aim at whatever distance the camera was fitted to (looks.ts fogFor)
   useEffect(() => {
      const fog = scene.fog;
      if (!(fog instanceof Fog)) return;
      const before = { near: fog.near, far: fog.far };
      const next = fogFor(config, view.distance, portrait);
      fog.near = next.near;
      fog.far = next.far;
      return () => {
         fog.near = before.near;
         fog.far = before.far;
      };
   }, [scene, config, view.distance, portrait]);
   const grounds = useMemo(() => groundsSpots(id), [id]);
   const hedgeTops = useMemo(() => grounds.hedges.map((h) => ({ ...h, y: (h.sy ?? 1) + 0.04, sy: 0.08, sx: (h.sx ?? 1) + 0.06, sz: (h.sz ?? 1) + 0.06 })), [grounds]);
   const lantern = useRef<Group>(null);
   const walls = useMemo(() => wallSpots(run.walls), [run]);
   const caps = useMemo(() => capSpots(run.walls), [run]);
   const pedestals = useMemo(() => propSpots(run.props, "pedestal").map((p) => ({ ...p, y: PEDESTAL_TOP * 0.45 })), [run]);
   const pedestalTops = useMemo(() => pedestals.map((p) => ({ ...p, y: PEDESTAL_TOP * 0.95 })), [pedestals]);
   const chests = useMemo(() => propSpots(run.props, "chest"), [run]);
   const tables = useMemo(() => propSpots(run.props, "table"), [run]);
   const chairs = useMemo(() => propSpots(run.props, "chair"), [run]);
   const clocks = useMemo(() => propSpots(run.props, "clock"), [run]);
   const shelves = useMemo(() => propSpots(run.props, "bookshelf"), [run]);
   const paintings = useMemo(() => paintingSpots(run), [run]);
   const lockedDoors = useMemo(() => run.doors.filter((d) => d.kind === "locked"), [run]);
   const aim = useRef({ x: run.hero.x, y: 0.9, z: run.hero.z }).current;

   const totalW = config.cols * ROOM_W;
   const totalD = config.rows * ROOM_D;
   const planks = useCanvasTexture(256, 256, drawPlanks);
   useMemo(() => {
      planks.wrapS = RepeatWrapping;
      planks.wrapT = RepeatWrapping;
      planks.repeat.set(totalW / 2.5, totalD / 2.5);
      planks.needsUpdate = true;
   }, [planks, totalW, totalD]);

   useEffect(() => {
      fx.warm("sparks", "puff", "score", "confetti");
   }, [fx]);

   const pose = useHumanoidPose((p) => {
      const speed = Math.hypot(run.hero.vx, run.hero.vz);
      gait.amount += (Math.min(1, speed / HERO_SPEED) * 0.6 - gait.amount) * (1 - Math.exp(-12 * time.delta));
      gait.phase = wrapPhase(gait.phase + gaitPhaseStep(gait.amount, DETECTIVE_LANDMARKS, DETECTIVE_SCALE, speed, time.delta, 4));
      if (run.over === "win") {
         cheerPose(time.now, p);
         return;
      }
      walkPose(gait.phase, gait.amount, p);
      blendPoses(p, idlePose(time.now, scratch), 1 - Math.min(1, gait.amount * 5), p, POSE_MASK.upper);
   });

   useRunFrame((_state, dt) => {
      const { moveX, moveY, action, actionPressed } = input.current;
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX, moveY, action, actionPressed, yaw: cam.yaw() }, dt, store.timeLeftMs ?? 0);

      let mask = 0;
      for (let i = 0; i < run.heldKeys.length; i++) if (run.heldKeys[i]) mask |= 1 << i;
      if (synced.keys !== run.keysCount) store.setStat("keys", (synced.keys = run.keysCount));
      if (synced.mask !== mask) store.setStat("keyMask", (synced.mask = mask));

      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, run.hero.x + Math.sin(run.hero.yaw) * LOOK_AHEAD));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, run.hero.z + Math.cos(run.hero.yaw) * LOOK_AHEAD));

      hand.x = run.hero.x;
      hand.z = run.hero.z;
      if (ev.keyPickup >= 0) {
         const k = run.keys[ev.keyPickup];
         AT.x = k.x;
         AT.y = k.y + 0.4;
         AT.z = k.z;
         fx.burst("sparks", AT, 14);
         fx.score(AT, "KEY", { color: k.color });
         playSfx("pickup");
         // the key flies into the detective's hand (the key ring badge lights as it lands)
         keyTosses.current[k.id]?.play(AT, hand, { duration: 0.42, height: 0.7, scaleFrom: 1.2, scaleTo: 0.5 });
      }
      if (ev.doorOpen >= 0) {
         const d = run.doors[ev.doorOpen];
         AT.x = d.x;
         AT.y = 1;
         AT.z = d.z;
         fx.burst("puff", AT, 10);
         playSfx(d.isExit ? "chime" : "whoosh");
         // the key goes from the hand into the lock
         if (d.kind === "locked" && d.keyIndex >= 0) keyTosses.current[d.keyIndex]?.play(hand, AT, { duration: 0.38, height: 0.4, scaleFrom: 0.6, scaleTo: 0.9 });
      }
      // a Use at a locked door without its key does nothing in the rules: say why
      if (input.current.actionPressed && run.time - lockedPopAt.current > 1.2) {
         const need = lockedDoorInReach(run);
         if (need >= 0) {
            lockedPopAt.current = run.time;
            AT.x = run.hero.x;
            AT.y = 2;
            AT.z = run.hero.z;
            pop.fail(AT, `Locked: need the ${keyName(need)}`, { shake: 0 });
            playSfx("buzz", { volume: 0.4 });
         }
      }
      if (ev.leverPulled && run.lever) {
         AT.x = run.lever.x;
         AT.y = 1;
         AT.z = run.lever.z;
         fx.burst("sparks", AT, 8);
         fx.shake(0.15);
         playSfx("click");
      }
      if (ev.hitArmour) {
         AT.x = run.hero.x;
         AT.y = 0.9;
         AT.z = run.hero.z;
         fx.burst("puff", AT, 12);
         fx.shake(0.3);
         playSfx("hit");
         AT.y = 2;
         pop.fail(AT, run.lives !== null ? "Caught! -1 life" : "Caught!", { shake: 0 });
      }
      if (ev.lifeLost) store.loseLife();

      // the next step: beacon + hint (the hint is rebuilt only when the step or "in reach" changes)
      nextObjective(run, goal);
      beacon.x = goal.x;
      beacon.y = goal.y;
      beacon.z = goal.z;
      beacon.hidden = run.over !== null;
      const near = Math.hypot(goal.x - run.hero.x, goal.z - run.hero.z) <= ACTION_RANGE ? 1 : 0;
      const code = (goal.kind === "key" ? 0 : goal.kind === "door" ? 1 : 2) * 100 + (goal.index + 1) * 2 + near;
      if (code !== guideCode.current) {
         if (Math.floor(code / 2) !== Math.floor(guideCode.current / 2)) setLook({ kind: goal.kind, index: goal.index });
         guideCode.current = code;
         GUIDE.set(objectiveHint(run, goal, touch));
      }

      if (ev.won) {
         const exit = run.rooms[run.rooms.length - 1];
         AT.x = exit.cx;
         AT.y = 1.5;
         AT.z = exit.cz;
         fx.burst("confetti", AT, 30);
         store.setScore(run.score);
         store.end("win");
      } else if (run.over === "lose") store.end("lose");
      else if (run.over === "timeup") store.end("timeup");
   });

   useFrame(() => {
      if (body.current) {
         body.current.position.set(run.hero.x, 0, run.hero.z);
         body.current.rotation.y = run.hero.yaw;
         // a short blink while the armour's mercy runs
         body.current.visible = run.hero.mercy <= 0 || Math.floor(time.now * 12) % 2 === 0;
      }
      if (armourBody.current && run.armour) {
         armourBody.current.position.set(run.armour.agent.x, Math.abs(Math.sin(time.now * 5)) * 0.05, run.armour.agent.z);
         armourBody.current.rotation.set(0, run.armour.agent.yaw, Math.sin(time.now * 5) * 0.04);
      }
      for (const k of run.keys) {
         const badge = keyBadges.current[k.id];
         if (!badge) continue;
         badge.visible = !k.collected;
         badge.position.set(k.x, k.y + FIT.key + 0.28 + Math.sin(time.now * 2.5 + k.id) * 0.05, k.z);
      }
      for (let i = 0; i < lockedDoors.length; i++) {
         const g = plaques.current[i];
         if (g) g.visible = !lockedDoors[i].open;
      }
      if (leverHandle.current && run.lever) leverHandle.current.rotation.x = run.lever.pulled ? 0.7 : -0.7;
      if (lantern.current) lantern.current.position.set(run.hero.x, 2.4, run.hero.z + 0.6);
      if (exitGlow.current) exitGlow.current.emissiveIntensity = run.exitDoorOpen ? 0.9 + Math.sin(time.now * 4) * 0.3 : 0.15;
   }, FRAME_PRIORITY.visuals);

   const placeDoor = (i: number, m: Matrix4) => {
      const d = run.doors[i];
      if (!d || d.open) return false;
      V.set(d.x, 0, d.z);
      E.set(0, d.rotY, 0);
      Q.setFromEuler(E);
      S.set(1, 1, 1);
      m.compose(V, Q, S);
   };
   const placeKey = (i: number, m: Matrix4, color: Color) => {
      const k = run.keys[i];
      if (!k || k.collected) return false;
      V.set(k.x, k.y + 0.04 + Math.sin(time.now * 2.5 + i) * 0.04, k.z);
      E.set(0, time.now * 1.6 + i, 0);
      Q.setFromEuler(E);
      S.set(1, 1, 1);
      m.compose(V, Q, S);
      color.copy(KEY_TINTS[i]);
   };
   const exitRoom = run.rooms[run.rooms.length - 1];

   return (
      <>
         <CameraRig camera={{ position: view.offset, fov: FOV, lookAt: [aim.x, aim.y, aim.z] }} follow={aim} bounds={bounds} offset={view.offset} shift={view.shift} damping={DAMPING} />

         {/* moonlight fill and the detective's warm lantern, so the night levels stay readable */}
         <ambientLight intensity={0.35} color={COLORS.moon} />
         <group ref={lantern}>
            <pointLight intensity={6} distance={9} decay={1.6} color={COLORS.lantern} />
         </group>
         {/* the grounds round the house reach past the fog; a gravel apron; the oak floor */}
         <mesh rotation-x={-Math.PI / 2} position={[totalW / 2, -0.02, totalD / 2]}>
            <circleGeometry args={[140, 40]} />
            <meshStandardMaterial color={COLORS.grounds} roughness={0.95} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[totalW / 2, -0.01, totalD / 2]}>
            <planeGeometry args={[totalW + 3, totalD + 3]} />
            <meshStandardMaterial color={COLORS.gravel} roughness={0.95} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[totalW / 2, 0.001, totalD / 2]}>
            <planeGeometry args={[totalW, totalD]} />
            <meshStandardMaterial map={planks} roughness={0.85} />
         </mesh>

         <Instanced spots={grounds.hedges} name="hedge">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.hedge} roughness={0.95} />
         </Instanced>
         <Instanced spots={hedgeTops} name="hedge-top">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.hedgeTop} roughness={0.9} />
         </Instanced>
         <InstancedModel asset={ASSETS.tree} spots={grounds.trees} fallback={<>{grounds.trees.map((t, i) => (<mesh key={i} position={[t.x, (t.scale ?? 1) / 2, t.z]}><coneGeometry args={[(t.scale ?? 1) * 0.3, t.scale ?? 1, 8]} /><meshStandardMaterial color={COLORS.hedge} /></mesh>))}</>} />
         <Instanced spots={walls} name="walls">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.88} />
         </Instanced>
         <Instanced spots={caps} name="wall-caps">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wallTrim} roughness={0.7} />
         </Instanced>

         <DynamicInstancedModel asset={ASSETS.door} count={run.doors.length} update={placeDoor} fallbackParts={DOOR_PARTS} name="doors" />
         {lockedDoors.map((d, i) => (
            <group key={d.id} ref={(g) => { plaques.current[i] = g; }} position={[d.x, FIT.doorHeight * 0.72, d.z]} rotation-y={d.rotY}>
               <group position={[0, 0, 0.13]}>
                  <ShapePlate shape={d.shape!} color={d.color!} size={0.26} />
               </group>
               <group position={[0, 0, -0.13]} rotation-y={Math.PI}>
                  <ShapePlate shape={d.shape!} color={d.color!} size={0.26} />
               </group>
            </group>
         ))}

         {pedestals.length > 0 && (
            <>
               <Instanced spots={pedestals} name="pedestal">
                  <boxGeometry args={[0.38, PEDESTAL_TOP * 0.9, 0.38]} />
                  <meshStandardMaterial color={COLORS.pedestal} roughness={0.8} />
               </Instanced>
               <Instanced spots={pedestalTops} name="pedestal-top">
                  <boxGeometry args={[0.5, PEDESTAL_TOP * 0.1, 0.5]} />
                  <meshStandardMaterial color={COLORS.pedestalTop} roughness={0.6} />
               </Instanced>
            </>
         )}
         <InstancedModel asset={ASSETS.chest} spots={chests} fallback={<>{chests.map((s, i) => (<group key={i} position={[s.x, 0, s.z]}><PedestalParts height={0.44} /></group>))}</>} />
         <DynamicInstancedModel asset={ASSETS.key} count={run.keys.length} update={placeKey} name="keys" tinted />
         {run.keys.map((k) => (
            <group key={k.id} ref={(g) => { keyBadges.current[k.id] = g; }}>
               <ShapePlate shape={k.shape} color={k.color} size={0.2} />
            </group>
         ))}

         <InstancedModel asset={ASSETS.table} spots={tables} fallback={<>{tables.map((s, i) => (<group key={i} position={[s.x, 0, s.z]} rotation-y={s.rotY ?? 0}><TablePrimitive /></group>))}</>} />
         <InstancedModel asset={ASSETS.chair} spots={chairs} fallback={<>{chairs.map((s, i) => (<group key={i} position={[s.x, 0, s.z]} rotation-y={s.rotY ?? 0}><ChairPrimitive /></group>))}</>} />
         <InstancedModel asset={ASSETS.clock} spots={clocks} fallback={<>{clocks.map((s, i) => (<group key={i} position={[s.x, 0, s.z]}><GrandfatherClockPrimitive /></group>))}</>} />
         <InstancedModel asset={ASSETS.bookshelf} spots={shelves} fallback={<>{shelves.map((s, i) => (<group key={i} position={[s.x, 0, s.z]}><BookshelfPrimitive /></group>))}</>} />
         <InstancedModel asset={ASSETS.painting} spots={paintings} fallback={<>{paintings.map((s, i) => (<group key={i} position={[s.x, s.y + 0.5, s.z]}><PaintingPrimitive /></group>))}</>} />

         {run.lever && (
            <group position={[run.lever.x, 0, run.lever.z]}>
               <mesh position={[0, 0.45, 0]}>
                  <boxGeometry args={[0.24, 0.9, 0.24]} />
                  <meshStandardMaterial color={COLORS.leverPost} roughness={0.8} />
               </mesh>
               <Model asset={ASSETS.lever} position={[0, 0.9, 0.0]} fallback={null} />
               <group ref={leverHandle} position={[0, 1.15, 0.14]}>
                  <mesh position={[0, 0.22, 0]}>
                     <cylinderGeometry args={[0.03, 0.03, 0.44, 8]} />
                     <meshStandardMaterial color={COLORS.leverHandle} roughness={0.35} metalness={0.5} />
                  </mesh>
                  <mesh position={[0, 0.46, 0]}>
                     <sphereGeometry args={[0.06, 12, 8]} />
                     <meshStandardMaterial color="#b91c1c" roughness={0.4} />
                  </mesh>
               </group>
            </group>
         )}

         {run.armour && (
            <group ref={armourBody}>
               <Model asset={ASSETS.armour} fallback={<ArmourStandPrimitive />} />
            </group>
         )}

         <group position={[exitRoom.cx, 0.02, exitRoom.cz]}>
            <mesh rotation-x={-Math.PI / 2}>
               <ringGeometry args={[0.9, 1.1, 40]} />
               <meshStandardMaterial ref={exitGlow} color={COLORS.exitGlow} emissive={COLORS.exitGlow} emissiveIntensity={0.15} roughness={0.5} />
            </mesh>
         </group>

         {/* clarity: the next step's beacon, and one flying copy per key (pickup and unlock) */}
         <TargetBeacon
            target={beacon}
            variant={look.kind === "exit" ? "drop-here" : "pick"}
            color={look.kind === "exit" ? EXIT_GREEN : KEY_COLORS[look.index]}
            radius={look.kind === "exit" ? 1.2 : look.kind === "door" ? 0.8 : 0.55}
            height={look.kind === "exit" ? 1.6 : look.kind === "door" ? 1.2 : 0.9}
            label={look.kind === "exit" ? "EXIT" : null}
         />
         {run.keys.map((k) => (
            <Toss key={k.id} ref={(t: TossHandle | null) => { keyTosses.current[k.id] = t; }} spin={8}>
               <ShapePlate shape={k.shape} color={k.color} size={0.26} />
               <mesh position={[0, -0.18, 0]}>
                  <cylinderGeometry args={[0.03, 0.03, 0.26, 8]} />
                  <meshStandardMaterial color={k.color} emissive={k.color} emissiveIntensity={0.6} metalness={0.4} roughness={0.35} />
               </mesh>
            </Toss>
         ))}

         <group ref={body}>
            <HumanoidModel asset={ASSETS.detective} pose={pose} fallback={<DetectiveFigure />} />
         </group>
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
