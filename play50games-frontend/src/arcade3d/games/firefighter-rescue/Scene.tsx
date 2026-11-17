"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, ConeGeometry, CylinderGeometry, Euler, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type Group } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx } from "@/arcade3d/core/audio";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import type { AABB } from "@/arcade3d/core/collision";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useActionPop, useFx } from "@/arcade3d/core/fx";
import { TargetBeacon, TargetMarkers } from "@/arcade3d/core/hud";
import { useCoarsePointer } from "@/arcade3d/core/TouchControls";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { waddle, type BodyOffset } from "@/arcade3d/core/motion";
import { useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { BlobShadow } from "@/arcade3d/core/render";
import { HumanoidModel, gaitPhaseStep, useHumanoidPose, wrapPhase } from "@/arcade3d/core/rig";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS, FIREFIGHTER_LANDMARKS, FIREFIGHTER_SCALE, FIT } from "./assets";
import type { FireLevel } from "./levels";
import {
   COLORS,
   DAMPING,
   EXIT_SIGN_SPOTS,
   FOLLOW,
   FOV,
   HOSE_REEL_SPOT,
   HYDRANT_SPOTS,
   LINTEL,
   LOOK_AHEAD,
   STREET,
   TRUCK_SPOT,
   WALL_H,
   buildingBox,
   cutawayWalls,
   doorLeaf,
   doorWallHeight,
   levelColors,
   levelDecor,
   lookAtFor,
   openDoorHeight,
   onFullWall,
   plaqueSpots,
   porchFull,
   viewFor,
   wallSpots,
   type DecorPiece,
} from "./looks";
import { GUIDE, heroInSmoke, hintCode, nextTarget, targetHint, type Target } from "./guide";
import { firefighterPose } from "./poses";
import { ExitSignPrimitive, ExtinguisherPrimitive, FirefighterFigure, HoseReelPrimitive, HydrantPrimitive, TruckPrimitive } from "./Primitives";
import {
   FURN_SIZE,
   HOP_H,
   MAX_SPEED,
   SPRAY_RANGE,
   createRun,
   debrisPose,
   doorClosed,
   step,
   type FurnKind,
   type Furniture,
   type Run,
} from "./rules";

const E = new Euler();
const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3(1, 1, 1);
const AT = { x: 0, y: 0.5, z: 0 };
const WOFF: BodyOffset = { y: 0, roll: 0, yaw: 0, squash: 1 };

/**
 * The rules' furniture of one kind as instance spots. `turn` is a visual turn on top of the rules'
 * rotY that keeps the box's footprint (a half turn): the GLB's front faces into its room.
 */
function spotsOf(items: readonly Furniture[], kind: FurnKind, turn: (item: Furniture) => number = () => 0) {
   return items.filter((item) => item.kind === kind).map((item) => ({ x: item.x, y: 0, z: item.z, rotY: item.rotY + turn(item) }));
}
/** Doors swing open at this rate (1/s) once their lock fire is out. */
const DOOR_SWING = 1.8;
/** Water puffs from the nozzle while spraying, this often (s). */
const SPRAY_EVERY = 0.08;
const LEAF = { x: 0, z: 0, rotY: 0 };

function FurnMeshes({ kind, color, trim, spots, asset }: {
   kind: FurnKind;
   color: string;
   trim: string;
   spots: ReturnType<typeof spotsOf>;
   asset: (typeof ASSETS)[FurnKind] | (typeof ASSETS)["chair"];
}) {
   const size = FURN_SIZE[kind];
   const parts = useMemo(() => {
      const body = new BoxGeometry(size.x, size.y * 0.78, size.z);
      body.translate(0, size.y * 0.39, 0);
      const cap = new BoxGeometry(size.x * 0.9, size.y * 0.24, size.z * 0.9);
      cap.translate(0, size.y * 0.84, 0);
      return {
         body,
         cap,
         bodyMat: new MeshStandardMaterial({ color, roughness: 0.72 }),
         capMat: new MeshStandardMaterial({ color: trim, roughness: 0.6 }),
      };
   }, [size, color, trim]);
   useEffect(() => () => {
      parts.body.dispose();
      parts.cap.dispose();
      parts.bodyMat.dispose();
      parts.capMat.dispose();
   }, [parts]);
   if (spots.length === 0) return null;
   return (
      <InstancedModel
         asset={asset}
         spots={spots}
         fallback={
            <>
               <Instanced spots={spots} name={kind}>
                  <primitive object={parts.body} attach="geometry" />
                  <primitive object={parts.bodyMat} attach="material" />
               </Instanced>
               <Instanced spots={spots} name={`${kind}-trim`}>
                  <primitive object={parts.cap} attach="geometry" />
                  <primitive object={parts.capMat} attach="material" />
               </Instanced>
            </>
         }
      />
   );
}

