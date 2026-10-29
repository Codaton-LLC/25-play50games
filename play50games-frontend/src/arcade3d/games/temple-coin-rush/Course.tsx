"use client";

// The run's props, drawn from the rules (rules.ts / temples.ts): the toll gates (m2TempleGate over each
// toll lane with a bronze portcullis that grinds up once paid, an offering bowl m2OfferingBowl beside
// it, the jackpot arch in gold, Vexa's ghost gate as a violet shimmer, Riko's cracked side wall glowing
// orange; the price floats over the arch on a billboard badge, never as text on the mesh), the lane
// dividers of each section, the fast lanes' gold chevrons, Nami's ledges over the slow lanes
// (m2TempleLedge), the coins (m2TempleCoin spinning near the hero, cheap gold discs farther off; Zuno's
// vein coins as glints in the wall until his magnet pulls them out), the relic orbs, the stone blocks
// (m2StoneObstacle), the low beams (m2TempleBeam on two posts), the fire-jet pillars (m2FireJetPillar)
// and their flames, the spike tiles (m2SpikeTrapTile) rising on their rhythm, the broken tiles
// (m2BrokenTile) glowing as the rumble passes and then dropping into a pit, the side-ramp boulders,
// the boulder at your heels (m2RollingBoulder), the secrets, the finish arch, and on level 5 Coilstone
// (m2CoilstoneHead + a chain of m2CoilstoneSegment looping overhead), its coils, the bell gates and
// their bells, and the offering-bowl rows of the Grand Gate.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   AdditiveBlending,
   BoxGeometry,
   CanvasTexture,
   Color,
   ConeGeometry,
   CylinderGeometry,
   DoubleSide,
   IcosahedronGeometry,
   InstancedMesh,
   Material,
   Matrix4,
   MeshBasicMaterial,
   MeshStandardMaterial,
   Object3D,
   OctahedronGeometry,
   LatheGeometry,
   Shape,
   ShapeGeometry,
   Vector2,
   TorusGeometry,
   type BufferGeometry,
   type Mesh,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useQuality } from "@/arcade3d/core/quality";
import { ASSETS, BLOCK_H, BOULDER_D, COIN_D, GATE_H, GATE_SCALE, GLB_SIZE, HEAD_SCALE, SEGMENT_SCALE } from "./assets";
import { COIN, HALF, HAZ, LANES, LANE_W, NONE, TIER, laneX } from "./temples";
import { LOOKS } from "./look";
import { SECRETS } from "./progression";
import {
   ARENA,
   CROSS,
   GATE,
   JET,
   arenaCoin,
   arenaToll,
   bossAlive,
   bossVulnerable,
   chaserZ,
   crossX,
   priceOf,
   spikeUp,
   type TempleRun,
} from "./rules";

const DUMMY = new Object3D();
const M4 = new Matrix4();
const LIFT = new Matrix4();
const WHITE = new Color("#ffffff");

/** Props farther ahead than this are not drawn (the fog hides them). */
export const AHEAD = 125;
/** GLB coins within this many metres of the hero; cheap discs beyond. */
const NEAR_COINS = 30;
const COIN_SLOTS = 40;
const FAR_SLOTS = 90;
/**
 * Where the chaser is drawn: in the lower foreground behind the hero, closer as the gap shrinks (the
 * rules' gap, 0.8-9 m, maps onto 1.6-6 m of drawn distance so the camera never sits inside it and it
 * looms nearer as the danger grows; the HUD's meter shows the real gap).
 */
export function chaserDrawOffset(gap: number): number {
   return 1.15 + gap * 0.55;
}

/** gates drawn: the one just passed and the next two */
const GATE_SLOTS = 3;
const SEGMENTS = 8;

function place(x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0, order: "XYZ" | "YXZ" = "XYZ"): Object3D {
   DUMMY.position.set(x, y, z);
   DUMMY.rotation.set(rx, ry, rz, order);
   DUMMY.scale.set(sx, sy, sz);
   DUMMY.updateMatrix();
   return DUMMY;
}

/** A GLB placed with its own middle (glbH / 2 over its feet) as the pivot, so it rolls round its centre. */
function placeCentered(m: Matrix4, x: number, y: number, z: number, s: number, sy: number, glbH: number, rx: number, ry = 0, rz = 0): void {
   place(x, y + (glbH * sy) / 2, z, s, sy, s, ry, rx, rz);
   LIFT.makeTranslation(0, -glbH / 2, 0);
   m.copy(DUMMY.matrix).multiply(LIFT);
}

/** A pool of instanced copies of one geometry + material, placed every frame by `update` (false hides one). */
function Pool({ geometry, material, count, update, tinted = false, order }: { geometry: BufferGeometry; material: Material; count: number; update: (i: number, color: Color) => Object3D | false; tinted?: boolean; order?: number }) {
   const ref = useRef<InstancedMesh>(null);
   const color = useMemo(() => new Color(), []);
   useEffect(() => {
      const m = ref.current;
      if (!m || !tinted) return;
      for (let i = 0; i < count; i++) m.setColorAt(i, WHITE);
   }, [count, tinted]);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      let n = 0;
      for (let i = 0; i < count; i++) {
         color.copy(WHITE);
         const o = update(i, color);
         if (o === false) continue;
         m.setMatrixAt(n, o.matrix);
         if (tinted) m.setColorAt(n, color);
         n++;
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (tinted && m.instanceColor) m.instanceColor.needsUpdate = true;
   });
   return <instancedMesh ref={ref} args={[geometry, material, Math.max(1, count)]} frustumCulled={false} renderOrder={order} />;
}

/** A temple bell: a lathed bronze profile, 1 m tall, its crown at y = 0.5. */
function bellGeometry(): BufferGeometry {
   const pts = [
      [0.0, 0.5],
      [0.16, 0.5],
      [0.24, 0.42],
      [0.27, 0.2],
      [0.32, -0.1],
      [0.42, -0.36],
      [0.5, -0.47],
      [0.46, -0.5],
   ].map(([x, y]) => new Vector2(x, y));
   return new LatheGeometry(pts, 16);
}

