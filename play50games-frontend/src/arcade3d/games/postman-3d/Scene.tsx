"use client";

// One useRunFrame steps rules.ts and syncs the store; visuals read the run and animate on useGameTime.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, BufferAttribute, CapsuleGeometry, Color, DoubleSide, Euler, Fog, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type Group, type Matrix4 } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers } from "@/arcade3d/core/hud/TargetMarkers";
import { useInput } from "@/arcade3d/core/input";
import { Parcel } from "@/arcade3d/core/kit";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { hop, type BodyOffset } from "@/arcade3d/core/motion";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { BlobShadow, Instanced, useCanvasTexture, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { HumanoidModel, POSE_MASK, blendPoses, carryPose, cheerPose, createPose, gaitPhaseStep, idlePose, reachPose, useHumanoidPose, walkPose, wrapPhase } from "@/arcade3d/core/rig";
import type { ModelAsset } from "@/arcade3d/core/types";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, FIT, POSTMAN_LANDMARKS, POSTMAN_SCALE } from "./assets";
import type { PostLevel } from "./levels";
import { CAMERA, COLORS, FOV, HOUSE_COLORS, LOOK_AHEAD, PITCH, VIEW, decorSpots, fogFor, lampSpots } from "./looks";
import { OFFICE, OFFICE_BOX, ROAD_HALF, SPEED, STREET_GAP, VAN_BOX, ZEBRA_X, createRun, nextItem, step, syncStore, targetFor, type Run } from "./rules";

/** Unit boxes (12 triangles; `rounded` = bevelled, for the bigger fallback pieces), sized only by their spots. */
function Boxes({ spots, color, emissive, rounded }: { spots: InstanceSpot[]; color: string; emissive?: number; rounded?: boolean }) {
   const geometry = useMemo(() => (rounded ? new RoundedBoxGeometry(1, 1, 1, 2, 0.045) : new BoxGeometry(1, 1, 1)), [rounded]);
   useEffect(() => () => geometry.dispose(), [geometry]);
   return spots.length ? (
      <Instanced spots={spots}>
         <primitive object={geometry} attach="geometry" />
         <meshStandardMaterial color={color} roughness={0.72} emissive={emissive ? color : "#000000"} emissiveIntensity={emissive ?? 0} />
      </Instanced>
   ) : null;
}

/** A GLB prop at its spots; its fallback a deliberate two-tone box at the same size. */
function Props({ asset, spots, size, color, detail }: { asset: ModelAsset; spots: InstanceSpot[]; size: [number, number, number]; color: string; detail?: ReactNode }) {
   const body = useMemo(() => spots.map((s) => ({ ...s, y: s.y + (size[1] * (s.scale ?? 1)) / 2, sx: size[0] * (s.scale ?? 1), sy: size[1] * (s.scale ?? 1), sz: size[2] * (s.scale ?? 1), scale: undefined })), [spots, size]);
   return spots.length ? <InstancedModel asset={asset} spots={spots} fallback={<><Boxes spots={body} color={color} rounded />{detail}</>} /> : null;
}

// One canvas atlas and one non-indexed mesh for every number plate (never merged with indexed geometry).
function Plates({ run }: { run: Run }) {
   const draw = useCallback(
      (ctx: CanvasRenderingContext2D) => {
         for (const h of run.houses) {
            const i = h.number - 1;
            const x = (i % 8) * 128;
            const y = Math.floor(i / 8) * 128;
            ctx.fillStyle = COLORS.ink;
            ctx.fillRect(x, y, 128, 128);
            ctx.fillStyle = HOUSE_COLORS[h.color];
            ctx.fillRect(x + 5, y + 5, 118, 18);
            ctx.fillStyle = COLORS.white;
            ctx.font = "bold 80px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(String(h.number), x + 64, y + 104);
         }
         ctx.fillStyle = COLORS.accent;
         ctx.fillRect(896, 896, 128, 128);
         ctx.fillStyle = COLORS.white;
         ctx.font = "bold 34px system-ui, sans-serif";
         ctx.textAlign = "center";
         ctx.fillText("POST", 960, 972);
      },
      [run]
   );
   const atlas = useCanvasTexture(1024, 1024, draw);
   const geometry = useMemo(() => {
      const vertices: number[] = [];
      const uvs: number[] = [];
      const add = (x: number, y: number, z: number, tile: number, width: number, height: number) => {
         const u = (tile % 8) / 8;
         const v = 1 - (Math.floor(tile / 8) + 1) / 8;
         for (const [dx, dy, du, dv] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, -1, 0, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) {
            // leaned back by the camera's pitch, so the plate faces the camera and reads at full height
            vertices.push(x + (dx * width) / 2, y + ((dy * height) / 2) * Math.cos(PITCH), z - ((dy * height) / 2) * Math.sin(PITCH));
            uvs.push(u + (0.01 + du * 0.98) / 8, v + (0.01 + dv * 0.98) / 8);
         }
      };
      // the plate stands on the mailbox post, facing the camera, 0.9 m wide and 0.75 m tall
      for (const h of run.houses) add(h.x + 0.62, 1.45, h.mailZ + 0.05, h.number - 1, 0.9, 0.75);
      add(OFFICE.x, 2.4, OFFICE_BOX.z + OFFICE_BOX.hz + 0.1, 63, 2.0, 0.7);
      const g = new BoxGeometry();
      g.setIndex(null);
      g.clearGroups();
      g.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
      g.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
      g.deleteAttribute("normal");
      g.computeVertexNormals();
      g.computeBoundingSphere();
      return g;
   }, [run]);
   useEffect(() => () => geometry.dispose(), [geometry]);
   return (
      <mesh geometry={geometry}>
         <meshBasicMaterial map={atlas} side={DoubleSide} toneMapped={false} />
      </mesh>
   );
}