function LevelScene() {
   const { id, config } = useLevel<FireLevel>();
   const view = useFittedView(viewFor(id));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const quality = useQuality();
   const [run] = useState<Run>(() => createRun(randomSeed(), config));
   // the level's own palette and exterior set dressing (level 1 keeps today's bare street)
   const colors = useMemo(() => levelColors(config), [config]);
   const decor = useMemo(() => levelDecor(config), [config]);
   const decorGroups = useMemo(() => {
      const group = (items: readonly DecorPiece[]) => {
         const map = new Map<string, InstanceSpot[]>();
         for (const item of items) {
            const list = map.get(item.color) ?? [];
            list.push(item.spot);
            map.set(item.color, list);
         }
         return [...map].map(([color, spots]) => ({ color, spots }));
      };
      return { boxes: group(decor.boxes), cyls: group(decor.cyls) };
   }, [decor]);
   // camera views (core/camera): an on-foot hero, the stick is camera-relative (inputToWorld in
   // rules.ts), so the chase view only drifts behind the travel. The building's walls (full height,
   // not the cutaway) and furniture pull the camera in front of them in the chase / front / free views.
   const solidBoxes = useMemo(() => wallSpots(config).map((s) => ({
      min: { x: s.x - (s.sx ?? 1) / 2, y: 0, z: s.z - (s.sz ?? 1) / 2 },
      max: { x: s.x + (s.sx ?? 1) / 2, y: (s.sy ?? 1), z: s.z + (s.sz ?? 1) / 2 },
   } as AABB)), [config]);
   const cam = useCameraViews({
      slug: "firefighter-rescue",
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
         let n = 0;
         for (const box of solidBoxes) {
            if (n >= out.length) break;
            const dst = out[n++];
            dst.min.x = box.min.x; dst.min.y = box.min.y; dst.min.z = box.min.z;
            dst.max.x = box.max.x; dst.max.y = box.max.y; dst.max.z = box.max.z;
         }
         for (const solid of run.solids) {
            if (n >= out.length) break;
            if (!solid.on) continue;
            const dst = out[n++];
            dst.min.x = solid.box.min.x; dst.min.y = solid.box.min.y; dst.min.z = solid.box.min.z;
            dst.max.x = solid.box.max.x; dst.max.y = solid.box.max.y; dst.max.z = solid.box.max.z;
         }
         return n;
      },
   });
   const aim = useRef({ x: run.hero.x, y: 0.9, z: run.hero.z + LOOK_AHEAD }).current;
   const body = useRef<Group>(null);
   const gait = useRef({ phase: 0 });
   const puffAt = useRef(0);
   const bounds = useMemo(() => buildingBox(config), [config]);
   const look = useMemo(() => lookAtFor(config), [config]);
   // cutaway: walls the camera looks over at the floor are drawn low, so no wall hides the firefighter,
   // a fire or a neighbour; their doors, plaques and signs follow
   const walls = useMemo(() => cutawayWalls(config, view.yaw), [config, view.yaw]);
   const plaques = useMemo(
      () => plaqueSpots(config).filter((spot) => onFullWall(config, view.yaw, spot)).slice(0, Math.max(1, Math.round(config.rooms * quality.decor))),
      [config, quality.decor, view.yaw]
   );
   const caps = useMemo(
      () => [...walls.map((spot) => ({ ...spot, y: spot.y + (spot.sy ?? 0) / 2, sy: 0.08 })), ...(porchFull(config, view.yaw) ? [LINTEL] : [])],
      [walls, config, view.yaw]
   );
   const signs = useMemo(() => EXIT_SIGN_SPOTS.filter((spot) => onFullWall(config, view.yaw, spot)), [config, view.yaw]);
   // door leaves are cut down like a wall in their place: shut in the hall wall, open across the room's side
   const doorScaleY = useMemo(
      () => Array.from({ length: config.rooms }, (_, room) => [doorWallHeight(config, view.yaw, room) / WALL_H, openDoorHeight(config, view.yaw, room) / WALL_H] as const),
      [config, view.yaw]
   );
   const doorOpen = useRef<number[]>([]).current;
   const sprayAt = useRef(0);
   // clarity (visual only): the beacon over the current target, the hint line, fail / info pops
   const pop = useActionPop();
   const touch = useCoarsePointer();
   const goal = useRef<Target>({ kind: 0, index: -1, x: 0, z: 0 }).current;
   const beacon = useRef({ x: 0, y: 0, z: 0, hidden: true }).current;
   // the same target for the edge arrow when it is off screen or under a HUD panel
   const edgeTargets = useMemo(() => [beacon], [beacon]);
   const guideCode = useRef(-1);
   const lastHold = useRef({ kind: 0, time: 0, index: -1, follower: -1, popAt: -10, goalKind: 0 as Target["kind"] }).current;
   const [goalKind, setGoalKind] = useState<Target["kind"]>(0);
   useEffect(() => {
      // the first target is up from the countdown on
      nextTarget(run, goal);
      beacon.x = goal.x;
      beacon.y = goal.kind === 1 ? 0.7 : 1.3;
      beacon.z = goal.z;
      beacon.hidden = goal.kind === 0;
      lastHold.goalKind = goal.kind;
      setGoalKind(goal.kind);
      GUIDE.set(targetHint(hintCode(run, goal, false), touch));
      return () => GUIDE.reset();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [run]);
   // the sofa faces the hall from either side; the cabinet stands with its back to the hall wall
   const sofas = useMemo(() => spotsOf(run.furniture, "sofa", (item) => (item.x > 0 ? Math.PI : 0)), [run]);
   const beds = useMemo(() => spotsOf(run.furniture, "bed"), [run]);
   const cabinets = useMemo(() => spotsOf(run.furniture, "cabinet", () => Math.PI), [run]);
   const chairs = useMemo(() => spotsOf(run.furniture, "chair"), [run]);
   const zEnd = config.rooms * 6;

   const fireParts = useMemo<InstancePart[]>(() => {
      const cone = new ConeGeometry(0.26, 0.62, 8);
      cone.translate(0, 0.34, 0);
      const core = new SphereGeometry(0.1, 8, 6);
      core.translate(0, 0.58, 0);
      return [
         { geometry: cone, material: new MeshStandardMaterial({ color: COLORS.ember, emissive: COLORS.ember, emissiveIntensity: 0.85, roughness: 0.4 }) },
         { geometry: core, material: new MeshStandardMaterial({ color: COLORS.emberCore, emissive: COLORS.emberCore, emissiveIntensity: 1, roughness: 0.35 }) },
      ];
   }, []);
   const debrisParts = useMemo<InstancePart[]>(() => {
      // one charred plank of the pile (the GLB's stand-in)
      const box = new BoxGeometry(FIT.debrisLength, 0.18, 0.2);
      box.translate(0, 0.09, 0);
      const band = new BoxGeometry(FIT.debrisLength * 0.4, 0.06, 0.21);
      band.translate(0.12, 0.17, 0);
      return [
         { geometry: box, material: new MeshStandardMaterial({ color: COLORS.debris, roughness: 0.7 }) },
         { geometry: band, material: new MeshStandardMaterial({ color: COLORS.debrisBand, roughness: 0.55 }) },
      ];
   }, []);
   const civParts = useMemo<InstancePart[]>(() => {
      const legs = new CylinderGeometry(0.1, 0.12, 0.55, 8);
      legs.translate(0, 0.32, 0);
      const torso = new CylinderGeometry(0.16, 0.18, 0.42, 8);
      torso.translate(0, 0.78, 0);
      const head = new SphereGeometry(0.13, 10, 8);
      head.translate(0, 1.12, 0);
      return [
         { geometry: legs, material: new MeshStandardMaterial({ color: COLORS.civTrim, roughness: 0.65 }) },
         { geometry: torso, material: new MeshStandardMaterial({ color: COLORS.civCloth, roughness: 0.6 }) },
         { geometry: head, material: new MeshStandardMaterial({ color: COLORS.skin, roughness: 0.55 }) },
      ];
   }, []);
   useEffect(() => () => {
      for (const part of [...fireParts, ...debrisParts, ...civParts]) {
         part.geometry.dispose();
         const material = part.material;
         if (Array.isArray(material)) material.forEach((m) => m.dispose());
         else material.dispose();
      }
   }, [fireParts, debrisParts, civParts]);

   const poseState = useRef({ phase: 0, amount: 0, now: 0, spray: false, guide: false, hop: 0, win: false }).current;
   const pose = useHumanoidPose((p) => {
      const speed = Math.hypot(run.hero.vx, run.hero.vz);
      const amount = Math.min(1, speed / MAX_SPEED);
      // the walk's own stride (walkStride x scale): the planted foot stays put at a walk and a run
      gait.current.phase = wrapPhase(gait.current.phase + gaitPhaseStep(Math.max(0.35, amount), FIREFIGHTER_LANDMARKS, FIREFIGHTER_SCALE, speed, time.delta));
      poseState.phase = gait.current.phase;
      poseState.amount = amount;
      poseState.now = time.now;
      poseState.spray = run.holdKind === 1;
      poseState.guide = run.follower >= 0;
      poseState.hop = run.hero.hop > 0 ? Math.min(1, run.hero.y / HOP_H) : 0;
      poseState.win = run.over === "win";
      firefighterPose(poseState, p);
   });

   useEffect(() => {
      fx.warm("smoke", "sparks", "puff", "splash", "confetti", "score");
   }, [fx]);

   useRunFrame((_state, dt) => {
      const { moveX, moveY, action, jumpPressed } = input.current;
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX, moveY, action, jumpPressed, yaw: cam.yaw() }, dt, store.timeLeftMs ?? 0);
      if (ev.score) store.addScore(ev.score);
      store.setStat("fires", run.firesOut);
      store.setStat("saved", run.saved);
      store.setStat("breath", Math.round(Math.max(0, run.hero.breath) * 100));
      aim.x = run.hero.x + Math.sin(run.hero.yaw) * LOOK_AHEAD;
      aim.z = run.hero.z + Math.cos(run.hero.yaw) * LOOK_AHEAD;
      aim.y = 0.9 + run.hero.y;
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, aim.x));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, aim.z));
      if (ev.hop) playSfx("jump");
      // the jet: water from the nozzle towards the fire being sprayed, steam where it lands
      if (run.holdKind === 1 && run.time - sprayAt.current > SPRAY_EVERY) {
         sprayAt.current = run.time;
         const fire = run.fires[run.holdIndex];
         if (fire && !fire.out) {
            const dx = fire.x - run.hero.x;
            const dz = fire.z - run.hero.z;
            const d = Math.max(0.01, Math.hypot(dx, dz));
            const reach = Math.min(d, SPRAY_RANGE);
            const k = 0.35 + 0.4 * ((run.time * 7) % 1);
            AT.x = run.hero.x + (dx / d) * reach * k; AT.y = 0.95 - 0.4 * k; AT.z = run.hero.z + (dz / d) * reach * k;
            fx.burst("splash", AT, 3);
            AT.x = fire.x; AT.y = 0.5; AT.z = fire.z;
            fx.burst("smoke", AT, 2);
         }
      }
      if (ev.fire >= 0) {
         const fire = run.fires[ev.fire];
         AT.x = fire.x; AT.y = 0.6; AT.z = fire.z;
         fx.burst("sparks", AT, 10);
         fx.score(AT, "+100");
         playSfx("whoosh");
      }
      if (ev.save >= 0) {
         AT.x = run.hero.x; AT.y = 1.2; AT.z = run.hero.z;
         fx.burst("sparks", AT, 12);
         fx.score(AT, run.civilians[ev.save]?.clean ? "+200" : "+150");
         playSfx("pickup");
      }
      if (ev.debris) {
         AT.x = run.hero.x; AT.y = 0.6; AT.z = run.hero.z;
         fx.burst("puff", AT, 8);
         fx.shake(0.25);
         playSfx("hit");
         AT.y = 2;
         pop.fail(AT, "Hit by debris! -1 life", { shake: 0 });
      }
      if (ev.breathBreak) {
         fx.shake(0.15);
         playSfx("buzz");
         AT.x = run.hero.x; AT.y = 2; AT.z = run.hero.z;
         pop.fail(AT, "Out of breath! -1 life", { shake: 0 });
      }
      // a spray let go before the fire was out: the hold starts again, say so
      if (lastHold.kind === 1 && lastHold.time > 0.15 && run.holdKind !== 1 && ev.fire < 0 && !run.over && run.time - lastHold.popAt > 1) {
         const fire = run.fires[lastHold.index];
         if (fire && !fire.out) {
            lastHold.popAt = run.time;
            AT.x = fire.x; AT.y = 1.3; AT.z = fire.z;
            pop.fail(AT, "Keep holding!", { shake: 0 });
         }
      }
      // a neighbour starts to follow
      if (run.follower >= 0 && lastHold.follower < 0) {
         const civ = run.civilians[run.follower];
         AT.x = civ.x; AT.y = 1.6; AT.z = civ.z;
         pop.info(AT, "Follow me!");
      }
      lastHold.kind = run.holdKind;
      lastHold.time = run.holdTime;
      lastHold.index = run.holdIndex;
      lastHold.follower = run.follower;

      // the current target: beacon + hint (rebuilt only when it changes)
      nextTarget(run, goal);
      beacon.x = goal.x;
      beacon.y = goal.kind === 1 ? 0.7 : goal.kind === 2 ? 1.3 : 0.1;
      beacon.z = goal.z;
      beacon.hidden = goal.kind === 0 || run.over !== null;
      if (goal.kind !== lastHold.goalKind) setGoalKind((lastHold.goalKind = goal.kind));
      const code = hintCode(run, goal, heroInSmoke(run));
      if (code !== guideCode.current) {
         guideCode.current = code;
         GUIDE.set(targetHint(code, touch));
      }
      if (ev.lifeLost) store.loseLife();
      if (ev.won) {
         AT.x = run.hero.x; AT.y = 2; AT.z = run.hero.z;
         fx.burst("confetti", AT, 24);
         playSfx("win");
         store.end("win");
      }
      if (run.time - puffAt.current > 0.4) {
         puffAt.current = run.time;
         for (const fire of run.fires) {
            if (fire.out) continue;
            AT.x = fire.x; AT.y = 0.45; AT.z = fire.z;
            fx.burst("smoke", AT, 4);
         }
         for (const disc of run.smoke) {
            AT.x = disc.x; AT.y = 0.35; AT.z = disc.z;
            fx.burst("smoke", AT, 3);
         }
         for (const debris of run.debris) {
            if (debrisPose(debris.phase).moving) continue;
            AT.x = debris.x; AT.y = 0.5; AT.z = debris.z;
            fx.burst("smoke", AT, 4);
         }
      }
   });

   useFrame(() => {
      const group = body.current;
      if (!group) return;
      group.position.set(run.hero.x, run.hero.y, run.hero.z);
      group.rotation.y = run.hero.yaw;
   }, FRAME_PRIORITY.visuals);

   const placeFire = (index: number, matrix: Matrix4) => {
      const fire = run.fires[index];
      if (!fire || fire.out) return false;
      const bob = 1 + Math.sin(run.time * 6 + index) * 0.08;
      V.set(fire.x, 0, fire.z);
      Q.identity();
      S.set(1, bob, 1);
      matrix.compose(V, Q, S);
   };
   // a debris pile = two charred planks crossed and stacked; it tumbles as it slides and shudders at
   // each end (the warning), always inside the rules' 0.68 m box
   const placeDebris = (index: number, matrix: Matrix4) => {
      const debris = run.debris[index >> 1];
      if (!debris) return false;
      const top = index & 1;
      const moving = debrisPose(debris.phase).moving;
      const shake = moving ? 0 : 0.04 * Math.sin(run.time * 38 + index);
      const rock = moving ? 0.1 * Math.sin(debris.x * 6 + top) : 0;
      E.set(rock, debris.x * 1.4 + (top ? Math.PI / 2 : 0) + shake, shake);
      Q.setFromEuler(E);
      V.set(debris.x, top ? 0.2 + Math.abs(rock) * 0.3 : 0.02, debris.z);
      S.set(1, 1, 1);
      matrix.compose(V, Q, S);
   };
   const placeCiv = (index: number, matrix: Matrix4) => {
      const civ = run.civilians[index];
      if (!civ) return false;
      const moving = Math.hypot(civ.vx, civ.vz);
      waddle(civ.phase, civ.saved ? 0.04 : moving > 0.2 ? 0.32 : 0.08, WOFF);
      E.set(WOFF.roll, civ.yaw + WOFF.yaw, 0);
      Q.setFromEuler(E);
      V.set(civ.x, WOFF.y, civ.z);
      S.set(1, WOFF.squash, 1);
      matrix.compose(V, Q, S);
   };
   // each room's double fire door: shut while its lock fire burns, then swung into the room
   const placeDoor = (index: number, matrix: Matrix4) => {
      const room = index >> 1;
      if (room >= config.rooms) return false;
      if (index % 2 === 0) {
         const target = doorClosed(run, room) ? 0 : 1;
         const now = doorOpen[room] ?? target;
         doorOpen[room] = target > now ? Math.min(target, now + DOOR_SWING * time.delta) : target;
      }
      const open = doorOpen[room] ?? 1;
      doorLeaf(config, room, (index & 1) as 0 | 1, open * open * (3 - 2 * open), LEAF);
      V.set(LEAF.x, 0, LEAF.z);
      E.set(0, LEAF.rotY, 0);
      Q.setFromEuler(E);
      const [shutY, openY] = doorScaleY[room] ?? [1, 1];
      S.set(1, shutY + (openY - shutY) * open, 1);
      matrix.compose(V, Q, S);
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
         {/* extra fill so the rooms and the firefighter read clearly (the core indoor/night light is dim; the fire glow keeps the mood) */}
         <hemisphereLight args={["#ffe9cf", "#7a6d62", config.lighting === "night" ? 1.5 : 1.1]} />
         <ambientLight intensity={config.lighting === "night" ? 0.7 : 0.45} />
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, (zEnd - 5.2) / 2]}>
            <planeGeometry args={[16, zEnd + 8]} />
            <meshStandardMaterial color={colors.floor} roughness={0.92} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, STREET.z]}>
            <planeGeometry args={[STREET.width, STREET.depth]} />
            <meshStandardMaterial color={colors.street} roughness={0.88} />
         </mesh>
         <Instanced spots={walls} name="walls">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={colors.wall} roughness={0.86} />
         </Instanced>
         <Instanced spots={caps} name="wall-caps">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={colors.wallTrim} roughness={0.7} />
         </Instanced>
         {plaques.length > 0 && (
            <Instanced spots={plaques} name="plaques">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={COLORS.ember} emissive={COLORS.ember} emissiveIntensity={0.15} roughness={0.5} />
            </Instanced>
         )}
         <FurnMeshes kind="sofa" color={colors.sofa} trim={colors.sofaCushion} spots={sofas} asset={ASSETS.sofa} />
         <FurnMeshes kind="bed" color={colors.bedFrame} trim={colors.bed} spots={beds} asset={ASSETS.bed} />
         <FurnMeshes kind="cabinet" color={colors.cabinet} trim={colors.cabinetDoor} spots={cabinets} asset={ASSETS.cabinet} />
         <FurnMeshes kind="chair" color={colors.chair} trim={colors.chairSeat} spots={chairs} asset={ASSETS.chair} />
         {decorGroups.boxes.map((g) => (
            <Instanced key={g.color} spots={g.spots} name="decor-box">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={g.color} roughness={0.85} />
            </Instanced>
         ))}
         {decorGroups.cyls.map((g) => (
            <Instanced key={g.color} spots={g.spots} name="decor-cyl">
               <cylinderGeometry args={[0.5, 0.5, 1, 12]} />
               <meshStandardMaterial color={g.color} roughness={0.7} />
            </Instanced>
         ))}
         {decor.windows.map((w, i) => (
            <mesh key={i} position={[w.spot.x, w.spot.y, w.spot.z]}>
               <boxGeometry args={[w.spot.sx ?? 1, w.spot.sy ?? 1, w.spot.sz ?? 1]} />
               <meshStandardMaterial color={w.color} emissive={w.color} emissiveIntensity={w.emissive} roughness={0.4} />
            </mesh>
         ))}
         <DynamicInstancedModel asset={ASSETS.door} count={config.rooms * 2} update={placeDoor} fallbackParts={DOOR_PARTS} name="doors" />
         <DynamicInstanced count={run.fires.length} update={placeFire} parts={fireParts} name="fires" />
         {run.smoke.map((disc, i) => (
            <mesh key={i} position={[disc.x, 0.025, disc.z]} rotation-x={-Math.PI / 2}>
               <circleGeometry args={[disc.r, 18]} />
               <meshBasicMaterial color={COLORS.smoke} transparent opacity={0.35} depthWrite={false} />
            </mesh>
         ))}
         {run.debris.length > 0 && (
            <DynamicInstancedModel asset={ASSETS.debris} count={run.debris.length * 2} update={placeDebris} fallbackParts={debrisParts} name="debris" />
         )}
         <TargetBeacon
            target={beacon}
            variant={goalKind === 3 ? "drop-here" : "pick"}
            color={goalKind === 1 ? "#fb923c" : goalKind === 2 ? "#38bdf8" : "#4ade80"}
            radius={goalKind === 3 ? 1.1 : 0.6}
            height={goalKind === 3 ? 1.8 : 0.9}
            label={goalKind === 3 ? "EXIT" : null}
         />
         <TargetMarkers targets={edgeTargets} color={goalKind === 1 ? "#fb923c" : goalKind === 2 ? "#38bdf8" : "#4ade80"} />
         <DynamicInstancedModel asset={ASSETS.civilian} count={5} update={placeCiv} fallbackParts={civParts} name="civilians" />
         <group ref={body}>
            <BlobShadow radius={0.42} opacity={0.28} />
            {/* the hand frame is upright in the carry and the spray (poses.ts): the canister hangs from its handle */}
            <HumanoidModel
               asset={ASSETS.firefighter}
               pose={pose}
               fallback={<FirefighterFigure />}
               attach={{ handR: <group position={[0, -FIT.extinguisherHeight * 0.82, 0.02]}><Model asset={ASSETS.extinguisher} fallback={<ExtinguisherPrimitive />} /></group> }}
            />
         </group>
         <Model asset={ASSETS.truck} position={[TRUCK_SPOT.x, 0, TRUCK_SPOT.z]} rotation-y={TRUCK_SPOT.rotY} fallback={<group rotation-y={-Math.PI / 2}><TruckPrimitive /></group>} />
         <InstancedModel asset={ASSETS.hydrant} spots={HYDRANT_SPOTS} fallback={<>{HYDRANT_SPOTS.map((s, i) => <group key={i} position={[s.x, 0, s.z]}><HydrantPrimitive /></group>)}</>} />
         <Model asset={ASSETS.hoseReel} position={[HOSE_REEL_SPOT.x, 0, HOSE_REEL_SPOT.z]} rotation-y={HOSE_REEL_SPOT.rotY} fallback={<HoseReelPrimitive />} />
         <InstancedModel
            asset={ASSETS.exitSign}
            spots={signs}
            fallback={<>{signs.map((s, i) => <group key={i} position={[s.x, s.y - 1.35, s.z]} rotation-y={s.rotY}><ExitSignPrimitive /></group>)}</>}
         />
      </>
   );
}

const DOOR_SLAB = new BoxGeometry(FIT.doorLeafWidth, FIT.doorHeight, FIT.doorDepth);
DOOR_SLAB.translate(0, FIT.doorHeight / 2, 0);
const DOOR_KNOB = new BoxGeometry(0.08, 0.08, FIT.doorDepth + 0.06);
DOOR_KNOB.translate(FIT.doorLeafWidth / 2 - 0.1, 1, 0);
const DOOR_PARTS: InstancePart[] = [
   { geometry: DOOR_SLAB, material: new MeshStandardMaterial({ color: "#b91c1c", roughness: 0.6 }) },
   { geometry: DOOR_KNOB, material: new MeshStandardMaterial({ color: COLORS.emberCore, roughness: 0.35, metalness: 0.2 }) },
];

export default function Scene() {
   return <LevelScene />;
}
