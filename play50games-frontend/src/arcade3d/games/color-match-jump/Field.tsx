"use client";

// The field: hexes in their live colours (one tinted pool), cracked hexes, pillars into the void, the
// colour-blind glyphs, orbs, the hero routes (ghost pillars, lightning curtains), the crown, the code
// beacon, the floating fortress islands and, on L5, the Echo Frost Golem.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, Object3D, RingGeometry, Vector3, type Group, type Mesh, type MeshStandardMaterial } from "three";
import { DynamicInstancedModel, Model } from "../../core/assets";
import { useGameTime } from "../../core/gameTime";
import { bossTimeScale } from "../../menu2/boss/boss";
import { ASSETS, GLB_SIZE, BEACON_H } from "./assets";
import { GOLEM, GREY, type Cell } from "./course";
import { CRACK_MS, REGROW_MS, cellAlive, cellHeight, colourAt, powerUp, sunkRows, type CmjRun } from "./rules";
import { FROST_GOLEM } from "./progression";
import { HEX_COLORS } from "./look";

const COLORS = HEX_COLORS.map((c) => new Color(c));
const WHITE = new Color("#ffffff");
const TMP = new Color();
const DROP_MS = 1100;

function sinkTime(r: CmjRun, row: number): number {
   const l = r.config;
   return l.sinkDelayMs + (row - 1) * l.sinkMs;
}

/** How far below its place a hex has dropped (m), or -1 when gone from view. */
function dropOf(r: CmjRun, c: Cell, t: number): number {
   let since = -1;
   if (!r.config.boss && !c.crown && c.row < sunkRows(r)) since = t - sinkTime(r, c.row);
   const k = r.crackAt[c.id];
   if (k >= 0 && t >= k + CRACK_MS) since = Math.max(since, t - (k + CRACK_MS));
   if (r.removedUntil[c.id] > t) since = Math.max(since, DROP_MS);
   if (since < 0) return 0;
   if (r.config.boss && cellAlive(r, c, t)) return 0;
   if (since >= DROP_MS) return -1;
   const s = since / 1000;
   return 9 * s * s;
}

/** Sideways shiver of the next row to sink (the last 0.7 s before it goes). */
function shiver(r: CmjRun, c: Cell, t: number): number {
   if (!r.config.sinkMs || r.config.boss) return 0;
   const left = sinkTime(r, c.row) - t;
   return left > 0 && left < 700 ? Math.sin(t * 0.09 + c.id) * 0.08 : 0;
}

function Hexes({ run: r }: { run: CmjRun }) {
   const cells = useMemo(() => r.course.cells.filter((c) => !c.crown), [r]);
   const ghosts = useMemo(() => cells.filter((c) => c.ghost), [cells]);
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.hex}
            count={cells.length}
            tinted
            update={(i, m, color) => {
               const c = cells[i];
               const t = r.simMs;
               const k = r.crackAt[c.id];
               if (k >= 0 && t < k + CRACK_MS + (r.config.boss ? REGROW_MS : Infinity)) return false;
               const drop = dropOf(r, c, t);
               if (drop < 0) return false;
               m.setPosition(c.x + shiver(r, c, t), cellHeight(r, c, t) - drop, c.z);
               const col = colourAt(r, c, t);
               TMP.copy(COLORS[col]);
               // L3: the hex fades towards its next colour in the last 0.8 s of the cycle
               if (r.config.hueMs > 0 && col < GREY) {
                  const into = t % r.config.hueMs;
                  if (into > r.config.hueMs - 800) TMP.lerp(COLORS[colourAt(r, c, t + 900)], (into - (r.config.hueMs - 800)) / 800);
               }
               if (r.litUntil[c.id] > t) TMP.lerp(WHITE, Math.min(0.45, (r.litUntil[c.id] - t) / 2600));
               if (c.glassy) TMP.lerp(WHITE, 0.25);
               if (c.ghost) TMP.copy(COLORS[GREY]);
               color.copy(TMP);
            }}
         />
         <DynamicInstancedModel
            asset={ASSETS.cracked}
            count={cells.length}
            tinted
            update={(i, m, color) => {
               const c = cells[i];
               const t = r.simMs;
               const k = r.crackAt[c.id];
               if (k < 0 || t >= k + CRACK_MS + DROP_MS) return false;
               const drop = dropOf(r, c, t);
               if (drop < 0) return false;
               m.setPosition(c.x + Math.sin(t * 0.08 + c.id) * 0.05, cellHeight(r, c, t) - drop, c.z);
               color.copy(COLORS[c.colour === GREY ? GREY : colourAt(r, c, r.crackAt[c.id])]).lerp(WHITE, 0.2);
            }}
         />
         <DynamicInstancedModel
            asset={ASSETS.pillar}
            count={cells.length}
            tinted
            update={(i, m, color) => {
               const c = cells[i];
               const drop = dropOf(r, c, r.simMs);
               if (drop < 0) return false;
               m.setPosition(c.x, cellHeight(r, c, r.simMs) - drop - 0.55, c.z);
               color.copy(COLORS[GREY]).lerp(WHITE, c.tall ? 0.15 : 0);
            }}
         />
         {/* Vexa's ghost pillars: violet glass columns standing on their hex */}
         <DynamicInstancedModel
            asset={GHOST}
            count={Math.max(1, ghosts.length)}
            update={(i, m) => {
               const c = ghosts[i];
               if (!c || dropOf(r, c, r.simMs) !== 0) return false;
               m.setPosition(c.x, cellHeight(r, c, r.simMs) + 3.2, c.z);
            }}
         />
      </>
   );
}

