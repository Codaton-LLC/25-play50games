"use client";

// The arena drawn from the rules every frame (no React state for the run): each platform's slate base
// with a glowing edge; every tile (m2ArenaFloorTile, one instanced pool) tinted grey or in its
// painter's colour, popping up as it is painted, and glowing once its row is set; the rims
// (m2ArenaWall); the rafts riding their rails; the paint blobs (m2PaintPickup) in the hero's colour;
// Vexa's glass cage and Nami's pillar; the grey blots (small Paint Blobs, m2PaintBlobBoss); the roller's
// lane glow and drum.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Matrix4, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { heroAccent } from "@/arcade3d/menu2/heroAnim";
import { ASSETS, BLOT_SCALE, GLB_SIZE, PICKUP_SCALE, TILE_DRAWN, TILE_STRETCH, TILE_THICK } from "./assets";
import { CAGE_HALF, CAGE_LID, PILLAR_TOP, TILE, type Box, type Platform } from "./course";
import { COLORS, levelLook } from "./look";
import { blotPos, laneBand, raftOff, rollerAt, tileCentre, type PaintRun, type RollerView } from "./rules";
import { SECRETS } from "./progression";

const UP = new Vector3(0, 1, 0);
const P = new Vector3();
const Q = new Quaternion();
const S = new Vector3();
const O = { x: 0, z: 0 };
const T = { x: 0, z: 0 };
const GREY = new Color(COLORS.grey);
const PAINT = COLORS.paint.map((c) => new Color(c));
const SET = COLORS.paint.map((c) => new Color(c).lerp(new Color("#ffffff"), 0.18));
const WHITE = new Color("#ffffff");
const BLOT = new Color(COLORS.blot);
const FROZEN = new Color("#a5f3fc");
const RV: RollerView = { cycle: 0, step: "idle", lane: 0, x: 0, t: 0 };
const POP_S = 0.28;

/** A platform's slate base under its tiles and its glowing edge (a raft's rides its rail). */
function Base({ run, plat }: { run: PaintRun; plat: Platform }) {
   const g = useRef<Group>(null);
   const b = run.course.boxes[plat.box];
   const w = b.maxX - b.minX;
   const d = b.maxZ - b.minZ;
   const accent = levelLook(run.level).accent;
   useFrame(() => {
      if (!g.current) return;
      const o = plat.raft >= 0 ? raftOff(run, plat.raft, O) : { x: 0, z: 0 };
      g.current.position.set((b.minX + b.maxX) / 2 + o.x, 0, (b.minZ + b.maxZ) / 2 + o.z);
   });
   const t = TILE_THICK;
   return (
      <group ref={g}>
         <mesh position={[0, -t - 0.6, 0]} receiveShadow>
            <boxGeometry args={[w + 0.2, 1.2, d + 0.2]} />
            <meshStandardMaterial color={COLORS.base} roughness={0.55} metalness={0.25} />
         </mesh>
         <mesh position={[0, -t - 1.6, 0]}>
            <boxGeometry args={[w - 0.6, 0.8, d - 0.6]} />
            <meshStandardMaterial color={COLORS.greyDark} roughness={0.7} metalness={0.2} />
         </mesh>
         {/* the glowing edge */}
         {[
            [0, -d / 2 - 0.1, w + 0.3, 0.12],
            [0, d / 2 + 0.1, w + 0.3, 0.12],
            [-w / 2 - 0.1, 0, 0.12, d + 0.3],
            [w / 2 + 0.1, 0, 0.12, d + 0.3],
         ].map(([x, z, sx, sz], k) => (
            <mesh key={k} position={[x, -t - 0.02, z]}>
               <boxGeometry args={[sx, 0.08, sz]} />
               <meshBasicMaterial color={plat.raft >= 0 ? "#67e8f9" : accent} toneMapped={false} />
            </mesh>
         ))}
         {plat.raft >= 0 && (
            <mesh position={[0, -t - 1.35, 0]} rotation-x={Math.PI / 2}>
               <ringGeometry args={[0.6, 1.1, 32]} />
               <meshBasicMaterial color="#67e8f9" transparent opacity={0.6} side={2} toneMapped={false} />
            </mesh>
         )}
      </group>
   );
}

