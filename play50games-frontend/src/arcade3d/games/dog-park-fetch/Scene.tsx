"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, BufferGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Fog, MeshStandardMaterial, RepeatWrapping, SphereGeometry, Vector3, type Group } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import type { AABB } from "@/arcade3d/core/collision";
import { playSfx } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { SkyDome } from "@/arcade3d/core/env";
import { Water } from "@/arcade3d/core/env/Water";
import { Toss, useActionPop, useFx, type TossHandle } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { hop as hopOffset, type BodyOffset } from "@/arcade3d/core/motion";
import { QuadrupedModel, useQuadrupedPose } from "@/arcade3d/core/rig/QuadrupedModel";
import { blendQuadrupedPoses, createQuadrupedPose, quadrupedGait, quadrupedIdle, quadrupedLeap, quadrupedPhaseStep, quadrupedSit } from "@/arcade3d/core/rig/quadrupedPoses";
import { useCameraZoom } from "@/arcade3d/core/useCameraZoom";
import { TargetBeacon } from "@/arcade3d/core/hud";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud/TargetMarkers";
import { useCoarsePointer } from "@/arcade3d/core/TouchControls";
import { BlobShadow, Instanced, useCanvasTexture, type InstanceSpot } from "@/arcade3d/core/render";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS, DOG_LANDMARKS, FIT } from "./assets";
import { GUIDE, dogHint, hintCode, nextGoal, type Goal } from "./guide";
import type { DogLevel } from "./levels";
import { BENCH_R, BLANKET_R, FOUNTAIN_R, LEAP_S, MAX_SPEED, STUN_S, TREE_R, blanketOf, createRun, frame, leapHeight, propsOf, toyXZ, type Kind, type Run } from "./rules";
import { COLORS, DAMPING, FOV, LOOK_AHEAD, ZOOM, PALETTES, aimBounds, blanketSpot, decorSpots, drawBlanket, fenceSpots, fogFor, lookAtFor, paintGrass, propSpots, railSpots, sandSpots, stripeSpots, viewFor } from "./looks";
import { BallPrimitive, DogFigure, FrisbeePrimitive, MowerPrimitive, OwnerFigure, StickPrimitive } from "./Primitives";

const BODY: BodyOffset = { y: 0, roll: 0, yaw: 0, squash: 1 };
const TOY = { x: 0, z: 0 };
const MARK = new Vector3();
/** Each toy rests with its centre this high (about its fitted half height). */
const TOY_REST: Record<Kind, number> = { ball: FIT.ball / 2, stick: 0.05, frisbee: 0.04 };
const TOY_HEIGHT = 0.12;
const OWNER_HOP_S = 0.45;
const BENCH_SIZE = { sx: 1.8, sy: 0.5, sz: 0.8 };
const DOG_SCALE = ASSETS.dog.scale ?? 1;
/** standing still this long (s) with nothing to fetch, the dog sits */
const SIT_AFTER_S = 1.2;
const smooth01 = (a: number, b: number, x: number) => {
   const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
   return t * t * (3 - 2 * t);
};
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Spots at the feet (y = 0), for the GLB draws. */
function feet(spots: readonly InstanceSpot[]): InstanceSpot[] {
   return spots.map((s) => ({ x: s.x, y: 0, z: s.z }));
}