const HOUSE_ASSETS = [
   [ASSETS.houseAN, ASSETS.houseBN, ASSETS.houseCN],
   [ASSETS.houseAS, ASSETS.houseBS, ASSETS.houseCS],
] as const;

function Neighborhood({ run, id }: { run: Run; id: Parameters<typeof decorSpots>[0] }) {
   const night = run.level.lighting === "night";
   const decor = useMemo(() => {
      const b = run.bounds;
      const width = b.max.x - b.min.x + 30;
      const midX = (b.max.x + b.min.x) / 2;
      const roads: InstanceSpot[] = [], lines: InstanceSpot[] = [], paving: InstanceSpot[] = [], kerbs: InstanceSpot[] = [], paths: InstanceSpot[] = [], zebra: InstanceSpot[] = [];
      const fences: InstanceSpot[] = [], posts: InstanceSpot[] = [], doors: InstanceSpot[] = [], frames: InstanceSpot[] = [], boxes: InstanceSpot[] = [];
      for (let street = 0; street < run.level.streets; street++) {
         const z = street * STREET_GAP;
         roads.push({ x: midX, y: 0.015, z, sx: width, sy: 0.03, sz: ROAD_HALF * 2 });
         for (let x = b.min.x - 14; x < b.max.x + 14; x += 4) lines.push({ x, y: 0.035, z, sx: 1.8, sy: 0.01, sz: 0.14 });
         for (const side of [-1, 1]) {
            paving.push({ x: midX, y: 0.05, z: z + side * 3.6, sx: width, sy: 0.08, sz: 1.6 });
            kerbs.push({ x: midX, y: 0.07, z: z + side * (ROAD_HALF + 0.05), sx: width, sy: 0.12, sz: 0.14 });
         }
         for (let j = 0; j < 7; j++) zebra.push({ x: ZEBRA_X, y: 0.04, z: z - 2.4 + j * 0.8, sx: 2.4, sy: 0.015, sz: 0.4 });
      }
      roads.push({ x: ZEBRA_X, y: 0.02, z: (b.max.z + b.min.z) / 2, sx: 4, sy: 0.04, sz: b.max.z - b.min.z + 30 });
      for (const h of run.houses) {
         paths.push({ x: h.x, y: 0.055, z: (h.mailZ + h.doorZ) / 2, sx: 1.3, sy: 0.05, sz: 3.5 });
         // a code door on the house front (the house GLBs keep their own detail): a frame and a two-tone leaf
         frames.push({ x: h.x, y: FIT.doorHeight / 2 + 0.06, z: h.doorZ + h.side * 0.4, sx: 1.2, sy: FIT.doorHeight + 0.12, sz: 0.1 });
         doors.push({ x: h.x, y: FIT.doorHeight / 2, z: h.doorZ + h.side * 0.34, sx: 0.95, sy: FIT.doorHeight, sz: 0.06 });
         boxes.push({ x: h.x + 0.62, y: 0, z: h.mailZ, rotY: h.side > 0 ? Math.PI : 0 });
         // a low code picket fence either side of the front path: two rails and a post every 0.33 m
         for (const side of [-1, 1]) {
            const cx = h.x + side * 2.0;
            const z = h.mailZ + h.side * 0.6;
            for (const y of [0.22, 0.46]) fences.push({ x: cx, y, z, sx: FIT.fenceLength, sy: 0.06, sz: 0.05 });
            for (let i = 0; i <= 8; i++) posts.push({ x: cx - FIT.fenceLength / 2 + (i * FIT.fenceLength) / 8, y: FIT.fenceHeight / 2, z, sx: 0.07, sy: FIT.fenceHeight, sz: 0.07 });
         }
      }
      return { roads, lines, paving, kerbs, paths, zebra, fences, posts, doors, frames, boxes };
   }, [run]);
   const houses = useMemo(
      () =>
         [0, 1].map((row) =>
            [0, 1, 2].map((kind) =>
               run.houses
                  .filter((h) => h.kind === kind && (row === 0 ? h.side < 0 : h.side > 0))
                  .map((h): InstanceSpot => ({ x: h.x, y: 0, z: h.z, rotY: h.side > 0 ? Math.PI : 0 }))
            )
         ),
      [run]
   );
   const roofs = useMemo(() => houses.map((row, r) => row.map((spots) => spots.map((s) => ({ ...s, y: r === 0 ? FIT.houseHeightNorth : FIT.houseHeightSouth, sx: 5.2, sy: 0.4, sz: 3.2 })))), [houses]);
   const bulbs = useMemo(() => (night ? run.houses.flatMap((h) => Array.from({ length: 6 }, (_, i) => ({ x: h.x - 2.2 + i * 0.88, y: (h.side < 0 ? FIT.houseHeightNorth : FIT.houseHeightSouth) - 0.15, z: h.doorZ + h.side * 0.32, scale: 0.08 }))) : []), [run, night]);
   const quality = useQuality();
   const extra = useMemo(() => {
      const d = decorSpots(id);
      return { ...d, trees: d.trees.slice(0, scaledCount(d.trees.length, quality.decor)) };
   }, [id, quality.decor]);
   const lamps = useMemo(() => {
      const all = lampSpots(run.level);
      return all.slice(0, scaledCount(all.length, quality.decor));
   }, [run, quality.decor]);
   const lampGlow = useMemo(() => lamps.map((s) => ({ ...s, y: FIT.lampHeight - 0.35, scale: 0.18 })), [lamps]);
   const lightSpots = useMemo(() => (run.level.traffic > 0 ? Array.from({ length: run.level.streets }, (_, s): InstanceSpot => ({ x: ZEBRA_X + 2.2, y: 0, z: s * STREET_GAP - 3.2, rotY: 0 })) : []), [run]);
   return (
      <>
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[15, -0.03, 20]}>
            <circleGeometry args={[300, 48]} />
            <meshStandardMaterial color={COLORS.lawn} roughness={1} />
         </mesh>
         <Boxes spots={decor.roads} color={COLORS.road} />
         <Boxes spots={decor.lines} color={COLORS.roadLine} />
         <Boxes spots={decor.paving} color={COLORS.pavement} />
         <Boxes spots={decor.kerbs} color={COLORS.kerb} />
         <Boxes spots={decor.paths} color={COLORS.path} />
         <Boxes spots={decor.zebra} color={COLORS.white} />
         {houses.map((row, r) =>
            row.map((spots, kind) => (
               <Props
                  key={`${r}-${kind}`}
                  asset={HOUSE_ASSETS[r][kind]}
                  spots={spots}
                  size={[5, r === 0 ? FIT.houseHeightNorth : FIT.houseHeightSouth, 3]}
                  color={COLORS.cream}
                  detail={<Boxes spots={roofs[r][kind]} color={HOUSE_COLORS[kind]} />}
               />
            ))
         )}
         <Boxes spots={decor.frames} color={COLORS.white} />
         <Boxes spots={decor.doors} color={COLORS.door} />
         <Props asset={ASSETS.mailbox} spots={decor.boxes} size={[0.5, FIT.mailboxHeight, 0.4]} color={COLORS.accent} />
         <Boxes spots={decor.fences} color={COLORS.white} />
         <Boxes spots={decor.posts} color={COLORS.white} />
         <Props asset={ASSETS.lamp} spots={lamps} size={[0.15, FIT.lampHeight, 0.15]} color={COLORS.navy} />
         <Instanced spots={lampGlow}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color={COLORS.glow} emissive={COLORS.glow} emissiveIntensity={night ? 2.6 : 0.25} toneMapped={!night} />
         </Instanced>
         <Model asset={ASSETS.office} position={[OFFICE_BOX.x, 0, OFFICE_BOX.z]} fallback={<group><mesh position={[0, FIT.officeHeight / 2, 0]}><boxGeometry args={[FIT.officeWidth, FIT.officeHeight, FIT.officeDepth]} /><meshStandardMaterial color={COLORS.cream} /></mesh><mesh position={[0, FIT.officeHeight, 0]}><boxGeometry args={[FIT.officeWidth + 0.3, 0.25, FIT.officeDepth + 0.3]} /><meshStandardMaterial color={COLORS.accent} /></mesh></group>} />
         <Model asset={ASSETS.van} position={[(VAN_BOX.minX + VAN_BOX.maxX) / 2, 0, (VAN_BOX.minZ + VAN_BOX.maxZ) / 2]} fallback={<group><mesh position={[0, 0.85, 0]}><boxGeometry args={[1.8, 1.7, 4]} /><meshStandardMaterial color={COLORS.accent} /></mesh><mesh position={[0, 1.2, 2.01]}><boxGeometry args={[1.6, 0.5, 0.02]} /><meshStandardMaterial color={COLORS.glass} /></mesh></group>} />
         <Props asset={ASSETS.bench} spots={extra.benches} size={[2.2, 1, 0.95]} color={COLORS.bag} />
         <Props asset={ASSETS.bicycle} spots={extra.bicycles} size={[0.6, 1, 1.6]} color={COLORS.navy} />
         {lightSpots.length > 0 && <Props asset={ASSETS.trafficLight} spots={lightSpots} size={[0.25, FIT.trafficLightHeight, 0.25]} color={COLORS.navy} />}
         {night && (
            <>
               <Instanced spots={bulbs}>
                  <sphereGeometry args={[1, 6, 4]} />
                  <meshStandardMaterial color={COLORS.glow} emissive={COLORS.glow} emissiveIntensity={3} toneMapped={false} />
               </Instanced>
               <Props asset={ASSETS.holidayTree} spots={extra.trees} size={[0.6, 1, 0.6]} color={COLORS.tree} />
            </>
         )}
         <Plates run={run} />
      </>
   );
}

