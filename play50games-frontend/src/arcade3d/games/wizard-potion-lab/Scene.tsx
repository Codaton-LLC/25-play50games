"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
   BoxGeometry,
   BufferGeometry,
   Color,
   ConeGeometry,
   CylinderGeometry,
   Float32BufferAttribute,
   LatheGeometry,
   MeshStandardMaterial,
   OctahedronGeometry,
   RepeatWrapping,
   Quaternion,
   SphereGeometry,
   Vector2,
   Vector3,
   type Group,
} from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { playSfx, startLoop } from "@/arcade3d/core/audio";
import CameraRig from "@/arcade3d/core/CameraRig";
import type { AABB } from "@/arcade3d/core/collision";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { useQuality } from "@/arcade3d/core/quality";
import { Instanced, useCanvasTexture, type InstancePart } from "@/arcade3d/core/render";
import { HumanoidModel, aimArm, cheerPose, gaitPhaseStep, idlePose, useHumanoidPose, walkPose, wrapPhase } from "@/arcade3d/core/rig";
import { CAULDRON_INNER_RADIUS_GLB, EXPANSION_GLB_POINTS } from "@/arcade3d/core/sharedAssets";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS, WIZARD_LANDMARKS, WIZARD_SCALE } from "./assets";
import { publishLab } from "./Hud";
import { LEVELS, type WizardLevel } from "./levels";
import { COLORS, DAMPING, FOLLOW, FOV, INGREDIENT_LOOK, candleSpots, aimBounds, drawFlagstones, labDecor, lookAtFor, runeSpots, viewFor, wallBoxes, wallCapSpots, wallSpots } from "./looks";
import { BallPrimitive, BookPrimitive, CauldronPrimitive, TablePrimitive, WizardFigure } from "./Primitives";
import {
   MAX_SPEED,
   TYPES,
   USE_RANGE,
   createRun,
   itemXZ,
   shelfFor,
   step,
   type Ingredient,
   type Run,
} from "./rules";

const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3(1, 1, 1);
const UP = new Vector3(0, 1, 0);
const AT = { x: 0, y: 1, z: 0 };
const P = { x: 0, z: 0 };
const POT_SCALE = ASSETS.cauldron.scale ?? 1;
const DISC_R = CAULDRON_INNER_RADIUS_GLB * POT_SCALE;
const DISC_Y = EXPANSION_GLB_POINTS.cauldronInnerFloor.y * POT_SCALE;

const BREW = Object.fromEntries(TYPES.map((type) => [type, new Color(INGREDIENT_LOOK[type].color)])) as Record<Ingredient, Color>;
const BREW_IDLE = new Color(COLORS.brewIdle);

const INGREDIENT_ASSET = {
   mushroom: ASSETS.mushroom,
   crystal: ASSETS.crystal,
   berry: ASSETS.berry,
   flower: ASSETS.flower,
   herb: ASSETS.herb,
   bottle: ASSETS.bottle,
} as const;

function starGeometry(): BufferGeometry {
   const outer = 0.2;
   const inner = 0.085;
   const positions: number[] = [];
   const ring: Array<[number, number]> = [];
   for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? outer : inner;
      ring.push([Math.cos(a) * r, Math.sin(a) * r]);
   }
   const push = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) => {
      positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
   };
   const y0 = 0;
   const y1 = 0.14;
   for (let i = 0; i < 10; i++) {
      const [x0, z0] = ring[i];
      const [x1, z1] = ring[(i + 1) % 10];
      push(0, y1, 0, x0, y1, z0, x1, y1, z1);
      push(0, y0, 0, x1, y0, z1, x0, y0, z0);
      push(x0, y0, z0, x1, y0, z1, x1, y1, z1);
      push(x0, y0, z0, x1, y1, z1, x0, y1, z0);
   }
   const geo = new BufferGeometry();
   geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
   geo.computeVertexNormals();
   return geo;
}

function dropGeometry(): LatheGeometry {
   const pts: Vector2[] = [];
   for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const y = t * 0.4;
      const r = Math.sin(Math.PI * t) * 0.15 * (1 - t * 0.55);
      pts.push(new Vector2(Math.max(0.012, r), y));
   }
   return new LatheGeometry(pts, 8);
}

function part(geometry: BufferGeometry, color: string): InstancePart {
   geometry.computeBoundingSphere();
   return {
      geometry,
      material: new MeshStandardMaterial({ color, roughness: 0.45, emissive: color, emissiveIntensity: 0.12 }),
   };
}