const GHOST = { ...ASSETS.pillar, id: "m2HexPillarGhost", stretch: [1.5 / GLB_SIZE.pillar[0], 3.2 / GLB_SIZE.pillar[1], 1.5 / GLB_SIZE.pillar[2]] as [number, number, number], yOffset: -3.2, material: { color: "#c4b5fd", emissive: "#5b21b6", roughness: 0.25, metalness: 0.1 } };

// ---- colour-blind glyphs: flat shapes on each coloured hex ----

function ribbon(points: [number, number][], w: number): BufferGeometry {
   const pos: number[] = [];
   for (let i = 0; i < points.length - 1; i++) {
      const [x0, z0] = points[i];
      const [x1, z1] = points[i + 1];
      const dx = x1 - x0;
      const dz = z1 - z0;
      const l = Math.hypot(dx, dz) || 1;
      const nx = (-dz / l) * w;
      const nz = (dx / l) * w;
      pos.push(x0 + nx, 0, z0 + nz, x1 + nx, 0, z1 + nz, x1 - nx, 0, z1 - nz, x0 + nx, 0, z0 + nz, x1 - nx, 0, z1 - nz, x0 - nx, 0, z0 - nz);
   }
   const g = new BufferGeometry();
   g.setAttribute("position", new Float32BufferAttribute(pos, 3));
   g.computeVertexNormals();
   return g;
}

function glyphGeometries(): BufferGeometry[] {
   const chevron = ribbon([[-0.32, 0.2], [0.05, 0], [-0.32, -0.2]], 0.07);
   const wave = ribbon(Array.from({ length: 13 }, (_, i) => [-0.36 + i * 0.06, Math.sin(i * 0.9) * 0.1] as [number, number]), 0.06);
   const hexagon = new RingGeometry(0.2, 0.32, 6).rotateX(-Math.PI / 2);
   const horseshoe = new RingGeometry(0.18, 0.3, 20, 1, Math.PI * 1.2, Math.PI * 1.6).rotateX(-Math.PI / 2);
   const spiral = ribbon(Array.from({ length: 28 }, (_, i) => {
      const a = i * 0.42;
      const rr = 0.04 + i * 0.011;
      return [Math.cos(a) * rr, Math.sin(a) * rr] as [number, number];
   }), 0.035);
   return [chevron, wave, hexagon, horseshoe, spiral];
}

const GLYPH_INK = ["#ffffff", "#ffffff", "#052e16", "#422006", "#ffffff"];