/** A flat chevron pointing +y (laid on the floor it points down the hall). */
function chevronGeometry(): BufferGeometry {
   const sh = new Shape();
   sh.moveTo(-0.5, -0.3);
   sh.lineTo(0, 0.2);
   sh.lineTo(0.5, -0.3);
   sh.lineTo(0.5, -0.05);
   sh.lineTo(0, 0.45);
   sh.lineTo(-0.5, -0.05);
   sh.closePath();
   return new ShapeGeometry(sh);
}

/** The price badge's texture: a coin and the number (cached per price and state). */
const BADGES = new Map<string, CanvasTexture>();
function badgeTexture(price: number, afford: boolean, surge: boolean): CanvasTexture {
   const key = `${price}|${afford ? 1 : 0}|${surge ? 1 : 0}`;
   const hit = BADGES.get(key);
   if (hit) return hit;
   const c = document.createElement("canvas");
   c.width = 256;
   c.height = 128;
   const ctx = c.getContext("2d")!;
   ctx.fillStyle = afford ? "rgba(20,40,28,0.86)" : "rgba(50,24,24,0.86)";
   ctx.beginPath();
   ctx.roundRect(8, 16, 240, 96, 48);
   ctx.fill();
   ctx.lineWidth = 6;
   ctx.strokeStyle = surge ? "#f97316" : afford ? "#facc15" : "#94a3b8";
   ctx.stroke();
   // the coin
   ctx.fillStyle = "#f5c542";
   ctx.beginPath();
   ctx.arc(64, 64, 30, 0, Math.PI * 2);
   ctx.fill();
   ctx.strokeStyle = "#b8860b";
   ctx.lineWidth = 5;
   ctx.beginPath();
   ctx.arc(64, 64, 20, 0, Math.PI * 2);
   ctx.stroke();
   ctx.fillStyle = afford ? "#fef3c7" : "#e5e7eb";
   ctx.font = "bold 64px system-ui, sans-serif";
   ctx.textAlign = "left";
   ctx.textBaseline = "middle";
   ctx.fillText(String(price), 108, 68);
   const t = new CanvasTexture(c);
   t.needsUpdate = true;
   BADGES.set(key, t);
   return t;
}

/** One gate's price badges (one per toll lane), billboarded over the arches. */
function PriceBadges({ run, slot }: { run: TempleRun; slot: number }) {
   const camera = useThree((s) => s.camera);
   const refs = useRef<(Mesh | null)[]>([]);
   const mats = useMemo(() => [0, 1, 2].map(() => new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false })), []);
   useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
   useFrame(() => {
      const g = Math.max(0, run.nextGate - 1) + slot;
      const gate = g < run.course.gates.length ? run.course.gates[g] : null;
      for (let l = 0; l < LANES; l++) {
         const mesh = refs.current[l];
         if (!mesh) continue;
         const show = !!gate && gate.lanes[l].tier !== TIER.slow && run.gateResult[g] === GATE.pending && run.hero.z - gate.z < AHEAD && run.hero.z > gate.z;
         mesh.visible = show;
         if (!show || !gate) continue;
         const price = priceOf(run, g, l);
         const tex = badgeTexture(price, run.purse.coins >= price, gate.surge && price > gate.lanes[l].price);
         if (mats[l].map !== tex) {
            mats[l].map = tex;
            mats[l].needsUpdate = true;
         }
         mesh.position.set(laneX(l), GATE_H + 1.75, gate.z);
         mesh.quaternion.copy(camera.quaternion);
         const d = Math.max(1, run.hero.z - gate.z);
         const s = Math.min(2.6, 1.1 + d * 0.02);
         mesh.scale.set(s, s / 2, 1);
      }
   });
   return (
      <>
         {[0, 1, 2].map((l) => (
            <mesh
               key={l}
               ref={(m) => {
                  refs.current[l] = m;
               }}
               material={mats[l]}
               renderOrder={5}
            >
               <planeGeometry args={[1, 1]} />
            </mesh>
         ))}
      </>
   );
}

