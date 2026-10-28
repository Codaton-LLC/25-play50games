"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   AdditiveBlending,
   BoxGeometry,
   ConeGeometry,
   CylinderGeometry,
   DoubleSide,
   Euler,
   Matrix4,
   MeshBasicMaterial,
   MeshStandardMaterial,
   Quaternion,
   SphereGeometry,
   Vector3,
   type Group,
   type Mesh,
} from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import { playSfx, startLoop, type LoopHandle } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { Toss, useActionPop, useFx, type TossHandle } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetBeacon, TargetMarkers } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { useQuality } from "@/arcade3d/core/quality";
import { BlobShadow, DynamicInstanced, Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS, WRECK_SQUASH } from "./assets";
import { GUIDE, canScoop, emptyGoal, hintCode, hintFor, nextGoal } from "./guide";
import type { SubLevel } from "./levels";
import { COLORS, DAMPING, FLOOR_PAD, FOLLOW, FOV, LOOK_AHEAD, lookAtFor, seaBounds, viewFor } from "./looks";
import { ColumnPrimitive, DockPrimitive, SubModel } from "./Primitives";
import {
   CRUISE_Y,
   DOCK_R,
   FLOOR_Y,
   MAX_SPEED,
   createRun,
   isLow,
   step,
   type BoxSolid,
   type CircleSolid,
   type Run,
   type Treasure,
} from "./rules";

const E = new Euler();
const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3(1, 1, 1);
const TOSS_ASSETS = { chest: ASSETS.chest, amphora: ASSETS.amphora, shell: ASSETS.pearlShell, coins: ASSETS.coin } as const;
const TOSS_KINDS = Object.keys(TOSS_ASSETS) as Array<keyof typeof TOSS_ASSETS>;
const AT = { x: 0, y: 1, z: 0 };

function circleSpots(items: readonly CircleSolid[], yOf: (item: CircleSolid) => number, sizeOf: (item: CircleSolid) => number): InstanceSpot[] {
   return items.map((item) => {
      const size = sizeOf(item);
      return { x: item.x, y: yOf(item), z: item.z, scale: size };
   });
}

