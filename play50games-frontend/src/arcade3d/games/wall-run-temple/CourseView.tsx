"use client";

// The playable temple: gap platforms (Hyper3D m2TempleGapPlatform, the hollow top filled with a stone
// slab), checkpoint beacons, the glyph walls tiled from m2TempleWallV2 with m2WallRunMarker medallions
// (sliding panels slide, crumbling panels shake and fall, walls you have run turn from ash grey to moss
// green), stone columns, the temple corner blocks, spike panels, dart vents, swinging rams, cracked
// panels, Vexa's ghost rooms, the level 5 gates, orbs and secrets. Every drawn face is the rules' face.
// (CourseView.tsx, not Course.tsx: Windows would collide it with course.ts.)
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Matrix4, Quaternion, Vector3, type Group, type MeshStandardMaterial } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, COLUMN_SEG, GLB_SIZE, PLATFORM_TOP, RAM_LOG_Y, RAM_SCALE, TILE_H, TILE_W, fit } from "./assets";
import { BillboardField, tintOf, type Billboard, type FogBand } from "./Billboards";
import { COLORS } from "./look";
import { ramAt, wallOut, type Wall } from "./course";
import { CRUMBLE_MS, PANEL_IN, blockSolid, type WallRun } from "./rules";
import { SECRETS } from "./progression";
import { glowTexture, sparkTexture } from "./textures";

export interface VisualClock {
   ms: number;
}

const V = new Vector3();
const Q = new Quaternion();
const UP = new Vector3(0, 1, 0);
const M = new Matrix4();
const P = { x: 0, y: 0, z: 0 };
const ASH = new Color("#b9b2a6");
const MOSS = new Color("#9fd99a");
const JADE = new Color("#8fe3c0");
const LOW = new Color("#8b8378");
const CRACK = new Color("#e8a77a");
const WHITE = new Color("#ffffff");

// ---------------- pads ----------------

function Pads({ run }: { run: WallRun }) {
   const pads = run.course.pads;
   const { slabs, fills, beacons, floors, shrines } = useMemo(() => {
      const slabs: InstanceSpot[] = [];
      const fills: InstanceSpot[] = [];
      const beacons: InstanceSpot[] = [];
      const floors: InstanceSpot[] = [];
      const shrines: InstanceSpot[] = [];
      pads.forEach((p, i) => {
         if (p.kind === "floor") {
            floors.push({ x: p.x, y: p.y - 0.6, z: p.z, sx: p.r * 2, sy: 1.2, sz: p.r * 2 });
            return;
         }
         const k = fit(GLB_SIZE.platform.x, p.r * 2);
         slabs.push({ x: p.x, y: p.y - PLATFORM_TOP * k, z: p.z, scale: k });
         // the platform's hollow middle, filled to the walking height
         fills.push({ x: p.x, y: p.y - 0.25, z: p.z, sx: p.r * 0.9, sy: 0.5, sz: p.r * 0.9 });
         if (p.cp && p.kind !== "start") beacons.push({ x: p.x + p.r * 0.7, y: p.y, z: p.z + p.r * 0.7, scale: 1.1, rotY: Math.PI / 4 });
         if (p.kind === "start" || (p.cp && i % 3 === 1)) shrines.push({ x: p.x - p.r * 0.72, y: p.y, z: p.z - p.r * 0.72, scale: 0.7, rotY: Math.PI * 0.75 });
      });
      return { slabs, fills, beacons, floors, shrines };
   }, [pads]);
   return (
      <>
         <InstancedModel asset={ASSETS.platform} spots={slabs} fallback={null} />
         <Instanced spots={fills}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.stone} roughness={0.85} />
         </Instanced>
         {floors.length ? (
            <Instanced spots={floors}>
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color="#6f7f5c" roughness={0.95} />
            </Instanced>
         ) : null}
         <InstancedModel asset={ASSETS.beacon} spots={beacons} fallback={null} />
         <InstancedModel asset={ASSETS.shrine} spots={shrines} fallback={null} />
      </>
   );
}

