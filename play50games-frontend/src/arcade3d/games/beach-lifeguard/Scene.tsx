"use client";

// One useRunFrame steps rules.ts (step + syncStore); visuals read the run and animate on useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BufferAttribute, Color, Euler, Fog, Matrix4, MeshBasicMaterial, PlaneGeometry, Quaternion, RepeatWrapping, RingGeometry, Vector3, type Group, type Mesh } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import type { AABB } from "@/arcade3d/core/collision";
import { SkyDome } from "@/arcade3d/core/env";
import { Water } from "@/arcade3d/core/env/Water";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { Toss, useActionPop, useFx, type TossHandle } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetBeacon, TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { hover, type BodyOffset } from "@/arcade3d/core/motion";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, useCanvasTexture, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { HumanoidModel, POSE_MASK, blendPoses, carryPose, cheerPose, crawlPose, createPose, gaitPhaseStep, idlePose, sitPose, useHumanoidPose, walkPose, wrapPhase } from "@/arcade3d/core/rig";
import { useCoarsePointer } from "@/arcade3d/core/TouchControls";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, FIT, LIFEGUARD_LANDMARKS, LIFEGUARD_SCALE } from "./assets";
import type { LevelId } from "@/arcade3d/types";
import type { BeachLevel } from "./levels";
import { COLORS, DAMPING, FOV, LOOK_AHEAD, SEABED_MAX, WATER_Y, aimBounds, decorSpots, fogFor, seabedY, swimBlend, viewFor } from "./looks";
import {
   AlertTorusMarker,
   BeachChairPrimitive,
   BeachCoolerPrimitive,
   JetSkiPrimitive,
   LifeguardFigure,
   RescueFloatPrimitive,
   SandcastlePrimitive,
   SwimmerFigure,
   TowerPrimitive,
} from "./Primitives";
import { GUIDE, beachHint, hintCode, nextGoal, type Goal } from "./guide";
import { SAFE_SAND_Z, SAND_DEPTH, SPEED_SAND, TOWER, createRun, step, syncStore, type PropKind, type Run } from "./rules";

const V = new Vector3();
const Q = new Quaternion();
const E = new Euler();
const S = new Vector3(1, 1, 1);
const AT = { x: 0, y: 0, z: 0 };
const BOB: BodyOffset = { y: 0, roll: 0, yaw: 0, squash: 1 };

/**
 * The beach sand, drawn once: the top of the canvas is the waterline (the plane lies with +v towards -z).
 * Wet sand from the water to the safe line at z = 2 (darker, with a faint tide line where it ends), then
 * dry sand in soft tone bands with grain and wind ripples.
 */
const SAND_TEX_H = 512;
function drawSand(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const wetEnd = (SAFE_SAND_Z / SAND_DEPTH) * h;
   const grad = ctx.createLinearGradient(0, 0, 0, h);
   grad.addColorStop(0, "#c9a86a");
   grad.addColorStop((wetEnd * 0.85) / h, "#dcbc80");
   grad.addColorStop(wetEnd / h, COLORS.wetSand);
   grad.addColorStop((wetEnd * 1.4) / h, COLORS.sand);
   grad.addColorStop(0.6, "#f5dcae");
   grad.addColorStop(1, "#ecd09a");
   ctx.fillStyle = grad;
   ctx.fillRect(0, 0, w, h);
   // tide line: a thin broken band of lighter shell grit where the wet sand ends
   ctx.fillStyle = "rgba(255, 250, 235, 0.35)";
   for (let x = 0; x < w; x += 6) ctx.fillRect(x, wetEnd - 2 + Math.sin(x * 0.07) * 2, 4, 2);
   // wind ripples on the dry sand
   ctx.strokeStyle = "rgba(160, 120, 60, 0.10)";
   ctx.lineWidth = 2;
   for (let y = wetEnd * 1.6; y < h; y += 14) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.05 + y) * 3);
      ctx.stroke();
   }
   // grain
   let seed = 7;
   const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
   for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = rnd() < 0.5 ? "rgba(120, 90, 40, 0.12)" : "rgba(255, 255, 255, 0.16)";
      ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
   }
}

const PROP_FALLBACK: Record<PropKind, () => JSX.Element> = {
   chair: () => <BeachChairPrimitive />,
   cooler: () => <BeachCoolerPrimitive />,
   sandcastle: () => <SandcastlePrimitive />,
   umbrella: () => (
      <mesh position={[0, 1, 0]}>
         <cylinderGeometry args={[0.04, 0.04, 2, 8]} />
         <meshStandardMaterial color="#e2e8f0" />
      </mesh>
   ),
};