function LevelScene() {
   const { id, config } = useLevel<DogLevel>();
   const portrait = useThree((state) => state.size.width < state.size.height);
   const view = useFittedView(viewFor(id, portrait));
   const scene = useThree((state) => state.scene);
   const input = useInput();
   const fx = useFx();
   const pop = useActionPop();
   const touch = useCoarsePointer();
   const time = useGameTime();
   const [run] = useState<Run>(() => createRun(randomSeed(), config));
   const aim = useRef({ x: run.dog.x, y: 0.4, z: run.dog.z + LOOK_AHEAD }).current;
   const dogGroup = useRef<Group>(null);
   const dogBody = useRef<Group>(null);
   const owner = useRef<Group>(null);
   const toyShadow = useRef<Group>(null);
   const toys = useRef<Record<string, Group | null>>({ ball: null, stick: null, frisbee: null });
   const mowerRefs = useRef<(Group | null)[]>([]);
   const anim = useRef({ phase: 0, yaw: run.dog.yaw, turn: 0, still: 0, sit: 0 });
   const idlePose = useMemo(createQuadrupedPose, []);
   const gaitPose = useMemo(createQuadrupedPose, []);
   const sitPose = useMemo(createQuadrupedPose, []);
   const mouth = useRef<Record<string, Group | null>>({ ball: null, stick: null, frisbee: null });
   const dogFloor = useRef<Group>(null);
   // clarity (visual only): beacons on the toy to fetch, on the ring where a thrown toy lands and on the
   // blanket while carrying; the hint line; fail pops; the returned toy flies from the dog's mouth to the owner
   const goal = useRef<Goal>({ kind: 0, x: 0, z: 0 }).current;
   const toyBeacon = useRef({ x: 0, y: 0.1, z: 0, hidden: true }).current;
   const landBeacon = useRef({ x: 0, y: 0.1, z: 0, hidden: true }).current;
   const homeBeacon = useRef({ x: 0, y: 0.1, z: 0, hidden: true }).current;
   const guideCode = useRef(-1);
   const carriedKind = useRef<Kind>("ball");
   const handsAt = useRef({ x: 0, y: 1.0, z: 0 }).current;
   const tossBall = useRef<TossHandle>(null);
   const tossStick = useRef<TossHandle>(null);
   const tossFrisbee = useRef<TossHandle>(null);
   const zoom = useCameraZoom({ min: ZOOM.min, max: ZOOM.max });
   const palette = PALETTES[id];
   const drawLawn = useMemo(() => {
      const p = palette;
      return (ctx: CanvasRenderingContext2D, w: number, h: number) => paintGrass(p, ctx, w, h);
   }, [palette]);
   const grass = useCanvasTexture(256, 256, drawLawn);
   const blanketMap = useCanvasTexture(256, 256, drawBlanket);
   useMemo(() => {
      grass.wrapS = RepeatWrapping;
      grass.wrapT = RepeatWrapping;
      grass.repeat.set(config.width / 4, config.depth / 4);
      grass.needsUpdate = true;
   }, [grass, config]);
   const ownerHopAt = useRef(-10);
   const bounds = useMemo(() => aimBounds(config, portrait), [config, portrait]);
   const decor = useMemo(() => decorSpots(id), [id]);
   const look = useMemo(() => lookAtFor(config), [config]);
   const blanket = useMemo(() => blanketOf(config), [config]);
   const props = useMemo(() => propsOf(config), [config]);
   const fence = useMemo(() => fenceSpots(config), [config]);
   const rails = useMemo(() => railSpots(config), [config]);
   const stripes = useMemo(() => stripeSpots(config), [config]);
   const sand = useMemo(() => sandSpots(config), [config]);
   const pad = useMemo(() => [blanketSpot(config)], [config]);
   const fountain = useMemo(() => propSpots(props.filter((p) => p.r === FOUNTAIN_R)), [props]);
   const benches = useMemo(() => propSpots(props.filter((p) => p.r === BENCH_R)).map((s) => ({ ...s, ...BENCH_SIZE, y: BENCH_SIZE.sy / 2 })), [props]);
   const bushes = useMemo(() => propSpots(props.filter((p) => p.r === TREE_R)), [props]);
   const fountainFeet = useMemo(() => feet(fountain), [fountain]);
   const benchFeet = useMemo(() => feet(benches), [benches]);
   // the in-lawn bushes are fitted to 1 m wide: the spot's scale is the solid circle's diameter
   const bushFeet = useMemo(() => bushes.map((b) => ({ x: b.x, y: 0, z: b.z, scale: TREE_R * 2 })), [bushes]);
   // per-level set pieces: lamps, umbrellas and stumps get a pole and a head / canopy from one spot
   const lampPoles = useMemo(() => decor.lamps.map((s) => { const k = s.scale ?? 1; return { x: s.x, y: 1.3 * k, z: s.z, sx: 0.09 * k, sy: 2.6 * k, sz: 0.09 * k }; }), [decor]);
   const lampHeads = useMemo(() => decor.lamps.map((s) => { const k = s.scale ?? 1; return { x: s.x, y: 2.66 * k, z: s.z, scale: 0.24 * k }; }), [decor]);
   const umbrellaPoles = useMemo(() => [...decor.umbrellasA, ...decor.umbrellasB].map((s) => { const k = s.scale ?? 1; return { x: s.x, y: k, z: s.z, sx: 0.05 * k, sy: 2 * k, sz: 0.05 * k }; }), [decor]);
   const umbrellaTopsA = useMemo(() => decor.umbrellasA.map((s) => { const k = s.scale ?? 1; return { x: s.x, y: 2.1 * k, z: s.z, rotY: s.rotY, sx: 2 * k, sy: 0.55 * k, sz: 2 * k }; }), [decor]);
   const umbrellaTopsB = useMemo(() => decor.umbrellasB.map((s) => { const k = s.scale ?? 1; return { x: s.x, y: 2.1 * k, z: s.z, rotY: s.rotY, sx: 2 * k, sy: 0.55 * k, sz: 2 * k }; }), [decor]);
   const stumps = useMemo(() => decor.stumps.map((s) => { const k = s.scale ?? 1; return { x: s.x, y: 0.25 * k, z: s.z, rotY: s.rotY, sx: 0.7 * k, sy: 0.5 * k, sz: 0.7 * k }; }), [decor]);
   const rocks = useMemo(() => decor.rocks.map((s) => { const k = s.scale ?? 1; return { x: s.x, y: 0.16 * k, z: s.z, rotY: s.rotY, sx: 1.3 * k, sy: 0.55 * k, sz: 0.9 * k }; }), [decor]);
   const targets = useMemo<MarkerTarget[]>(() => [{ x: 0, y: 0, z: 0, hidden: true }], []);
   // camera views (core/camera): the rules get the drawn camera's yaw; the props and the picket
   // fence pull the chase / front / free camera in front of them (the top view looks over them).
   // The fog (fogFor, near >= 18 m) stays past the top view's 15 m, so no override is needed.
   const cam = useCameraViews({
      slug: "dog-park-fetch",
      subject: "character",
      steering: "camera",
      defaultYaw: view.yaw,
      target: (o) => {
         const d = run.dog;
         o.x = d.x;
         o.y = 0.45;
         o.z = d.z;
         o.heading = d.yaw;
         o.vx = d.vx;
         o.vz = d.vz;
      },
      solids: (out: AABB[]) => {
         let n = 0;
         const put = (x: number, z: number, hx: number, hz: number, h: number) => {
            if (n >= out.length) return;
            const b = out[n++];
            b.min.x = x - hx;
            b.max.x = x + hx;
            b.min.y = 0;
            b.max.y = h;
            b.min.z = z - hz;
            b.max.z = z + hz;
         };
         for (const p of props) {
            const h = p.r === FOUNTAIN_R ? 1.6 : p.r === BENCH_R ? 0.55 : 0.6;
            put(p.x, p.z, p.r, p.r, h);
         }
         const hw = config.width / 2;
         const hd = config.depth / 2;
         put(0, -hd, hw, 0.05, 1.1);
         // no south fence solid: the dog starts at the blanket 1.8 m from it, so a camera clipped to it
         // (min 2.2 m out) would sit right at the owner; the pickets are low and the camera looks over them
         put(-hw, 0, 0.05, hd, 1.1);
         put(hw, 0, 0.05, hd, 1.1);
         return n;
      },
   });

   // Unit geometry and flat materials, built once and disposed with the scene.
   const unitBox = useMemo(() => new BoxGeometry(1, 1, 1), []);
   const unitCylinder = useMemo(() => new CylinderGeometry(0.5, 0.5, 1, 24), []);
   const unitSphere = useMemo(() => new SphereGeometry(0.5, 14, 10), []);
   const unitCone = useMemo(() => new CylinderGeometry(0.04, 0.5, 1, 10), []);
   const trunkGeo = useMemo(() => new CylinderGeometry(0.12, 0.16, 1, 8), []);
   // a bunting pennant: a downward triangle in the x-y plane, hung from its top edge
   const unitTri = useMemo(() => {
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, -1, 0], 3));
      g.setAttribute("normal", new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
      return g;
   }, []);
   const fenceMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.fence, roughness: 0.7 }), []);
   const stripeMat = useMemo(() => new MeshStandardMaterial({ color: palette.stripe, roughness: 0.95, transparent: true, opacity: 0.35, depthWrite: false }), [palette]);
   const sandMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.sand, roughness: 0.95 }), []);
   const padMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.blanket, emissive: COLORS.blanketEdge, emissiveIntensity: 0.12, roughness: 0.8 }), []);
   const fountainMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.fountain, roughness: 0.6 }), []);
   const benchMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.bench, roughness: 0.7 }), []);
   const trunkMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.trunk, roughness: 0.9 }), []);
   const canopyMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.tree, roughness: 0.9 }), []);
   // the per-level set pieces (looks.ts decorSpots), all code-built and instanced
   const lampMat = useMemo(() => new MeshStandardMaterial({ color: "#334155", roughness: 0.6 }), []);
   const lampHeadMat = useMemo(() => new MeshStandardMaterial({ color: "#fef9c3", emissive: "#fde047", emissiveIntensity: 0.7, roughness: 0.4 }), []);
   const blockMat = useMemo(() => new MeshStandardMaterial({ color: "#94a3b8", roughness: 0.85 }), []);
   const rockMat = useMemo(() => new MeshStandardMaterial({ color: "#a8a29e", roughness: 0.95 }), []);
   const poleMat = useMemo(() => new MeshStandardMaterial({ color: "#f8fafc", roughness: 0.6 }), []);
   const canopyAMat = useMemo(() => new MeshStandardMaterial({ color: "#e11d48", roughness: 0.7 }), []);
   const canopyBMat = useMemo(() => new MeshStandardMaterial({ color: "#0ea5e9", roughness: 0.7 }), []);
   const flagLineMat = useMemo(() => new MeshStandardMaterial({ color: "#57534e", roughness: 0.8 }), []);
   const flagAMat = useMemo(() => new MeshStandardMaterial({ color: "#e11d48", roughness: 0.7, side: DoubleSide }), []);
   const flagBMat = useMemo(() => new MeshStandardMaterial({ color: "#f59e0b", roughness: 0.7, side: DoubleSide }), []);
   const balloonAMat = useMemo(() => new MeshStandardMaterial({ color: "#ef4444", roughness: 0.35 }), []);
   const balloonBMat = useMemo(() => new MeshStandardMaterial({ color: "#fbbf24", roughness: 0.35 }), []);
   const disposables = useMemo(
      () => [unitBox, unitCylinder, unitSphere, unitCone, unitTri, trunkGeo, fenceMat, stripeMat, sandMat, padMat, fountainMat, benchMat, trunkMat, canopyMat, lampMat, lampHeadMat, blockMat, rockMat, poleMat, canopyAMat, canopyBMat, flagLineMat, flagAMat, flagBMat, balloonAMat, balloonBMat],
      [unitBox, unitCylinder, unitSphere, unitCone, unitTri, trunkGeo, fenceMat, stripeMat, sandMat, padMat, fountainMat, benchMat, trunkMat, canopyMat, lampMat, lampHeadMat, blockMat, rockMat, poleMat, canopyAMat, canopyBMat, flagLineMat, flagAMat, flagBMat, balloonAMat, balloonBMat],
   );
   useEffect(() => () => {
      for (const d of disposables) d.dispose();
   }, [disposables]);

   useEffect(() => {
      fx.warm("sparkle", "confetti", "puff", "score");
   }, [fx]);

   useEffect(() => {
      guideCode.current = hintCode(run);
      GUIDE.set(dogHint(run, guideCode.current, touch));
      return () => GUIDE.reset();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [run]);

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

   useRunFrame((_state, dt) => {
      const { moveX, moveY, jumpPressed } = input.current;
      const ev = frame(run, { moveX, moveY, jumpPressed, yaw: cam.yaw() }, dt, useArcadeStore);
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, run.dog.x + Math.sin(run.dog.yaw) * LOOK_AHEAD));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, run.dog.z + Math.cos(run.dog.yaw) * LOOK_AHEAD));
      if (ev.leap) playSfx("jump");
      if (ev.thrown >= 0) {
         ownerHopAt.current = run.time;
         playSfx("whoosh");
      }
      if (ev.landed && run.active) {
         toyXZ(run.active, TOY);
         MARK.set(TOY.x, 0.2, TOY.z);
         fx.burst("puff", MARK, 6);
         playSfx("thud");
      }
      if (ev.caught) {
         MARK.set(run.dog.x, 1.0, run.dog.z);
         fx.burst("sparkle", MARK, 12);
         fx.score(MARK, "+60");
         playSfx("chime");
      }
      if (ev.returned) {
         // the toy flies from the dog's mouth into the owner's hands instead of vanishing
         handsAt.x = run.blanket.x + OWNER_SIDE;
         handsAt.z = run.blanket.z + 0.3;
         const toss = carriedKind.current === "ball" ? tossBall : carriedKind.current === "stick" ? tossStick : tossFrisbee;
         toss.current?.play({ x: run.dog.x, y: 0.5, z: run.dog.z }, handsAt, { duration: 0.45, height: 0.9, scaleFrom: 1, scaleTo: 0.8 });
         MARK.set(run.blanket.x, 0.8, run.blanket.z);
         fx.burst("confetti", MARK, 18);
         fx.score(MARK, `+${ev.score}`);
         playSfx("pickup");
      }
      if (ev.fetched) {
         playSfx("click");
         MARK.set(run.blanket.x, 1.2, run.blanket.z);
         pop.fail(MARK, `Too slow! Owner took it ${run.timedOut}/2`, { shake: 0 });
      }
      if (ev.mowerHit) {
         playSfx("hit");
         MARK.set(run.dog.x, 1.2, run.dog.z);
         pop.fail(MARK, ev.dropped ? "Mower! Toy dropped" : "Mower!", { shake: 0.3 });
      }
      // the hint line changes only with the step
      const code = hintCode(run);
      if (code !== guideCode.current) {
         guideCode.current = code;
         GUIDE.set(dogHint(run, code, touch));
      }
      if (ev.won) playSfx("win");
   });

   // the dog's pose: walk -> trot -> gallop by speed with planted paws (core quadruped rig), a leap
   // for the jump, idle when still and sitting when it waits; knocked over by a mower it sits dazed
   const pose = useQuadrupedPose((p) => {
      const dog = run.dog;
      const a = anim.current;
      const dt = time.delta;
      const speed = Math.hypot(dog.vx, dog.vz);
      const rate = dt > 0 ? wrapAngle(dog.yaw - a.yaw) / dt : 0;
      a.yaw = dog.yaw;
      a.turn += (Math.max(-1, Math.min(1, rate / 5)) - a.turn) * Math.min(1, dt * 8);
      if (dog.leap > 0) {
         quadrupedLeap(1 - dog.leap / LEAP_S, DOG_LANDMARKS, p);
         return;
      }
      a.still = speed < 0.2 ? a.still + dt : 0;
      const wantSit = dog.stun > 0 || a.still > SIT_AFTER_S ? 1 : 0;
      a.sit += (wantSit - a.sit) * Math.min(1, dt * (wantSit ? 4 : 10));
      const s01 = Math.min(1, speed / MAX_SPEED);
      a.phase = quadrupedPhaseStep(a.phase, speed * dt, s01, DOG_LANDMARKS, DOG_SCALE, dt, 5.5);
      quadrupedGait(a.phase, s01, DOG_LANDMARKS, gaitPose, a.turn);
      quadrupedIdle(time.now, DOG_LANDMARKS, idlePose);
      blendQuadrupedPoses(idlePose, gaitPose, smooth01(0.05, 0.6, speed), p);
      if (a.sit > 0.01) {
         quadrupedSit(1, time.now * (dog.stun > 0 ? 6 : 1), DOG_LANDMARKS, sitPose);
         blendQuadrupedPoses(p, sitPose, a.sit, p);
      }
   });

   useFrame(() => {
      const dog = run.dog;
      const group = dogGroup.current;
      if (group) {
         group.position.set(dog.x, dog.leap > 0 ? leapHeight(LEAP_S - dog.leap) : 0, dog.z);
         group.rotation.set(0, dog.yaw, 0);
      }
      const ring = dogFloor.current;
      if (ring) ring.position.set(dog.x, 0, dog.z);
      const body = dogBody.current;
      if (body) body.visible = !(dog.mercy > 0 && dog.stun < STUN_S * 0.5 && Math.floor(time.now * 12) % 2 === 0);
      const own = owner.current;
      if (own) {
         const t = run.time - ownerHopAt.current;
         const lift = t >= 0 && t < OWNER_HOP_S ? hopOffset(Math.PI * (t / OWNER_HOP_S), 0.15, BODY).y : 0;
         own.position.set(run.blanket.x + OWNER_SIDE, lift, run.blanket.z + 0.3);
         own.rotation.set(0, Math.PI, 0);
      }
      const th = run.active;
      const carried = th?.state === "carried";
      if (th && carried) carriedKind.current = th.kind;
      nextGoal(run, goal);
      toyBeacon.hidden = goal.kind !== 1;
      toyBeacon.x = goal.x;
      toyBeacon.z = goal.z;
      landBeacon.hidden = goal.kind !== 3;
      landBeacon.x = goal.x;
      landBeacon.z = goal.z;
      homeBeacon.hidden = goal.kind !== 2;
      homeBeacon.x = goal.x;
      homeBeacon.z = goal.z;
      for (const kind of ["ball", "stick", "frisbee"] as const) {
         const g = toys.current[kind];
         if (!g) continue;
         const show = !!th && th.kind === kind;
         g.visible = show;
         if (!show || !th) continue;
         if (carried) {
            // carried in the mouth: the copy on the dog's head bone shows instead
            g.visible = false;
         } else {
            const xz = toyXZ(th, TOY);
            const f = Math.min(1, th.t / th.flight);
            const h = th.state === "flying" ? 4 * th.apex * f * (1 - f) : 0;
            g.position.set(xz.x, TOY_REST[kind] + h, xz.z);
         }
         g.rotation.set(0, th.index * 0.7 + time.now * 2, 0);
      }
      for (const kind of ["ball", "stick", "frisbee"] as const) {
         const m = mouth.current[kind];
         if (m) m.visible = !!th && carried && th.kind === kind;
      }
      // a shadow on the grass under a toy in the air: where it will come down, and when
      const shadow = toyShadow.current;
      if (shadow) {
         shadow.visible = !!th && th.state === "flying";
         if (shadow.visible && th) {
            const xz = toyXZ(th, TOY);
            shadow.position.set(xz.x, 0.02, xz.z);
            shadow.scale.setScalar(0.6 + 0.5 * Math.min(1, th.t / th.flight));
         }
      }
      for (let i = 0; i < run.mowers.length; i++) {
         const g = mowerRefs.current[i];
         const m = run.mowers[i];
         if (!g) continue;
         g.position.set(m.agent.x, 0, m.agent.z);
         g.rotation.set(0, m.agent.yaw, 0);
      }
      // One arrow: on the toy while it is out, on the blanket while it is carried.
      const marker = targets[0];
      marker.hidden = !th;
      if (th) {
         if (carried) {
            marker.x = run.blanket.x;
            marker.z = run.blanket.z;
            marker.y = 0.6;
         } else {
            const xz = toyXZ(th, TOY);
            marker.x = xz.x;
            marker.z = xz.z;
            marker.y = TOY_HEIGHT;
         }
      }
   }, FRAME_PRIORITY.visuals);

   return (
      <>
         <CameraRig
            camera={{ position: view.offset, fov: FOV, lookAt: look }}
            follow={aim}
            bounds={bounds}
            offset={view.offset}
            shift={view.shift}
            damping={DAMPING}
            zoom={zoom}
         />
         <SkyDome top={palette.sky} bottom={config.background} />
         {/* the park grass runs out under the fog; the fenced lawn is a brighter mown rectangle on it */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}>
            <circleGeometry args={[160, 48]} />
            <meshStandardMaterial color={palette.parkGrass} roughness={0.95} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
            <planeGeometry args={[config.width, config.depth]} />
            <meshStandardMaterial map={grass} color={COLORS.lawn} roughness={0.95} />
         </mesh>
         <Instanced spots={stripes} name="stripes">
            <primitive object={unitBox} attach="geometry" />
            <primitive object={stripeMat} attach="material" />
         </Instanced>
         {id === 4 && (
            <>
               <Instanced spots={sand} name="sand">
                  <primitive object={unitBox} attach="geometry" />
                  <primitive object={sandMat} attach="material" />
               </Instanced>
               {/* the beach park: water beyond the south fence, visual only, flat and low */}
               <Water size={[config.width + 60, 40]} position={[0, 0.02, config.depth / 2 + 21]} amplitude={0.012} foamEdge={0.03} />
            </>
         )}
         <Instanced spots={fence} name="fence">
            <primitive object={unitBox} attach="geometry" />
            <primitive object={fenceMat} attach="material" />
         </Instanced>
         <Instanced spots={rails} name="fence-rails">
            <primitive object={unitBox} attach="geometry" />
            <primitive object={fenceMat} attach="material" />
         </Instanced>
         {/* the picnic blanket: home, where every toy goes back */}
         <mesh position={[pad[0].x, 0.022, pad[0].z]} rotation-x={-Math.PI / 2} rotation-z={0.12}>
            <planeGeometry args={[2.6, 2.2]} />
            <meshStandardMaterial map={blanketMap} roughness={0.9} />
         </mesh>
         <mesh position={[pad[0].x, 0.03, pad[0].z]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.45, 1.55, 48]} />
            <meshBasicMaterial color={COLORS.blanketEdge} transparent opacity={0.6} depthWrite={false} />
         </mesh>
         {fountain.length > 0 && (
            <InstancedModel
               asset={ASSETS.fountain}
               spots={fountainFeet}
               fallback={
                  <Instanced spots={fountain} name="fountain">
                     <primitive object={unitCylinder} attach="geometry" />
                     <primitive object={fountainMat} attach="material" />
                  </Instanced>
               }
            />
         )}
         {benches.length > 0 && (
            <InstancedModel
               asset={ASSETS.bench}
               spots={benchFeet}
               fallback={
                  <Instanced spots={benches} name="benches">
                     <primitive object={unitBox} attach="geometry" />
                     <primitive object={benchMat} attach="material" />
                  </Instanced>
               }
            />
         )}
         {bushes.length > 0 && (
            <InstancedModel
               asset={ASSETS.bush}
               spots={bushFeet}
               fallback={<DecorFallback spots={bushFeet} geometry={unitSphere} material={canopyMat} flat />}
            />
         )}
         {/* decor outside the fence, fitted to 1 m and scaled once by its spot */}
         <InstancedModel asset={ASSETS.tree} spots={decor.trees} fallback={<DecorFallback spots={decor.trees} geometry={unitSphere} material={canopyMat} />} />
         <InstancedModel asset={ASSETS.bush} spots={decor.bushes} fallback={<DecorFallback spots={decor.bushes} geometry={unitSphere} material={canopyMat} flat />} />
         {decor.tents.length > 0 && <InstancedModel asset={ASSETS.tent} spots={decor.tents} fallback={<DecorFallback spots={decor.tents} geometry={unitBox} material={benchMat} />} />}
         {decor.tunnels.length > 0 && <InstancedModel asset={ASSETS.tunnel} spots={decor.tunnels} fallback={<DecorFallback spots={decor.tunnels} geometry={unitCylinder} material={fountainMat} flat />} />}
         {decor.hurdles.length > 0 && <InstancedModel asset={ASSETS.hurdle} spots={decor.hurdles} fallback={<DecorFallback spots={decor.hurdles} geometry={unitBox} material={benchMat} flat />} />}
         {/* the per-level set pieces (all outside the fence): city lamps and skyline, forest stumps
             and boulders, beach umbrellas and rocks, festival bunting and balloons */}
         {lampPoles.length > 0 && (
            <>
               <Instanced spots={lampPoles} name="lamp-poles">
                  <primitive object={unitCylinder} attach="geometry" />
                  <primitive object={lampMat} attach="material" />
               </Instanced>
               <Instanced spots={lampHeads} name="lamp-heads">
                  <primitive object={unitSphere} attach="geometry" />
                  <primitive object={lampHeadMat} attach="material" />
               </Instanced>
            </>
         )}
         {decor.blocks.length > 0 && (
            <Instanced spots={decor.blocks} name="skyline">
               <primitive object={unitBox} attach="geometry" />
               <primitive object={blockMat} attach="material" />
            </Instanced>
         )}
         {stumps.length > 0 && (
            <Instanced spots={stumps} name="stumps">
               <primitive object={unitCylinder} attach="geometry" />
               <primitive object={trunkMat} attach="material" />
            </Instanced>
         )}
         {rocks.length > 0 && (
            <Instanced spots={rocks} name="rocks">
               <primitive object={unitSphere} attach="geometry" />
               <primitive object={rockMat} attach="material" />
            </Instanced>
         )}
         {umbrellaPoles.length > 0 && (
            <>
               <Instanced spots={umbrellaPoles} name="umbrella-poles">
                  <primitive object={unitCylinder} attach="geometry" />
                  <primitive object={poleMat} attach="material" />
               </Instanced>
               <Instanced spots={umbrellaTopsA} name="umbrella-tops-a">
                  <primitive object={unitCone} attach="geometry" />
                  <primitive object={canopyAMat} attach="material" />
               </Instanced>
               <Instanced spots={umbrellaTopsB} name="umbrella-tops-b">
                  <primitive object={unitCone} attach="geometry" />
                  <primitive object={canopyBMat} attach="material" />
               </Instanced>
            </>
         )}
         {decor.flagLines.length > 0 && (
            <>
               <Instanced spots={decor.flagLines} name="flag-lines">
                  <primitive object={unitBox} attach="geometry" />
                  <primitive object={flagLineMat} attach="material" />
               </Instanced>
               <Instanced spots={decor.flagsA} name="flags-a">
                  <primitive object={unitTri} attach="geometry" />
                  <primitive object={flagAMat} attach="material" />
               </Instanced>
               <Instanced spots={decor.flagsB} name="flags-b">
                  <primitive object={unitTri} attach="geometry" />
                  <primitive object={flagBMat} attach="material" />
               </Instanced>
            </>
         )}
         {decor.balloonsA.length + decor.balloonsB.length > 0 && (
            <>
               <Instanced spots={decor.balloonsA} name="balloons-a">
                  <primitive object={unitSphere} attach="geometry" />
                  <primitive object={balloonAMat} attach="material" />
               </Instanced>
               <Instanced spots={decor.balloonsB} name="balloons-b">
                  <primitive object={unitSphere} attach="geometry" />
                  <primitive object={balloonBMat} attach="material" />
               </Instanced>
            </>
         )}
         <group ref={owner}>
            <Model asset={ASSETS.owner} fallback={<OwnerFigure />} />
         </group>
         {/* the player's ring and contact shadow on the grass under the dog */}
         <group ref={dogFloor}>
            <BlobShadow radius={0.42} opacity={0.38} />
            <mesh rotation-x={-Math.PI / 2} position-y={0.016} renderOrder={2}>
               <ringGeometry args={[0.5, 0.58, 40]} />
               <meshBasicMaterial color={COLORS.dogRing} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
            </mesh>
         </group>
         <group ref={dogGroup}>
            <group ref={dogBody}>
               <QuadrupedModel
                  asset={ASSETS.dog}
                  pose={pose}
                  tint={config.tint ?? undefined}
                  fallback={<DogFigure />}
                  attach={{
                     mouth: (
                        <>
                           <group ref={(g) => { mouth.current.ball = g; }} visible={false}>
                              <Model asset={ASSETS.ball} fallback={<BallPrimitive />} />
                           </group>
                           <group ref={(g) => { mouth.current.stick = g; }} visible={false}>
                              <Model asset={ASSETS.stick} fallback={<StickPrimitive />} />
                           </group>
                           <group ref={(g) => { mouth.current.frisbee = g; }} visible={false} rotation-x={Math.PI / 2 + 0.3}>
                              <Model asset={ASSETS.frisbee} fallback={<FrisbeePrimitive />} />
                           </group>
                        </>
                     ),
                  }}
               />
            </group>
         </group>
         {/* the toy to fetch, the ring where a thrown toy lands, the blanket while carrying */}
         <TargetBeacon target={toyBeacon} variant="pick" color={COLORS.target} radius={0.8} height={0.7} />
         <TargetBeacon target={landBeacon} variant="drop-here" color={COLORS.target} radius={1.0} height={0.9} />
         <TargetBeacon target={homeBeacon} variant="drop-here" radius={BLANKET_R} height={1.1} label="HOME" />
         <Toss ref={tossBall} spin={0}>
            <Model asset={ASSETS.ball} fallback={<BallPrimitive />} />
         </Toss>
         <Toss ref={tossStick} spin={0}>
            <Model asset={ASSETS.stick} fallback={<StickPrimitive />} />
         </Toss>
         <Toss ref={tossFrisbee} spin={10}>
            <group rotation-x={Math.PI}>
               <Model asset={ASSETS.frisbee} fallback={<FrisbeePrimitive />} />
            </group>
         </Toss>
         <group ref={(g) => { toys.current.ball = g; }}>
            <Model asset={ASSETS.ball} fallback={<BallPrimitive />} />
         </group>
         <group ref={(g) => { toys.current.stick = g; }}>
            <Model asset={ASSETS.stick} fallback={<StickPrimitive />} />
         </group>
         <group ref={(g) => { toys.current.frisbee = g; }}>
            {/* the GLB lies concave side up: turned over, so it flies dome up */}
            <group rotation-x={Math.PI}>
               <Model asset={ASSETS.frisbee} fallback={<FrisbeePrimitive />} />
            </group>
         </group>
         {run.mowers.map((_, i) => (
            <group key={i} ref={(g) => { mowerRefs.current[i] = g; }}>
               <Model asset={ASSETS.mower} fallback={<MowerPrimitive />} />
            </group>
         ))}
         <group ref={toyShadow} visible={false}>
            <mesh rotation-x={-Math.PI / 2}>
               <circleGeometry args={[0.45, 20]} />
               <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
            </mesh>
         </group>
         <TargetMarkers targets={targets} color={COLORS.target} />
      </>
   );
}

/** A decor stand-in at unit size, scaled by the same spots as the GLB (flat = half height). */
function DecorFallback({ spots, geometry, material, flat = false }: { spots: readonly InstanceSpot[]; geometry: BoxGeometry | SphereGeometry | CylinderGeometry; material: MeshStandardMaterial; flat?: boolean }) {
   const placed = useMemo(
      () =>
         spots.map((spot) => {
            const k = spot.scale ?? 1;
            return { x: spot.x, z: spot.z, rotY: spot.rotY, y: (flat ? 0.25 : 0.5) * k, sx: k, sy: (flat ? 0.5 : 1) * k, sz: k };
         }),
      [spots, flat],
   );
   return (
      <Instanced spots={placed} name="decor">
         <primitive object={geometry} attach="geometry" />
         <primitive object={material} attach="material" />
      </Instanced>
   );
}

// the owner stands beside the blanket, not behind the dog: the chase camera sits behind the dog,
// so an owner there would fill the screen
const OWNER_SIDE = 2.3;

export default function Scene() {
   return <LevelScene />;
}