// ---------------- walls ----------------

interface Tile {
   wall: number;
   /** the tile's centre along the wall's axis and its height */
   a: number;
   y: number;
   sx: number;
   sy: number;
   seed: number;
}

/** The wall tiles (pure): each wall cut into slabs about TILE_W x TILE_H. */
export function tilesOf(walls: readonly Wall[]): Tile[] {
   const out: Tile[] = [];
   walls.forEach((w, i) => {
      const len = w.a1 - w.a0;
      const h = w.y1 - w.y0;
      const n = Math.max(1, Math.round(len / TILE_W));
      const m = Math.max(1, Math.round(h / TILE_H));
      for (let a = 0; a < n; a++) {
         for (let b = 0; b < m; b++) {
            out.push({ wall: i, a: w.a0 + (a + 0.5) * (len / n), y: w.y0 + b * (h / m), sx: fit(GLB_SIZE.wall.x, (len / n) * 1.01), sy: fit(GLB_SIZE.wall.y, (h / m) * 1.01), seed: a * 7 + b * 13 + i });
         }
      }
   });
   return out;
}

/** a wall's face offset right now: 0 out, -PANEL_IN in (eased), and how far a crumbled panel has fallen */
function panelOffset(run: WallRun, i: number, now: number, ms: number): number {
   const w = run.course.walls[i];
   if (w.kind !== "moving") return 0;
   // ease the slide over 0.25 s around each switch
   const f = (((ms / w.period + w.phase) % 1) + 1) % 1;
   const edge = 250 / w.period;
   let out: number;
   if (f < 0.5) out = Math.min(1, f / edge, (0.5 - f) / edge + 0.0001);
   else out = 0;
   void now;
   return -PANEL_IN * (1 - Math.min(1, out));
}

function Walls({ run, clock, visited }: { run: WallRun; clock: VisualClock; visited: Uint8Array }) {
   const walls = run.course.walls;
   const tiles = useMemo(() => tilesOf(walls), [walls]);
   const fall = useRef<Float64Array>(new Float64Array(walls.length).fill(-1));
   const time = useGameTime();
   const markers = useMemo(() => {
      const out: Array<{ wall: number; a: number; y: number }> = [];
      walls.forEach((w, i) => {
         if (w.kind === "ghost") return;
         const len = w.a1 - w.a0;
         const n = Math.max(1, Math.floor(len / 8));
         const y = w.kind === "upper" || w.kind === "low" || w.kind === "shaft" ? (w.y0 + w.y1) / 2 : w.y0 + 4.2;
         for (let k = 0; k < n; k++) out.push({ wall: i, a: w.a0 + (k + 0.5) * (len / n), y });
      });
      return out;
   }, [walls]);
   useFrame(() => {
      for (let i = 0; i < walls.length; i++) {
         if (run.crumbled[i] && fall.current[i] < 0) fall.current[i] = time.now;
         if (!run.crumbled[i]) fall.current[i] = -1;
      }
   });
   const place = (w: Wall, i: number, a: number, y: number, depthOff: number, m: Matrix4, sx: number, sy: number, sz: number, seed: number): boolean => {
      let off = depthOff + panelOffset(run, i, time.now, clock.ms);
      let dy = 0;
      let shake = 0;
      const f = fall.current[i];
      if (f >= 0) {
         const t = time.now - f;
         if (t > 1.6) return false;
         dy = -t * t * 9 - (seed % 3) * t;
      } else if (w.kind === "crumble" && run.crumbleAt[i] >= 0) {
         const k = Math.min(1, (run.simMs - run.crumbleAt[i]) / CRUMBLE_MS);
         shake = Math.sin(time.now * 70 + seed) * 0.05 * k;
      }
      off += 0;
      const across = w.c + w.n * off;
      const px = w.axis === "x" ? a + shake : across;
      const pz = w.axis === "x" ? across : a + shake;
      const rot = w.axis === "x" ? (w.n > 0 ? 0 : Math.PI) : w.n > 0 ? Math.PI / 2 : -Math.PI / 2;
      Q.setFromAxisAngle(UP, rot);
      m.compose(V.set(px, y + dy, pz), Q, P2.set(sx, sy, sz));
      return true;
   };
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.wall}
            count={tiles.length}
            tinted
            update={(k, m, color) => {
               const t = tiles[k];
               if (!t) return false;
               const w = walls[t.wall];
               // the slab's back face sits on the wall's back: centre 0.3 m behind the face
               if (!place(w, t.wall, t.a, t.y, -0.3, m, t.sx, t.sy, fit(GLB_SIZE.wall.z, 0.62), t.seed)) return false;
               const base = w.kind === "upper" ? JADE : w.kind === "low" ? LOW : visited[t.wall] ? MOSS : ASH;
               color.copy(base);
               if (w.kind === "crumble" && run.crumbleAt[t.wall] >= 0 && !run.crumbled[t.wall]) color.lerp(CRACK, 0.6);
               if (w.kind === "moving" && !wallOut(w, clock.ms)) color.multiplyScalar(0.7);
            }}
         />
         <DynamicInstancedModel
            asset={ASSETS.marker}
            count={markers.length}
            update={(k, m) => {
               const g = markers[k];
               if (!g) return false;
               const w = walls[g.wall];
               const s = fit(GLB_SIZE.marker.x, 1.1);
               return place(w, g.wall, g.a, g.y, 0.05, m, s, s, s, k);
            }}
         />
      </>
   );
}