function Glyphs({ run: r }: { run: CmjRun }) {
   const geoms = useMemo(glyphGeometries, []);
   const meshes = useRef<(InstancedMesh | null)[]>([]);
   const tmp = useMemo(() => new Object3D(), []);
   useEffect(() => () => geoms.forEach((g) => g.dispose()), [geoms]);
   useFrame(() => {
      const t = r.simMs;
      const n = [0, 0, 0, 0, 0];
      for (const c of r.course.cells) {
         if (c.colour === GREY || c.crown) continue;
         const col = colourAt(r, c, t);
         if (col >= GREY || r.crackAt[c.id] >= 0) continue;
         const drop = dropOf(r, c, t);
         if (drop < 0) continue;
         const mesh = meshes.current[col];
         if (!mesh) continue;
         tmp.position.set(c.x + shiver(r, c, t), cellHeight(r, c, t) - drop + 0.03, c.z);
         tmp.scale.setScalar(1.7);
         tmp.updateMatrix();
         mesh.setMatrixAt(n[col]++, tmp.matrix);
      }
      meshes.current.forEach((m, k) => {
         if (!m) return;
         m.count = n[k];
         m.instanceMatrix.needsUpdate = true;
      });
   });
   return (
      <>
         {geoms.map((g, k) => (
            <instancedMesh key={k} ref={(m) => { meshes.current[k] = m; }} args={[g, undefined, r.course.cells.length]} frustumCulled={false}>
               <meshBasicMaterial color={GLYPH_INK[k]} transparent opacity={0.8} side={DoubleSide} depthWrite={false} />
            </instancedMesh>
         ))}
      </>
   );
}

// ---- orbs, floats, shards, cores ----

type OrbItem = { kind: "cell"; id: number } | { kind: "float"; i: number } | { kind: "shard" } | { kind: "core"; k: number };
const ORB_GOLD = new Color("#fde68a");
const SHARD_PINK = new Color("#f9a8d4");

function Orbs({ run: r }: { run: CmjRun }) {
   const time = useGameTime();
   const items = useMemo<OrbItem[]>(() => {
      const list: OrbItem[] = [];
      r.course.cells.forEach((c) => {
         if (c.orb || c.secret >= 0) list.push({ kind: "cell", id: c.id });
      });
      r.course.floats.forEach((_, i) => list.push({ kind: "float", i }));
      if (r.boss) {
         list.push({ kind: "shard" });
         for (let k = 0; k < 3; k++) list.push({ kind: "core", k });
      }
      return list;
   }, [r]);
   return (
      <DynamicInstancedModel
         asset={ASSETS.orb}
         count={items.length}
         tinted
         update={(i, m, color) => {
            const it = items[i];
            const spin = time.now * 2 + i;
            const bob = Math.sin(time.now * 3 + i) * 0.12;
            if (it.kind === "cell") {
               const c = r.course.cells[it.id];
               const secret = c.secret >= 0;
               if (secret ? r.secrets.found[c.secret] : r.orbTaken[c.id]) return false;
               const drop = dropOf(r, c, r.simMs);
               if (drop < 0) return false;
               m.makeRotationY(spin);
               if (secret) m.scale(SCALE_BIG);
               m.setPosition(c.x, cellHeight(r, c, r.simMs) - drop + 0.9 + bob, c.z);
               color.copy(secret ? SHARD_PINK : ORB_GOLD);
               return;
            }
            if (it.kind === "float") {
               const f = r.course.floats[it.i];
               if (r.floatTaken[it.i]) return false;
               m.makeRotationY(spin);
               if (f.secret >= 0) m.scale(SCALE_BIG);
               m.setPosition(f.x, f.y + bob, f.z);
               color.copy(f.secret >= 0 ? SHARD_PINK : ORB_GOLD);
               return;
            }
            if (it.kind === "shard") {
               if (r.shardCell < 0 || r.p3Done || r.ended) return false;
               const c = r.course.cells[r.shardCell];
               m.makeRotationY(spin * 1.5);
               m.scale(SCALE_BIG);
               m.setPosition(c.x, cellHeight(r, c, r.simMs) + 1.1 + bob, c.z);
               color.copy(SHARD_PINK);
               return;
            }
            // the golem's three back cores, lit until cracked
            if (!r.boss || r.coreTarget > it.k || r.boss.hp <= 0) return false;
            m.makeRotationY(spin);
            m.scale(SCALE_CORE);
            m.setPosition(GOLEM.x + (it.k - 1) * 1.3, 6.3 + bob * 0.5, GOLEM.z - 1.4);
            color.copy(COLORS[[0, 2, 4][it.k]]);
         }}
      />
   );
}
const SCALE_BIG = new Vector3(1.6, 1.6, 1.6);
const SCALE_CORE = new Vector3(1.9, 1.9, 1.9);

// ---- curtains, crown, beacon ----

