"use client";

// Temple Lantern Jump's climb: the pads (rules.ts / course.ts), drawn from the run. Stone ledges and
// decks are slabs of m2TempleLedge; glyph ledges draw themselves in gold lines as the light reaches
// them and fade to a faint ghost outline over 0.4 s in the dark; every plain ledge keeps a faint
// rim light (the card's fix for guessing in the dark); lanterns are m2StoneCageLantern on bronze
// brackets with a warm glow while lit and a green moss ring around the pad; balconies are wood that
// shakes and falls; the express column has its fire jet; bats fly the ring; galleries have their
// brazier, the hidden lantern room its ghost wall. Everything is instanced (about a dozen draw calls).
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   AdditiveBlending, CanvasTexture, CircleGeometry, Color, CylinderGeometry, DoubleSide, MeshBasicMaterial, Object3D, RingGeometry, SphereGeometry, SRGBColorSpace,
   type Matrix4, type Mesh,
} from "three";
import { DynamicInstancedModel, InstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { DynamicInstanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { GUST, batAt, gustStart, jetPhase, padX, padZ, GALLERY_RING, WALL_RING } from "./course";
import { BAT_WIDTH, BRAZIER_SCALE, GLB_SIZE, LANTERN_SCALE, ORB_SIZE, POST_SCALE, ASSETS, balconyScale, ledgeScale } from "./assets";
import { COLORS } from "./look";
import { lanternLit, padGlow, padSolid, type TempleRun } from "./rules";

const DUMMY = new Object3D();
const BAT_P = { x: 0, y: 0, z: 0 };

/** Writes a matrix: position, y turn, per-axis scale. */
function place(m: Matrix4, x: number, y: number, z: number, sx: number, sy: number, sz: number, rotY = 0, rotX = 0): void {
   DUMMY.position.set(x, y, z);
   DUMMY.rotation.set(rotX, rotY, 0, "YXZ");
   DUMMY.scale.set(sx, sy, sz);
   DUMMY.updateMatrix();
   m.copy(DUMMY.matrix);
}

/** The glyph: a sun with rays and a ring, gold lines on transparent (drawn once). */
function glyphTexture(): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = c.height = 256;
   const g = c.getContext("2d")!;
   g.clearRect(0, 0, 256, 256);
   g.strokeStyle = "#ffd36a";
   g.lineWidth = 7;
   g.lineCap = "round";
   g.beginPath();
   g.arc(128, 128, 112, 0, Math.PI * 2);
   g.stroke();
   g.lineWidth = 5;
   g.beginPath();
   g.arc(128, 128, 44, 0, Math.PI * 2);
   g.stroke();
   for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(128 + Math.cos(a) * 62, 128 + Math.sin(a) * 62);
      g.lineTo(128 + Math.cos(a) * (i % 2 ? 88 : 102), 128 + Math.sin(a) * (i % 2 ? 88 : 102));
      g.stroke();
   }
   const t = new CanvasTexture(c);
   t.colorSpace = SRGBColorSpace;
   return t;
}