const P2 = new Vector3();

/** Wall slabs on the four upright faces of a box (pure): the temple corners and the cracked panels wear the wall set. */
export function faceTiles(b: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }): InstanceSpot[] {
   const out: InstanceSpot[] = [];
   const h = b.y1 - b.y0;
   const m = Math.max(1, Math.round(h / TILE_H));
   const th = fit(GLB_SIZE.wall.z, 0.3);
   const faces: Array<[number, number, number, number, number]> = [
      // [centre x, centre z, length, rotY, along x?]
      [(b.x0 + b.x1) / 2, b.z1 + 0.02, b.x1 - b.x0, 0, 1],
      [(b.x0 + b.x1) / 2, b.z0 - 0.02, b.x1 - b.x0, Math.PI, 1],
      [b.x1 + 0.02, (b.z0 + b.z1) / 2, b.z1 - b.z0, Math.PI / 2, 0],
      [b.x0 - 0.02, (b.z0 + b.z1) / 2, b.z1 - b.z0, -Math.PI / 2, 0],
   ];
   for (const [cx, cz, len, rot, alongX] of faces) {
      const n = Math.max(1, Math.round(len / TILE_W));
      for (let a = 0; a < n; a++) {
         const off = -len / 2 + (a + 0.5) * (len / n);
         for (let k = 0; k < m; k++) {
            out.push({ x: alongX ? cx + off : cx, y: b.y0 + k * (h / m), z: alongX ? cz : cz + off, sx: fit(GLB_SIZE.wall.x, (len / n) * 1.01), sy: fit(GLB_SIZE.wall.y, (h / m) * 1.01), sz: th, rotY: rot });
         }
      }
   }
   return out;
}

// ---------------- columns, corners ----------------

