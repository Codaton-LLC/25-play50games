"use client";

// The world of the run's map (level.ts MAP_1, maps.ts levels 2-5) in its theme (looks.ts THEMES):
// terrain, fences and gates (with their drop bars), every prop (GLBs instanced, procedural
// acacias, huts' fallbacks, walls, jeeps), bushes / tall grass / flower hedges / crowds, ponds,
// birds, the hide outline, lamp glows (at dusk or all night), snacks and bamboo bundles, the sky
// dome and the surroundings. Level 1 draws exactly what it drew before levels had maps.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BoxGeometry, CircleGeometry, Color, DoubleSide, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3, type InstancedMesh, type Mesh } from "three";
import { DynamicInstancedModel, InstancedModel, Model, type InstancePart } from "@/arcade3d/core/assets";
import { SkyDome, Water } from "@/arcade3d/core/env";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { fenceSpots } from "@/arcade3d/core/kit";
import { createPath } from "@/arcade3d/core/path";
import { DynamicInstanced, Instanced, useInstanceMatrices, type InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, BAMBOO_CLUMP, BAMBOO_GLB, BAMBOO_THICKET, BAMBOO_UNIT, ZOO_FOUNTAIN_DRAWN, ZOO_FOUNTAIN_FALLBACK, ZOO_FOUNTAIN_SPOTS, ZOO_ROCK_FALLBACK, ZOO_ROCK_SPOTS, ZOO_ROCKS_DRAWN } from "./assets";
import type { Prop, ZooMap } from "./level";
import { COLORS, THEMES, themeStage, type Theme } from "./looks";
import {
   acaciaPieces,
   bambooPieces,
   benchPieces,
   binPieces,
   birdPieces,
   bundlePieces,
   bushPieces,
   carPieces,
   cratePieces,
   flowerBedPieces,
   gatePieces,
   grassPieces,
   hutPieces,
   jeepPieces,
   kioskPieces,
   lampHeadPieces,
   lampPieces,
   palmPieces,
   rockPieces,
   snackPieces,
   towerPieces,
   treePieces,
   visitorPieces,
   wallPieces,
   useMerged,
   type Piece,
} from "./Primitives";
import { TOSS, type RunState } from "./rules";
import { Terrain } from "./Terrain";
import { Decor } from "./Decor";

const BAMBOO_TALL = BAMBOO_GLB.height * BAMBOO_UNIT;
const centre = (p: Prop) => ({ x: (p.box.min.x + p.box.max.x) / 2, y: 0, z: (p.box.min.z + p.box.max.z) / 2 });
const boxSpot = (p: Prop, h: number): InstanceSpot => ({ ...centre(p), sx: p.box.max.x - p.box.min.x, sy: h, sz: p.box.max.z - p.box.min.z });