function Props({ run }: { run: Run }) {
   const byKind = useMemo(() => {
      const out: Record<PropKind, InstanceSpot[]> = { chair: [], cooler: [], sandcastle: [], umbrella: [] };
      for (const p of run.props) out[p.kind].push({ x: p.x, y: 0, z: p.z, rotY: p.rotY });
      return out;
   }, [run]);
   return (
      <>
         {(Object.keys(byKind) as PropKind[]).map((kind) =>
            byKind[kind].length === 0 ? null : (
               <InstancedModel
                  key={kind}
                  asset={ASSETS[kind]}
                  spots={byKind[kind]}
                  fallback={byKind[kind].map((s, i) => (
                     <group key={i} position={[s.x, 0, s.z]} rotation-y={s.rotY}>
                        {PROP_FALLBACK[kind]()}
                     </group>
                  ))}
               />
            )
         )}
      </>
   );
}

function Decor({ id }: { id: LevelId }) {
   const quality = useQuality();
   const decor = useMemo(() => {
      const d = decorSpots(id);
      return { palms: d.palms.slice(0, scaledCount(d.palms.length, quality.decor)), huts: d.huts, castles: d.castles, coolers: d.coolers };
   }, [id, quality.decor]);
   return (
      <>
         <InstancedModel
            asset={ASSETS.palm}
            spots={decor.palms}
            fallback={
               <Instanced spots={decor.palms} name="palm-stand-in">
                  <coneGeometry args={[0.3, 1, 8]} />
                  <meshStandardMaterial color="#4d7c0f" roughness={0.8} />
               </Instanced>
            }
         />
         <InstancedModel
            asset={ASSETS.decorCastle}
            spots={decor.castles}
            fallback={
               <Instanced spots={decor.castles} name="castle-stand-in">
                  <cylinderGeometry args={[0.5, 0.6, 1, 8]} />
                  <meshStandardMaterial color={COLORS.sandcastle} roughness={0.9} />
               </Instanced>
            }
         />
         <InstancedModel
            asset={ASSETS.decorCooler}
            spots={decor.coolers}
            fallback={
               <Instanced spots={decor.coolers} name="cooler-stand-in">
                  <boxGeometry args={[1, 1, 0.75]} />
                  <meshStandardMaterial color={COLORS.coolerBlue} roughness={0.5} />
               </Instanced>
            }
         />
         <InstancedModel
            asset={ASSETS.hut}
            spots={decor.huts}
            fallback={
               <Instanced spots={decor.huts} name="hut-stand-in">
                  <boxGeometry args={[0.7, 1, 0.9]} />
                  <meshStandardMaterial color={COLORS.hutWood} roughness={0.8} />
               </Instanced>
            }
         />
      </>
   );
}

// ---------- the water: sea floor, shore foam, wake ----------

/** The sea floor under the see-through water: sand at the shore, darker with depth (the depth colour). */
function Seabed({ width, depth }: { width: number; depth: number }) {
   const geometry = useMemo(() => {
      const g = new PlaneGeometry(width, depth, 1, 48);
      g.rotateX(-Math.PI / 2);
      g.translate(0, 0, -depth / 2);
      const pos = g.getAttribute("position");
      const colors = new Float32Array(pos.count * 3);
      const shallow = new Color(COLORS.seabedShallow);
      const deep = new Color(COLORS.seabedDeep);
      const c = new Color();
      for (let i = 0; i < pos.count; i++) {
         const y = seabedY(pos.getZ(i));
         pos.setY(i, y - 0.03);
         c.copy(shallow).lerp(deep, Math.min(1, -y / SEABED_MAX));
         colors[i * 3] = c.r;
         colors[i * 3 + 1] = c.g;
         colors[i * 3 + 2] = c.b;
      }
      g.setAttribute("color", new BufferAttribute(colors, 3));
      g.computeVertexNormals();
      return g;
   }, [width, depth]);
   useEffect(() => () => geometry.dispose(), [geometry]);
   return (
      <mesh geometry={geometry}>
         <meshStandardMaterial vertexColors roughness={0.9} />
      </mesh>
   );
}