function Curtains({ run: r }: { run: CmjRun }) {
   const cells = useMemo(() => r.course.cells.filter((c) => c.curtain), [r]);
   const refs = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      const shield = powerUp(r, 2);
      cells.forEach((c, i) => {
         const m = refs.current[i];
         if (!m) return;
         const drop = dropOf(r, c, r.simMs);
         m.visible = drop >= 0;
         m.position.set(c.x, cellHeight(r, c, r.simMs) - Math.max(0, drop) + 1.1, c.z);
         const mat = m.material as MeshStandardMaterial;
         mat.opacity = shield ? 0.18 : 0.35 + 0.25 * Math.abs(Math.sin(time.now * 17 + i));
      });
   });
   return (
      <>
         {cells.map((c, i) => (
            <mesh key={c.id} ref={(m) => { refs.current[i] = m; }}>
               <cylinderGeometry args={[1.15, 1.15, 2.2, 6, 1, true]} />
               <meshStandardMaterial color="#a7f3d0" emissive="#34d399" emissiveIntensity={1.2} transparent opacity={0.4} side={DoubleSide} depthWrite={false} />
            </mesh>
         ))}
      </>
   );
}

function Beacon({ run: r }: { run: CmjRun }) {
   const group = useRef<Group>(null);
   const time = useGameTime();
   const left = useMemo(() => Math.min(...r.course.cells.map((c) => c.x)) - 4.2, [r]);
   const z = useRef(r.z - 4);
   useFrame((_, dt) => {
      const g = group.current;
      if (!g) return;
      if (r.boss) g.position.set(-17.5, 0, -6);
      else {
         z.current += (r.z - 5 - z.current) * Math.min(1, dt * 2);
         g.position.set(left, 0, z.current);
      }
      g.visible = !r.boss || (r.boss.phase === 0 && r.coreTarget < 3);
   });
   return (
      <group ref={group}>
         <Model asset={ASSETS.pillar} />
         <Model asset={ASSETS.beacon} />
         <DynamicInstancedModel
            asset={ASSETS.lamp}
            count={6}
            tinted
            update={(i, m, color) => {
               if (i >= r.code.length) return false;
               const done = i < r.codeStep;
               const now = i === r.codeStep;
               const s = now ? 1 + 0.15 * Math.sin(time.now * 8) : 1;
               m.makeScale(s, s, s);
               m.setPosition((i - (r.code.length - 1) / 2) * 1.05, BEACON_H + (done ? 0.35 : 0), 0);
               color.copy(COLORS[r.code[i]]);
               if (!done && !now) color.lerp(COLORS[GREY], 0.45);
               if (done) color.lerp(WHITE, 0.3);
            }}
         />
      </group>
   );
}

function Crown({ run: r }: { run: CmjRun }) {
   const ref = useRef<Group>(null);
   const time = useGameTime();
   useFrame(() => {
      if (ref.current) ref.current.rotation.y = time.now * 0.4;
   });
   if (r.course.crown < 0) return null;
   const c = r.course.cells[r.course.crown];
   return (
      <group position={[c.x, c.h, c.z]}>
         <group ref={ref}>
            <Model asset={ASSETS.crown} />
         </group>
         <group position={[0, -0.35, 0]}>
            <Model asset={ASSETS.pillar} />
         </group>
      </group>
   );
}

// ---- the fortress backdrop ----

const ISLANDS: [number, number, number, number][] = [
   [-55, -28, -40, 34], [60, -32, -70, 40], [-70, -36, -120, 46], [48, -26, 20, 26], [-40, -40, 40, 30], [10, -48, -160, 60],
];

function Backdrop({ run: r }: { run: CmjRun }) {
   const far = r.course.crown >= 0 ? r.course.cells[r.course.crown].z : 0;
   return (
      <DynamicInstancedModel
         asset={ASSETS.arena}
         count={ISLANDS.length + (r.boss ? 1 : 0)}
         tinted
         update={(i, m, color) => {
            if (i === ISLANDS.length) {
               // the golem's own floating platform
               const s = 13;
               m.makeScale(s, s, s);
               m.setPosition(GOLEM.x, -(GLB_SIZE.arena[1] / GLB_SIZE.arena[0]) * s, GOLEM.z);
               color.set("#cbd5e1");
               return;
            }
            const [x, y, z, s] = ISLANDS[i];
            m.makeScale(s, s, s);
            m.setPosition(x, y, z + far * 0.5);
            color.set("#94a3b8");
         }}
      />
   );
}

// ---- the golem ----

const GOLEM_GREY = new Color("#94a3b8");
const GOLEM_OPEN = new Color("#e0f2fe");
const GOLEM_FLASH = new Color("#ffffff");