/** Every instanced spot of a map (built once per map). */
function spotsFor(map: ZooMap, theme: Theme) {
   const of = (kind: Prop["kind"]) => map.props.filter((p) => p.kind === kind);
   const level1 = map.theme === "enclosure";
   const bushCentre = (b: ZooMap["bushes"][number]) => ({ x: (b.box.min.x + b.box.max.x) / 2, y: 0, z: (b.box.min.z + b.box.max.z) / 2 });
   const looks = (look: "bush" | "grass" | "flowers" | "crowd") => map.bushes.filter((b) => (b.look ?? "bush") === look && !(level1 && b.stage === 0));
   const visitors: InstanceSpot[][] = [[], [], [], [], [], []];
   looks("crowd").forEach((b, i) => {
      const c = bushCentre(b);
      const w = b.box.max.x - b.box.min.x, d = b.box.max.z - b.box.min.z;
      for (let k = 0; k < 5; k++) {
         const a = i * 1.7 + k * 1.26;
         const r = k === 0 ? 0 : 0.32 + ((k * 13) % 7) / 20;
         visitors[(i + k) % 6].push({ x: c.x + Math.cos(a) * r * w * 0.5, y: 0, z: c.z + Math.sin(a) * r * d * 0.5, rotY: a + Math.PI, sx: 1, sy: 0.9 + ((k * 7) % 5) / 25, sz: 1 });
      }
   });
   return {
      rock: of("rock").map((p) => ({ ...centre(p), rotY: p.yaw, sx: p.size, sy: p.size * 1.5, sz: p.size })),
      bamboo: [
         ...of("bamboo").map((p) => ({ ...centre(p), rotY: p.yaw, sx: BAMBOO_CLUMP.width, sy: BAMBOO_CLUMP.height / BAMBOO_TALL, sz: BAMBOO_CLUMP.width })),
         // level 1's stage-1 hiding spots are bamboo thickets (Decisions: the bamboo GLB as the hiding clumps)
         ...(level1 ? map.bushes.filter((b) => b.stage === 0) : []).map((b, i) => ({ ...bushCentre(b), rotY: i * 1.3, sx: BAMBOO_THICKET.width, sy: BAMBOO_THICKET.height / BAMBOO_TALL, sz: BAMBOO_THICKET.width })),
      ],
      bench: of("bench").map((p) => ({ ...centre(p), rotY: p.yaw })),
      bin: of("bin").map((p) => ({ ...centre(p) })),
      lamp: of("lamp").map((p) => ({ ...centre(p) })),
      palm: of("palm").map((p) => ({ ...centre(p), rotY: p.yaw })),
      car: of("car").map((p) => ({ ...centre(p), rotY: p.yaw })),
      tree: of("trunk").map((p) => ({ ...centre(p), rotY: p.yaw })),
      kiosk: of("kiosk").map((p) => boxSpot(p, 2.6)),
      acacia: of("acacia").map((p) => ({ ...centre(p), rotY: p.yaw, sx: 1, sy: 1, sz: 1 })),
      hut: of("hut").map((p) => boxSpot(p, 2.8)),
      crate: of("crate").map((p) => boxSpot(p, p.box.max.y)),
      wall: of("wall").map((p) => boxSpot(p, p.box.max.y)),
      fountain: of("fountain").map((p) => ({ ...centre(p), sx: (p.box.max.x - p.box.min.x) / ZOO_FOUNTAIN_DRAWN.width, sy: (p.box.max.x - p.box.min.x) / ZOO_FOUNTAIN_DRAWN.width, sz: (p.box.max.z - p.box.min.z) / ZOO_FOUNTAIN_DRAWN.width })),
      parkedJeep: of("jeep").map((p) => ({ ...centre(p), rotY: p.yaw })),
      towers: of("tower").map((p) => centre(p)),
      ponds: [...of("pond"), ...of("moat").filter(() => !level1)],
      bush: looks("bush").map((b, i) => ({ ...bushCentre(b), rotY: i * 0.9, sx: b.box.max.x - b.box.min.x + 0.5, sy: 1.0, sz: b.box.max.z - b.box.min.z + 0.5 })),
      flowerHedge: looks("flowers").map((b, i) => ({ ...bushCentre(b), rotY: i * 0.7, sx: b.box.max.x - b.box.min.x + 0.3, sy: 0.85, sz: b.box.max.z - b.box.min.z + 0.3 })),
      blooms: looks("flowers").flatMap((b, i) => [0, 1, 2, 3].map((k) => ({ ...bushCentre(b), x: bushCentre(b).x + Math.cos(i + k * 1.57) * 0.45, z: bushCentre(b).z + Math.sin(i + k * 1.57) * 0.45, y: 0.55, rotY: i + k }))),
      grass: looks("grass").map((b, i) => ({ ...bushCentre(b), rotY: i * 1.1, sx: (b.box.max.x - b.box.min.x) * 0.95, sy: 1.05, sz: (b.box.max.z - b.box.min.z) * 0.95 })),
      visitors,
      flowerBeds: map.decor.filter((d) => d.kind === "flowers").map((d) => ({ x: d.x, y: 0, z: d.z, rotY: d.yaw ?? 0, sx: d.w, sy: 1, sz: d.d })),
      plazas: map.decor.filter((d) => d.kind === "plaza").map((d) => ({ x: d.x, y: 0.006, z: d.z, sx: d.w, sy: 1, sz: d.d })),
      // warm light pools under the lamps at night (and wherever the map asks for one)
      pools: [
         ...map.decor.filter((d) => d.kind === "lightPool").map((d) => ({ x: d.x, y: 0.02, z: d.z, sx: d.w / 2, sy: 1, sz: d.d / 2 })),
         ...(map.theme === "night" ? map.lamps.filter((l) => !map.decor.some((d) => d.kind === "lightPool" && Math.hypot(d.x - centre(l).x, d.z - centre(l).z) < 0.5)).map((l) => ({ ...centre(l), y: 0.02, sx: 2.4, sy: 1, sz: 2.4 })) : []),
      ],
      gate: map.stages.map((s) => ({ x: (s.gate.x0 + s.gate.x1) / 2, y: 0, z: s.gate.z, sx: s.gate.x1 - s.gate.x0, sy: 1, sz: 1 })),
      fence: (() => {
         const posts: InstanceSpot[] = [], rails: InstanceSpot[] = [], nets: InstanceSpot[] = [];
         const net = theme.fence.style === "net";
         for (const [x0, z0, x1, z1] of map.fences) {
            const f = fenceSpots(createPath([{ x: x0, y: 0, z: z0 }, { x: x1, y: 0, z: z1 }]), { spacing: 2, height: net ? 2.4 : 1.1, postSize: 0.14, railSize: 0.07 });
            posts.push(...f.posts);
            if (!net) rails.push(...f.rails);
            else {
               const len = Math.hypot(x1 - x0, z1 - z0);
               nets.push({ x: (x0 + x1) / 2, y: 1.2, z: (z0 + z1) / 2, rotY: Math.atan2(-(z1 - z0), x1 - x0), sx: len, sy: 2.3, sz: 1 });
               rails.push(...f.rails.filter((r) => r.y !== undefined && r.y > 1.5));
            }
         }
         return { posts, rails, nets };
      })(),
   };
}