/** Every tile in one pool: grey, painted (popping as it turns), set (brighter, glowing). */
function Tiles({ run }: { run: PaintRun }) {
   const c = run.course;
   const time = useGameTime();
   const n = c.tiles.length;
   const seen = useMemo(() => new Int8Array(n).fill(-1), [n]);
   const at = useMemo(() => new Float32Array(n).fill(-10), [n]);
   useFrame(() => {
      const paint = run.board.paint;
      for (let i = 0; i < n; i++) {
         if (paint[i] !== seen[i]) {
            seen[i] = paint[i];
            at[i] = time.now;
         }
      }
   });
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.tile}
            count={n}
            name="tiles"
            update={(i, m: Matrix4, color?: Color) => {
               tileCentre(run, i, T);
               const k = Math.max(0, 1 - (time.now - at[i]) / POP_S);
               const pop = Math.sin(k * Math.PI) * 0.25;
               P.set(T.x, -TILE_THICK + pop * 0.6, T.z);
               Q.identity();
               S.set(TILE_STRETCH[0] * (1 - pop * 0.2), TILE_STRETCH[1] * (1 + pop * 2), TILE_STRETCH[2] * (1 - pop * 0.2));
               m.compose(P, Q, S);
               const p = run.board.paint[i];
               if (!color) return;
               if (p < 0) color.copy(GREY);
               else if (run.board.set[c.tiles[i].row]) color.copy(SET[p]).lerp(WHITE, 0.08 + 0.06 * Math.sin(time.now * 3 + c.tiles[i].ix * 0.6));
               else color.copy(PAINT[p]);
               if (k > 0) color.lerp(WHITE, k * 0.5);
            }}
         />
         {/* set rows glow */}
         <DynamicInstanced
            count={n}
            name="set-glow"
            tinted
            update={(i, m: Matrix4, color?: Color) => {
               const p = run.board.paint[i];
               if (p < 0 || !run.board.set[c.tiles[i].row]) return false;
               tileCentre(run, i, T);
               P.set(T.x, 0.03, T.z);
               Q.setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
               const s = TILE_DRAWN * (0.98 + 0.03 * Math.sin(time.now * 4 + i));
               S.set(s, s, 1);
               m.compose(P, Q, S);
               color?.copy(PAINT[p]);
            }}
         >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial transparent opacity={0.28} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

/** The rims: the arena wall stretched along each rim box (2 m segments). */
function Rims({ run }: { run: PaintRun }) {
   const spots = useMemo(() => {
      const out: InstanceSpot[] = [];
      for (const b of run.course.boxes) {
         if (b.kind !== "rim") continue;
         const alongX = b.maxX - b.minX >= b.maxZ - b.minZ;
         const len = alongX ? b.maxX - b.minX : b.maxZ - b.minZ;
         const thick = alongX ? b.maxZ - b.minZ : b.maxX - b.minX;
         const k = Math.max(1, Math.round(len / TILE));
         const seg = len / k;
         for (let j = 0; j < k; j++) {
            const u = (j + 0.5) * seg;
            out.push({
               x: alongX ? b.minX + u : (b.minX + b.maxX) / 2,
               y: 0,
               z: alongX ? (b.minZ + b.maxZ) / 2 : b.minZ + u,
               rotY: alongX ? 0 : Math.PI / 2,
               sx: (seg + 0.02) / GLB_SIZE.wall.x,
               sy: b.top / GLB_SIZE.wall.y,
               sz: thick / GLB_SIZE.wall.z,
            });
         }
      }
      return out;
   }, [run]);
   return (
      <InstancedModel
         asset={ASSETS.wall}
         spots={spots}
         fallback={
            <Instanced spots={spots}>
               <boxGeometry args={[GLB_SIZE.wall.x, GLB_SIZE.wall.y, GLB_SIZE.wall.z]} />
               <meshStandardMaterial color={COLORS.rim} roughness={0.5} metalness={0.3} />
            </Instanced>
         }
      />
   );
}

/** The paint blobs: in the hero's colour, bobbing and spinning, gone once taken. */
function Pickups({ run }: { run: PaintRun }) {
   const ps = run.course.pickups;
   const time = useGameTime();
   const tint = useMemo(() => new Color(heroAccent(run.heroId)).lerp(WHITE, 0.15), [run.heroId]);
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.pickup}
            count={ps.length}
            name="pickups"
            update={(i, m: Matrix4, color?: Color) => {
               if (run.board.taken[i]) return false;
               const o = ps[i];
               P.set(o.x, 0.25 + Math.sin(time.now * 2.2 + i) * 0.12, o.z);
               Q.setFromAxisAngle(UP, time.now * 1.6 + i);
               S.setScalar(PICKUP_SCALE);
               m.compose(P, Q, S);
               color?.copy(tint);
            }}
         />
         <DynamicInstanced
            count={ps.length}
            name="pickup-glow"
            update={(i, m: Matrix4) => {
               if (run.board.taken[i]) return false;
               const o = ps[i];
               P.set(o.x, 0.04, o.z);
               Q.setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
               const s = 1 + 0.12 * Math.sin(time.now * 4 + i);
               S.set(s, s, 1);
               m.compose(P, Q, S);
            }}
         >
            <ringGeometry args={[0.55, 0.75, 32]} />
            <meshBasicMaterial color={heroAccent(run.heroId)} transparent opacity={0.7} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