function ingredientParts(): Record<Ingredient, InstancePart[]> {
   const cap = new SphereGeometry(0.16, 12, 10);
   cap.translate(0, 0.22, 0);
   const stem = new CylinderGeometry(0.05, 0.07, 0.16, 8);
   stem.translate(0, 0.08, 0);
   const crystal = new BoxGeometry(0.26, 0.34, 0.26);
   crystal.translate(0, 0.17, 0);
   const berry = new ConeGeometry(0.16, 0.34, 8);
   berry.translate(0, 0.17, 0);
   const flower = new OctahedronGeometry(0.18, 0);
   flower.translate(0, 0.2, 0);
   const star = starGeometry();
   const drop = dropGeometry();
   return {
      mushroom: [part(cap, INGREDIENT_LOOK.mushroom.color), part(stem, "#f5f5f4")],
      crystal: [part(crystal, INGREDIENT_LOOK.crystal.color)],
      berry: [part(berry, INGREDIENT_LOOK.berry.color)],
      flower: [part(flower, INGREDIENT_LOOK.flower.color)],
      herb: [part(star, INGREDIENT_LOOK.herb.color)],
      bottle: [part(drop, INGREDIENT_LOOK.bottle.color)],
   };
}

function disposeParts(parts: InstancePart[]): void {
   for (const piece of parts) {
      piece.geometry.dispose();
      const material = piece.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material.dispose();
   }
}

function IngredientPools({ run, parts }: { run: Run; parts: Record<Ingredient, InstancePart[]> }) {
   return (
      <>
         {TYPES.map((type, index) => (
            <DynamicInstancedModel
               key={type}
               asset={INGREDIENT_ASSET[type]}
               count={1}
               name={type}
               fallbackParts={parts[type]}
               update={(_i, matrix) => {
                  const shelf = shelfFor(run, type);
                  if (!shelf) return false;
                  if (run.carried === type) {
                     const yaw = run.hero.yaw;
                     const reaching = run.reach > 0 || Math.hypot(run.hero.x, run.hero.z) <= USE_RANGE;
                     const forward = reaching ? 0.46 : 0.32;
                     V.set(
                        run.hero.x + Math.sin(yaw) * forward,
                        reaching ? 0.78 : 1.05,
                        run.hero.z + Math.cos(yaw) * forward,
                     );
                     Q.setFromAxisAngle(UP, yaw);
                  } else {
                     itemXZ(shelf, run.time, P);
                     const bob = Math.sin(run.time * 2.4 + index) * 0.03;
                     V.set(P.x, 0.92 + bob, P.z);
                     Q.setFromAxisAngle(UP, shelf.angle + run.time * 0.4);
                  }
                  S.set(1, 1, 1);
                  matrix.compose(V, Q, S);
               }}
            />
         ))}
      </>
   );
}