type Spots = ReturnType<typeof spotsFor>;

function Merged({ spots, build, name, emissive }: { spots: readonly InstanceSpot[]; build: () => Piece[]; name: string; emissive?: boolean }) {
   const geometry = useMerged(build);
   if (spots.length === 0) return null;
   return (
      <Instanced spots={spots} name={name}>
         <primitive object={geometry} attach="geometry" />
         {emissive ? <meshBasicMaterial vertexColors toneMapped={false} /> : <meshStandardMaterial vertexColors roughness={0.75} flatShading />}
      </Instanced>
   );
}

/** An <InstancedModel> with its merged stand-in, drawn only when the map has spots of it. */
function Props({ asset, spots, build, name }: { asset: (typeof ASSETS)[keyof typeof ASSETS]; spots: readonly InstanceSpot[]; build: () => Piece[]; name: string }) {
   if (spots.length === 0) return null;
   return <InstancedModel asset={asset} spots={spots} fallback={<Merged spots={spots} build={build} name={name} />} />;
}

function Fences({ spots, theme }: { spots: Spots; theme: Theme }) {
   return (
      <group name="fences">
         <Instanced spots={spots.fence.posts} name="fence-posts">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={theme.fence.post} roughness={0.8} />
         </Instanced>
         {spots.fence.rails.length > 0 && (
            <Instanced spots={spots.fence.rails} name="fence-rails">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={theme.fence.rail} roughness={0.7} metalness={theme.fence.style === "iron" ? 0.5 : 0} />
            </Instanced>
         )}
         {spots.fence.nets.length > 0 && (
            // the aviary nets: see-through mesh panels (they never block sight)
            <Instanced spots={spots.fence.nets} name="aviary-nets">
               <planeGeometry args={[1, 1, 1, 1]} />
               <meshStandardMaterial color={theme.fence.rail} transparent opacity={0.28} side={DoubleSide} depthWrite={false} wireframe />
            </Instanced>
         )}
         <Merged spots={spots.gate} build={gatePieces} name="gates" />
      </group>
   );
}