/** Glyph ledges draw their sun in gold lines as light reaches them; dark ones keep a faint ghost ring. */
function Glyphs({ run }: { run: TempleRun }) {
   const pads = useMemo(() => run.course.pads.filter((p) => p.kind === "glyph" || p.kind === "gallery" || p.kind === "express"), [run]);
   const rims = useMemo(() => run.course.pads.filter((p) => p.kind === "plain" || p.kind === "balcony"), [run]);
   const time = useGameTime();
   const parts = useMemo<InstancePart[]>(() => {
      const map = glyphTexture();
      return [{ geometry: new CircleGeometry(1, 40), material: new MeshBasicMaterial({ map, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false, side: DoubleSide }) }];
   }, []);
   const ghost = useMemo<InstancePart[]>(() => [{ geometry: new RingGeometry(0.9, 1, 48), material: new MeshBasicMaterial({ color: COLORS.ghost, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false }) }], []);
   const rim = useMemo<InstancePart[]>(() => [{ geometry: new RingGeometry(0.93, 1, 48), material: new MeshBasicMaterial({ color: COLORS.rim, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }) }], []);
   useEffect(() => () => [...parts, ...ghost, ...rim].forEach((p) => { p.geometry.dispose(); (p.material as MeshBasicMaterial).map?.dispose(); (p.material as MeshBasicMaterial).dispose(); }), [parts, ghost, rim]);
   const glyphUpdate = (i: number, m: Matrix4) => {
      const p = pads[i];
      const k = padGlow(run, p);
      if (k <= 0.02) return false;
      const pulse = 0.92 + 0.08 * Math.sin(time.now * 3 + i);
      place(m, p.x, p.y + 0.02, p.z, p.r * 0.92 * k * pulse, p.r * 0.92 * k * pulse, 1, time.now * 0.15 * (i % 2 ? 1 : -1) + i, -Math.PI / 2);
   };
   const ghostUpdate = (i: number, m: Matrix4) => {
      const p = pads[i];
      if (padGlow(run, p) > 0.98) return false;
      place(m, p.x, p.y + 0.02, p.z, p.r, p.r, 1, 0, -Math.PI / 2);
   };
   const rimUpdate = (i: number, m: Matrix4) => {
      const p = rims[i];
      if (!padSolid(run, p)) return false;
      place(m, p.x, p.y + 0.02, p.z, p.r, p.r, 1, 0, -Math.PI / 2);
   };
   return (
      <>
         <DynamicInstanced count={pads.length} update={glyphUpdate} parts={parts} name="glyphs" />
         <DynamicInstanced count={pads.length} update={ghostUpdate} parts={ghost} name="ghost-rims" />
         {rims.length > 0 ? <DynamicInstanced count={rims.length} update={rimUpdate} parts={rim} name="plain-rims" /> : null}
      </>
   );
}

/** Every stone slab: ledges, decks, galleries, the express ledges and the goal roof. Glyph slabs thin out as the light fades. */
function Slabs({ run }: { run: TempleRun }) {
   const pads = useMemo(() => run.course.pads.filter((p) => p.kind !== "lantern" && p.kind !== "balcony"), [run]);
   const update = (i: number, m: Matrix4) => {
      const p = pads[i];
      const glow = padGlow(run, p);
      if (glow <= 0.02) return false;
      const s = ledgeScale(p.r);
      const thick = s * (0.35 + 0.65 * glow);
      place(m, p.x, p.y - GLB_SIZE.ledge.y * thick, p.z, s, thick, s, i * 1.7);
   };
   return <DynamicInstancedModel asset={ASSETS.ledge} count={pads.length} update={update} name="slabs" />;
}

function Balconies({ run }: { run: TempleRun }) {
   const pads = useMemo(() => run.course.pads.filter((p) => p.kind === "balcony"), [run]);
   const time = useGameTime();
   const update = (i: number, m: Matrix4) => {
      const p = pads[i];
      if (!padSolid(run, p)) return false;
      const s = balconyScale(p.r);
      const t = run.touched[p.id];
      const shake = t > 0 ? Math.sin(time.now * 70) * 0.05 * Math.min(1, (run.simMs - t) / 400) : 0;
      place(m, p.x + shake, p.y - GLB_SIZE.balcony.y * s * 0.62, p.z, s, s, s, i);
   };
   return pads.length > 0 ? <DynamicInstancedModel asset={ASSETS.balcony} count={pads.length} update={update} name="balconies" /> : null;
}