function Columns({ run }: { run: WallRun }) {
   const spots = useMemo(() => {
      const out: InstanceSpot[] = [];
      for (const c of run.course.columns) {
         const n = Math.max(1, Math.round((c.y1 - c.y0) / COLUMN_SEG));
         const seg = (c.y1 - c.y0) / n;
         for (let k = 0; k < n; k++) out.push({ x: c.x, y: c.y0 + k * seg, z: c.z, sx: fit(GLB_SIZE.column.x, c.r * 2.2), sy: fit(GLB_SIZE.column.y, seg), sz: fit(GLB_SIZE.column.z, c.r * 2.2), rotY: k * 0.7 });
      }
      return out;
   }, [run.course]);
   const corners = useMemo(
      () => run.course.corners.map((b) => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2, sx: b.x1 - b.x0 - 0.3, sy: b.y1 - b.y0, sz: b.z1 - b.z0 - 0.3 })),
      [run.course],
   );
   const caps = useMemo(() => corners.map((c) => ({ x: c.x, y: c.y + c.sy / 2 + 0.15, z: c.z, sx: c.sx + 0.4, sy: 0.3, sz: c.sz + 0.4 })), [corners]);
   // skins only on the corner's top 9 m: below that it is lost in the haze over the canopy
   const skins = useMemo(() => run.course.corners.flatMap((b) => faceTiles({ ...b, y0: Math.max(b.y0, b.y1 - 9) })), [run.course]);
   const camera = useThree((st) => st.camera);
   const boxes = run.course.corners;
   /** a piece the camera is in or right at: it steps out of the shot (a fast whip outruns the camera's collision) */
   const nearCam = (x: number, y: number, z: number, rx: number, ry: number, rz: number) => {
      const p = camera.position;
      return Math.abs(p.x - x) < rx && Math.abs(p.y - y) < ry && Math.abs(p.z - z) < rz;
   };
   const place = (m: Matrix4, t: InstanceSpot) => {
      Q.setFromAxisAngle(UP, t.rotY ?? 0);
      m.compose(V.set(t.x, t.y, t.z), Q, P2.set(t.sx ?? t.scale ?? 1, t.sy ?? t.scale ?? 1, t.sz ?? t.scale ?? 1));
   };
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.column}
            count={spots.length}
            update={(k, m) => {
               const t = spots[k];
               if (!t) return false;
               if (nearCam(t.x, t.y + COLUMN_SEG / 2, t.z, 1.6, COLUMN_SEG / 2 + 1, 1.6)) return false;
               place(m, t);
            }}
         />
         {corners.length ? (
            <>
               <DynamicInstanced
                  count={corners.length}
                  update={(k, m) => {
                     const b = boxes[k];
                     if (!b) return false;
                     if (nearCam((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2, (b.x1 - b.x0) / 2 + 0.8, (b.y1 - b.y0) / 2 + 0.8, (b.z1 - b.z0) / 2 + 0.8)) return false;
                     place(m, corners[k]);
                  }}
               >
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color="#7d6748" roughness={0.9} />
               </DynamicInstanced>
               <DynamicInstancedModel
                  asset={ASSETS.wall}
                  count={skins.length}
                  update={(k, m) => {
                     const t = skins[k];
                     if (!t) return false;
                     if (nearCam(t.x, t.y + TILE_H / 2, t.z, 2.2, TILE_H, 2.2)) return false;
                     place(m, t);
                  }}
               />
               <Instanced spots={caps}>
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color={COLORS.jadeDark} roughness={0.6} metalness={0.2} />
               </Instanced>
            </>
         ) : null}
      </>
   );
}

// ---------------- hazards ----------------

function Spikes({ run }: { run: WallRun }) {
   const spots = useMemo(
      () =>
         run.course.spikes.map((s) => {
            const w = run.course.walls[s.wall];
            const len = w.axis === "x" ? s.x1 - s.x0 : s.z1 - s.z0;
            const rot = w.axis === "x" ? (w.n > 0 ? 0 : Math.PI) : w.n > 0 ? Math.PI / 2 : -Math.PI / 2;
            return { x: (s.x0 + s.x1) / 2, y: s.y0, z: (s.z0 + s.z1) / 2, sx: fit(GLB_SIZE.spikes.x, len), sy: fit(GLB_SIZE.spikes.y, s.y1 - s.y0), sz: fit(GLB_SIZE.spikes.z, 0.6), rotY: rot };
         }),
      [run.course],
   );
   return <InstancedModel asset={ASSETS.spikes} spots={spots} fallback={null} />;
}