function LevelScene() {
   const { id, config } = useLevel<SubLevel>();
   const view = useFittedView(viewFor(id));
   // the fog is tuned for a desktop camera (about 14 m away); a phone or tablet fit sits further back and would see only murk
   const scene = useThree((state) => state.scene);
   useEffect(() => {
      const fog = scene.fog;
      if (fog && "far" in fog) fog.far = Math.max(fog.far, view.distance * 1.3);
   }, [scene, view.distance]);
   const input = useInput();
   const fx = useFx();
   const pop = useActionPop();
   const time = useGameTime();
   const quality = useQuality();
   const [run] = useState<Run>(() => createRun(randomSeed(), config));
   // camera views (core/camera): vehicle framing, but the stick is camera-relative (inputToWorld in
   // rules.ts), so the chase camera only drifts behind the travel; the top view stays inside the fog
   const cam = useCameraViews({
      slug: "submarine-treasure-dive",
      subject: "vehicle",
      steering: "camera",
      defaultYaw: view.yaw,
      framing: { top: { distance: 13 }, free: { distance: 8 } },
      target: (o) => {
         const sub = run.sub;
         o.x = sub.x;
         o.y = sub.y + 0.3;
         o.z = sub.z;
         o.heading = sub.yaw;
         o.vx = sub.vx;
         o.vz = sub.vz;
      },
   });
   const aim = useRef({ x: run.sub.x, y: 0.55, z: run.sub.z + LOOK_AHEAD }).current;
   const body = useRef<Group>(null);
   const shadow = useRef<Group>(null);
   const sonar = useRef<Mesh>(null);
   const loop = useRef<LoopHandle | null>(null);
   const bubbleAt = useRef(0);
   const bounds = useMemo(() => seaBounds(config), [config]);
   const look = useMemo(() => lookAtFor(config), [config]);
   const markers = useRef([{ x: run.dock.x, y: 1.2, z: run.dock.z }]).current;
   const goal = useRef(emptyGoal()).current;
   const pickBeacon = useRef({ x: 0, y: 0.5, z: 0, hidden: true }).current;
   const dockBeacon = useRef({ x: run.dock.x, y: 0.6, z: run.dock.z, hidden: true }).current;
   const guideCode = useRef(-1);
   const scoop = useRef(-1);
   const tosses = useRef<Record<string, TossHandle | null>>({}).current;
   const HAND = useRef({ x: 0, y: 0, z: 0 }).current;

   const rocksA = useMemo(() => run.circles.filter((c, i) => c.kind === "rock" && i % 2 === 0), [run]);
   const rocksB = useMemo(() => run.circles.filter((c, i) => c.kind === "rock" && i % 2 === 1), [run]);
   const coral = useMemo(() => run.circles.filter((c) => c.kind === "coral"), [run]);
   const arches = useMemo(() => run.circles.filter((c) => c.kind === "arch"), [run]);
   const anchors = useMemo(() => run.circles.filter((c) => c.kind === "anchor"), [run]);
   const wrecks = useMemo(() => run.boxes.filter((b) => b.kind === "wreck"), [run]);
   const columns = useMemo(() => run.boxes.filter((b) => b.kind === "column"), [run]);
   const chests = useMemo(() => run.treasures.filter((t) => t.kind === "chest"), [run]);
   const amphorae = useMemo(() => run.treasures.filter((t) => t.kind === "amphora"), [run]);
   const shells = useMemo(() => run.treasures.filter((t) => t.kind === "shell"), [run]);
   const piles = useMemo(() => run.treasures.filter((t) => t.kind === "coins"), [run]);

   const rockSpots = (items: readonly CircleSolid[]): InstanceSpot[] =>
      items.map((item) => ({ x: item.x, y: item.r * 0.42, z: item.z, scale: item.r * 2 }));
   const aquaSpots = useMemo(() => rockSpots(rocksA), [rocksA]);
   const boulderSpots = useMemo(() => rockSpots(rocksB), [rocksB]);
   const coralSpots = useMemo(() => circleSpots(coral, (c) => c.r * 0.55, (c) => c.r * 2), [coral]);
   const coralTips = useMemo(() => coral.map((c) => ({ x: c.x, y: c.r * 1.15, z: c.z, scale: c.r * 0.7 })), [coral]);
   const archSpots = useMemo(
      () => arches.map((c) => ({ x: c.x, y: 0.72, z: c.z, sx: c.r * 2, sy: 1.45, sz: c.r * 0.85 })),
      [arches],
   );
   const archCaps = useMemo(
      () => arches.map((c) => ({ x: c.x, y: 1.35, z: c.z, sx: c.r * 1.7, sy: 0.28, sz: c.r * 0.7 })),
      [arches],
   );
   const anchorSpots = useMemo(() => anchors.map((c) => ({ x: c.x, y: 0.45, z: c.z, sx: 0.55, sy: 0.9, sz: 0.28 })), [anchors]);
   const kelpSpots = useMemo(() => {
      const kept = run.kelp.slice(0, Math.max(0, Math.round(run.kelp.length * quality.decor)));
      return kept.map((k) => ({ x: k.x, y: k.height / 2, z: k.z, rotY: k.rotY, sx: 0.34, sy: k.height, sz: 0.34 }));
   }, [run, quality.decor]);
   const wreckSpots = useMemo(
      () => wrecks.map((b) => ({ x: b.x, y: 0.55, z: b.z, rotY: b.rotY, sx: Math.max(b.hx, b.hz) * 2, sy: 1.1, sz: Math.min(b.hx, b.hz) * 2 })),
      [wrecks],
   );
   const wreckTrim = useMemo(
      () => wrecks.map((b) => ({ x: b.x, y: 0.95, z: b.z, rotY: b.rotY, sx: Math.max(b.hx, b.hz) * 1.2, sy: 0.28, sz: Math.min(b.hx, b.hz) * 1.15 })),
      [wrecks],
   );


   // The GLBs are unit models standing on y = 0: their spots carry the size in metres. The stand-ins
   // above keep their own spots (they are centred, so their y differs).
   const glbRocksA = useMemo(() => rocksA.map((c) => ({ x: c.x, y: 0, z: c.z, rotY: c.x * 1.7, scale: c.r * 2 })), [rocksA]);
   const glbRocksB = useMemo(() => rocksB.map((c) => ({ x: c.x, y: 0, z: c.z, rotY: c.z * 1.3, scale: c.r * 2 })), [rocksB]);
   const glbCoral = useMemo(() => coral.map((c) => ({ x: c.x, y: 0, z: c.z, rotY: c.x * 2.1, scale: c.r * 2 })), [coral]);
   const glbArches = useMemo(() => arches.map((c) => ({ x: c.x, y: 0, z: c.z, rotY: c.z * 0.9, scale: c.r * 2 })), [arches]);
   const glbAnchors = useMemo(() => anchors.map((c) => ({ x: c.x, y: 0, z: c.z, rotY: c.x * 1.1, scale: 1.5 })), [anchors]);
   const glbKelp = useMemo(() => {
      const kept = run.kelp.slice(0, Math.max(0, Math.round(run.kelp.length * quality.decor)));
      return kept.map((k) => ({ x: k.x, y: 0, z: k.z, rotY: k.rotY, scale: k.height * 0.9 }));
   }, [run, quality.decor]);
   const glbWrecks = useMemo(
      () => wrecks.map((b) => {
         const length = Math.max(b.hx, b.hz) * 2;
         return { x: b.x, y: 0, z: b.z, rotY: b.rotY, sx: length, sy: length * WRECK_SQUASH, sz: length };
      }),
      [wrecks],
   );

   const chestParts = useMemo<InstancePart[]>(() => {
      const body = new BoxGeometry(0.9, 0.48, 0.6);
      body.translate(0, 0.24, 0);
      const lid = new BoxGeometry(0.94, 0.16, 0.64);
      lid.translate(0, 0.52, 0);
      return [
         { geometry: body, material: new MeshStandardMaterial({ color: COLORS.chest, roughness: 0.55 }) },
         { geometry: lid, material: new MeshStandardMaterial({ color: COLORS.chestTrim, roughness: 0.4, metalness: 0.25 }) },
      ];
   }, []);
   const amphoraParts = useMemo<InstancePart[]>(() => {
      const body = new CylinderGeometry(0.2, 0.26, 0.62, 10);
      body.translate(0, 0.31, 0);
      const neck = new CylinderGeometry(0.1, 0.14, 0.22, 8);
      neck.translate(0, 0.68, 0);
      return [
         { geometry: body, material: new MeshStandardMaterial({ color: COLORS.amphora, roughness: 0.62 }) },
         { geometry: neck, material: new MeshStandardMaterial({ color: COLORS.amphoraDark, roughness: 0.5 }) },
      ];
   }, []);
   const shellParts = useMemo<InstancePart[]>(() => {
      const shell = new SphereGeometry(0.32, 12, 8);
      shell.scale(1, 0.55, 0.85);
      shell.translate(0, 0.16, 0);
      const pearl = new SphereGeometry(0.1, 10, 8);
      pearl.translate(0, 0.28, 0.08);
      return [
         { geometry: shell, material: new MeshStandardMaterial({ color: COLORS.shell, roughness: 0.35 }) },
         { geometry: pearl, material: new MeshStandardMaterial({ color: COLORS.pearl, emissive: COLORS.pearl, emissiveIntensity: 0.25, roughness: 0.25 }) },
      ];
   }, []);
   const coinParts = useMemo<InstancePart[]>(() => {
      const coin = new CylinderGeometry(0.16, 0.16, 0.04, 12);
      coin.translate(0, 0.04, 0);
      return [{ geometry: coin, material: new MeshStandardMaterial({ color: COLORS.coin, metalness: 0.45, roughness: 0.35 }) }];
   }, []);
   const jellyParts = useMemo<InstancePart[]>(() => {
      const bell = new SphereGeometry(0.7, 12, 10);
      bell.scale(1, 0.72, 1);
      const core = new SphereGeometry(0.22, 8, 8);
      core.translate(0, 0.12, 0);
      return [
         { geometry: bell, material: new MeshStandardMaterial({ color: COLORS.jelly, transparent: true, opacity: 0.78, roughness: 0.25, emissive: COLORS.jelly, emissiveIntensity: 0.2 }) },
         { geometry: core, material: new MeshStandardMaterial({ color: COLORS.jellyCore, emissive: COLORS.jellyCore, emissiveIntensity: 0.4, roughness: 0.3 }) },
      ];
   }, []);
   const fishParts = useMemo<InstancePart[]>(() => {
      const body = new SphereGeometry(0.5, 10, 8);
      body.scale(0.28, 0.16, 0.42);
      const fin = new ConeGeometry(0.08, 0.16, 4);
      fin.rotateX(Math.PI / 2);
      fin.translate(0, 0, -0.28);
      return [
         { geometry: body, material: new MeshStandardMaterial({ color: COLORS.fish, roughness: 0.45 }) },
         { geometry: fin, material: new MeshStandardMaterial({ color: COLORS.fishFin, roughness: 0.4 }) },
      ];
   }, []);
   const currentParts = useMemo<InstancePart[]>(() => {
      const mote = new BoxGeometry(1, 1, 1);
      return [{ geometry: mote, material: new MeshBasicMaterial({ color: COLORS.current, transparent: true, opacity: 0.45, depthWrite: false }) }];
   }, []);
   useEffect(() => () => {
      for (const part of [...chestParts, ...amphoraParts, ...shellParts, ...coinParts, ...jellyParts, ...fishParts, ...currentParts]) {
         part.geometry.dispose();
         const material = part.material;
         if (Array.isArray(material)) material.forEach((m) => m.dispose());
         else material.dispose();
      }
   }, [chestParts, amphoraParts, shellParts, coinParts, jellyParts, fishParts, currentParts]);

   useEffect(() => {
      fx.warm("sparkle", "splash", "sparks", "score");
      const handle = startLoop("hum", { volume: 0.08, pitch: 0.8 });
      loop.current = handle;
      return () => handle.stop();
   }, [fx]);

   useEffect(() => {
      nextGoal(run, goal);
      guideCode.current = hintCode(run, goal);
      GUIDE.set(hintFor(run, goal));
      return () => GUIDE.reset();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [run]);

   useRunFrame((_state, dt) => {
      const { moveX, moveY, action } = input.current;
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX, moveY, action, yaw: cam.yaw() }, dt, store.timeLeftMs ?? 0);
      if (ev.score) store.addScore(ev.score);
      store.setStat("treasure", run.found);
      store.setStat("battery", Math.round(Math.max(0, Math.min(100, run.sub.battery))));
      const speed = Math.hypot(run.sub.vx, run.sub.vz);
      const lx = speed > 0.3 ? run.sub.vx / speed : Math.sin(run.sub.yaw);
      const lz = speed > 0.3 ? run.sub.vz / speed : Math.cos(run.sub.yaw);
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, run.sub.x + lx * LOOK_AHEAD));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, run.sub.z + lz * LOOK_AHEAD));
      aim.y = 0.55;
      nextGoal(run, goal);
      markers[0].x = goal.x;
      markers[0].y = 1.1;
      markers[0].z = goal.z;
      pickBeacon.hidden = goal.kind !== "treasure";
      dockBeacon.hidden = goal.kind !== "dock";
      pickBeacon.x = goal.x;
      pickBeacon.z = goal.z;
      const code = hintCode(run, goal);
      if (code !== guideCode.current) {
         guideCode.current = code;
         GUIDE.set(hintFor(run, goal));
      }
      const scooping = canScoop(run) ? 1 : 0;
      if (scoop.current !== scooping) store.setStat("scoop", (scoop.current = scooping));
      const hum = loop.current;
      if (hum) hum.set({ pitch: 0.75 + Math.min(1, speed / MAX_SPEED) * 0.7, volume: 0.05 + Math.min(1, speed / MAX_SPEED) * 0.12 });
      if (ev.pickup >= 0) {
         const t = run.treasures[ev.pickup];
         AT.x = t?.x ?? run.sub.x;
         AT.y = 1.1;
         AT.z = t?.z ?? run.sub.z;
         fx.burst("sparkle", AT, 12);
         fx.score(AT, ev.clean ? "+200" : "+150");
         if (t) {
            HAND.x = run.sub.x;
            HAND.y = run.sub.y + 0.2;
            HAND.z = run.sub.z;
            tosses[t.kind]?.play({ x: t.x, y: 0.4, z: t.z }, HAND, { duration: 0.4, height: 0.9, scaleFrom: 1, scaleTo: 0.3 });
         }
         playSfx("pickup");
      }
      if (ev.jelly) {
         AT.x = run.sub.x;
         AT.y = run.sub.y;
         AT.z = run.sub.z;
         fx.burst("sparks", AT, 8);
         AT.y = run.sub.y + 1.4;
         pop.fail(AT, "Jellyfish! -8 battery", { shake: 0.28 });
         playSfx("zap");
      } else if (ev.bump) {
         AT.x = run.sub.x;
         AT.y = run.sub.y;
         AT.z = run.sub.z;
         fx.burst("splash", AT, 6);
         AT.y = run.sub.y + 1.4;
         pop.fail(AT, "Bump! -4 battery", { shake: 0.16 });
         playSfx("thud");
      }
      if (isLow(run.sub.y) && run.time - bubbleAt.current > 0.28) {
         bubbleAt.current = run.time;
         AT.x = run.sub.x;
         AT.y = run.sub.y + 0.2;
         AT.z = run.sub.z;
         fx.burst("splash", AT, 5);
      }
      if (ev.won) {
         playSfx("win");
         store.end("win");
      }
      if (ev.lost) {
         playSfx("lose");
         store.end("lose");
      }
   });

   useFrame(() => {
      const group = body.current;
      if (group) {
         group.position.set(run.sub.x, run.sub.y, run.sub.z);
         group.rotation.y = run.sub.yaw;
      }
      const blob = shadow.current;
      if (blob) {
         const alt = (run.sub.y - FLOOR_Y) / (CRUISE_Y - FLOOR_Y);
         blob.position.set(run.sub.x, 0, run.sub.z);
         const spread = 0.72 + alt * 0.62;
         blob.scale.set(spread, 1, spread);
      }
      const ring = sonar.current;
      if (ring) {
         const t = (time.now % 2) / 2;
         const s = 0.4 + t * 4.4;
         ring.scale.set(s, s, 1);
         const material = ring.material;
         if (!Array.isArray(material)) material.opacity = 0.48 * (1 - t);
      }
   }, FRAME_PRIORITY.visuals);

   const placeTreasure = (list: readonly Treasure[]) => (index: number, matrix: Matrix4) => {
      const item = list[index];
      if (!item || item.taken) return false;
      V.set(item.x, 0, item.z);
      Q.identity();
      S.set(1, 1, 1);
      matrix.compose(V, Q, S);
   };
   const placeCoins = (index: number, matrix: Matrix4) => {
      const pile = piles[Math.floor(index / 3)];
      if (!pile || pile.taken) return false;
      const k = index % 3;
      const ang = k * 2.15;
      V.set(pile.x + Math.cos(ang) * 0.16, 0, pile.z + Math.sin(ang) * 0.16);
      E.set(0, ang, 0);
      Q.setFromEuler(E);
      S.set(1, 1, 1);
      matrix.compose(V, Q, S);
   };
   const placeJelly = (index: number, matrix: Matrix4) => {
      const jelly = run.jellies[index];
      if (!jelly) return false;
      const bob = Math.sin(time.now * 1.6 + index) * 0.12;
      V.set(jelly.agent.x, jelly.agent.y + bob, jelly.agent.z);
      E.set(0, jelly.agent.yaw, 0);
      Q.setFromEuler(E);
      S.set(1, 1, 1);
      matrix.compose(V, Q, S);
   };
   const placeSchool = (cx: number, cz: number, radius: number, rate: number, lift: number) => (index: number, matrix: Matrix4) => {
      const count = 6;
      const a = time.now * rate + (index / count) * Math.PI * 2;
      V.set(cx + Math.cos(a) * radius, lift + Math.sin(time.now * 1.3 + index) * 0.12, cz + Math.sin(a) * radius * 0.72);
      E.set(0, -a + Math.PI / 2, 0);
      Q.setFromEuler(E);
      S.set(1, 1, 1);
      matrix.compose(V, Q, S);
   };
   const motes = Math.max(4, Math.round(8 * quality.particles));
   const placeCurrent = (index: number, matrix: Matrix4) => {
      const spanX = config.width + 24;
      const spanZ = config.depth - 6;
      const x = ((index * 6.5 + time.now * (1.2 + config.current * 3)) % spanX) - spanX / 2;
      const z = ((index * 4.7) % spanZ) - config.depth / 2 + 3;
      V.set(x, 1.8 + (index % 4) * 0.35, z);
      Q.identity();
      S.set(0.55, 0.06, 0.16);
      matrix.compose(V, Q, S);
   };
   const schoolA = placeSchool(config.width * 0.16, config.depth * 0.08, 3.4, 0.32, 2.15);
   const schoolB = placeSchool(-config.width * 0.2, -config.depth * 0.02, 2.8, -0.28, 2.4);

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
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
            <planeGeometry args={[config.width + FLOOR_PAD * 2, config.depth + FLOOR_PAD * 2]} />
            <meshStandardMaterial color={COLORS.sandDeep} roughness={0.94} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
            <planeGeometry args={[config.width - 1.2, config.depth - 1.2]} />
            <meshStandardMaterial color={COLORS.sandDeep} roughness={0.9} />
         </mesh>
         <group position={[run.dock.x, 0, run.dock.z]}>
            <Model asset={ASSETS.subDock} fallback={<DockPrimitive />} />
         </group>
         {aquaSpots.length > 0 && (
            <InstancedModel
               asset={ASSETS.aquariumRock}
               spots={glbRocksA}
               fallback={
                  <Instanced spots={aquaSpots} name="reef-rocks">
                     <sphereGeometry args={[0.5, 10, 8]} />
                     <meshStandardMaterial color={COLORS.rock} roughness={0.86} />
                  </Instanced>
               }
            />
         )}
         {boulderSpots.length > 0 && (
            <InstancedModel
               asset={ASSETS.rock}
               spots={glbRocksB}
               fallback={
                  <Instanced spots={boulderSpots} name="boulders">
                     <sphereGeometry args={[0.5, 10, 8]} />
                     <meshStandardMaterial color={COLORS.rockDark} roughness={0.9} />
                  </Instanced>
               }
            />
         )}
         {coralSpots.length > 0 && (
            <InstancedModel
               asset={ASSETS.coral}
               spots={glbCoral}
               fallback={
                  <>
                     <Instanced spots={coralSpots} name="coral">
                        <sphereGeometry args={[0.5, 8, 6]} />
                        <meshStandardMaterial color={COLORS.coral} roughness={0.55} />
                     </Instanced>
                     <Instanced spots={coralTips} name="coral-tips">
                        <sphereGeometry args={[0.5, 8, 6]} />
                        <meshStandardMaterial color={COLORS.coralDeep} roughness={0.5} />
                     </Instanced>
                  </>
               }
            />
         )}
         {archSpots.length > 0 && (
            <InstancedModel
               asset={ASSETS.rockArch}
               spots={glbArches}
               fallback={
                  <>
                     <Instanced spots={archSpots} name="arches">
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color={COLORS.arch} roughness={0.82} />
                     </Instanced>
                     <Instanced spots={archCaps} name="arch-caps">
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color={COLORS.rock} roughness={0.7} />
                     </Instanced>
                  </>
               }
            />
         )}
         {anchorSpots.length > 0 && (
            <InstancedModel
               asset={ASSETS.anchor}
               spots={glbAnchors}
               fallback={
                  <Instanced spots={anchorSpots} name="anchors">
                     <boxGeometry args={[1, 1, 1]} />
                     <meshStandardMaterial color={COLORS.anchor} roughness={0.45} metalness={0.35} />
                  </Instanced>
               }
            />
         )}
         {kelpSpots.length > 0 && (
            <InstancedModel
               asset={ASSETS.seaweed}
               spots={glbKelp}
               fallback={
                  <Instanced spots={kelpSpots} name="kelp">
                     <cylinderGeometry args={[0.5, 0.35, 1, 6]} />
                     <meshStandardMaterial color={COLORS.kelp} roughness={0.7} />
                  </Instanced>
               }
            />
         )}
         {wreckSpots.length > 0 && (
            <InstancedModel
               asset={ASSETS.wreck}
               spots={glbWrecks}
               fallback={
                  <>
                     <Instanced spots={wreckSpots} name="wrecks">
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color={COLORS.wreck} roughness={0.78} />
                     </Instanced>
                     <Instanced spots={wreckTrim} name="wreck-trim">
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color={COLORS.wreckTrim} roughness={0.55} />
                     </Instanced>
                  </>
               }
            />
         )}
         {columns.map((box: BoxSolid, index) => (
            <group key={index} position={[box.x, 0.44, box.z]} rotation-y={box.rotY}>
               <group rotation-z={Math.PI / 2}>
                  <Model asset={ASSETS.ruinColumn} fallback={<ColumnPrimitive />} />
               </group>
            </group>
         ))}
         {chests.length > 0 && (
            <DynamicInstancedModel asset={ASSETS.chest} count={chests.length} update={placeTreasure(chests)} fallbackParts={chestParts} name="chests" />
         )}
         {amphorae.length > 0 && (
            <DynamicInstancedModel asset={ASSETS.amphora} count={amphorae.length} update={placeTreasure(amphorae)} fallbackParts={amphoraParts} name="amphorae" />
         )}
         {shells.length > 0 && (
            <DynamicInstancedModel asset={ASSETS.pearlShell} count={shells.length} update={placeTreasure(shells)} fallbackParts={shellParts} name="shells" />
         )}
         {piles.length > 0 && (
            <DynamicInstancedModel asset={ASSETS.coin} count={piles.length * 3} update={placeCoins} fallbackParts={coinParts} name="coins" />
         )}
         {run.jellies.length > 0 && (
            <DynamicInstancedModel asset={ASSETS.jellyfish} count={run.jellies.length} update={placeJelly} fallbackParts={jellyParts} name="jellies" />
         )}
         <DynamicInstancedModel asset={ASSETS.tropicalFish} count={6} update={schoolA} fallbackParts={fishParts} name="tropical-fish" />
         <DynamicInstancedModel asset={ASSETS.fish} count={6} update={schoolB} name="school-fish" />
         {config.current > 0 && <DynamicInstanced count={motes} update={placeCurrent} parts={currentParts} name="current" />}
         <group ref={body}>
            <SubModel run={run} />
            {config.lighting === "night" && (
               <mesh position={[0, 0, 1.15]} rotation-x={Math.PI / 2}>
                  <coneGeometry args={[0.5, 2.1, 12, 1, true]} />
                  <meshBasicMaterial color="#cffafe" transparent opacity={0.32} depthWrite={false} blending={AdditiveBlending} side={DoubleSide} />
               </mesh>
            )}
            <mesh ref={sonar} rotation-x={Math.PI / 2} position={[0, -0.2, 0]}>
               <torusGeometry args={[1, 0.03, 6, 24]} />
               <meshBasicMaterial color={COLORS.accent} transparent opacity={0.45} depthWrite={false} />
            </mesh>
         </group>
         <group ref={shadow}>
            <BlobShadow radius={0.85} opacity={0.38} color="#134e4a" />
         </group>
         <TargetMarkers targets={markers} color={COLORS.accent} />
         <TargetBeacon target={pickBeacon} variant="pick" color={COLORS.accent} radius={0.9} height={1.0} />
         <TargetBeacon target={dockBeacon} variant="drop-here" radius={DOCK_R * 0.7} height={1.0} label="DOCK" />
         {TOSS_KINDS.map((kind) => (
            <Toss key={kind} ref={(h) => { tosses[kind] = h; }} spin={5}>
               <Model asset={TOSS_ASSETS[kind]} />
            </Toss>
         ))}
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