function glow(m: InstancedMesh | null, opacity: number) {
   if (!m) return;
   m.visible = opacity > 0.01;
   (m.material as MeshBasicMaterial).opacity = opacity;
}

/** Lamp glows: off by day, fading in from the theme's lamp stage (level 1: the dusk of stage 3; level 5: all night). */
function LampGlows({ run, map, from }: { run: RunState; map: ZooMap; from: number }) {
   const time = useGameTime();
   const heads = useRef<InstancedMesh>(null);
   const halos = useRef<InstancedMesh>(null);
   const [state] = useState(() => ({ k: 0 }));
   const spots = useMemo(() => map.lamps.map((p) => ({ ...centre(p), y: 2.9 })), [map]);
   const halo = useMemo(() => map.lamps.map((p) => ({ ...centre(p), y: 0.02 })), [map]);
   useInstanceMatrices(heads, spots);
   useInstanceMatrices(halos, halo);
   const haloGeometry = useMemo(() => new CircleGeometry(2.4, 24).rotateX(-Math.PI / 2), []);
   useEffect(() => () => haloGeometry.dispose(), [haloGeometry]);
   const night = from === 0;
   useFrame(() => {
      state.k += ((run.stage >= from ? 1 : 0) - state.k) * (1 - Math.exp(-1.5 * time.delta));
      const flicker = 0.92 + 0.08 * Math.sin(time.now * 3);
      glow(heads.current, state.k * 0.9 * flicker);
      glow(halos.current, state.k * (night ? 0.5 : 0.35) * flicker);
   });
   if (spots.length === 0) return null;
   return (
      <group name="lamp-glows">
         <instancedMesh ref={heads} args={[undefined, undefined, spots.length]} visible={false} name="lamp-heads">
            <sphereGeometry args={[0.42, 14, 10]} />
            <meshBasicMaterial color={COLORS.lampGlow} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </instancedMesh>
         <instancedMesh ref={halos} args={[undefined, undefined, halo.length]} visible={false} name="lamp-halos">
            <primitive object={haloGeometry} attach="geometry" />
            <meshBasicMaterial color={COLORS.lampGlow} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </instancedMesh>
      </group>
   );
}

const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3();
const UP = new Vector3(0, 1, 0);
const MINT = new Color(COLORS.accent);
const CORAL = new Color(COLORS.alert);

/** The drop bars: raised beside the west post until the gate closes, then they swing down across the opening. */
function DropBars({ run }: { run: RunState }) {
   const time = useGameTime();
   const stages = run.map.stages;
   const geometry = useMerged(() => Array.from({ length: 6 }, (_, i): Piece => [new BoxGeometry(1 / 6, 0.16, 0.16).translate(-0.5 + (i + 0.5) / 6, 0, 0), i % 2 ? COLORS.white : COLORS.alert]));
   const [fell] = useState(() => stages.map(() => -1));
   const update = (i: number, m: Matrix4) => {
      const g = stages[i].gate;
      if (run.bars[i] && fell[i] < 0) fell[i] = time.now;
      const k = fell[i] < 0 ? 0 : Math.min(1, (time.now - fell[i]) / 0.45);
      // eased with a small bounce at the end
      const ease = k < 1 ? 1 - (1 - k) * (1 - k) : 1;
      const a = (Math.PI / 2) * (1 - ease);
      const w = g.x1 - g.x0 - 0.1;
      m.makeRotationZ(a).scale(S.set(w, 1, 1));
      m.setPosition(g.x0 + 0.05 + (Math.cos(a) * w) / 2, 1.0 + (Math.sin(a) * w) / 2, g.z);
   };
   return (
      <DynamicInstanced count={stages.length} update={update} name="drop-bars">
         <primitive object={geometry} attach="geometry" />
         <meshStandardMaterial vertexColors roughness={0.6} />
      </DynamicInstanced>
   );
}