/** Broken foam lines on a transparent canvas: the surf washing up the wet sand. */
function drawFoam(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.clearRect(0, 0, w, h);
   let seed = 11;
   const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
   for (let band = 0; band < 3; band++) {
      const y0 = h * (0.25 + band * 0.22);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 - band * 0.22})`;
      ctx.lineWidth = 7 - band * 2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y0 + Math.sin(x * 0.045 + band) * 6 + Math.sin(x * 0.13) * 3);
      ctx.stroke();
   }
   for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + rnd() * 0.5})`;
      ctx.fillRect(rnd() * w, h * (0.2 + rnd() * 0.5), 2 + rnd() * 3, 2);
   }
}

/** Two foam lines that wash up the wet sand and back, half a wave apart. */
function ShoreFoam({ width }: { width: number }) {
   const time = useGameTime();
   const tex = useCanvasTexture(256, 64, drawFoam);
   useMemo(() => {
      tex.wrapS = RepeatWrapping;
      tex.repeat.set(width / 14, 1);
      tex.needsUpdate = true;
   }, [tex, width]);
   const near = useRef<Mesh>(null);
   const far = useRef<Mesh>(null);
   useFrame(() => {
      const t = time.now;
      const pairs: Array<[Mesh | null, number, number]> = [
         [near.current, 0, -0.5],
         [far.current, Math.PI, -1.7],
      ];
      for (const [mesh, off, z0] of pairs) {
         if (!mesh) continue;
         const s = Math.sin(t * 0.9 + off);
         mesh.position.z = z0 + s * 0.55;
         (mesh.material as MeshBasicMaterial).opacity = 0.5 + 0.4 * Math.max(0, s);
      }
      tex.offset.x = (t * 0.01) % 1;
   }, FRAME_PRIORITY.visuals);
   return (
      <>
         <mesh ref={near} rotation-x={-Math.PI / 2} position={[0, WATER_Y + 0.03, -0.5]}>
            <planeGeometry args={[width, 1.6]} />
            <meshBasicMaterial map={tex} transparent depthWrite={false} opacity={0.8} />
         </mesh>
         <mesh ref={far} rotation-x={-Math.PI / 2} position={[0, WATER_Y + 0.025, -1.7]} scale={[1, 1.4, 1]}>
            <planeGeometry args={[width, 1.6]} />
            <meshBasicMaterial map={tex} transparent depthWrite={false} opacity={0.6} />
         </mesh>
      </>
   );
}

/** One foam ring on the water (a stroke's wake, a jet ski's trail, the pickup's splash ring). */
interface Ripple {
   x: number;
   z: number;
   born: number;
   size: number;
   life: number;
}
const RIPPLES = 28;
const RIPPLE_PARTS: InstancePart[] = [
   {
      geometry: new RingGeometry(0.42, 0.56, 24).rotateX(-Math.PI / 2),
      material: new MeshBasicMaterial({ color: "#f8fafc", transparent: true, opacity: 0.42, depthWrite: false }),
   },
];

// ---------- the scene ----------

/** The lifeguard lies down about his chest when he swims (rad: nearly flat, the head a little up). */
const SWIM_PITCH = 1.42;
/** Chest height (m) of the drawn lifeguard: the pivot of that lie-down, held at the water line. */
const PIVOT = LIFEGUARD_LANDMARKS.chestY * LIFEGUARD_SCALE;
/** Seated on the jet ski: the rider's origin under the ski's (the hips land on its seat). */
const SKI_SEAT = 0.62 - LIFEGUARD_LANDMARKS.hipY * LIFEGUARD_SCALE;
/** The rescued swimmer's hop from the arms onto the sand, s. */
const HOP_S = 0.45;
const UP = new Vector3(0, 1, 0);
const Q2 = new Quaternion();
const Q3 = new Quaternion();
const V2 = new Vector3();
const V3 = new Vector3();
const AX = new Vector3(1, 0, 0);
const AY = new Vector3(0, 1, 0);