/** Lanterns: the cage on its bracket (the swinging ones move), the glow while lit and a moss ring on the stone under it. */
function Lanterns({ run }: { run: TempleRun }) {
   const ids = useMemo(() => [...run.course.lanterns, run.course.room], [run]);
   const pads = useMemo(() => ids.map((id) => run.course.pads[id]), [ids, run]);
   const time = useGameTime();
   const camera = useThree((st) => st.camera);
   /** a lantern the camera swings past shrinks away instead of filling the screen (1 at 3.4 m, gone under 1.4 m) */
   const nearK = (p: { id: number; y: number }, x: number, z: number): number => {
      const d = Math.hypot(camera.position.x - x, camera.position.y - (p.y - 0.5), camera.position.z - z);
      return Math.max(0, Math.min(1, (d - 1.4) / 2));
   };
   const cage = (i: number, m: Matrix4) => {
      const p = pads[i];
      const squash = run.hero.standing === p.id ? 0.85 : 1;
      const x = padX(p, run.simMs);
      const z = padZ(p, run.simMs);
      const k = nearK(p, x, z);
      if (k < 0.05) return false;
      place(m, x, p.y - 1 * squash, z, LANTERN_SCALE * k, LANTERN_SCALE * squash * k, LANTERN_SCALE * k, i * 0.8);
   };
   const glowParts = useMemo<InstancePart[]>(() => [{ geometry: new SphereGeometry(1, 16, 12), material: new MeshBasicMaterial({ color: COLORS.lantern, transparent: true, opacity: 0.38, blending: AdditiveBlending, depthWrite: false, toneMapped: false }) }], []);
   const mossParts = useMemo<InstancePart[]>(() => [{ geometry: new CircleGeometry(1, 36), material: new MeshBasicMaterial({ color: COLORS.moss, transparent: true, opacity: 0.32, blending: AdditiveBlending, depthWrite: false, toneMapped: false }) }], []);
   const postParts = useMemo<InstancePart[]>(() => [{ geometry: new CylinderGeometry(0.05, 0.07, 1, 6), material: new MeshBasicMaterial({ color: "#6b4a22" }) }], []);
   useEffect(() => () => [...glowParts, ...mossParts, ...postParts].forEach((p) => { p.geometry.dispose(); (p.material as MeshBasicMaterial).dispose(); }), [glowParts, mossParts, postParts]);
   const glow = (i: number, m: Matrix4) => {
      const p = pads[i];
      const left = run.litUntil[p.id] - run.simMs;
      if (left <= 0) return false;
      const fade = Math.min(1, left / 1500);
      const flick = 1 + 0.08 * Math.sin(time.now * 9 + i * 2.1) + 0.05 * Math.sin(time.now * 23 + i);
      const r = 0.95 * fade * flick;
      place(m, padX(p, run.simMs), p.y - 0.5, padZ(p, run.simMs), r, r, r);
   };
   const moss = (i: number, m: Matrix4) => {
      const p = pads[i];
      const left = run.litUntil[p.id] - run.simMs;
      if (left <= 0) return false;
      const r = 2.2 * Math.min(1, left / 2500);
      place(m, padX(p, run.simMs), p.y - 1.55, padZ(p, run.simMs), r, r, 1, 0, -Math.PI / 2);
   };
   const post = (i: number, m: Matrix4) => {
      const p = pads[i];
      place(m, padX(p, run.simMs), p.y - 1.6, padZ(p, run.simMs), 1, 1.2, 1);
   };
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.lantern} count={pads.length} update={cage} name="lanterns" />
         <DynamicInstanced count={pads.length} update={post} parts={postParts} name="lantern-brackets" />
         <DynamicInstanced count={pads.length} update={glow} parts={glowParts} name="lantern-glow" />
         <DynamicInstanced count={pads.length} update={moss} parts={mossParts} name="lantern-moss" />
      </>
   );
}

/** The lantern posts on the checkpoint decks: three round the rim, lit once the hero has been there. */
function DeckPosts({ run }: { run: TempleRun }) {
   const spots = useMemo<InstanceSpot[]>(() => {
      const out: InstanceSpot[] = [];
      for (const id of run.course.decks) {
         const d = run.course.pads[id];
         for (let k = 0; k < 3; k++) {
            const a = (k / 3) * Math.PI * 2 + d.id;
            out.push({ x: d.x + Math.cos(a) * (d.r - 0.45), y: d.y, z: d.z + Math.sin(a) * (d.r - 0.45), scale: POST_SCALE });
         }
      }
      return out;
   }, [run]);
   return <InstancedModel asset={ASSETS.deck} spots={spots} fallback={null} />;
}

/** The colour orbs: the shared scoreOrb, green here, bobbing; gone once taken. */
function Orbs({ run }: { run: TempleRun }) {
   const time = useGameTime();
   const update = (i: number, m: Matrix4) => {
      if (run.orbTaken[i]) return false;
      const o = run.course.orbs[i];
      const s = ORB_SIZE / GLB_SIZE.orb.y;
      place(m, o.x, o.y - ORB_SIZE / 2 + Math.sin(time.now * 2 + i * 0.9) * 0.1, o.z, s, s, s, time.now * 2 + i);
   };
   return <DynamicInstancedModel asset={ASSETS.orb} count={run.course.orbs.length} update={update} name="orbs" />;
}