export function Course({ run, offsetX = 0 }: { run: TempleRun; offsetX?: number }) {
   const c = run.course;
   const look = LOOKS[c.level];
   const time = useGameTime();
   const quality = useQuality();
   const near = (z: number) => z < run.hero.z + 30 && z > run.hero.z - AHEAD;
   const gateOf = (k: number) => {
      const g = Math.max(0, run.nextGate - 1) + k;
      return g < c.gates.length ? g : NONE;
   };
   /** a gate's frame (pillars, lintel, arches, bowls) is drawn until the hero has run through it */
   const framed = (g: number) => g !== NONE && near(c.gates[g].z) && run.hero.z > c.gates[g].z - 0.3;

   // ---- materials and geometries (code parts: pillars, dividers, portcullis bars, flames, glow) ----
   const mats = useMemo(
      () => ({
         stone: new MeshStandardMaterial({ color: look.stone, roughness: 0.85 }),
         trim: new MeshStandardMaterial({ color: look.trim, roughness: 0.75 }),
         jade: new MeshStandardMaterial({ color: look.jade, emissive: look.jade, emissiveIntensity: 0.35, roughness: 0.4 }),
         bronze: new MeshStandardMaterial({ color: "#8a6a2a", roughness: 0.4, metalness: 0.7 }),
         gold: new MeshStandardMaterial({ color: "#f5c542", emissive: "#b8860b", emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.8 }),
         flame: new MeshBasicMaterial({ color: "#ff9a3c", transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
         chevron: new MeshBasicMaterial({ color: "#facc15", transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, toneMapped: false, side: DoubleSide }),
         ghost: new MeshBasicMaterial({ color: "#c4b5fd", transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false, toneMapped: false, side: DoubleSide }),
         crack: new MeshStandardMaterial({ color: "#6b5a44", emissive: "#f97316", emissiveIntensity: 0.9, roughness: 0.8 }),
         pit: new MeshBasicMaterial({ color: "#0b0805" }),
         glint: new MeshBasicMaterial({ color: "#fde68a", transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
         relic: new MeshStandardMaterial({ color: "#34d399", emissive: "#10b981", emissiveIntensity: 1.1, roughness: 0.2, metalness: 0.2 }),
         halo: new MeshBasicMaterial({ color: "#6ee7b7", transparent: true, opacity: 0.45, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
         shard: new MeshStandardMaterial({ color: "#e9d5ff", emissive: "#a855f7", emissiveIntensity: 1.2, roughness: 0.2 }),
         rumble: new MeshBasicMaterial({ color: "#d6c4a0", transparent: true, opacity: 0.35, depthWrite: false }),
         dark: new MeshStandardMaterial({ color: "#1f1a24", emissive: "#3b1670", emissiveIntensity: 0.25, roughness: 0.5, metalness: 0.4 }),
         disc: new MeshStandardMaterial({ color: "#f5c542", emissive: "#a16207", emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.8 }),
      }),
      [look],
   );
   useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
   const geos = useMemo(
      () => ({
         pillar: new RoundedBoxGeometry(0.55, 1, 0.75, 2, 0.08),
         divider: new RoundedBoxGeometry(0.36, 1, 1, 2, 0.06),
         bar: new CylinderGeometry(0.05, 0.05, 1, 6),
         flame: new ConeGeometry(0.42, 1, 8, 1, true),
         chevron: chevronGeometry(),
         box: new BoxGeometry(1, 1, 1),
         disc: new CylinderGeometry(0.5, 0.5, 0.1, 14),
         gem: new OctahedronGeometry(0.32, 0),
         halo: new TorusGeometry(0.5, 0.05, 6, 24),
         glint: new IcosahedronGeometry(0.12, 0),
         bell: bellGeometry(),
         ring: new TorusGeometry(1, 0.08, 6, 28),
      }),
      [],
   );
   useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

   // ---- toll gates ----
   const gateS = GATE_SCALE;
   const arches = GATE_SLOTS * LANES;
   /**
    * How far a toll gate has ground down into the floor (0 shut .. 1 open): it sinks once paid (or as a
    * hero with the price in its purse runs at it, so the way is clear), and stays down.
    */
   const gateOpen = (g: number, l: number) => {
      const res = run.gateResult[g];
      const gate = c.gates[g];
      if ((res === GATE.paid || res === GATE.free) && run.hero.route === g && run.hero.lane === l) return Math.min(1, (run.simMs - run.gateMs[g]) / 300 + 0.6);
      if (res !== GATE.pending) return 0;
      if (run.hero.lane !== l || run.purse.coins < priceOf(run, g, l) && !(run.simMs <= run.openUntil[g * LANES + l])) return 0;
      return Math.max(0, Math.min(1, 1 - (run.hero.z - gate.z - 2) / 9));
   };
   const archUpdate = (i: number, m: Matrix4) => {
      const g = gateOf(Math.floor(i / LANES));
      const l = i % LANES;
      if (g === NONE) return false;
      const gate = c.gates[g];
      if (!near(gate.z) || gate.lanes[l].tier === TIER.slow) return false;
      const sink = gateOpen(g, l);
      if (sink >= 1) return false;
      const shake = sink > 0 && sink < 1 ? Math.sin(time.now * 50 + i) * 0.03 : 0;
      place(offsetX + laneX(l) + shake, -sink * (GATE_H + 0.1), gate.z, gateS, gateS, gateS * 0.6, Math.PI);
      m.copy(DUMMY.matrix);
   };

   // ---- coins: a pool of near GLB coins and far discs, filled each frame from the course and the arena ----
   const p = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const coinScale = COIN_D / GLB_SIZE.coin.x;
   /** a coin's drawn place (the magnet pulls the vein coins out towards the hero) */
   const coinSpot = (i: number, out: { x: number; y: number; z: number }) => {
      const o = c.coins[i];
      out.x = o.x;
      out.y = o.y;
      out.z = o.z;
      if (o.need === 1) {
         const h = run.hero;
         const pull = run.simMs < h.magnetUntil ? Math.max(0, 1 - (h.z - o.z) / 9) : 0;
         out.x = o.x + (h.x - o.x) * pull * 0.85;
         out.y = o.y + (h.y + 0.8 - o.y) * pull * 0.85;
      }
      return out;
   };
   const coinVisible = (i: number) => {
      const o = c.coins[i];
      if (run.collected[i]) return false;
      if (o.need === 1) return run.simMs < run.hero.magnetUntil;
      if (o.need === 2) return run.gateResult[o.gate] === GATE.ghost || (run.hero.z > c.gates[o.gate].z && run.simMs < run.hero.phaseUntil);
      return true;
   };
   // the visible coins this frame, sorted into near and far lists
   const lists = useMemo(() => ({ near: new Int32Array(COIN_SLOTS), nearN: 0, far: new Int32Array(FAR_SLOTS), farN: 0, frame: -1 }), []);
   const fill = () => {
      if (lists.frame === run.simMs) return;
      lists.frame = run.simMs;
      lists.nearN = 0;
      lists.farN = 0;
      const hz = run.hero.z;
      for (let i = 0; i < c.coins.length; i++) {
         const o = c.coins[i];
         if (o.z > hz + 6 || o.z < hz - AHEAD) continue;
         if (!coinVisible(i)) continue;
         if (hz - o.z < NEAR_COINS && lists.nearN < COIN_SLOTS) lists.near[lists.nearN++] = i;
         else if (lists.farN < FAR_SLOTS) lists.far[lists.farN++] = i;
      }
      // level 5's arena coins (encoded -1 - (section * ARENA.coins + k))
      for (let s = run.arenaMet; s < run.arenaSpawned; s++) {
         for (let k = 0; k < ARENA.coins; k++) {
            if (run.arenaTaken[s] & (1 << k)) continue;
            arenaCoin(run, s, k, p);
            if (p.z > hz + 6 || p.z < hz - AHEAD) continue;
            const id = -1 - (s * ARENA.coins + k);
            if (hz - p.z < NEAR_COINS && lists.nearN < COIN_SLOTS) lists.near[lists.nearN++] = id;
            else if (lists.farN < FAR_SLOTS) lists.far[lists.farN++] = id;
         }
      }
   };
   const spotOf = (id: number, out: { x: number; y: number; z: number }) => {
      if (id >= 0) return coinSpot(id, out);
      const n = -1 - id;
      return arenaCoin(run, Math.floor(n / ARENA.coins), n % ARENA.coins, out);
   };

   // ---- hazards ----
   const hz = c.hazards;
   const hazIdx = (kind: number) => hz.map((q, i) => (q.kind === kind ? i : -1)).filter((i) => i >= 0);
   const blocks = useMemo(() => hazIdx(HAZ.block), [c]); // eslint-disable-line react-hooks/exhaustive-deps
   const beams = useMemo(() => hazIdx(HAZ.beam), [c]); // eslint-disable-line react-hooks/exhaustive-deps
   const jets = useMemo(() => hazIdx(HAZ.jet), [c]); // eslint-disable-line react-hooks/exhaustive-deps
   const spikes = useMemo(() => hazIdx(HAZ.spike), [c]); // eslint-disable-line react-hooks/exhaustive-deps
   const brokens = useMemo(() => hazIdx(HAZ.broken), [c]); // eslint-disable-line react-hooks/exhaustive-deps
   const tileW = LANE_W - 0.15;

   // ---- the chaser ----
   const boss = c.boss;
   const quality2 = quality.decor < 0.7 ? 5 : SEGMENTS;
   const headPos = useMemo(() => ({ x: 0, z: 0, lunge: 0, freedAt: Number.NaN }), []);
   const serpentOn = () => boss && run.bossOn;

   useFrame(() => {
      // the chaser's drawn place: it trails the hero's x, and on a lunge it strikes at the marked lane
      const h = run.hero;
      const tx = h.x;
      headPos.x += (tx - headPos.x) * 0.08;
      headPos.z = h.z + chaserDrawOffset(run.gap);
      const b = run.boss;
      let lunge = 0;
      if (b && run.bossOn && bossAlive(run) && b.phase === 0 && (b.step === "telegraph" || b.step === "attack")) {
         const k = b.step === "telegraph" ? -0.15 * Math.sin(time.now * 30) : 1;
         lunge = k;
         if (b.step === "attack") headPos.x += (laneX(run.hazard.lane) - headPos.x) * 0.3;
      }
      headPos.lunge += (lunge - headPos.lunge) * 0.25;
      if (b && run.bossOn && !bossAlive(run) && Number.isNaN(headPos.freedAt)) headPos.freedAt = time.now;
   });

   return (
      <group position={[0, 0, 0]}>
         {/* toll arches (GLB) over each toll lane, Vexa's ghost arch as a shimmer */}
         <DynamicInstancedModel asset={ASSETS.gate} count={arches} update={archUpdate} />
         <Pool
            geometry={geos.box}
            material={mats.ghost}
            count={GATE_SLOTS}
            update={(k) => {
               const g = gateOf(k);
               if (g === NONE) return false;
               const gate = c.gates[g];
               if (gate.ghost === NONE || !near(gate.z) || run.gateResult[g] === GATE.ghost) return false;
               const w = 0.5 + 0.08 * Math.sin(time.now * 4 + k);
               return place(offsetX + laneX(gate.ghost), GATE_H / 2, gate.z, LANE_W - 0.3, GATE_H, 0.2 + w * 0.05);
            }}
         />
         {/* the gate's pillars at the lane lines, and its lintel */}
         <Pool
            geometry={geos.pillar}
            material={mats.stone}
            count={GATE_SLOTS * (LANES + 1)}
            update={(i) => {
               const g = gateOf(Math.floor(i / (LANES + 1)));
               if (!framed(g)) return false;
               const gate = c.gates[g];
               const x = -HALF + 0.6 + (i % (LANES + 1)) * LANE_W;
               return place(offsetX + x, (GATE_H + 0.6) / 2, gate.z, 1, GATE_H + 0.6, 1);
            }}
         />
         <Pool
            geometry={geos.box}
            material={mats.trim}
            count={GATE_SLOTS}
            update={(k) => {
               const g = gateOf(k);
               if (!framed(g)) return false;
               return place(offsetX, GATE_H + 0.75, c.gates[g].z, HALF * 2 + 0.4, 0.5, 0.9);
            }}
         />
         <Pool
            geometry={geos.box}
            material={mats.jade}
            count={GATE_SLOTS}
            update={(k) => {
               const g = gateOf(k);
               if (!framed(g)) return false;
               return place(offsetX, GATE_H + 0.75, c.gates[g].z + 0.46, HALF * 2, 0.16, 0.04);
            }}
         />
         {/* the dust the sinking gate throws up at its foot */}
         <Pool
            geometry={geos.box}
            material={mats.rumble}
            count={GATE_SLOTS * LANES}
            update={(i) => {
               const g = gateOf(Math.floor(i / LANES));
               const l = i % LANES;
               if (g === NONE) return false;
               const gate = c.gates[g];
               if (!near(gate.z) || gate.lanes[l].tier === TIER.slow) return false;
               const sink = gateOpen(g, l);
               if (sink <= 0 || sink >= 1) return false;
               return place(offsetX + laneX(l), 0.2, gate.z, LANE_W - 0.2, 0.4 + 0.2 * Math.sin(time.now * 40 + i), 0.9);
            }}
         />
         {/* the jackpot arch's gold frame */}
         <Pool
            geometry={geos.ring}
            material={mats.gold}
            count={GATE_SLOTS}
            update={(k) => {
               const g = gateOf(k);
               if (g === NONE) return false;
               const gate = c.gates[g];
               const l = gate.lanes.findIndex((r) => r.tier === TIER.jackpot);
               if (l < 0 || !near(gate.z)) return false;
               return place(offsetX + laneX(l), GATE_H * 0.55, gate.z + 0.2, 1.05, 1.15, 1, 0, 0, time.now * 0.6);
            }}
         />
         {/* the offering bowls beside each toll arch, on the pillar's outer side */}
         <DynamicInstancedModel
            asset={ASSETS.bowl}
            count={GATE_SLOTS * LANES}
            update={(i, m) => {
               const g = gateOf(Math.floor(i / LANES));
               const l = i % LANES;
               if (g === NONE) return false;
               const gate = c.gates[g];
               if (!framed(g) || gate.lanes[l].tier === TIER.slow) return false;
               const s = 1.05 / GLB_SIZE.bowl.x;
               place(offsetX + laneX(l) + (l === 0 ? -0.75 : 0.75), 0, gate.z + 1.3, s, s, s);
               m.copy(DUMMY.matrix);
            }}
         />
         {/* Riko's cracked side wall: a glowing cracked slab at the head of the divider beside the cracked lane */}
         <Pool
            geometry={geos.box}
            material={mats.crack}
            count={GATE_SLOTS}
            update={(k) => {
               const g = gateOf(k);
               if (g === NONE) return false;
               const gate = c.gates[g];
               if (gate.cracked === NONE || !near(gate.z) || run.gateResult[g] === GATE.free) return false;
               const side = gate.freeTo > gate.cracked ? 1 : -1;
               return place(offsetX + laneX(gate.cracked) + side * (LANE_W / 2), 1.0, gate.z - 1.2, 0.42, 2.0, 2.2);
            }}
         />
         {/* the section dividers between the lanes, and the fast lanes' gold chevrons */}
         <Pool
            geometry={geos.divider}
            material={mats.stone}
            count={GATE_SLOTS * (LANES - 1)}
            update={(i) => {
               const g = gateOf(Math.floor(i / (LANES - 1)));
               if (g === NONE) return false;
               const gate = c.gates[g];
               if (!near(gate.z) && !near(gate.z1)) return false;
               const x = laneX(i % (LANES - 1)) + LANE_W / 2;
               const len = gate.z - gate.z1 - 1;
               return place(offsetX + x, 0.7, (gate.z + gate.z1) / 2 - 0.5, 1, 1.4, len);
            }}
         />
         <Pool
            geometry={geos.box}
            material={mats.jade}
            count={GATE_SLOTS * (LANES - 1)}
            update={(i) => {
               const g = gateOf(Math.floor(i / (LANES - 1)));
               if (g === NONE) return false;
               const gate = c.gates[g];
               if (!near(gate.z) && !near(gate.z1)) return false;
               const x = laneX(i % (LANES - 1)) + LANE_W / 2;
               return place(offsetX + x, 1.42, (gate.z + gate.z1) / 2 - 0.5, 0.4, 0.08, gate.z - gate.z1 - 1);
            }}
         />
         <Pool
            geometry={geos.chevron}
            material={mats.chevron}
            count={GATE_SLOTS * LANES * 6}
            update={(i) => {
               const g = gateOf(Math.floor(i / (LANES * 6)));
               const l = Math.floor(i / 6) % LANES;
               const k = i % 6;
               if (g === NONE) return false;
               const gate = c.gates[g];
               if (gate.lanes[l].tier === TIER.slow) return false;
               const z = gate.z - 4 - k * ((gate.z - gate.z1 - 6) / 5);
               if (!near(z)) return false;
               const pulse = 0.5 + 0.5 * Math.sin(time.now * 6 - k);
               return place(offsetX + laneX(l), 0.03, z, 1.2, 0.5 + pulse * 0.1, 1, 0, -Math.PI / 2);
            }}
         />
         {/* Nami's ledges over the slow lanes (under the ledge coins) */}
         <DynamicInstancedModel
            asset={ASSETS.ledge}
            count={GATE_SLOTS * LANES}
            update={(i, m) => {
               const g = gateOf(Math.floor(i / LANES));
               const l = i % LANES;
               if (g === NONE) return false;
               const gate = c.gates[g];
               if (gate.lanes[l].tier !== TIER.slow || !near(gate.z - 17)) return false;
               const s = (LANE_W - 0.4) / GLB_SIZE.ledge.x;
               place(offsetX + laneX(l), COIN.ledgeY - 0.75, gate.z - 4 - 17, s, s * 0.7, 9 / GLB_SIZE.ledge.z);
               m.copy(DUMMY.matrix);
            }}
         />
         {GATE_SLOTS > 0 ? [0, 1, 2].map((k) => <PriceBadges key={k} run={run} slot={k} />) : null}

         {/* coins */}
         <DynamicInstancedModel
            asset={ASSETS.coin}
            count={COIN_SLOTS}
            update={(i, m) => {
               fill();
               if (i >= lists.nearN) return false;
               const id = lists.near[i];
               spotOf(id, p);
               // the GLB lies flat: stood up on its edge (about x), then spun about the world's y
               const spin = time.now * 3.2 + p.z * 0.4;
               place(offsetX + p.x, p.y, p.z, coinScale, coinScale, coinScale, spin, Math.PI / 2, 0, "YXZ");
               m.copy(DUMMY.matrix);
               M4.makeTranslation(0, -GLB_SIZE.coin.y / 2, 0);
               m.multiply(M4);
            }}
         />
         <Pool
            geometry={geos.disc}
            material={mats.disc}
            count={FAR_SLOTS}
            update={(i) => {
               fill();
               if (i >= lists.farN) return false;
               spotOf(lists.far[i], p);
               return place(offsetX + p.x, p.y, p.z, COIN_D, 1, COIN_D, time.now * 3 + p.z * 0.4, Math.PI / 2, 0, "YXZ");
            }}
         />
         {/* Zuno's veins: glints in the wall while the coins are still inside */}
         <Pool
            geometry={geos.glint}
            material={mats.glint}
            count={24}
            update={(() => {
               const ids: number[] = [];
               return (i: number) => {
                  if (i === 0) {
                     ids.length = 0;
                     for (let q = 0; q < c.coins.length && ids.length < 24; q++) {
                        const o = c.coins[q];
                        if (o.need !== 1 || run.collected[q] || !near(o.z) || run.simMs < run.hero.magnetUntil) continue;
                        ids.push(q);
                     }
                  }
                  if (i >= ids.length) return false;
                  const o = c.coins[ids[i]];
                  const tw = 0.6 + 0.4 * Math.sin(time.now * 5 + o.z);
                  return place(offsetX + o.x + Math.sign(o.x) * 0.3, o.y, o.z, tw, tw, tw);
               };
            })()}
         />
         {/* relic orbs: a jade gem in a halo */}
         <Pool
            geometry={geos.gem}
            material={mats.relic}
            count={4}
            update={(i) => {
               if (i >= c.orbs.length || run.orbMask & (1 << i)) return false;
               const o = c.orbs[i];
               if (!near(o.z)) return false;
               return place(offsetX + o.x, o.y + 0.15 * Math.sin(time.now * 2 + i), o.z, 1.3, 1.6, 1.3, time.now * 1.5);
            }}
         />
         <Pool
            geometry={geos.halo}
            material={mats.halo}
            count={4}
            update={(i) => {
               if (i >= c.orbs.length || run.orbMask & (1 << i)) return false;
               const o = c.orbs[i];
               if (!near(o.z)) return false;
               const s = 1 + 0.1 * Math.sin(time.now * 3 + i);
               return place(offsetX + o.x, o.y, o.z, s, s, s, time.now * 0.8);
            }}
         />
         {/* secrets: Vexa's shard in the ghost passage, the jackpot room's shard */}
         <Pool
            geometry={geos.gem}
            material={mats.shard}
            count={3}
            update={(i) => {
               if (i >= c.secrets.length || run.secrets.found[i]) return false;
               const s = c.secrets[i];
               if (s.need === "pauper" || !near(s.z)) return false;
               const spec = SECRETS[c.level][i];
               if (spec.id === "ghost" && run.gateResult[s.gate] !== GATE.ghost && !(run.simMs < run.hero.phaseUntil)) return false;
               return place(offsetX + s.x, s.y + 0.2 * Math.sin(time.now * 2.5), s.z, 0.9, 1.4, 0.9, time.now * 2);
            }}
         />

         {/* stone blocks (jump them) */}
         <DynamicInstancedModel
            asset={ASSETS.block}
            count={Math.min(24, blocks.length)}
            update={(() => {
               const ids: number[] = [];
               return (i: number, m: Matrix4) => {
                  if (i === 0) {
                     ids.length = 0;
                     for (const q of blocks) if (near(hz[q].z) && ids.length < 24) ids.push(q);
                  }
                  if (i >= ids.length) return false;
                  const b = hz[ids[i]];
                  place(offsetX + laneX(b.lane), 0, b.z, 1.9 / GLB_SIZE.block.x, BLOCK_H / GLB_SIZE.block.y, 1.1 / GLB_SIZE.block.z, (ids[i] % 2) * Math.PI);
                  m.copy(DUMMY.matrix);
               };
            })()}
         />
         {/* low beams (roll under them) on two posts */}
         <DynamicInstancedModel
            asset={ASSETS.beam}
            count={Math.max(1, Math.min(4, beams.length))}
            update={(i, m) => {
               const ids = beams.filter((q) => near(hz[q].z));
               if (i >= ids.length) return false;
               const b = hz[ids[i]];
               place(offsetX, 0.95, b.z, (HALF * 2) / GLB_SIZE.beam.x, 0.55 / GLB_SIZE.beam.y, 0.6 / GLB_SIZE.beam.z);
               m.copy(DUMMY.matrix);
            }}
         />
         <Pool
            geometry={geos.pillar}
            material={mats.trim}
            count={8}
            update={(i) => {
               const ids = beams.filter((q) => near(hz[q].z));
               const k = Math.floor(i / 2);
               if (k >= ids.length) return false;
               return place(offsetX + (i % 2 ? 1 : -1) * (HALF - 0.2), 0.9, hz[ids[k]].z, 0.8, 1.8, 0.8);
            }}
         />
         {/* fire-jet pillars on the lane's left line, and their flames across the lane */}
         <DynamicInstancedModel
            asset={ASSETS.jet}
            count={Math.max(1, Math.min(6, jets.length))}
            update={(i, m) => {
               const ids = jets.filter((q) => near(hz[q].z));
               if (i >= ids.length) return false;
               const j = hz[ids[i]];
               const s = 1.7 / GLB_SIZE.jet.y;
               place(offsetX + laneX(j.lane) - LANE_W / 2 + 0.1, 0, j.z, s, s, s);
               m.copy(DUMMY.matrix);
            }}
         />
         <Pool
            geometry={geos.flame}
            material={mats.flame}
            count={12}
            update={(i) => {
               const ids = jets.filter((q) => near(hz[q].z));
               const k = Math.floor(i / 2);
               if (k >= ids.length) return false;
               const j = hz[ids[k]];
               const f = 0.85 + 0.15 * Math.sin(time.now * 22 + i * 2.1);
               const y = i % 2 ? 0.7 : 1.35;
               return place(offsetX + laneX(j.lane) - 0.1, y, j.z, 0.55 * f, LANE_W * f, 0.55 * f, 0, 0, Math.PI / 2);
            }}
         />
         {/* spike tiles: the tile rises with its spikes on the rhythm */}
         <DynamicInstancedModel
            asset={ASSETS.spike}
            count={Math.max(1, Math.min(16, spikes.length))}
            update={(() => {
               const ids: number[] = [];
               return (i: number, m: Matrix4) => {
                  if (i === 0) {
                     ids.length = 0;
                     for (const q of spikes) if (near(hz[q].z) && ids.length < 16) ids.push(q);
                  }
                  if (i >= ids.length) return false;
                  const sp = hz[ids[i]];
                  const up = spikeUp(sp, run.simMs);
                  const s = tileW / GLB_SIZE.spike.x;
                  place(offsetX + laneX(sp.lane), up ? 0 : -0.28, sp.z, s, s * 0.9, 1.8 / GLB_SIZE.spike.z);
                  m.copy(DUMMY.matrix);
               };
            })()}
         />
         {/* broken tiles: glowing once the rumble passed, then dropping away into a pit */}
         <DynamicInstancedModel
            asset={ASSETS.broken}
            count={Math.max(1, Math.min(20, brokens.length))}
            update={(() => {
               const ids: number[] = [];
               return (i: number, m: Matrix4) => {
                  if (i === 0) {
                     ids.length = 0;
                     for (const q of brokens) if (near(hz[q].z) && ids.length < 20) ids.push(q);
                  }
                  if (i >= ids.length) return false;
                  const q = ids[i];
                  const b = hz[q];
                  const t = (run.simMs - run.tileFall[q]) / 1000;
                  if (t > 1.2) return false;
                  const shake = run.tileFall[q] !== Infinity && t < 0 ? Math.sin(time.now * 60 + q) * 0.03 : 0;
                  const drop = t > 0 ? 9 * t * t : 0;
                  const s = tileW / GLB_SIZE.broken.x;
                  place(offsetX + laneX(b.lane) + shake, -0.38 - drop, b.z, s, s, 1.9 / GLB_SIZE.broken.z, 0, t > 0 ? t * 0.8 : 0);
                  m.copy(DUMMY.matrix);
               };
            })()}
         />
         <Pool
            geometry={geos.box}
            material={mats.crack}
            count={20}
            update={(() => {
               const ids: number[] = [];
               return (i: number) => {
                  if (i === 0) {
                     ids.length = 0;
                     for (const q of brokens) if (near(hz[q].z) && run.tileFall[q] !== Infinity && run.simMs < run.tileFall[q] && ids.length < 20) ids.push(q);
                  }
                  if (i >= ids.length) return false;
                  const b = hz[ids[i]];
                  return place(offsetX + laneX(b.lane), 0.02, b.z, tileW * 0.9, 0.03, 1.7);
               };
            })()}
         />
         <Pool
            geometry={geos.box}
            material={mats.pit}
            count={20}
            update={(() => {
               const ids: number[] = [];
               return (i: number) => {
                  if (i === 0) {
                     ids.length = 0;
                     for (const q of brokens) if (near(hz[q].z) && run.simMs >= run.tileFall[q] && ids.length < 20) ids.push(q);
                  }
                  if (i >= ids.length) return false;
                  const b = hz[ids[i]];
                  return place(offsetX + laneX(b.lane), -0.5, b.z, tileW, 1, 1.9);
               };
            })()}
         />
         {/* the rumble waves (level 3+): a dust band rolling ahead of the boulder */}
         <Pool
            geometry={geos.box}
            material={mats.rumble}
            count={4}
            update={(k) => {
               if (!run.waveLive[k]) return false;
               return place(offsetX, 0.15, run.waveZ[k], HALF * 2, 0.3 + 0.1 * Math.sin(time.now * 20 + k), 0.8);
            }}
         />
         {/* level 4's side-ramp boulders */}
         <DynamicInstancedModel
            asset={ASSETS.boulder}
            count={Math.max(1, c.crosses.length > 0 ? 2 : 0)}
            update={(() => {
               const ids: number[] = [];
               return (i: number, m: Matrix4) => {
                  if (i === 0) {
                     ids.length = 0;
                     for (let q = 0; q < c.crosses.length && ids.length < 2; q++) if (near(c.crosses[q].z)) ids.push(q);
                  }
                  if (i >= ids.length) return false;
                  const q = ids[i];
                  const cr = c.crosses[q];
                  let x = crossX(run, q);
                  // waiting on its ramp (outside the wall) until it rolls; gone once across
                  if (!Number.isFinite(x)) {
                     if (run.crossStart[q] >= 0) return false;
                     x = cr.side * CROSS.start;
                  }
                  // it rolls across the hall: round the z axis
                  const d = 2.2;
                  placeCentered(m, offsetX + x, 0, cr.z, d / GLB_SIZE.boulder.x, d / GLB_SIZE.boulder.y, GLB_SIZE.boulder.y, 0, 0, -x / (d / 2));
               };
            })()}
         />
         {/* the boulder at your heels (until Coilstone takes over) */}
         <DynamicInstancedModel
            asset={ASSETS.boulder}
            count={1}
            update={(_i, m) => {
               if (serpentOn() || run.ended === "win") return false;
               const s = BOULDER_D / GLB_SIZE.boulder.x;
               const sy = BOULDER_D / GLB_SIZE.boulder.y;
               const roll = -(c.startZ - chaserZ(run)) / (BOULDER_D / 2);
               placeCentered(m, offsetX + headPos.x * 0.6, 0, headPos.z + BOULDER_D / 2, s, sy, GLB_SIZE.boulder.y, roll);
            }}
         />
         {/* level 5: Coilstone */}
         {boss ? (
            <>
               <DynamicInstancedModel
                  asset={ASSETS.head}
                  count={1}
                  update={(_i, m) => {
                     if (!serpentOn()) return false;
                     const t = time.now;
                     // it rears out of the floor behind the hero: half sunk, so the hero and the course stay in view
                     let y = -1.1 + Math.sin(t * 2) * 0.12 + headPos.lunge * 0.5;
                     let z = headPos.z + 1.2 - headPos.lunge * 2.6;
                     if (!Number.isNaN(headPos.freedAt)) {
                        // freed: it rears up and slides away over the wall
                        const k = Math.min(1, (t - headPos.freedAt) / 2.5);
                        y += k * 7;
                        z += k * 14;
                     }
                     place(offsetX + headPos.x, y, z, HEAD_SCALE, HEAD_SCALE, HEAD_SCALE, Math.PI, bossVulnerable(run) ? 0.25 : 0);
                     m.copy(DUMMY.matrix);
                  }}
               />
               <DynamicInstancedModel
                  asset={ASSETS.segment}
                  count={quality2}
                  update={(i, m) => {
                     if (!serpentOn()) return false;
                     const t = time.now;
                     // the body rises from behind its head onto the left wall's top and coils along it,
                     // ahead past the hero: a colossal serpent in the upper corner of the view
                     const k = i / quality2;
                     // from just ahead of the hero (never between the camera and the hero) onwards
                     const z = run.hero.z - 1 - i * 2.9;
                     const y = 5.9 + Math.sin(t * 1.6 + i * 0.9) * 0.35;
                     const x = -(HALF + 1.5) + Math.sin(t * 0.9 + i) * 0.3;
                     const sc = SEGMENT_SCALE * (1 - k * 0.25);
                     place(offsetX + x, y, z, sc, sc, sc, 0, Math.sin(t + i) * 0.2);
                     m.copy(DUMMY.matrix);
                  }}
               />
               {/* the coils across the lanes (phase 2): low to jump, high to roll under */}
               <DynamicInstancedModel
                  asset={ASSETS.segment}
                  count={LANES}
                  update={(i, m) => {
                     const bh = run.hazard;
                     if (!bh.live || bh.kind === 0) return false;
                     const s = bh.kind === 1 ? 0.9 / GLB_SIZE.segment.y : 0.9 / GLB_SIZE.segment.y;
                     const y = bh.kind === 1 ? 0 : 1.05;
                     place(offsetX + laneX(i), y, bh.z, (LANE_W + 0.2) / GLB_SIZE.segment.x, s, s, 0);
                     m.copy(DUMMY.matrix);
                  }}
               />
               {/* the lunge's mark: dust in the lane it aims at */}
               <Pool
                  geometry={geos.box}
                  material={mats.rumble}
                  count={1}
                  update={() => {
                     const bh = run.hazard;
                     if (!bh.live || bh.kind !== 0) return false;
                     return place(offsetX + laneX(bh.lane), 0.05, run.hero.z - 2, LANE_W, 0.1 + 0.08 * Math.sin(time.now * 30), 14);
                  }}
               />
               {/* the arena's tolls: a bell gate over the middle lane, or a row of offering bowls */}
               <DynamicInstancedModel
                  asset={ASSETS.gate}
                  count={3}
                  update={(i, m) => {
                     const s = run.arenaMet + i;
                     if (s >= run.arenaSpawned) return false;
                     const z = run.arenaZ[s];
                     if (!near(z) || arenaToll(run, s).bowls) return false;
                     place(offsetX + laneX(1), 0, z, gateS, gateS, gateS * 0.6, Math.PI);
                     m.copy(DUMMY.matrix);
                  }}
               />
               <Pool
                  geometry={geos.bell}
                  material={mats.bronze}
                  count={3}
                  update={(i) => {
                     const s = run.arenaMet + i - 1;
                     if (s < 0 || s >= run.arenaSpawned) return false;
                     const z = run.arenaZ[s];
                     if (arenaToll(run, s).bowls) return false;
                     if (run.arenaPaid[s]) {
                        // the paid bell flies back over the hero to Coilstone's head
                        const k = Math.min(1, (z - run.hero.z) / 10);
                        if (k >= 1) return false;
                        return place(offsetX + laneX(1) * (1 - k) + headPos.x * k, GATE_H - 0.4 + Math.sin(k * Math.PI) * 6, z + (headPos.z - z) * k, 0.8, 0.8, 0.8, k * 6);
                     }
                     if (!near(z) || s < run.arenaMet) return false;
                     return place(offsetX + laneX(1), GATE_H - 0.4 + Math.sin(time.now * 2 + s) * 0.05, z, 0.8, 0.8, 0.8, 0, Math.sin(time.now * 1.5 + s) * 0.1);
                  }}
               />
               <DynamicInstancedModel
                  asset={ASSETS.bowl}
                  count={9}
                  update={(i, m) => {
                     const s = run.arenaMet + Math.floor(i / LANES);
                     const l = i % LANES;
                     if (s >= run.arenaSpawned) return false;
                     const z = run.arenaZ[s];
                     if (!near(z) || !arenaToll(run, s).bowls) return false;
                     const sc = 1.4 / GLB_SIZE.bowl.x;
                     place(offsetX + laneX(l), 0, z, sc, sc, sc);
                     m.copy(DUMMY.matrix);
                  }}
               />
               <Pool
                  geometry={geos.halo}
                  material={mats.halo}
                  count={9}
                  update={(i) => {
                     const s = run.arenaMet + Math.floor(i / LANES);
                     const l = i % LANES;
                     if (s >= run.arenaSpawned) return false;
                     const z = run.arenaZ[s];
                     if (!near(z) || !arenaToll(run, s).bowls || run.purse.coins < ARENA.bowl) return false;
                     const k = 1.2 + 0.1 * Math.sin(time.now * 4 + i);
                     return place(offsetX + laneX(l), 1.4, z, k, k, k, 0, Math.PI / 2);
                  }}
               />
               {/* Shadow Plates' dark plates on its head: one fewer per hit */}
               <Pool
                  geometry={geos.box}
                  material={mats.dark}
                  count={5}
                  update={(i) => {
                     const b = run.boss!;
                     if (!serpentOn() || i >= Math.min(5, b.hp)) return false;
                     const a = (i / 5) * Math.PI - Math.PI / 2;
                     const z = headPos.z + 1.2 - headPos.lunge * 2.6;
                     return place(offsetX + headPos.x + Math.sin(a) * 0.55, 1.7 + Math.cos(a) * 0.25 + headPos.lunge * 0.5, z + 0.2, 0.28, 0.12, 0.3, 0, -0.5, a);
                  }}
               />
            </>
         ) : null}
         {/* the finish: a grand gate of the temple's exit, glowing jade */}
         <DynamicInstancedModel
            asset={ASSETS.gate}
            count={1}
            update={(_i, m) => {
               const z = run.finishGate;
               if (!near(z) || bossAlive(run)) return false;
               const s = (HALF * 2) / GLB_SIZE.gate.x;
               place(offsetX, 0, z, s, s * 0.85, s * 0.5, Math.PI);
               m.copy(DUMMY.matrix);
            }}
         />
         <Pool
            geometry={geos.ring}
            material={mats.halo}
            count={1}
            update={() => {
               const z = run.finishGate;
               if (!near(z) || bossAlive(run)) return false;
               const k = 2.6 + 0.15 * Math.sin(time.now * 3);
               return place(offsetX, 3.2, z + 0.4, k, k, k);
            }}
         />
      </group>
   );
}