/** The mint outline under the bush the panda hides in; it pulses coral while a keeper is within 1.5 m. */
function HideOutline({ run }: { run: RunState }) {
   const time = useGameTime();
   const mesh = useRef<Mesh>(null);
   useFrame(() => {
      const m = mesh.current;
      if (!m) return;
      const h = run.panda.hidden;
      m.visible = h >= 0 && !run.over;
      if (!m.visible) return;
      const b = run.map.bushes[h].box;
      let near = false;
      for (const i of run.map.stageKeepers[run.stage]) {
         const a = run.keepers[i].agent;
         const dx = Math.max(b.min.x - a.x, 0, a.x - b.max.x), dz = Math.max(b.min.z - a.z, 0, a.z - b.max.z);
         if (Math.hypot(dx, dz) <= 1.5) near = true;
      }
      m.position.set((b.min.x + b.max.x) / 2, 0.03, (b.min.z + b.max.z) / 2);
      m.scale.set((b.max.x - b.min.x) / 2 + 0.15, (b.max.z - b.min.z) / 2 + 0.15, 1);
      const mat = m.material as MeshBasicMaterial;
      const pulse = near ? 0.5 + 0.5 * Math.sin(time.now * 12) : 0;
      mat.color.lerpColors(MINT, CORAL, pulse);
      mat.opacity = 0.75;
   });
   return (
      <mesh ref={mesh} rotation-x={-Math.PI / 2} visible={false} renderOrder={3} name="hide-outline">
         <ringGeometry args={[0.92, 1.0, 40]} />
         <meshBasicMaterial color={COLORS.accent} transparent depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

/** The current exit: a soft mint ring on the gate line. */
function ExitBeacon({ run }: { run: RunState }) {
   const time = useGameTime();
   const mesh = useRef<Mesh>(null);
   useFrame(() => {
      const m = mesh.current;
      if (!m) return;
      const g = run.map.stages[run.stage].gate;
      m.position.set((g.x0 + g.x1) / 2, 0.025, g.z - 0.6);
      const s = 1 + 0.08 * Math.sin(time.now * 3);
      m.scale.set(((g.x1 - g.x0) / 2) * s, 0.9 * s, 1);
   });
   return (
      <mesh ref={mesh} rotation-x={-Math.PI / 2} renderOrder={2} name="exit-beacon">
         <ringGeometry args={[0.7, 1, 40]} />
         <meshBasicMaterial color={COLORS.accent} transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

/** The safari jeeps driving their loops (run.jeeps, the rules' poses), headlights and a dust bob. */
function Jeeps({ run }: { run: RunState }) {
   const time = useGameTime();
   const geometry = useMerged(jeepPieces);
   const count = run.map.jeeps.length;
   const update = (i: number, m: Matrix4) => {
      const j = run.jeeps[i];
      if (!j) return false;
      Q.setFromAxisAngle(UP, j.yaw);
      m.compose(V.set(j.x, 0.02 * Math.abs(Math.sin(time.now * 14 + i)), j.z), Q, S.set(1, 1, 1));
   };
   if (count === 0) return null;
   return (
      <DynamicInstanced count={count} update={update} name="jeeps">
         <primitive object={geometry} attach="geometry" />
         <meshStandardMaterial vertexColors roughness={0.6} />
      </DynamicInstanced>
   );
}

/** The birds on their spots (three kinds): they bob and peck, and jump and flap when they squawk. */
function Birds({ run }: { run: RunState }) {
   const time = useGameTime();
   const birds = run.map.birds;
   const kinds = [0, 1, 2].map((k) => birds.map((b, i) => ({ b, i })).filter((_, i) => i % 3 === k));
   return (
      <group name="birds">
         {kinds.map((list, k) => (list.length ? <BirdKind key={k} kind={k} list={list} run={run} time={time} /> : null))}
      </group>
   );
}

function BirdKind({ kind, list, run, time }: { kind: number; list: { b: ZooMap["birds"][number]; i: number }[]; run: RunState; time: ReturnType<typeof useGameTime> }) {
   const geometry = useMerged(() => birdPieces(kind));
   const update = (n: number, m: Matrix4) => {
      const { b, i } = list[n];
      const st = run.birds[i];
      const jump = st && st.since < 0.6 ? Math.sin((st.since / 0.6) * Math.PI) * 0.5 : 0;
      const peck = 0.03 * Math.max(0, Math.sin(time.now * 2.3 + i * 1.7));
      const face = Math.atan2(run.panda.x - b.x, run.panda.z - b.z) * (jump > 0 ? 1 : 0) + (jump > 0 ? 0 : i * 1.1 + 0.4 * Math.sin(time.now * 0.6 + i));
      Q.setFromAxisAngle(UP, face);
      const s = 1.4 * (1 + 0.15 * jump);
      m.compose(V.set(b.x, jump + peck, b.z), Q, S.set(s, s * (1 - 0.1 * peck * 10), s));
   };
   return (
      <DynamicInstanced count={list.length} update={update} name={`birds-${kind}`}>
         <primitive object={geometry} attach="geometry" />
         <meshStandardMaterial vertexColors roughness={0.55} />
      </DynamicInstanced>
   );
}

/** Snacks (bobbing, with a glow disc) and the bamboo bundles (flying in their closed-form arc, then lying). */
function Pickups({ run }: { run: RunState }) {
   const time = useGameTime();
   const snack = useMerged(snackPieces);
   const bundle = useMerged(bundlePieces);
   // The old merged stand-in rides the same pool update as the GLB (fallbackParts are not scaled by asset.scale).
   const snackParts = useMemo<readonly InstancePart[]>(
      () => [{ geometry: snack, material: new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: COLORS.bamboo, emissiveIntensity: 0.25 }) }],
      [snack]
   );
   useEffect(() => () => {
      for (const part of snackParts) (part.material as MeshStandardMaterial).dispose();
   }, [snackParts]);
   const placeSnack = (i: number, m: Matrix4) => {
      const s = run.snacks[i];
      if (!s || s.eaten || s.stage < run.stage) return false;
      Q.setFromAxisAngle(UP, time.now * 1.6 + i);
      m.compose(V.set(s.x, 0.12 + 0.06 * Math.sin(time.now * 2.5 + i), s.z), Q, S.set(1.6, 1.6, 1.6));
   };
   const placeGlow = (i: number, m: Matrix4) => {
      const s = run.snacks[i];
      if (!s || s.eaten || s.stage < run.stage) return false;
      const k = 0.45 * (1 + 0.1 * Math.sin(time.now * 3 + i));
      m.makeRotationX(-Math.PI / 2).scale(S.set(k, k, 1)).setPosition(s.x, 0.02, s.z);
   };
   const placeBundle = (i: number, m: Matrix4) => {
      if (i < 2) {
         const b = run.bundles[i];
         if (!b.shown) return false;
         Q.setFromAxisAngle(UP, i * 1.7 + 0.4);
         m.compose(V.set(b.x, 0, b.z), Q, S.set(1, 1, 1));
         return;
      }
      const t = run.toss;
      if (!t.active) return false;
      const k = Math.min(TOSS.flight, t.t);
      Q.setFromAxisAngle(V.set(1, 0, 0), k * 12);
      m.compose(V.set(t.from.x + t.v.x * k, Math.max(0, t.from.y + t.v.y * k - 0.5 * TOSS.gravity * k * k), t.from.z + t.v.z * k), Q, S.set(1, 1, 1));
   };
   return (
      <group name="pickups">
         <DynamicInstancedModel asset={ASSETS.snack} count={run.snacks.length} update={placeSnack} fallbackParts={snackParts} name="snacks" />
         <DynamicInstanced count={run.snacks.length} update={placeGlow} name="snack-glows">
            <circleGeometry args={[1, 24]} />
            <meshBasicMaterial color={COLORS.cone} transparent opacity={0.45} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={3} update={placeBundle} name="bundles">
            <primitive object={bundle} attach="geometry" />
            <meshStandardMaterial vertexColors roughness={0.6} />
         </DynamicInstanced>
      </group>
   );
}

/** The sky dome of the current stage's look (day, dusk, savanna, garden, night). */
function Sky({ run, theme }: { run: RunState; theme: Theme }) {
   const [stage, setStage] = useState(0);
   useFrame(() => {
      if (run.stage !== stage) setStage(run.stage);
   });
   const look = themeStage(theme, stage);
   return <SkyDome top={look.top} bottom={look.bottom} offset={0.05} exponent={0.7} />;
}

/** The ponds of a map: water with a stone rim (level 1's moat is Terrain's). */
function Ponds({ ponds, reduced, night }: { ponds: readonly Prop[]; reduced: boolean; night: boolean }) {
   const rims = useMemo(
      () =>
         ponds.flatMap((p) => {
            const w = p.box.max.x - p.box.min.x, d = p.box.max.z - p.box.min.z, c = centre(p);
            return [
               { x: c.x, y: 0.05, z: p.box.min.z, sx: w + 0.3, sy: 0.12, sz: 0.3 },
               { x: c.x, y: 0.05, z: p.box.max.z, sx: w + 0.3, sy: 0.12, sz: 0.3 },
               { x: p.box.min.x, y: 0.05, z: c.z, sx: 0.3, sy: 0.12, sz: d },
               { x: p.box.max.x, y: 0.05, z: c.z, sx: 0.3, sy: 0.12, sz: d },
            ];
         }),
      [ponds]
   );
   if (ponds.length === 0) return null;
   return (
      <group name="ponds">
         {ponds.map((p, i) => (
            <Water
               key={i}
               size={[p.box.max.x - p.box.min.x, p.box.max.z - p.box.min.z]}
               position={[centre(p).x, 0.02, centre(p).z]}
               color={night ? "#1e3a5f" : COLORS.water}
               deep={night ? "#0b1a2e" : COLORS.deep}
               foam={COLORS.foam}
               amplitude={reduced ? 0 : 0.04}
               wavelength={2.2}
               speed={reduced ? 0 : 0.5}
               foamEdge={0.1}
            />
         ))}
         <Instanced spots={rims} name="pond-rims">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.rock} roughness={0.9} />
         </Instanced>
      </group>
   );
}

export default function Stage({ run, reduced = false, levelId = 1 }: { run: RunState; reduced?: boolean; levelId?: number }) {
   const map = run.map;
   const theme = THEMES[map.theme];
   const spots = useMemo(() => spotsFor(map, theme), [map, theme]);
   const tower = useMerged(towerPieces);
   const lampHead = useMerged(lampHeadPieces);
   const poolGeometry = useMemo(() => new CircleGeometry(1, 28).rotateX(-Math.PI / 2), []);
   useEffect(() => () => poolGeometry.dispose(), [poolGeometry]);
   const night = map.theme === "night";
   const lampAsset = night ? ASSETS.victorianLamp : ASSETS.lamp;
   return (
      <group name="zoo">
         <Sky run={run} theme={theme} />
         <Terrain reduced={reduced} map={map} theme={theme} />
         <Decor reduced={reduced} exit={map.stages[2].gate} />
         <Fences spots={spots} theme={theme} />
         <DropBars run={run} />

         <InstancedModel
            asset={ASSETS.zooRocks}
            spots={ZOO_ROCK_SPOTS}
            fallback={
               <Instanced spots={ZOO_ROCK_FALLBACK}>
                  <sphereGeometry args={[ZOO_ROCKS_DRAWN.width / 2, 8, 6]} />
                  <meshStandardMaterial color={COLORS.rock} roughness={0.9} />
               </Instanced>
            }
         />
         {(levelId === 4 || levelId === 5) && (
            <InstancedModel
               asset={ASSETS.zooFountain}
               spots={ZOO_FOUNTAIN_SPOTS}
               fallback={
                  <Instanced spots={ZOO_FOUNTAIN_FALLBACK}>
                     <cylinderGeometry args={[ZOO_FOUNTAIN_DRAWN.width / 2, ZOO_FOUNTAIN_DRAWN.width / 2, ZOO_FOUNTAIN_DRAWN.height, 16]} />
                     <meshStandardMaterial color={COLORS.rock} roughness={0.8} />
                  </Instanced>
               }
            />
         )}
         {spots.fountain.length > 0 && <Props asset={ASSETS.zooFountain} spots={spots.fountain} build={() => [[new BoxGeometry(2.2, 1.4, 2.2).translate(0, 0.7, 0), COLORS.rock]]} name="fountains" />}
         <Props asset={ASSETS.rock} spots={spots.rock} build={rockPieces} name="rocks" />
         <Props asset={ASSETS.bamboo} spots={spots.bamboo} build={bambooPieces} name="bamboo" />
         <Props asset={ASSETS.bench} spots={spots.bench} build={benchPieces} name="benches" />
         <Props asset={ASSETS.bin} spots={spots.bin} build={binPieces} name="bins" />
         <Props asset={lampAsset} spots={spots.lamp} build={lampPieces} name="lamps" />
         <Props asset={ASSETS.palm} spots={spots.palm} build={palmPieces} name="palms" />
         <Props asset={ASSETS.car} spots={spots.car} build={carPieces} name="cars" />
         <Props asset={ASSETS.leafyTree} spots={spots.tree} build={treePieces} name="trees" />
         <Props asset={ASSETS.kiosk} spots={spots.kiosk} build={kioskPieces} name="kiosks" />
         <Props asset={ASSETS.bush} spots={spots.bush} build={bushPieces} name="bushes" />
         <Props asset={ASSETS.bush} spots={spots.flowerHedge} build={bushPieces} name="flower-hedges" />
         <Props asset={ASSETS.flower} spots={spots.blooms} build={() => [[new BoxGeometry(0.2, 0.5, 0.2).translate(0, 0.25, 0), "#f43f5e"]]} name="blooms" />
         <Props asset={ASSETS.hut} spots={spots.hut} build={() => hutPieces(map.theme === "safari" ? "#e7d3a8" : "#f1f5f9", map.theme === "safari" ? "#a16207" : "#b91c1c")} name="huts" />
         <Props asset={ASSETS.crate} spots={spots.crate} build={cratePieces} name="crates" />
         <Merged spots={spots.grass} build={grassPieces} name="tall-grass" />
         <Merged spots={spots.acacia} build={acaciaPieces} name="acacias" />
         <Merged spots={spots.wall} build={wallPieces} name="walls" />
         <Merged spots={spots.parkedJeep} build={jeepPieces} name="parked-jeeps" />
         <Merged spots={spots.flowerBeds} build={flowerBedPieces} name="flower-beds" />
         {spots.visitors.map((v, k) => (
            <Merged key={k} spots={v} build={() => visitorPieces(k)} name={`visitors-${k}`} />
         ))}
         {spots.plazas.length > 0 && (
            <Instanced spots={spots.plazas} name="plazas">
               <boxGeometry args={[1, 0.01, 1]} />
               <meshStandardMaterial color="#e7e0d2" roughness={0.85} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
            </Instanced>
         )}
         {spots.pools.length > 0 && (
            <Instanced spots={spots.pools} name="light-pools">
               <primitive object={poolGeometry} attach="geometry" />
               <meshBasicMaterial color={COLORS.lampGlow} transparent opacity={0.18} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
            </Instanced>
         )}
         <Ponds ponds={spots.ponds} reduced={reduced} night={night} />

         {spots.towers.map((t, i) => (
            <group key={i} position={[t.x, 0, t.z]} rotation-y={t.x > 0 ? -Math.PI / 2 : Math.PI / 2}>
               <Model
                  asset={ASSETS.tower}
                  name="tower"
                  fallback={
                     <mesh geometry={tower} name="tower">
                        <meshStandardMaterial vertexColors roughness={0.6} />
                     </mesh>
                  }
               />
               {map.theme !== "enclosure" && (
                  <mesh geometry={lampHead} position={[0, 4.6, 0.1]} name="lamp-head">
                     <meshStandardMaterial vertexColors roughness={0.4} emissive="#fef08a" emissiveIntensity={night ? 0.8 : 0.2} />
                  </mesh>
               )}
            </group>
         ))}

         <Jeeps run={run} />
         <Birds run={run} />
         <LampGlows run={run} map={map} from={theme.lampsFrom} />
         <HideOutline run={run} />
         <ExitBeacon run={run} />
         <Pickups run={run} />
      </group>
   );
}