function Darts({ run, fog }: { run: WallRun; fog: FogBand }) {
   const map = useMemo(() => sparkTexture(), []);
   useEffect(() => () => map.dispose(), [map]);
   const time = useGameTime();
   const darts = run.course.darts;
   const spots = useMemo<Billboard[]>(() => darts.flatMap((d) => [0, 1].map(() => ({ x: d.x, y: d.y, z: d.z, size: 1.6, ...tintOf(COLORS.dart) }))), [darts]);
   return (
      <>
         {darts.map((d, i) => (
            <mesh key={i} position={[d.x, d.y, d.z]}>
               <boxGeometry args={[0.5, 0.5, 0.5]} />
               <meshStandardMaterial color="#3f3a33" emissive={COLORS.dart} emissiveIntensity={0.35} roughness={0.7} />
            </mesh>
         ))}
         <BillboardField
            spots={spots}
            map={map}
            fog={fog}
            additive
            aspect={1}
            live={(dd) => {
               for (let i = 0; i < spots.length; i++) {
                  const d = darts[i >> 1];
                  const f = Math.sin(time.now * 31 + i * 1.9) * 0.5 + 0.5;
                  dd[i * 4] = d.x + Math.sin(time.now * 17 + i) * 0.4;
                  dd[i * 4 + 1] = d.y + Math.cos(time.now * 13 + i) * 0.3;
                  dd[i * 4 + 2] = d.z + Math.cos(time.now * 11 + i) * 0.4;
                  dd[i * 4 + 3] = d.r * (1.2 + f * 1.4);
               }
               return true;
            }}
         />
      </>
   );
}

function Rams({ run, clock }: { run: WallRun; clock: VisualClock }) {
   const rams = run.course.rams;
   const refs = useRef<Array<Group | null>>([]);
   useFrame(() => {
      rams.forEach((r, i) => {
         const g = refs.current[i];
         if (!g) return;
         const ang = r.amp * Math.sin((Math.PI * 2 * clock.ms) / r.period + r.phase);
         if (r.swing === "x") g.rotation.set(0, 0, ang);
         else g.rotation.set(-ang, 0, 0);
      });
   });
   return (
      <>
         {rams.map((r, i) => (
            <group key={i} position={[r.x, r.y, r.z]}>
               <group ref={(g) => { refs.current[i] = g; }}>
                  {/* the chains down from the beam to the log's own short chains */}
                  {[-0.5, 0.5].map((s) => (
                     <mesh key={s} position={[r.swing === "x" ? 0 : s, -(r.length - 2.4) / 2, r.swing === "x" ? s : 0]}>
                        <cylinderGeometry args={[0.05, 0.05, r.length - 2.4, 5]} />
                        <meshStandardMaterial color="#7c5c2e" metalness={0.5} roughness={0.5} />
                     </mesh>
                  ))}
                  <group position={[0, -r.length - RAM_LOG_Y * RAM_SCALE, 0]} rotation={[0, r.swing === "x" ? 0 : Math.PI / 2, 0]} scale={RAM_SCALE}>
                     <Model asset={ASSETS.ram} />
                  </group>
               </group>
               <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.1, 0]}>
                  <cylinderGeometry args={[0.18, 0.18, 6, 8]} />
                  <meshStandardMaterial color="#5b4630" roughness={0.8} />
               </mesh>
            </group>
         ))}
      </>
   );
}

// ---------------- blocks: cracked panels, gates, ghost rooms ----------------