export default function Scene() {
   const { id, config } = useLevel<BeachLevel>();
   const portrait = useThree((state) => state.size.width < state.size.height);
   const view = useFittedView(viewFor(id, portrait));
   const scene = useThree((state) => state.scene);
   const input = useInput();
   const fx = useFx();
   const pop = useActionPop();
   const touch = useCoarsePointer();
   const time = useGameTime();
   const [run] = useState<Run>(() => createRun(randomSeed(), config, id));
   // camera views (core/camera): an on-foot hero, the stick is camera-relative (inputToWorld in
   // rules.ts), so the chase view only drifts behind the travel. The pivot is the drawn chest: on the
   // sand at PIVOT over the feet, in the water at the water line, seated on the jet ski. The tower and
   // the beach props (run.solids) pull the camera in front of them in the chase / front / free views.
   const cam = useCameraViews({
      slug: "beach-lifeguard",
      subject: "character",
      steering: "camera",
      defaultYaw: view.yaw,
      // the beach fog starts at FOG_NEAR = 22 m (looks.ts fogFor); keep the top view's pivot inside it
      framing: { top: { distance: 18 } },
      target: (o) => {
         const h = run.hero;
         const foot = seabedY(h.z);
         const origin = run.onJetSki ? WATER_Y - 0.16 + SKI_SEAT : foot + (WATER_Y - 0.06 - PIVOT - foot) * swimBlend(h.z);
         o.x = h.x;
         o.y = origin + PIVOT;
         o.z = h.z;
         o.heading = h.yaw;
         o.vx = h.vx;
         o.vz = h.vz;
      },
      solids: (out: AABB[]) => {
         const n = Math.min(out.length, run.solids.length);
         for (let i = 0; i < n; i++) {
            const box = run.solids[i];
            const dst = out[i];
            dst.min.x = box.min.x; dst.min.y = box.min.y; dst.min.z = box.min.z;
            dst.max.x = box.max.x; dst.max.y = box.max.y; dst.max.z = box.max.z;
         }
         return n;
      },
   });
   const hero = useRef<Group>(null);
   const tilt = useRef<Group>(null);
   const handFloat = useRef<Group>(null);
   const tube = useRef<Group>(null);
   const line = useRef<Mesh>(null);
   const carried = useRef<Group>(null);
   const torus = useRef<Group>(null);
   const ski = useRef<Group>(null);
   const gait = useRef({ phase: 0 }).current;
   // visual state: the swim blend, the stroke, the towed swimmer's eased pose, rescued swimmers on the sand
   const look = useRef({
      swim: 0,
      stroke: 0,
      lastStroke: 0,
      lastWake: 0,
      lastFlail: 0,
      carriedPos: new Vector3(),
      carriedQ: new Quaternion(),
      tubePos: new Vector3(0, WATER_Y, 0),
      /** swimmer index -> where it stands on the dry sand once rescued */
      saved: new Map<number, { x: number; y: number; z: number; rotY: number; at: number }>(),
      ripples: Array.from({ length: RIPPLES }, (): Ripple => ({ x: 0, z: 0, born: -99, size: 1, life: 1 })),
      nextRipple: 0,
   }).current;
   const scratch = useMemo(() => createPose(), []);
   const aim = useRef({ x: run.hero.x, y: 0.8, z: run.hero.z - LOOK_AHEAD }).current;
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
   const sand = useCanvasTexture(256, SAND_TEX_H, drawSand);
   useMemo(() => {
      sand.wrapS = RepeatWrapping;
      sand.repeat.set((config.width + 200) / 16, 1);
      sand.needsUpdate = true;
   }, [sand, config.width]);
   const markers = useRef<MarkerTarget[]>([{ x: 0, y: 0.4, z: 0, hidden: true, color: COLORS.accent }]).current;
   // clarity (visual only): a beacon on the swimmer in trouble and one on the dry sand while towing,
   // the hint line, the fail pop and the rescued swimmer's hop from the arms onto the sand
   const goal = useRef<Goal>({ kind: 0, x: 0, z: 0 }).current;
   const swimBeacon = useRef({ x: 0, y: WATER_Y + 0.7, z: 0, hidden: true }).current;
   const shoreBeacon = useRef({ x: 0, y: 0.3, z: SAFE_SAND_Z + 0.3, hidden: true }).current;
   const guideCode = useRef(-1);
   const hop = useRef<TossHandle>(null);
   useEffect(() => {
      guideCode.current = hintCode(run);
      GUIDE.set(beachHint(run, guideCode.current, touch));
      return () => GUIDE.reset();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [run]);

   useEffect(() => {
      fx.warm("sparks", "splash", "puff", "score", "confetti");
   }, [fx]);

   const ripple = (x: number, z: number, size: number, life: number) => {
      const r = look.ripples[look.nextRipple];
      look.nextRipple = (look.nextRipple + 1) % RIPPLES;
      r.x = x;
      r.z = z;
      r.size = size;
      r.life = life;
      r.born = time.now;
   };

   const pose = useHumanoidPose((p) => {
      const h = run.hero;
      const speed = Math.hypot(h.vx, h.vz);
      const amount = Math.min(1, speed / SPEED_SAND);
      // swim once the water is deep enough (looks.ts swimBlend), eased so the dive and the stand-up flow
      const want = run.onJetSki ? 0 : swimBlend(h.z);
      look.swim += (want - look.swim) * Math.min(1, time.delta * 7);
      if (run.onJetSki) {
         sitPose(1, p);
         return;
      }
      if (run.over === "win" && look.swim < 0.5) cheerPose(time.now, p);
      else if (amount < 0.06) idlePose(time.now, p);
      else {
         gait.phase = wrapPhase(gait.phase + gaitPhaseStep(Math.max(0.3, amount), LIFEGUARD_LANDMARKS, LIFEGUARD_SCALE, speed, time.delta, 4));
         walkPose(gait.phase, Math.max(0.3, amount), p);
      }
      // carrying the rescued swimmer up the sand: both forearms forward under the body
      if (run.carrying && look.swim < 0.5 && run.over !== "win") blendPoses(p, carryPose(0.15, scratch), 1, p, POSE_MASK.arms);
      if (look.swim > 0.001) {
         // the front crawl: one arm cycle about every 1.2 s at full swim speed, a slow stroke when still
         look.stroke += time.delta * (2.2 + 1.25 * speed);
         crawlPose(look.stroke, scratch);
         blendPoses(p, scratch, look.swim, p);
      }
   });

   useRunFrame((_state, dt) => {
      const { moveX, moveY, actionPressed } = input.current;
      const store = useArcadeStore.getState();
      const wasCarrying = run.carrying;
      const activeIndex = run.activeSwimmer;
      const active = run.swimmers[activeIndex];
      const ev = step(run, { moveX, moveY, actionPressed, yaw: cam.yaw() }, dt, store.timeLeftMs ?? 0);
      syncStore(run, ev, useArcadeStore);
      const h = run.hero;
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, h.x + h.vx * (LOOK_AHEAD / SPEED_SAND)));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, h.z + h.vz * (LOOK_AHEAD / SPEED_SAND)));
      AT.x = h.x;
      AT.y = 1;
      AT.z = h.z;
      if (ev.alertAlarm) playSfx("alarm", { volume: 0.5 });
      if (ev.jetSkiMount) {
         playSfx("whoosh");
         fx.burst("splash", AT, 10);
      }
      if (ev.grabbed && active) {
         // the pickup: a splash and rings where the swimmer was, "Saved!", and the swimmer is drawn up
         // onto the tube from where it stood (the towed pose eases in from there)
         playSfx("pickup");
         AT.x = active.x;
         AT.y = 0.3;
         AT.z = active.z;
         fx.burst("splash", AT, 22);
         fx.score(AT, "Saved!", { color: COLORS.savedText, size: 0.11 });
         ripple(active.x, active.z, 3.2, 1.3);
         ripple(active.x, active.z, 1.8, 0.9);
         look.carriedPos.set(active.x, WATER_Y - FIT.swimmerSink, active.z);
         look.carriedQ.identity();
         look.tubePos.set(active.x, WATER_Y, active.z);
      }
      if (ev.rescued && wasCarrying) {
         playSfx(ev.won ? "win" : "chime");
         AT.x = h.x;
         AT.y = 1.2;
         AT.z = h.z;
         fx.burst("confetti", AT, 18);
         fx.burst("sparks", AT, 10);
         fx.score(AT, `Rescued! +${ev.score}`, { color: COLORS.accent });
         // the rescued swimmer stands on the dry sand beside the lifeguard, facing the sea
         const rightX = -Math.cos(h.yaw);
         const rightZ = Math.sin(h.yaw);
         const spot = { x: h.x + rightX * 0.9, y: 0, z: Math.max(SAFE_SAND_Z + 0.6, h.z + rightZ * 0.9), rotY: Math.PI + (look.saved.size % 2 ? 0.4 : -0.4), at: time.now };
         look.saved.set(activeIndex, spot);
         // the swimmer hops from the arms onto the sand instead of appearing there
         hop.current?.play(look.carriedPos, spot, { duration: HOP_S, height: 0.7, scaleFrom: 1, scaleTo: 1 });
      }
      if (ev.lifeLost) {
         playSfx("buzz");
         const lostCarry = wasCarrying && !run.carrying;
         AT.x = lostCarry || !active ? h.x : active.x;
         AT.y = 1.4;
         AT.z = lostCarry || !active ? h.z : active.z;
         pop.fail(AT, lostCarry ? "Lost them! -1 life" : "Too late! -1 life", { shake: 0.25 });
      }
      // the hint line changes only with the step
      const code = hintCode(run);
      if (code !== guideCode.current) {
         guideCode.current = code;
         GUIDE.set(beachHint(run, code, touch));
      }
   });

   useFrame(() => {
      const h = run.hero;
      const now = time.now;
      const k = look.swim;
      const fwdX = Math.sin(h.yaw);
      const fwdZ = Math.cos(h.yaw);
      const speed = Math.hypot(h.vx, h.vz);
      const dt = Math.min(0.1, time.delta);
      const skiY = WATER_Y - 0.16 + Math.sin(now * 2.2) * 0.04;
      // the body: on foot it stands on the sea floor (wading sinks it), swimming it lies down with the chest
      // at the water line, on the jet ski it sits on the seat
      if (hero.current) {
         const foot = seabedY(h.z);
         const swimY = WATER_Y - 0.06 - PIVOT + Math.sin(look.stroke * 2) * 0.03;
         const y = run.onJetSki ? skiY + SKI_SEAT : foot + (swimY - foot) * k;
         hero.current.position.set(h.x, y, h.z);
         hero.current.rotation.y = h.yaw;
      }
      if (tilt.current) tilt.current.rotation.x = SWIM_PITCH * k;
      if (ski.current) {
         ski.current.position.set(run.jetSki.x, skiY, run.jetSki.z);
         ski.current.rotation.y = run.onJetSki ? h.yaw : 0;
      }

      // splashes on the hand entries, a wake behind the kick, a trail behind the jet ski
      if (!run.over) {
         const entry = Math.floor(look.stroke / Math.PI);
         if (k > 0.6 && entry !== Math.floor(look.lastStroke / Math.PI)) {
            const side = entry % 2 ? -1 : 1;
            AT.x = h.x + fwdX * 1.0 + Math.cos(h.yaw) * 0.3 * side;
            AT.y = WATER_Y + 0.1;
            AT.z = h.z + fwdZ * 1.0 - Math.sin(h.yaw) * 0.3 * side;
            fx.burst("splash", AT, 5);
         }
         const wakeEvery = run.onJetSki ? 0.08 : 0.34;
         if ((run.onJetSki || k > 0.5) && speed > 0.6 && now - look.lastWake > wakeEvery) {
            look.lastWake = now;
            const back = run.onJetSki ? 1.2 : 1.1;
            const jitter = Math.sin(now * 13.7) * 0.25;
            ripple(h.x - fwdX * back + fwdZ * jitter, h.z - fwdZ * back - fwdX * jitter, run.onJetSki ? 1.6 : 0.9 + 0.3 * Math.abs(jitter), run.onJetSki ? 1.4 : 1.0);
            if (run.onJetSki) {
               AT.x = h.x - fwdX * 1.3;
               AT.y = WATER_Y + 0.2;
               AT.z = h.z - fwdZ * 1.3;
               fx.burst("splash", AT, 3);
            }
         }
      }
      look.lastStroke = look.stroke;

      // the swimmer in trouble splashes about
      const s = run.swimmers[run.activeSwimmer];
      const alert = !!s && !s.saved && !run.carrying && !run.over;
      if (alert && now - look.lastFlail > 0.55) {
         look.lastFlail = now;
         AT.x = s.x;
         AT.y = WATER_Y + 0.4;
         AT.z = s.z;
         fx.burst("splash", AT, 4);
         ripple(s.x, s.z, 1.2, 1.0);
      }

      // the towed / carried swimmer: on its back on the tube behind the lifeguard in the water, across his
      // arms on the sand; eased from where it was, so the pickup and the step out of the water are animated
      const body = carried.current;
      if (body) {
         body.visible = run.carrying;
         if (run.carrying) {
            if (k >= 0.5) {
               // head towards the lifeguard, face up, at the water line
               Q2.setFromAxisAngle(AY, h.yaw + Math.PI);
               Q3.setFromAxisAngle(AX, -Math.PI / 2);
               Q2.multiply(Q3);
               V2.set(h.x - fwdX * 2.75, WATER_Y + 0.1 + Math.sin(now * 2.6) * 0.03, h.z - fwdZ * 2.75);
            } else {
               // a cradle carry: lying across the forearms at chest height, the head on the lifeguard's left
               Q2.setFromAxisAngle(AY, h.yaw - Math.PI / 2);
               Q3.setFromAxisAngle(AX, -Math.PI / 2);
               Q2.multiply(Q3);
               const rightX = -Math.cos(h.yaw);
               const rightZ = Math.sin(h.yaw);
               const base = hero.current ? hero.current.position.y : 0;
               V2.set(h.x + fwdX * 0.42 + rightX * 0.8, base + 1.0, h.z + fwdZ * 0.42 + rightZ * 0.8);
            }
            const e = 1 - Math.exp(-9 * dt);
            look.carriedPos.lerp(V2, e);
            look.carriedQ.slerp(Q2, e);
            body.position.copy(look.carriedPos);
            body.quaternion.copy(look.carriedQ);
         }
      }

      // the rescue tube: in the hand on the sand, trailing on its line while swimming, under the towed swimmer
      const towing = run.carrying && k >= 0.5;
      const trailing = !run.carrying && k >= 0.5 && !run.onJetSki;
      if (handFloat.current) handFloat.current.visible = !run.carrying && k < 0.5 && !run.onJetSki;
      if (tube.current) {
         tube.current.visible = towing || trailing;
         if (towing) V2.set(h.x - fwdX * 1.45, WATER_Y + 0.02, h.z - fwdZ * 1.45);
         else V2.set(h.x - fwdX * 1.6, WATER_Y + 0.02 + Math.sin(now * 3) * 0.02, h.z - fwdZ * 1.6);
         look.tubePos.lerp(V2, 1 - Math.exp(-10 * dt));
         tube.current.position.copy(look.tubePos);
         tube.current.rotation.y = h.yaw + (towing ? Math.PI / 2 : 0);
      }
      if (line.current) {
         line.current.visible = towing || trailing;
         // from the lifeguard's hip (behind his chest when he swims) to the tube
         V2.set(h.x - fwdX * 0.7, WATER_Y + 0.05, h.z - fwdZ * 0.7);
         V3.copy(look.tubePos).sub(V2);
         const len = V3.length();
         line.current.position.copy(V2).addScaledVector(V3, 0.5);
         if (len > 1e-4) line.current.quaternion.setFromUnitVectors(UP, V3.multiplyScalar(1 / len));
         line.current.scale.set(1, Math.max(0.01, len), 1);
      }

      if (torus.current) {
         torus.current.visible = alert;
         if (s) torus.current.position.set(s.x, WATER_Y + 0.14, s.z);
         const kk = 1 + Math.sin(now * 6) * 0.06;
         torus.current.scale.set(kk, 1, kk);
      }
      nextGoal(run, goal);
      swimBeacon.x = goal.x;
      swimBeacon.z = goal.z;
      swimBeacon.hidden = goal.kind !== 1;
      shoreBeacon.x = goal.x;
      shoreBeacon.hidden = goal.kind !== 2;
      const m = markers[0];
      if (run.carrying) {
         m.x = h.x;
         m.z = SAFE_SAND_Z + 0.3;
         m.hidden = false;
      } else if (alert && s) {
         m.x = s.x;
         m.z = s.z;
         m.hidden = false;
      } else m.hidden = true;
   }, FRAME_PRIORITY.visuals);

   // swimmers wait in the water to the chest, bobbing (the one in trouble rocks harder); the one being
   // rescued is drawn by its own model; rescued swimmers stand on the dry sand, bouncing a little
   const placeSwimmer = (i: number, m: Matrix4) => {
      const s = run.swimmers[i];
      if (!s || (run.carrying && i === run.activeSwimmer)) return false;
      if (s.saved) {
         const spot = look.saved.get(i);
         if (!spot || time.now - spot.at < HOP_S) return false;
         E.set(0, spot.rotY, 0);
         Q.setFromEuler(E);
         V.set(spot.x, Math.max(0, Math.sin(time.now * 4 + i)) * 0.08, spot.z);
         S.set(1, 1, 1);
         m.compose(V, Q, S);
         return;
      }
      hover(time.now + i * 1.3, 0.06, BOB);
      const trouble = i === run.activeSwimmer;
      const flail = trouble ? Math.sin(time.now * 7 + i) * 0.14 : 0;
      E.set(flail, Math.sin(time.now * 0.6 + i) * 0.3, BOB.roll + (trouble ? Math.sin(time.now * 5.3) * 0.1 : 0));
      Q.setFromEuler(E);
      V.set(s.x, WATER_Y - FIT.swimmerSink + BOB.y, s.z);
      S.set(1, 1, 1);
      m.compose(V, Q, S);
   };

   const placeRipple = (i: number, m: Matrix4) => {
      const r = look.ripples[i];
      const age = (time.now - r.born) / r.life;
      if (age < 0 || age >= 1) return false;
      // widens to `size` and thins out as it fades just under the surface
      const sc = r.size * (0.35 + 0.65 * Math.sqrt(age));
      V.set(r.x, WATER_Y + 0.04 - age * 0.05, r.z);
      Q.identity();
      S.set(sc, 1, sc * (1 - 0.25 * age));
      m.compose(V, Q, S);
   };

   const sandW = config.width + 80;
   const seaDepth = config.water + 90;
   return (
      <>
         <CameraRig camera={{ position: view.offset, fov: FOV, lookAt: [aim.x, aim.y, aim.z] }} follow={aim} bounds={bounds} offset={view.offset} shift={view.shift} damping={DAMPING} />
         <SkyDome top={config.lighting === "sunset" ? "#7c2d12" : "#0ea5e9"} bottom={config.background} />
         <TargetMarkers targets={markers} />
         <TargetBeacon target={swimBeacon} variant="pick" color={COLORS.accent} radius={1.1} height={1.0} ground={WATER_Y + 0.12} label="GRAB" />
         <TargetBeacon target={shoreBeacon} variant="drop-here" radius={1.6} height={1.2} label="SAFE" />
         <Toss ref={hop} spin={0}>
            <Model asset={ASSETS.swimmer} fallback={<SwimmerFigure />} />
         </Toss>

         {/* sand to the horizon behind the beach and past both ends, wet sand along the shore */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, SAND_DEPTH + 60]}>
            <planeGeometry args={[sandW + 120, 120]} />
            <meshStandardMaterial color={COLORS.sandFar} roughness={0.95} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, SAND_DEPTH / 2]}>
            <planeGeometry args={[config.width + 200, SAND_DEPTH]} />
            <meshStandardMaterial map={sand} roughness={0.92} />
         </mesh>
         <Seabed width={sandW + 120} depth={seaDepth} />
         <Water
            size={[sandW + 120, seaDepth]}
            position={[0, WATER_Y, -seaDepth / 2]}
            color={COLORS.waterShallow}
            deep={COLORS.waterDeep}
            foam={COLORS.waterFoam}
            amplitude={id === 5 ? 0.24 : 0.14}
            foamEdge={0.012}
            opacity={0.8}
         />
         <ShoreFoam width={sandW + 120} />
         <DynamicInstanced count={RIPPLES} update={placeRipple} parts={RIPPLE_PARTS} name="ripples" />

         <Model asset={ASSETS.tower} position={[TOWER.x, 0, TOWER.z]} rotation-y={Math.PI} fallback={<TowerPrimitive />} />
         <group position={[TOWER.x + 0.95, 0.9, TOWER.z - 0.2]} rotation={[0, 0, Math.PI / 2]}>
            <Model asset={ASSETS.rescueFloat} fallback={<RescueFloatPrimitive />} />
         </group>

         <group ref={hero}>
            <group ref={tilt} position-y={PIVOT}>
               <group position-y={-PIVOT}>
                  <HumanoidModel
                     asset={ASSETS.lifeguard}
                     pose={pose}
                     fallback={<LifeguardFigure />}
                     attach={{
                        // the tube in the right hand while he runs (-x = towards the fingertips)
                        handR: (
                           <group ref={handFloat} position={[-0.42, -0.08, 0]} rotation-y={Math.PI / 2}>
                              <Model asset={ASSETS.rescueFloat} fallback={<RescueFloatPrimitive />} />
                           </group>
                        ),
                     }}
                  />
               </group>
            </group>
         </group>
         <group ref={tube} visible={false}>
            <Model asset={ASSETS.rescueFloat} fallback={<RescueFloatPrimitive />} />
         </group>
         <mesh ref={line} visible={false}>
            <cylinderGeometry args={[0.018, 0.018, 1, 6]} />
            <meshStandardMaterial color={COLORS.towLine} roughness={0.6} />
         </mesh>
         <group ref={carried} visible={false}>
            <Model asset={ASSETS.swimmer} fallback={<SwimmerFigure />} />
         </group>

         <DynamicInstancedModel asset={ASSETS.swimmer} count={run.swimmers.length} update={placeSwimmer} name="swimmers" />
         <group ref={torus}>
            <AlertTorusMarker />
         </group>
         {config.jetSki && (
            <group ref={ski}>
               <Model asset={ASSETS.jetSki} fallback={<JetSkiPrimitive />} />
            </group>
         )}

         <Props run={run} />
         <Decor id={id} />
      </>
   );
}