const V = new Vector3();
const Q = new Quaternion();
const E = new Euler();
const S = new Vector3(1, 1, 1);
const HOP: BodyOffset = { y: 0, roll: 0, yaw: 0, squash: 1 };
const DOG_TINTS = [new Color("#ffffff"), new Color("#fde68a"), new Color("#a8a29e")];

function LevelScene() {
   const { id, config } = useLevel<PostLevel>();
   const [run] = useState(() => createRun(randomSeed(), config));
   const input = useInput();
   const controls = useRef({ moveX: 0, moveY: 0, yaw: 0, actionPressed: false }).current;
   const time = useGameTime();
   const fx = useFx();
   const view = useFittedView(VIEW);
   const scene = useThree((s) => s.scene);
   const hero = useRef<Group>(null);
   const parcel = useRef<Group>(null);
   const ring = useRef<Group>(null);
   const aim = useRef({ x: OFFICE.x, y: 0.8, z: OFFICE.z - LOOK_AHEAD }).current;
   const target = useRef([{ x: OFFICE.x, y: 1.2, z: OFFICE.z, hidden: false, color: COLORS.accent }]).current;
   const anim = useRef({ reachUntil: 0, messageUntil: 0, phase: 0 }).current;
   const at = useRef({ x: 0, y: 1, z: 0 }).current;
   const hud = useRef({ key: "" }).current;

   // the fog starts past the aim at whatever distance the camera was fitted to (looks.ts fogFor)
   useEffect(() => {
      const fog = scene.fog;
      if (!(fog instanceof Fog)) return;
      const before = { near: fog.near, far: fog.far };
      const next = fogFor(config, view.distance);
      fog.near = next.near;
      fog.far = next.far;
      return () => {
         fog.near = before.near;
         fog.far = before.far;
      };
   }, [scene, config, view.distance]);

   const pools = useMemo(() => {
      const make = (geometry: InstancePart["geometry"], color: string): InstancePart => ({ geometry, material: new MeshStandardMaterial({ color, roughness: 0.65 }) });
      const car = new RoundedBoxGeometry(2.8, 0.8, 1.3, 2, 0.1);
      car.translate(0, 0.6, 0);
      const roof = new RoundedBoxGeometry(1.5, 0.55, 1.15, 2, 0.08);
      roof.translate(-0.2, 1.17, 0);
      const dog = new CapsuleGeometry(0.2, 0.42, 4, 8);
      dog.rotateX(Math.PI / 2);
      dog.translate(0, 0.38, 0);
      const head = new SphereGeometry(0.17, 10, 8);
      head.translate(0, 0.58, 0.32);
      return { cars: [make(car, COLORS.accent), make(roof, COLORS.glass)], dogs: [make(dog, COLORS.dog), make(head, COLORS.bag)] };
   }, []);
   useEffect(
      () => () => {
         for (const part of [...pools.cars, ...pools.dogs]) {
            part.geometry.dispose();
            (part.material as MeshStandardMaterial).dispose();
         }
      },
      [pools]
   );

   const armPose = useMemo(() => createPose(), []);
   const pose = useHumanoidPose((p) => {
      const speed = Math.hypot(run.hero.vx, run.hero.vz);
      const amount = Math.min(1, speed / SPEED);
      anim.phase = wrapPhase(anim.phase + gaitPhaseStep(Math.max(0.35, amount), POSTMAN_LANDMARKS, POSTMAN_SCALE, speed, time.delta));
      if (run.over === "win") {
         cheerPose(time.now, p);
         return;
      }
      if (amount > 0.05) walkPose(anim.phase, Math.max(0.35, amount), p);
      else idlePose(time.now, p);
      if (anim.reachUntil > time.now) {
         reachPose(1, 0.6, armPose);
         blendPoses(p, armPose, 1, p, POSE_MASK.arms);
      } else if (run.carrying) {
         carryPose(0.25, armPose);
         blendPoses(p, armPose, 1, p, POSE_MASK.arms);
      }
   });

   /** The game HUD's route list (next three items) and the refill flag, written only when they change. */
   const publish = useCallback(() => {
      let key = "";
      let slot = 0;
      for (const item of run.items) {
         if (item.delivered || slot >= 3) continue;
         key += `${item.house}.${item.color}.${item.kind === "parcel" ? 1 : 0}|`;
         slot++;
      }
      const next = nextItem(run);
      key += next && !next.loaded ? "R" : "";
      if (key === hud.key) return;
      hud.key = key;
      const s = useArcadeStore.getState();
      slot = 0;
      for (const item of run.items) {
         if (item.delivered || slot >= 3) continue;
         s.setStat(`next${slot}`, item.house);
         s.setStat(`color${slot}`, item.color);
         s.setStat(`parcel${slot}`, item.kind === "parcel" ? 1 : 0);
         slot++;
      }
      for (; slot < 3; slot++) s.setStat(`next${slot}`, 0);
      s.setStat("refill", next && !next.loaded ? 1 : 0);
   }, [run, hud]);
   useEffect(() => {
      publish();
      fx.warm("puff", "sparks", "score", "confetti");
   }, [publish, fx]);

   useRunFrame((_s, dt) => {
      controls.moveX = input.current.moveX;
      controls.moveY = input.current.moveY;
      controls.yaw = view.yaw;
      controls.actionPressed = input.current.actionPressed;
      const e = step(run, controls, dt);
      syncStore(run, useArcadeStore);
      if (e.delivered >= 0 || e.refill) publish();
      const item = nextItem(run);
      if (item && item.loaded) targetFor(run, item, target[0]);
      else {
         target[0].x = OFFICE.x;
         target[0].z = OFFICE.z;
      }
      target[0].hidden = !item || !config.markers;
      const speed = Math.hypot(run.hero.vx, run.hero.vz);
      const ahead = speed > 0.3 ? LOOK_AHEAD / speed : 0;
      aim.x = run.hero.x + run.hero.vx * ahead;
      aim.z = run.hero.z + run.hero.vz * ahead;
      at.x = run.hero.x;
      at.y = 1.4;
      at.z = run.hero.z;
      if (e.delivered >= 0) {
         fx.burst("puff", at, 10);
         fx.score(at, `+${e.score}`, { color: COLORS.accent });
         playSfx(e.score > 100 ? "combo" : "chime");
         anim.reachUntil = time.now + 0.35;
      }
      if (e.wrong || e.refill) {
         useArcadeStore.getState().setStat("message", e.wrong ? 1 : 2);
         anim.messageUntil = time.now + 1.5;
         playSfx(e.wrong ? "buzz" : "pickup");
      }
      if (anim.messageUntil > 0 && time.now > anim.messageUntil) {
         anim.messageUntil = 0;
         useArcadeStore.getState().setStat("message", 0);
      }
      if (e.hit) {
         playSfx("hit");
         fx.shake(0.2);
         fx.burst("sparks", at, 8);
      }
      if (run.over === "win") fx.burst("confetti", at, 30);
   });

   useFrame(() => {
      const h = run.hero;
      if (hero.current) {
         hero.current.position.set(h.x, 0, h.z);
         hero.current.rotation.y = h.yaw;
         hero.current.visible = h.mercy === 0 || Math.floor(time.now * 12) % 2 === 0;
      }
      if (parcel.current) parcel.current.visible = run.carrying;
      if (ring.current) {
         ring.current.position.set(target[0].x, 0.09, target[0].z);
         ring.current.visible = !target[0].hidden;
      }
   }, FRAME_PRIORITY.visuals);

   const updateCar = (i: number, m: Matrix4) => {
      const c = run.cars[i];
      if (!c) return false;
      V.set(c.x, 0, c.z);
      Q.setFromEuler(E.set(0, c.direction < 0 ? Math.PI : 0, 0));
      S.set(1, 1, 1);
      m.compose(V, Q, S);
   };
   const updateDog = (i: number, m: Matrix4, color: Color) => {
      const d = run.dogs[i];
      if (!d) return false;
      color.copy(DOG_TINTS[i % DOG_TINTS.length]);
      hop(time.now * 9 + i, d.active * 0.12, HOP);
      V.set(d.x, HOP.y, d.z);
      // faces the street (it runs out toward it)
      Q.setFromEuler(E.set(0, d.side > 0 ? Math.PI : 0, HOP.roll));
      S.set(1, HOP.squash, 1);
      m.compose(V, Q, S);
   };

   return (
      <>
         <CameraRig camera={{ ...CAMERA, fov: FOV }} follow={aim} followFraction={1} bounds={run.bounds} offset={view.offset} shift={view.shift} damping={5} />
         <Neighborhood run={run} id={id} />
         <group ref={hero}>
            <BlobShadow radius={0.42} opacity={0.25} />
            <HumanoidModel
               asset={ASSETS.postman}
               pose={pose}
               attach={{ chest: <group position={[-0.32, -0.32, 0.06]}><Model asset={ASSETS.mailbag} fallback={<mesh><boxGeometry args={[0.35, 0.4, 0.3]} /><meshStandardMaterial color={COLORS.bag} /></mesh>} /></group> }}
               fallback={
                  <group>
                     <mesh position={[0, 0.37, 0]}><capsuleGeometry args={[0.2, 0.42, 4, 8]} /><meshStandardMaterial color={COLORS.navy} /></mesh>
                     <mesh position={[0, 1.02, 0]}><capsuleGeometry args={[0.28, 0.45, 4, 10]} /><meshStandardMaterial color={COLORS.blue} /></mesh>
                     <mesh position={[0, 1.48, 0]}><sphereGeometry args={[0.24, 12, 8]} /><meshStandardMaterial color={COLORS.skin} /></mesh>
                     <mesh position={[0, 1.71, 0.02]}><cylinderGeometry args={[0.28, 0.28, 0.14, 12]} /><meshStandardMaterial color={COLORS.navy} /></mesh>
                     <group position={[-0.37, 0.8, 0]}><mesh><boxGeometry args={[0.35, 0.4, 0.3]} /><meshStandardMaterial color={COLORS.bag} /></mesh></group>
                  </group>
               }
            />
            <group ref={parcel} position={[0, 1.0, 0.42]}>
               <Parcel size={[0.5, 0.35, 0.4]} />
            </group>
         </group>
         {run.cars.length > 0 && <DynamicInstancedModel asset={ASSETS.car} count={run.cars.length} update={updateCar} fallbackParts={pools.cars} name="cars" />}
         {run.dogs.length > 0 && <DynamicInstancedModel asset={ASSETS.dog} count={run.dogs.length} update={updateDog} tinted fallbackParts={pools.dogs} name="dogs" />}
         {config.markers && (
            <>
               <TargetMarkers targets={target} color={COLORS.accent} />
               <group ref={ring}>
                  <mesh rotation={[-Math.PI / 2, 0, 0]}>
                     <ringGeometry args={[0.7, 0.85, 32]} />
                     <meshBasicMaterial color={COLORS.accent} transparent opacity={0.75} side={DoubleSide} depthWrite={false} />
                  </mesh>
               </group>
            </>
         )}
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