function Blocks({ run }: { run: WallRun }) {
   const blocks = run.course.blocks;
   const skins = useMemo(() => blocks.flatMap((b, i) => (b.kind === "cracked" ? faceTiles(b).map((t) => ({ ...t, block: i })) : [])), [blocks]);
   const refs = useRef<Array<Group | null>>([]);
   const time = useGameTime();
   const ghostMats = useRef<Array<MeshStandardMaterial | null>>([]);
   const smashed = useRef<number[]>([]);
   useFrame(() => {
      blocks.forEach((b, i) => {
         const g = refs.current[i];
         if (!g) return;
         if (b.kind === "cracked") {
            if (run.broken[i] && smashed.current[i] === undefined) smashed.current[i] = time.now;
            const t = smashed.current[i] === undefined ? -1 : time.now - smashed.current[i];
            g.visible = t < 0.7;
            if (t >= 0) {
               g.scale.setScalar(1 + t * 0.6);
               g.position.y = -t * t * 6;
            }
         } else {
            // a gate sinks into the floor once its phase opens it
            const open = !blockSolid(run, i);
            const want = open ? -(b.y1 - b.y0) : 0;
            g.position.y += (want - g.position.y) * 0.06;
            g.visible = g.position.y > -(b.y1 - b.y0) + 0.2;
         }
      });
      const phasing = run.hero.phaseUntil >= run.simMs;
      for (const m of ghostMats.current) if (m) m.opacity = phasing ? 0.14 : 0.4 + Math.sin(time.now * 2.4) * 0.06;
   });
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.wall}
            count={skins.length}
            tinted
            update={(k, m, color) => {
               const t = skins[k];
               if (!t || run.broken[t.block]) return false;
               Q.setFromAxisAngle(UP, t.rotY ?? 0);
               m.compose(V.set(t.x, t.y, t.z), Q, P2.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1));
               color.copy(CRACK);
            }}
         />
         {blocks.map((b, i) => {
            const w = b.x1 - b.x0;
            const h = b.y1 - b.y0;
            const d = b.z1 - b.z0;
            return (
               <group key={i} ref={(g) => { refs.current[i] = g; }}>
                  <group position={[(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2]}>
                     <mesh scale={b.kind === "cracked" ? [0.9, 1, 0.9] : [1, 1, 1]}>
                        <boxGeometry args={[w, h, d]} />
                        <meshStandardMaterial color={b.kind === "gate" ? "#8a7550" : "#6b5537"} roughness={0.9} />
                     </mesh>
                     {b.kind === "cracked"
                        ? [0, 1, 2].map((k) => (
                             <mesh key={k} position={[0, (k - 1) * h * 0.25, 0]} rotation={[0, 0, (k - 1) * 0.6 + 0.3]}>
                                <boxGeometry args={[w * 1.12, 0.07, d * 1.12]} />
                                <meshStandardMaterial color="#3b2a1a" emissive="#f97316" emissiveIntensity={0.35} />
                             </mesh>
                          ))
                        : [0.25, 0.5, 0.75].map((f) => (
                             <mesh key={f} position={[0, -h / 2 + h * f, 0]}>
                                <boxGeometry args={[w * 1.02, 0.18, d * 1.02]} />
                                <meshStandardMaterial color={COLORS.glyph} emissive={COLORS.glyph} emissiveIntensity={0.5} />
                             </mesh>
                          ))}
                  </group>
               </group>
            );
         })}
         {run.course.ghosts.map((g, i) => (
            <mesh key={`g${i}`} position={[(g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2, (g.z0 + g.z1) / 2]}>
               <boxGeometry args={[g.x1 - g.x0, g.y1 - g.y0, g.z1 - g.z0]} />
               <meshStandardMaterial
                  ref={(m) => { ghostMats.current[i] = m; }}
                  color={COLORS.ghost}
                  emissive={COLORS.hazard}
                  emissiveIntensity={0.5}
                  transparent
                  opacity={0.4}
                  depthWrite={false}
                  roughness={0.2}
               />
            </mesh>
         ))}
      </>
   );
}

// ---------------- orbs, secrets ----------------