function ledgeOf(run: PaintRun, kind: Box["kind"]): Box[] {
   return run.course.boxes.filter((b) => b.kind === kind);
}

/** Vexa's glass cage (four ghost panels, a lid, the prism blob inside) and Nami's pillar with its gold blob. */
function Secrets({ run }: { run: PaintRun }) {
   const c = run.course;
   const time = useGameTime();
   const panels = useRef<(Mesh | null)[]>([]);
   const caged = useRef<Group>(null);
   const gold = useRef<Group>(null);
   const idx = (id: string) => SECRETS[run.level].findIndex((s) => s.id === id);
   useFrame(() => {
      const phasing = run.heroId === "vexa" && run.simMs <= run.hero.phaseUntil;
      panels.current.forEach((w) => {
         if (!w) return;
         const mat = w.material as MeshStandardMaterial;
         mat.opacity += ((phasing ? 0.12 : 0.42) - mat.opacity) * 0.15;
      });
      if (caged.current) {
         caged.current.visible = !run.secrets.found[idx("ghost")];
         caged.current.rotation.y = time.now * 1.8;
         caged.current.position.y = 0.2 + Math.sin(time.now * 2) * 0.08;
      }
      if (gold.current) {
         gold.current.visible = !run.secrets.found[idx("high")];
         gold.current.rotation.y = time.now * 1.5;
         gold.current.position.y = PILLAR_TOP + 0.15 + Math.sin(time.now * 2.4) * 0.08;
      }
   });
   const ledges = ledgeOf(run, "ledge");
   const pillars = ledgeOf(run, "pillar");
   const lids = ledgeOf(run, "lid");
   return (
      <>
         {ledges.map((b) => (
            <mesh key={b.id} position={[(b.minX + b.maxX) / 2, -0.6, (b.minZ + b.maxZ) / 2]}>
               <boxGeometry args={[b.maxX - b.minX, 1.2, b.maxZ - b.minZ]} />
               <meshStandardMaterial color={COLORS.base} roughness={0.55} metalness={0.25} />
            </mesh>
         ))}
         {lids.map((b) => (
            <mesh key={b.id} position={[(b.minX + b.maxX) / 2, (b.top + b.bottom) / 2, (b.minZ + b.maxZ) / 2]}>
               <boxGeometry args={[b.maxX - b.minX, b.top - b.bottom, b.maxZ - b.minZ]} />
               <meshStandardMaterial color={COLORS.ghost} emissive="#8b5cf6" emissiveIntensity={0.5} transparent opacity={0.55} roughness={0.2} />
            </mesh>
         ))}
         {c.ghostWalls.map((w, i) => (
            <mesh
               key={i}
               ref={(m) => {
                  panels.current[i] = m;
               }}
               position={[w.x, CAGE_LID / 2, w.z]}
            >
               <boxGeometry args={[w.normal === "x" ? 0.1 : CAGE_HALF * 2, CAGE_LID, w.normal === "x" ? CAGE_HALF * 2 : 0.1]} />
               <meshStandardMaterial color={COLORS.ghost} emissive="#a78bfa" emissiveIntensity={0.7} transparent opacity={0.42} depthWrite={false} />
            </mesh>
         ))}
         <group position={[c.cage.x, 0, c.cage.z]}>
            <group ref={caged}>
               <Model asset={ASSETS.pickup} scale={PICKUP_SCALE} tint="#a78bfa" />
            </group>
         </group>
         {pillars.map((b) => (
            <group key={b.id} position={[(b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2]}>
               <mesh position={[0, (b.top - 1.2) / 2 - 0.6, 0]}>
                  <cylinderGeometry args={[0.72, 0.85, b.top + 1.2, 8]} />
                  <meshStandardMaterial color={COLORS.base} roughness={0.5} metalness={0.3} />
               </mesh>
               <mesh position={[0, b.top - 0.12, 0]}>
                  <cylinderGeometry args={[0.8, 0.8, 0.12, 8]} />
                  <meshBasicMaterial color={COLORS.gold} toneMapped={false} />
               </mesh>
            </group>
         ))}
         <group position={[c.high.x, 0, c.high.z]}>
            <group ref={gold}>
               <Model asset={ASSETS.pickup} scale={PICKUP_SCALE} tint={COLORS.gold} />
            </group>
         </group>
      </>
   );
}

/** The grey blots: small grey Paint Blobs wobbling round their loops (icy and still while frozen). */
function Blots({ run }: { run: PaintRun }) {
   const n = run.course.blots.length;
   const time = useGameTime();
   if (n === 0) return null;
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.blob}
            count={n}
            name="blots"
            update={(i, m: Matrix4, color?: Color) => {
               const p = blotPos(run, i, O);
               const frozen = run.simMs <= run.blotFrozen[i];
               const w = frozen ? 0 : Math.sin(time.now * 9 + i * 2);
               P.set(p.x, 0, p.z);
               Q.setFromAxisAngle(UP, time.now * (frozen ? 0 : 0.8) + i);
               S.set(BLOT_SCALE * (1 + w * 0.08), BLOT_SCALE * (1 - w * 0.1), BLOT_SCALE * (1 + w * 0.08));
               m.compose(P, Q, S);
               color?.copy(frozen ? FROZEN : BLOT);
            }}
         />
         <DynamicInstanced
            count={n}
            name="blot-shadow"
            update={(i, m: Matrix4) => {
               const p = blotPos(run, i, O);
               P.set(p.x, 0.02, p.z);
               Q.setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
               S.set(1, 1, 1);
               m.compose(P, Q, S);
            }}
         >
            <circleGeometry args={[0.75, 24]} />
            <meshBasicMaterial color="#1f2937" transparent opacity={0.45} depthWrite={false} />
         </DynamicInstanced>
      </>
   );
}