function Golem({ run: r }: { run: CmjRun }) {
   const time = useGameTime();
   const boulder = useRef<Mesh>(null);
   const shadow = useRef<Mesh>(null);
   const band = useRef<Mesh>(null);
   const plate = useRef<Mesh>(null);
   const stomp = useRef<Mesh>(null);
   const bandGeo = useMemo(() => [new RingGeometry(6.6, 9.5, 48), new RingGeometry(9.5, 12.6, 48), new RingGeometry(12.6, 15.9, 48)].map((g) => g.rotateX(-Math.PI / 2)), []);
   useEffect(() => () => bandGeo.forEach((g) => g.dispose()), [bandGeo]);
   useFrame(() => {
      const b = r.boss;
      if (!b) return;
      const t = r.simMs;
      if (band.current) {
         const show = b.phase === 0 && b.step === "telegraph" && r.slamBand >= 0;
         band.current.visible = show;
         if (show) band.current.geometry = bandGeo[r.slamBand];
      }
      const target = r.boulderCell >= 0 ? r.course.cells[r.boulderCell] : null;
      const falling = b.phase === 1 && b.step === "telegraph" && !!target;
      if (boulder.current && shadow.current) {
         boulder.current.visible = falling;
         shadow.current.visible = falling;
         if (falling && target) {
            const k = Math.min(1, b.stepMs / FROST_GOLEM.phases[1].attacks[0].telegraphMs);
            boulder.current.position.set(target.x, cellHeight(r, target, t) + 14 * (1 - k * k) + 0.8, target.z);
            shadow.current.position.set(target.x, cellHeight(r, target, t) + 0.05, target.z);
            shadow.current.scale.setScalar(0.5 + k);
         }
      }
      if (plate.current) {
         plate.current.visible = b.phase === 1 && b.hp > 0;
         const pm = plate.current.material as MeshStandardMaterial;
         pm.color.copy(COLORS[r.plate]);
         pm.emissive.copy(COLORS[r.plate]);
      }
      if (stomp.current) {
         stomp.current.visible = b.phase === 1;
         const c = r.course.cells[r.course.stomp];
         stomp.current.position.set(c.x, cellHeight(r, c, t) + 0.06, c.z);
         stomp.current.rotation.z = time.now;
      }
   });
   if (!r.boss) return null;
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.golem}
            count={1}
            tinted
            update={(_, m, color) => {
               const b = r.boss!;
               if (b.step === "done") return false;
               const ts = bossTimeScale(b, FROST_GOLEM);
               const lean = b.step === "telegraph" ? -0.12 * Math.min(1, b.stepMs / 600) : b.step === "attack" ? 0.1 : Math.sin(time.now * 0.8 * ts) * 0.03;
               const sink = b.step === "defeat" ? Math.min(1, b.defeatMs / FROST_GOLEM.defeatMs) * 6 : 0;
               m.makeRotationX(lean);
               m.setPosition(GOLEM.x, -sink, GOLEM.z);
               color.copy(b.flashMs > 0 ? GOLEM_FLASH : b.step === "vulnerable" ? GOLEM_OPEN : GOLEM_GREY);
            }}
         />
         <mesh ref={plate} position={[GOLEM.x, 9.6, GOLEM.z + 0.3]} rotation-x={-Math.PI / 2}>
            <torusGeometry args={[0.9, 0.18, 10, 32]} />
            <meshStandardMaterial emissiveIntensity={1.4} />
         </mesh>
         <mesh ref={band}>
            <meshBasicMaterial color="#7dd3fc" transparent opacity={0.35} depthWrite={false} side={DoubleSide} />
         </mesh>
         <mesh ref={boulder}>
            <icosahedronGeometry args={[0.9, 1]} />
            <meshStandardMaterial color="#e0f2fe" roughness={0.35} metalness={0.1} flatShading />
         </mesh>
         <mesh ref={shadow} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[1, 24]} />
            <meshBasicMaterial color="#0f172a" transparent opacity={0.45} depthWrite={false} />
         </mesh>
         <mesh ref={stomp} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.95, 1.2, 6]} />
            <meshBasicMaterial color="#fde68a" side={DoubleSide} />
         </mesh>
      </>
   );
}

export function Field({ run }: { run: CmjRun }) {
   return (
      <>
         <Backdrop run={run} />
         <Hexes run={run} />
         <Glyphs run={run} />
         <Orbs run={run} />
         <Curtains run={run} />
         <Crown run={run} />
         <Beacon run={run} />
         <Golem run={run} />
      </>
   );
}