function Orbs({ run, map, fog }: { run: WallRun; map: ReturnType<typeof glowTexture>; fog: FogBand }) {
   const orbs = run.course.orbs;
   const time = useGameTime();
   const plain = useMemo(() => orbs.map((o, i) => (o.kind === "magnet" ? -1 : i)).filter((i) => i >= 0), [orbs]);
   const gold = useMemo(() => orbs.map((o, i) => (o.kind === "magnet" ? i : -1)).filter((i) => i >= 0), [orbs]);
   const tints = useMemo(() => orbs.map((o) => new Color(o.kind === "bonus" ? COLORS.bonus : COLORS.orb)), [orbs]);
   const glows = useMemo<Billboard[]>(() => orbs.map((o) => ({ x: o.x, y: o.y, z: o.z, size: 1.2, ...tintOf(o.kind === "magnet" ? COLORS.magnet : COLORS.orb) })), [orbs]);
   return (
      <>
         <DynamicInstanced
            count={plain.length}
            tinted
            update={(k, m, color) => {
               const i = plain[k];
               if (i === undefined || run.collected[i]) return false;
               const o = orbs[i];
               m.makeRotationY(time.now * 2 + i).scale(V.set(1, 1.25, 1)).setPosition(o.x, o.y + Math.sin(time.now * 2.4 + i) * 0.12, o.z);
               color.copy(tints[i]);
            }}
         >
            <octahedronGeometry args={[0.3, 1]} />
            <meshStandardMaterial color={WHITE} emissive={COLORS.orb} emissiveIntensity={0.45} metalness={0.3} roughness={0.25} />
         </DynamicInstanced>
         <DynamicInstancedModel
            asset={ASSETS.goldOrb}
            count={gold.length}
            update={(k, m) => {
               const i = gold[k];
               if (i === undefined || run.collected[i]) return false;
               const o = orbs[i];
               const s = fit(GLB_SIZE.goldOrb.y, 0.75);
               m.makeRotationY(time.now + i).scale(V.set(s, s, s)).setPosition(o.x, o.y - 0.38, o.z);
            }}
         />
         <BillboardField
            spots={glows}
            map={map}
            fog={fog}
            additive
            aspect={1}
            live={(d) => {
               for (let i = 0; i < orbs.length; i++) d[i * 4 + 3] = run.collected[i] ? 0 : 1.2 + Math.sin(time.now * 3 + i) * 0.15;
               return true;
            }}
         />
      </>
   );
}

function Secrets({ run }: { run: WallRun }) {
   const spots = run.course.secrets;
   const refs = useRef<Array<Group | null>>([]);
   const time = useGameTime();
   useFrame(() => {
      spots.forEach((s, i) => {
         const g = refs.current[i];
         if (!g) return;
         g.visible = s.y > -500 && !run.secrets.found[i];
         g.rotation.y = time.now * 1.6 + i;
         g.position.y = s.y + Math.sin(time.now * 2 + i) * 0.15;
      });
   });
   return (
      <>
         {spots.map((s, i) => (
            <group key={i} ref={(g) => { refs.current[i] = g; }} position={[s.x, s.y, s.z]}>
               <mesh scale={[0.3, 0.6, 0.3]}>
                  <octahedronGeometry args={[1, 0]} />
                  <meshStandardMaterial
                     color={SECRETS[run.level][i]?.kind === "shard" ? COLORS.jade : COLORS.glyph}
                     emissive={COLORS.jade}
                     emissiveIntensity={0.9}
                     roughness={0.1}
                     transparent
                     opacity={0.9}
                  />
               </mesh>
            </group>
         ))}
      </>
   );
}

/** The ram's bob (for the scene's juice): its world point now. */
export function ramPoint(run: WallRun, i: number, ms: number, out: { x: number; y: number; z: number }) {
   return ramAt(run.course.rams[i], ms, out);
}

export default function CourseView({ run, clock, fog, visited }: { run: WallRun; clock: VisualClock; fog: FogBand; visited: Uint8Array }) {
   const glow = useMemo(() => glowTexture(), []);
   useEffect(() => () => glow.dispose(), [glow]);
   void M;
   return (
      <group>
         <Pads run={run} />
         <Walls run={run} clock={clock} visited={visited} />
         <Columns run={run} />
         <Spikes run={run} />
         <Darts run={run} fog={fog} />
         <Rams run={run} clock={clock} />
         <Blocks run={run} />
         <Orbs run={run} map={glow} fog={fog} />
         <Secrets run={run} />
      </group>
   );
}