function LevelScene() {
   const { id, config } = useLevel<WizardLevel>();
   const level = config ?? LEVELS[1];
   const view = useFittedView(viewFor(id));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const quality = useQuality();
   const [run] = useState<Run>(() => createRun(randomSeed(), level));
   // camera views (core/camera): the rules get the drawn camera's yaw; the lab's wall ring blocks the camera
   const cam = useCameraViews({
      slug: "wizard-potion-lab",
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
      solids: (out: AABB[]) => wallBoxes(walls, out),
   });
   const aim = useRef({ x: run.hero.x, y: 0.6, z: run.hero.z }).current;
   const body = useRef<Group>(null);
   const gait = useRef({ phase: 0 });
   const bounds = useMemo(() => aimBounds(level), [level]);
   const look = useMemo(() => lookAtFor(), []);
   const walls = useMemo(() => wallSpots(level), [level]);
   const caps = useMemo(() => wallCapSpots(walls), [walls]);
   const candles = useMemo(() => candleSpots(level, quality.decor), [level, quality.decor]);
   const runes = useMemo(() => runeSpots(level, quality.decor), [level, quality.decor]);
   const shelfSpots = useMemo(
      () => run.shelves.map((shelf) => ({ x: shelf.x, y: 0, z: shelf.z, rotY: shelf.angle + Math.PI })),
      [run],
   );
   const decor = useMemo(() => labDecor(level), [level]);
   const flagstones = useCanvasTexture(256, 256, drawFlagstones);
   useMemo(() => {
      flagstones.wrapS = RepeatWrapping;
      flagstones.wrapT = RepeatWrapping;
      flagstones.repeat.set(level.radius, level.radius);
      flagstones.needsUpdate = true;
   }, [flagstones, level.radius]);
   const parts = useMemo(() => ingredientParts(), []);
   const brewMat = useMemo(() => new MeshStandardMaterial({
      color: COLORS.brewIdle,
      emissive: COLORS.glow,
      emissiveIntensity: 0.55,
      roughness: 0.22,
      metalness: 0.05,
   }), []);
   const shelfGeo = useMemo(() => {
      const bodyGeo = new BoxGeometry(1.12, 1.48, 0.34);
      bodyGeo.translate(0, 0.74, 0);
      const trim = new BoxGeometry(1.18, 0.08, 0.4);
      trim.translate(0, 1.5, 0);
      return { bodyGeo, trim };
   }, []);
   const candleGeo = useMemo(() => {
      const wax = new CylinderGeometry(0.045, 0.055, 0.3, 8);
      wax.translate(0, 0.15, 0);
      const flame = new SphereGeometry(0.04, 8, 6);
      flame.translate(0, 0.34, 0);
      return { wax, flame };
   }, []);
   useEffect(() => () => {
      for (const type of TYPES) disposeParts(parts[type]);
      brewMat.dispose();
      shelfGeo.bodyGeo.dispose();
      shelfGeo.trim.dispose();
      candleGeo.wax.dispose();
      candleGeo.flame.dispose();
   }, [parts, brewMat, shelfGeo, candleGeo]);

   const pose = useHumanoidPose((p) => {
      const speed = Math.hypot(run.hero.vx, run.hero.vz);
      const amount = Math.min(1, speed / MAX_SPEED);
      gait.current.phase = wrapPhase(gait.current.phase + gaitPhaseStep(Math.max(0.35, amount), WIZARD_LANDMARKS, WIZARD_SCALE, speed, time.delta, 4));
      if (run.over === "win") cheerPose(time.now, p);
      else if (amount > 0.08 && run.hero.stun <= 0) walkPose(gait.current.phase, Math.max(0.35, amount), p);
      else idlePose(time.now, p);
      const atPot = run.carried !== null && Math.hypot(run.hero.x, run.hero.z) <= USE_RANGE;
      if (run.reach > 0 || atPot) aimArm(p, -1, 0.04, -0.42, 0.88, 0.02, -0.7, 0.62);
   });

   useEffect(() => {
      fx.warm("puff", "sparks", "smoke", "score");
      const loop = startLoop("bubbling", { volume: 0.18 });
      publishLab(run);
      return () => {
         loop.stop();
         publishLab(null);
      };
   }, [fx, run]);

   useRunFrame((_state, dt) => {
      const { moveX, moveY, actionPressed } = input.current;
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX, moveY, actionPressed, yaw: cam.yaw() }, dt, store.timeLeftMs ?? 0);
      if (ev.score) store.addScore(ev.score);
      aim.x = run.hero.x;
      aim.z = run.hero.z;
      aim.y = 0.6;
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, aim.x));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, aim.z));
      if (ev.picked) playSfx("pickup");
      if (ev.added) {
         AT.x = 0; AT.y = 0.7; AT.z = 0;
         fx.burst("puff", AT, 12);
         playSfx("pop");
      }
      if (ev.brewed >= 0) {
         AT.x = run.hero.x; AT.y = 1.3; AT.z = run.hero.z;
         fx.burst("sparks", AT, 14);
         fx.score(AT, `+${ev.score}`);
         playSfx("chime");
      }
      if (ev.wrong) {
         AT.x = 0; AT.y = 0.8; AT.z = 0;
         fx.burst("smoke", AT, 8);
         fx.shake(0.22);
         playSfx("buzz");
      }
      if (ev.lifeLost) store.loseLife();
      if (ev.won) {
         playSfx("win");
         store.end("win");
      }
      if (ev.lost) playSfx("lose");
      publishLab(run);
   });

   useFrame(() => {
      const group = body.current;
      if (group) {
         group.position.set(run.hero.x, 0, run.hero.z);
         group.rotation.y = run.hero.yaw;
      }
      const tint = run.brew ? BREW[run.brew] : BREW_IDLE;
      brewMat.color.copy(tint);
      brewMat.emissive.copy(tint);
   }, FRAME_PRIORITY.visuals);

   const span = (level.radius + 1.6) * 2.4;
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
         <pointLight position={[0, 2.2, 0]} color={COLORS.glow} intensity={4} distance={level.radius * 1.4} decay={2} />
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
            <planeGeometry args={[span, span]} />
            <meshStandardMaterial color={level.background} roughness={0.95} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]}>
            <circleGeometry args={[level.radius - 0.05, 48]} />
            <meshStandardMaterial map={flagstones} color="#ffffff" emissive={COLORS.floor} emissiveMap={flagstones} emissiveIntensity={level.lighting === "night" ? 0.7 : 0.35} roughness={0.88} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
            <ringGeometry args={[level.radius - 0.55, level.radius - 0.2, 48]} />
            <meshStandardMaterial color={COLORS.floorIn} roughness={0.8} />
         </mesh>
         <Instanced spots={walls} name="walls">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wall} emissive={COLORS.wall} emissiveIntensity={level.lighting === "night" ? 0.4 : 0.15} roughness={0.86} />
         </Instanced>
         <Instanced spots={caps} name="wall-caps">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wallTrim} roughness={0.65} />
         </Instanced>
         {runes.length > 0 && (
            <Instanced spots={runes} name="runes">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={COLORS.rune} emissive={COLORS.glow} emissiveIntensity={0.4} roughness={0.4} />
            </Instanced>
         )}
         <InstancedModel
            asset={ASSETS.shelf}
            spots={shelfSpots}
            fallback={
               <>
                  <Instanced spots={shelfSpots} name="shelves">
                     <primitive object={shelfGeo.bodyGeo} attach="geometry" />
                     <meshStandardMaterial color={COLORS.shelf} roughness={0.75} />
                  </Instanced>
                  <Instanced spots={shelfSpots} name="shelf-trim">
                     <primitive object={shelfGeo.trim} attach="geometry" />
                     <meshStandardMaterial color={COLORS.shelfTrim} roughness={0.55} />
                  </Instanced>
               </>
            }
         />
         <InstancedModel
            asset={ASSETS.candle}
            spots={candles}
            fallback={
               <>
                  <Instanced spots={candles} name="candles">
                     <primitive object={candleGeo.wax} attach="geometry" />
                     <meshStandardMaterial color={COLORS.candle} roughness={0.55} />
                  </Instanced>
                  <Instanced spots={candles} name="flames">
                     <primitive object={candleGeo.flame} attach="geometry" />
                     <meshStandardMaterial color={COLORS.candleWax} emissive={COLORS.candleWax} emissiveIntensity={0.9} roughness={0.4} />
                  </Instanced>
               </>
            }
         />
         {/* lab dressing beyond the wall ring: shelves, cauldrons, tall candles (outside the play area) */}
         <InstancedModel asset={ASSETS.shelf} spots={decor.shelves} fallback={null} />
         <InstancedModel asset={ASSETS.cauldron} spots={decor.cauldrons} fallback={null} />
         <InstancedModel asset={ASSETS.candle} spots={decor.candles} fallback={null} />
         <pointLight position={[0, 1.7, 0]} intensity={level.lighting === "night" ? 12 : level.lighting === "sunset" ? 4 : 0} distance={9} decay={1.5} color={COLORS.glow} />
         <Model asset={ASSETS.cauldron} fallback={<CauldronPrimitive />} />
         <mesh position={[0, DISC_Y, 0]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[DISC_R, 20]} />
            <primitive object={brewMat} attach="material" />
         </mesh>
         <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.7, 0.86, 24]} />
            <meshBasicMaterial color={COLORS.glow} transparent opacity={0.45} depthWrite={false} />
         </mesh>
         <group position={[run.table.x, 0, run.table.z]} rotation-y={run.table.rotY}>
            <Model asset={ASSETS.table} fallback={<TablePrimitive />} />
            <Model asset={ASSETS.book} position={[0.22, 0.78, 0.02]} rotation-y={0.4} fallback={<BookPrimitive />} />
            <Model asset={ASSETS.ball} position={[-0.28, 0.78, -0.04]} fallback={<BallPrimitive />} />
         </group>
         <IngredientPools run={run} parts={parts} />
         <group ref={body}>
            <pointLight position={[0, 2.4, 0.8]} intensity={level.lighting === "night" ? 9 : level.lighting === "sunset" ? 3 : 0} distance={7} decay={1.6} color="#ddd6fe" />
            <HumanoidModel asset={ASSETS.wizard} pose={pose} fallback={<WizardFigure />} />
         </group>
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