/** Ember sparks in the soot walls (Zuno's magnet draws them out): faint orange glints, brighter near the hero. */
function Sparks({ run }: { run: TempleRun }) {
   const time = useGameTime();
   const parts = useMemo<InstancePart[]>(() => [{ geometry: new SphereGeometry(1, 8, 6), material: new MeshBasicMaterial({ color: COLORS.ember, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false, toneMapped: false }) }], []);
   useEffect(() => () => parts.forEach((p) => { p.geometry.dispose(); (p.material as MeshBasicMaterial).dispose(); }), [parts]);
   const update = (i: number, m: Matrix4) => {
      if (run.sparkTaken[i]) return false;
      const s = run.course.sparks[i];
      const magnet = run.simMs <= run.magnetUntil;
      const near = Math.hypot(run.hero.x - s.x, run.hero.y - s.y, run.hero.z - s.z) < 6.5;
      const r = (magnet || near ? 0.16 : 0.07) * (1 + 0.3 * Math.sin(time.now * 6 + i));
      place(m, s.x, s.y, s.z, r, r, r);
   };
   return <DynamicInstanced count={run.course.sparks.length} update={update} parts={parts} name="sparks" />;
}

/** Gallery braziers (flames while lit), the ghost wall and the room's shimmer. */
function Galleries({ run }: { run: TempleRun }) {
   const course = run.course;
   const time = useGameTime();
   const spots = useMemo<InstanceSpot[]>(
      () => course.braziers.map((b) => ({ x: b.x, y: b.y, z: b.z, scale: BRAZIER_SCALE })),
      [course],
   );
   const flame = useMemo<InstancePart[]>(() => [{ geometry: new SphereGeometry(1, 10, 8), material: new MeshBasicMaterial({ color: COLORS.jet, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false, toneMapped: false }) }], []);
   useEffect(() => () => flame.forEach((p) => { p.geometry.dispose(); (p.material as MeshBasicMaterial).dispose(); }), [flame]);
   const update = (i: number, m: Matrix4) => {
      const b = course.braziers[i];
      const on = run.brazierLit[i];
      const r = (on ? 0.4 : 0.14) * (1 + 0.2 * Math.sin(time.now * 10 + i));
      place(m, b.x, b.y + 0.55 * BRAZIER_SCALE * GLB_SIZE.brazier.y + r * 0.5, b.z, r, r * (on ? 1.7 : 1), r);
   };
   const room = course.pads[course.room];
   const a = Math.atan2(room.z, room.x);
   const wall = useMemo(() => new CylinderGeometry(WALL_RING, WALL_RING, 5.2, 24, 1, true, Math.PI / 2 - a - 0.55, 1.1), [a]);
   const wallMat = useMemo(() => new MeshBasicMaterial({ color: COLORS.ghost, transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false }), []);
   useEffect(() => () => { wall.dispose(); wallMat.dispose(); }, [wall, wallMat]);
   useFrame(() => {
      wallMat.opacity = run.simMs < run.phaseUntil ? 0.05 : 0.14 + 0.05 * Math.sin(time.now * 2.4);
   });
   return (
      <>
         <InstancedModel asset={ASSETS.brazier} spots={spots} fallback={null} />
         <DynamicInstanced count={course.braziers.length} update={update} parts={flame} name="brazier-flames" />
         <mesh geometry={wall} material={wallMat} position={[0, room.y + 1.2, 0]} />
         {GALLERY_RING > 0 ? null : null}
      </>
   );
}

/** The fire jet of the express column: a translucent column that warns (a faint glow), then burns. */
function Jet({ run }: { run: TempleRun }) {
   const jet = run.course.jet;
   const time = useGameTime();
   const geo = useMemo(() => (jet ? new CylinderGeometry(jet.r, jet.r * 1.15, jet.y1 - jet.y0, 18, 1, true) : null), [jet]);
   const mat = useMemo(() => new MeshBasicMaterial({ color: COLORS.jet, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false }), []);
   useEffect(() => () => { geo?.dispose(); mat.dispose(); }, [geo, mat]);
   useFrame(() => {
      const b = run.boss;
      const fast = run.bossActive && b !== null && b.phase >= 1;
      const ph = jetPhase(run.simMs, fast);
      mat.opacity = ph === "on" ? 0.55 + 0.2 * Math.sin(time.now * 30) : ph === "warn" ? 0.08 + 0.08 * Math.sin(time.now * 14) : 0.03;
   });
   if (!jet || !geo) return null;
   return <mesh geometry={geo} material={mat} position={[0, (jet.y0 + jet.y1) / 2, 0]} />;
}