/** The roller: its lane glows (red) for 1.5 s, then the striped drum rolls across it. */
function Roller({ run }: { run: PaintRun }) {
   const c = run.course;
   const lane = useRef<Mesh>(null);
   const laneMat = useRef<MeshBasicMaterial>(null);
   const drum = useRef<Group>(null);
   const spin = useRef<Group>(null);
   useFrame(() => {
      const r = rollerAt(run, RV);
      if (!r) return;
      const [z0, z1] = laneBand(c, r.lane);
      const p = c.platforms[c.roller];
      const on = r.step === "glow" || r.step === "roll";
      if (lane.current) {
         lane.current.visible = on;
         lane.current.position.set(p.x0 + p.nx, 0.05, (z0 + z1) / 2);
         if (laneMat.current) laneMat.current.opacity = r.step === "roll" ? 0.35 : 0.18 + 0.2 * Math.abs(Math.sin(r.t * Math.PI * 6));
      }
      if (drum.current) {
         drum.current.visible = r.step !== "idle" && run.hz.rollerStopped !== r.cycle;
         drum.current.position.set(r.x, 0.8, (z0 + z1) / 2);
      }
      if (spin.current) spin.current.rotation.z = -r.x / 0.8;
   });
   if (c.roller < 0) return null;
   const p = c.platforms[c.roller];
   return (
      <>
         <mesh ref={lane} rotation-x={-Math.PI / 2} visible={false}>
            <planeGeometry args={[p.nx * TILE, 2 * TILE]} />
            <meshBasicMaterial ref={laneMat} color={COLORS.lane} transparent opacity={0.3} depthWrite={false} toneMapped={false} />
         </mesh>
         <group ref={drum} visible={false}>
            <group ref={spin}>
               <mesh rotation-x={Math.PI / 2}>
                  <cylinderGeometry args={[0.8, 0.8, 2 * TILE - 0.2, 24]} />
                  <meshStandardMaterial color={COLORS.roller} roughness={0.45} metalness={0.35} />
               </mesh>
               {[-1.2, 0, 1.2].map((z) => (
                  <mesh key={z} position={[0, 0, z]} rotation-x={Math.PI / 2}>
                     <cylinderGeometry args={[0.82, 0.82, 0.18, 24]} />
                     <meshStandardMaterial color={COLORS.rollerBand} roughness={0.4} />
                  </mesh>
               ))}
            </group>
            {[-1, 1].map((s) => (
               <mesh key={s} position={[0, 0.35, s * (TILE - 0.05)]}>
                  <boxGeometry args={[0.25, 1.4, 0.12]} />
                  <meshStandardMaterial color="#1f2937" roughness={0.5} metalness={0.5} />
               </mesh>
            ))}
            <mesh position={[0, 1.05, 0]}>
               <boxGeometry args={[0.25, 0.14, 2 * TILE]} />
               <meshStandardMaterial color="#1f2937" roughness={0.5} metalness={0.5} />
            </mesh>
         </group>
      </>
   );
}

export function Arena({ run }: { run: PaintRun }) {
   return (
      <group>
         {run.course.platforms.map((p) => (
            <Base key={p.id} run={run} plat={p} />
         ))}
         <Tiles run={run} />
         <Rims run={run} />
         <Pickups run={run} />
         <Secrets run={run} />
         <Blots run={run} />
         <Roller run={run} />
      </group>
   );
}