/** Soot bats (level 4): m2CaveBat on the ring, wings beating; a stunned one hangs dim and still. */
function Bats({ run }: { run: TempleRun }) {
   const time = useGameTime();
   const k = BAT_WIDTH / GLB_SIZE.bat.x;
   const update = (i: number, m: Matrix4) => {
      const bat = run.course.bats[i];
      batAt(bat, run.simMs, BAT_P);
      const stunned = run.batStun[i] > run.simMs;
      const flap = stunned ? 0.4 : 1 + 0.25 * Math.sin(time.now * 16 + i);
      const a = bat.phase - (run.simMs / 9000) * Math.PI * 2;
      place(m, BAT_P.x, BAT_P.y - 0.4 * k * GLB_SIZE.bat.y, BAT_P.z, k, k * flap, k, -a + Math.PI / 2 + Math.PI, stunned ? 0.5 : 0);
   };
   return run.course.bats.length > 0 ? <DynamicInstancedModel asset={ASSETS.bat} count={run.course.bats.length} update={update} name="bats" /> : null;
}

/** Gust leaves (level 3): drift in 1 s before a gust and blow across it. */
function Leaves({ run }: { run: TempleRun }) {
   const N = 18;
   const parts = useMemo<InstancePart[]>(() => [{ geometry: new CircleGeometry(0.12, 5), material: new MeshBasicMaterial({ color: COLORS.leaf, side: DoubleSide, toneMapped: false }) }], []);
   useEffect(() => () => parts.forEach((p) => { p.geometry.dispose(); (p.material as MeshBasicMaterial).dispose(); }), [parts]);
   const update = (i: number, m: Matrix4) => {
      const ms = run.simMs;
      if (ms < GUST.first - GUST.warnMs) return false;
      const k = Math.floor((ms - (GUST.first - GUST.warnMs)) / GUST.every);
      const t = ms - (gustStart(k) - GUST.warnMs);
      if (t < 0 || t > GUST.warnMs + GUST.lastsMs) return false;
      const u = t / (GUST.warnMs + GUST.lastsMs);
      const h = run.hero;
      const side = (i % 6) - 2.5;
      place(m, h.x - 9 + u * 18 + side * 0.4, h.y + 0.5 + ((i * 37) % 11) * 0.5 + Math.sin(u * 9 + i) * 0.5, h.z + side * 1.2 + Math.cos(u * 7 + i) * 0.6, 1, 1, 1, u * 12 + i, u * 8);
   };
   return run.course.cfg.gusts ? <DynamicInstanced count={N} update={update} parts={parts} name="gust-leaves" /> : null;
}

/** The co-op chandelier's twin plates on the level 1 start deck: they glow when stood on. */
function Plates({ run }: { run: TempleRun }) {
   const ring = useMemo(() => new RingGeometry(0.45, 0.7, 28), []);
   const mats = useMemo(() => [0, 1].map(() => new MeshBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false })), []);
   useEffect(() => () => { ring.dispose(); mats.forEach((m) => m.dispose()); }, [ring, mats]);
   const time = useGameTime();
   useFrame(() => {
      for (let i = 0; i < mats.length; i++) mats[i].opacity = 0.32 + 0.12 * Math.sin(time.now * 3 + i);
   });
   return (
      <>
         {run.course.plates.map((p, i) => (
            <mesh key={i} geometry={ring} material={mats[i]} position={[p.x, 0.03, p.z]} rotation-x={-Math.PI / 2} />
         ))}
      </>
   );
}

export function Course({ run }: { run: TempleRun }) {
   return (
      <>
         <Slabs run={run} />
         <Glyphs run={run} />
         <Balconies run={run} />
         <Lanterns run={run} />
         <DeckPosts run={run} />
         <Orbs run={run} />
         <Sparks run={run} />
         <Galleries run={run} />
         <Jet run={run} />
         <Bats run={run} />
         <Leaves run={run} />
         <Plates run={run} />
      </>
   );
}

export type { Mesh };
export { lanternLit };
