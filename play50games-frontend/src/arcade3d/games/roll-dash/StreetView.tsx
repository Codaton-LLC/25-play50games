"use client";

// The street (no gameplay here: rules.ts owns it). Greytown's causeway: a grey road with three lanes,
// old-town houses (m2OldTownHouseBg) and street lamps (m2StreetLamp) along both kerbs, market stalls
// (m2MarketStall) in Market Lane and Old Town, and the fortress gate (skyFortressGate) at the end. Only
// the stretch around the roller is drawn (moving pools): a 1.5 km street costs the same as a short one.
// The Prism Locks, each with its glyph billboard over it (World 6: never colour alone):
// - red: a cracked crate barricade (m2ArenaCrate, red);
// - blue: a 3 m barrier (m2CityBarrier stood up, blue);
// - green: two tesla coils (m2TeslaCoil) with an arc between them;
// - yellow: a gold vault (m2ArenaCrate, gold);
// - purple: a ghost wall (m2EnergyBarrierWall, violet).
// Plain obstacles: crates (m2ArenaCrate), hanging signs (code), ore carts (m2OreCart, Old Town). Level 3's
// shadow rollers (m2ShadowArmadillo) roll in to repaint a lock; level 4's locks stay grey and glyphless
// outside a lamp's light. Behind every correct unlock the street repaints in colour (the colour returning).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, Euler, Matrix4, Quaternion, RepeatWrapping, SRGBColorSpace, Vector3, type Mesh } from "three";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, COIN_SIZE, GLB_SIZE, LOCK_W } from "./assets";
import { LANE_W, cartX, laneX, lit } from "./course";
import { HERO_IDS, heroById, type HeroId } from "./heroes";
import { COLORS, HERO_COLOURS, levelLook } from "./look";
import { BARRIER_H, CRATE_H, SIGN_HIGH, SIGN_LOW, type DashRun, type LiveItem } from "./rules";

const BEHIND = 15;
const AHEAD = 150;

const P = new Vector3();
const S = new Vector3();
const Q = new Quaternion();
const E = new Euler();
const UP = new Vector3(0, 1, 0);

function place(m: Matrix4, x: number, y: number, z: number, sx: number, sy: number, sz: number, rotY = 0): void {
   P.set(x, y, z);
   S.set(sx, sy, sz);
   Q.setFromAxisAngle(UP, rotY);
   m.compose(P, Q, S);
}

const TINT: Record<HeroId, Color> = {
   riko: new Color(HERO_COLOURS.riko),
   nami: new Color(HERO_COLOURS.nami),
   kiro: new Color(HERO_COLOURS.kiro),
   zuno: new Color(HERO_COLOURS.zuno),
   vexa: new Color(HERO_COLOURS.vexa),
};
const GREY = new Color("#6b7280");

/** A glyph sprite (chevron, wave, hexagon, horseshoe, spiral) on a disc in the hero's colour. */
function glyphTexture(hero: HeroId): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = 128;
   c.height = 128;
   const g = c.getContext("2d")!;
   g.fillStyle = HERO_COLOURS[hero];
   g.beginPath();
   g.arc(64, 64, 60, 0, Math.PI * 2);
   g.fill();
   g.strokeStyle = "#ffffff";
   g.lineWidth = 12;
   g.lineCap = "round";
   g.lineJoin = "round";
   g.beginPath();
   const glyph = heroById(hero).glyph;
   if (glyph === "chevron") {
      g.moveTo(38, 44);
      g.lineTo(64, 70);
      g.lineTo(90, 44);
      g.moveTo(38, 70);
      g.lineTo(64, 96);
      g.lineTo(90, 70);
   } else if (glyph === "wave") {
      g.moveTo(26, 70);
      g.bezierCurveTo(46, 36, 60, 100, 78, 60);
      g.bezierCurveTo(88, 40, 98, 50, 104, 58);
   } else if (glyph === "hexagon") {
      for (let k = 0; k <= 6; k++) {
         const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
         const x = 64 + Math.cos(a) * 34;
         const y = 64 + Math.sin(a) * 34;
         if (k === 0) g.moveTo(x, y);
         else g.lineTo(x, y);
      }
   } else if (glyph === "horseshoe") {
      g.arc(64, 58, 28, Math.PI * 0.95, Math.PI * 2.05, false);
      g.moveTo(36, 62);
      g.lineTo(36, 94);
      g.moveTo(92, 62);
      g.lineTo(92, 94);
   } else {
      for (let k = 0; k < 60; k++) {
         const a = k * 0.32;
         const r = 4 + k * 0.6;
         const x = 64 + Math.cos(a) * r;
         const y = 64 + Math.sin(a) * r;
         if (k === 0) g.moveTo(x, y);
         else g.lineTo(x, y);
      }
   }
   g.stroke();
   const t = new CanvasTexture(c);
   t.colorSpace = SRGBColorSpace;
   return t;
}

function rainbowTexture(): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = 256;
   c.height = 4;
   const g = c.getContext("2d")!;
   const grad = g.createLinearGradient(0, 0, 256, 0);
   const cols = ["#ef4444", "#facc15", "#22c55e", "#2563eb", "#8b5cf6", "#ef4444"];
   cols.forEach((col, i) => grad.addColorStop(i / (cols.length - 1), col));
   g.fillStyle = grad;
   g.fillRect(0, 0, 256, 4);
   const t = new CanvasTexture(c);
   t.wrapS = t.wrapT = RepeatWrapping;
   t.colorSpace = SRGBColorSpace;
   return t;
}

/** The items within the drawn stretch, sorted by kind for the pools (filled each frame). */
interface Window {
   crates: LiveItem[];
   barriers: LiveItem[];
   teslas: LiveItem[];
   ghosts: LiveItem[];
   carts: LiveItem[];
   signs: LiveItem[];
   glyphs: LiveItem[];
   plates: LiveItem[];
   rollers: LiveItem[];
}

const emptyWindow = (): Window => ({ crates: [], barriers: [], teslas: [], ghosts: [], carts: [], signs: [], glyphs: [], plates: [], rollers: [] });

/** The lanes a lock (or full lock) covers. */
const lanesOf = (it: LiveItem): readonly number[] => (it.lane < 0 ? [0, 1, 2] : [it.lane]);

function Items({ run }: { run: DashRun }) {
   const win = useMemo(emptyWindow, []);
   const time = useGameTime();
   const c = run.course;
   useFrame(() => {
      for (const k of Object.keys(win) as (keyof Window)[]) win[k].length = 0;
      const h = run.hero;
      for (let i = Math.max(0, run.scan - 4); i < run.items.length; i++) {
         const it = run.items[i];
         if (it.d > h.d + AHEAD) break;
         if (it.d < h.d - BEHIND || it.done) continue;
         if (it.kind === "crate") win.crates.push(it);
         else if (it.kind === "sign") win.signs.push(it);
         else if (it.kind === "cart") win.carts.push(it);
         else if (it.boss === "plate") win.plates.push(it);
         else {
            const col = it.now;
            if (col === "riko" || col === "zuno") win.crates.push(it);
            else if (col === "nami") win.barriers.push(it);
            else if (col === "kiro") win.teslas.push(it);
            else if (col === "vexa") win.ghosts.push(it);
            win.glyphs.push(it);
            if (it.repaint && it.now === it.colour && it.d - h.d < 40) win.rollers.push(it);
         }
      }
   }, -0.3);

   // crate-like: plain crates (their own wood), red barricades and gold vaults (tinted), a crate per lane
   const crateS = { x: LOCK_W / GLB_SIZE.crate.x, y: CRATE_H / GLB_SIZE.crate.y, z: 1.0 / GLB_SIZE.crate.z };
   const crateSlots = (n: number) => {
      let k = 0;
      for (const it of win.crates) {
         const lanes = lanesOf(it);
         if (n < k + lanes.length) return { it, lane: lanes[n - k] };
         k += lanes.length;
      }
      return null;
   };
   const slotsOf = (list: LiveItem[], n: number) => {
      let k = 0;
      for (const it of list) {
         const lanes = lanesOf(it);
         if (n < k + lanes.length) return { it, lane: lanes[n - k] };
         k += lanes.length;
      }
      return null;
   };
   const tintOf = (it: LiveItem, color: Color): boolean => {
      if (it.kind !== "lock" || !it.now) return false;
      color.copy(lit(c, it.d) ? TINT[it.now] : GREY);
      return true;
   };
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.crate}
            count={48}
            tinted
            update={(i, m, color) => {
               const s = crateSlots(i);
               if (!s) return false;
               const tall = s.it.kind === "lock" ? 1.6 : 1;
               place(m, laneX(s.lane), 0, -(s.it.d + 0.5), crateS.x, crateS.y * tall, crateS.z, (s.it.id % 4) * 0.08);
               tintOf(s.it, color);
            }}
         />
         <DynamicInstancedModel
            asset={ASSETS.barrier}
            count={18}
            tinted
            update={(i, m, color) => {
               const s = slotsOf(win.barriers, i);
               if (!s) return false;
               // the city barrier stood up and turned across the lane: BARRIER_H + 0.7 m tall
               place(m, laneX(s.lane), 0, -(s.it.d + 0.3), LOCK_W / GLB_SIZE.barrier.z, (BARRIER_H + 0.7) / GLB_SIZE.barrier.y, 0.6 / GLB_SIZE.barrier.x, Math.PI / 2);
               tintOf(s.it, color);
            }}
         />
         <DynamicInstancedModel
            asset={ASSETS.tesla}
            count={36}
            tinted
            update={(i, m, color) => {
               const s = slotsOf(win.teslas, i >> 1);
               if (!s) return false;
               const side = i & 1 ? 1 : -1;
               place(m, laneX(s.lane) + side * (LANE_W / 2 - 0.15), 0, -(s.it.d + 0.5), 0.6 / GLB_SIZE.tesla.x, 2.2 / GLB_SIZE.tesla.y, 0.6 / GLB_SIZE.tesla.z);
               tintOf(s.it, color);
            }}
         />
         <DynamicInstanced
            count={18}
            name="tesla-arcs"
            update={(i, m) => {
               const s = slotsOf(win.teslas, i);
               if (!s || !lit(c, s.it.d)) return false;
               const flick = 0.7 + 0.3 * Math.sin(time.now * 40 + i);
               place(m, laneX(s.lane), 1.2, -(s.it.d + 0.5), LANE_W - 0.3, 0.07 * flick, 0.07);
            }}
         >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#86efac" toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstancedModel
            asset={ASSETS.ghostWall}
            count={18}
            tinted
            update={(i, m, color) => {
               const s = slotsOf(win.ghosts, i);
               if (!s) return false;
               const wob = 1 + Math.sin(time.now * 5 + i) * 0.03;
               place(m, laneX(s.lane), 0, -(s.it.d + 0.5), (LOCK_W / GLB_SIZE.ghostWall.x) * wob, 2.6 / GLB_SIZE.ghostWall.y, 2);
               tintOf(s.it, color);
            }}
         />
         <DynamicInstancedModel
            asset={ASSETS.cart}
            count={8}
            update={(i, m) => {
               const it = win.carts[i];
               if (!it) return false;
               place(m, cartX(it, run.simMs), 0, -(it.d + 0.95), 1.3 / GLB_SIZE.cart.x, 1.15 / GLB_SIZE.cart.y, 1.9 / GLB_SIZE.cart.z, Math.PI / 2);
            }}
         />
         <DynamicInstanced
            count={18}
            name="signs"
            update={(i, m) => {
               const it = win.signs[i];
               if (!it) return false;
               place(m, laneX(it.lane), (SIGN_LOW + SIGN_HIGH) / 2, -(it.d + 0.25), LANE_W - 0.2, SIGN_HIGH - SIGN_LOW, 0.12);
            }}
         >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#e2e8f0" emissive="#f59e0b" emissiveIntensity={0.25} roughness={0.6} />
         </DynamicInstanced>
         <DynamicInstanced
            count={18}
            name="sign-posts"
            update={(i, m) => {
               const it = win.signs[i >> 1];
               if (!it) return false;
               const side = i & 1 ? 1 : -1;
               place(m, laneX(it.lane) + side * (LANE_W / 2 - 0.05), SIGN_HIGH / 2 + 0.1, -(it.d + 0.25), 0.1, SIGN_HIGH + 0.2, 0.1);
            }}
         >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#374151" roughness={0.8} />
         </DynamicInstanced>
         {HERO_IDS.map((hero) => (
            <Glyphs key={hero} run={run} win={win} hero={hero} />
         ))}
         <Plates run={run} win={win} />
         <DynamicInstancedModel
            asset={ASSETS.roller}
            count={4}
            update={(i, m) => {
               const it = win.rollers[i];
               if (!it) return false;
               // it rolls in from the kerb towards the lock as you close in
               const h = run.hero;
               const k = Math.max(0, Math.min(1, 1 - (it.d - h.d - 8) / 30));
               const x = (it.lane < 0 ? 1 : it.lane - 1) * LANE_W + (1 - k) * 6;
               place(m, x, 0, -(it.d + 1.4), 1.1 / GLB_SIZE.roller.x, 1.1 / GLB_SIZE.roller.x, 1.1 / GLB_SIZE.roller.x, time.now * 6);
            }}
         />
      </>
   );
}

/** One hero colour's glyph billboards (a pool), over its locks, facing down the street at you. */
function Glyphs({ run, win, hero }: { run: DashRun; win: Window; hero: HeroId }) {
   const tex = useMemo(() => glyphTexture(hero), [hero]);
   useEffect(() => () => tex.dispose(), [tex]);
   const time = useGameTime();
   const c = run.course;
   return (
      <DynamicInstanced
         count={12}
         name={`glyph-${hero}`}
         update={(i, m) => {
            let n = 0;
            for (const it of win.glyphs) {
               if (it.now !== hero) continue;
               if (n++ !== i) continue;
               if (!lit(c, it.d)) return false;
               // a lock lights up leadS ahead (time, not distance): the glyph grows in
               const ahead = (it.d - run.hero.d) / Math.max(1, c.cfg.speed);
               const k = ahead > c.cfg.leadS + 0.4 ? 0.35 : 1;
               const x = it.lane < 0 ? 0 : laneX(it.lane);
               const s = (it.lane < 0 ? 1.4 : 0.95) * k * (1 + Math.sin(time.now * 6) * 0.05);
               place(m, x, 3.3, -(it.d + 0.2), s, s, s);
               return;
            }
            return false;
         }}
      >
         <planeGeometry args={[1, 1]} />
         <meshBasicMaterial map={tex} transparent toneMapped={false} side={DoubleSide} depthWrite={false} />
      </DynamicInstanced>
   );
}

/** Level 5, P3: the Hawk's five plates, glowing rings across the bridge, each in its hero's colour. */
function Plates({ run, win }: { run: DashRun; win: Window }) {
   return (
      <DynamicInstanced
         count={6}
         name="plates"
         tinted
         update={(i, m, color) => {
            const it = win.plates[i];
            if (!it || !it.now) return false;
            P.set(0, 2.2, -(it.d + 0.2));
            Q.setFromEuler(E.set(0, 0, 0));
            S.set(3.4, 2.2, 1);
            m.compose(P, Q, S);
            color.copy(TINT[it.now]);
         }}
      >
         <ringGeometry args={[0.75, 1, 40]} />
         <meshBasicMaterial color="#ffffff" transparent opacity={0.85} side={DoubleSide} toneMapped={false} />
      </DynamicInstanced>
   );
}

function Orbs({ run }: { run: DashRun }) {
   const time = useGameTime();
   const c = run.course;
   const s = COIN_SIZE / GLB_SIZE.coin.y;
   const first = useRef(0);
   return (
      <DynamicInstancedModel
         asset={ASSETS.coin}
         count={40}
         update={(i, m) => {
            const h = run.hero;
            if (i === 0) {
               while (first.current < c.orbs.length && c.orbs[first.current].d < h.d - 6) first.current += 1;
            }
            let k = first.current;
            let n = 0;
            while (k < c.orbs.length) {
               const o = c.orbs[k];
               if (o.d > h.d + AHEAD) return false;
               if (!run.orbTaken[k]) {
                  if (n === i) {
                     place(m, laneX(o.lane), o.y - COIN_SIZE / 2, -o.d, s, s, s, time.now * 3 + k);
                     return;
                  }
                  n += 1;
               }
               k += 1;
            }
            return false;
         }}
      />
   );
}

const HOUSE_GAP = 9;
const LAMP_GAP = 26;

/** The kerbs: houses both sides, lamps, stalls (Market Lane, Old Town), around the roller. */
function Kerbs({ run }: { run: DashRun }) {
   const look = levelLook(run.level);
   const hs = 6 / GLB_SIZE.house.y;
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.house}
            count={44}
            update={(i, m) => {
               const base = Math.floor((run.hero.d - BEHIND) / HOUSE_GAP);
               const k = base + (i >> 1);
               const side = i & 1 ? 1 : -1;
               const d = k * HOUSE_GAP;
               const tall = 1 + ((k * 7 + (side > 0 ? 3 : 0)) % 4) * 0.18;
               place(m, side * 8.6, 0, -d, hs * 1.2, hs * tall, hs, side > 0 ? -Math.PI / 2 : Math.PI / 2);
            }}
         />
         <DynamicInstancedModel
            asset={ASSETS.lamp}
            count={14}
            update={(i, m) => {
               const base = Math.floor((run.hero.d - BEHIND) / LAMP_GAP);
               const k = base + (i >> 1);
               const side = i & 1 ? 1 : -1;
               place(m, side * 4.3, 0, -(k * LAMP_GAP + 6), 4.2 / GLB_SIZE.lamp.y, 4.2 / GLB_SIZE.lamp.y, 4.2 / GLB_SIZE.lamp.y, side > 0 ? -Math.PI / 2 : Math.PI / 2);
            }}
         />
         {look.stalls && (
            <DynamicInstancedModel
               asset={ASSETS.stall}
               count={14}
               update={(i, m) => {
                  const gap = 21;
                  const base = Math.floor((run.hero.d - BEHIND) / gap);
                  const k = base + (i >> 1);
                  const side = i & 1 ? 1 : -1;
                  place(m, side * 5.9, 0, -(k * gap + 11), 2.6 / GLB_SIZE.stall.x, 2.6 / GLB_SIZE.stall.x, 2.6 / GLB_SIZE.stall.x, side > 0 ? -Math.PI / 2 : Math.PI / 2);
               }}
            />
         )}
      </>
   );
}

/** The road: three lanes, kerbs, and the colour returning behind the roller. */
function Road({ run }: { run: DashRun }) {
   const c = run.course;
   const len = c.cfg.boss ? 3000 : c.length + 80;
   const paint = useRef<Mesh>(null);
   const rainbow = useMemo(rainbowTexture, []);
   useEffect(() => () => rainbow.dispose(), [rainbow]);
   useFrame(() => {
      const m = paint.current;
      if (!m) return;
      const to = Math.max(0.01, run.paintedTo);
      m.scale.set(1, to, 1);
      m.position.z = -to / 2;
      rainbow.repeat.set(1, to / 40);
   });
   return (
      <>
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, -len / 2 + 20]}>
            <planeGeometry args={[7.4, len]} />
            <meshStandardMaterial color={COLORS.street} roughness={0.95} />
         </mesh>
         {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 3.95, 0.1, -len / 2 + 20]}>
               <boxGeometry args={[0.5, 0.24, len]} />
               <meshStandardMaterial color={COLORS.kerb} roughness={0.8} />
            </mesh>
         ))}
         {[-0.5, 0.5].map((k) => (
            <mesh key={k} rotation-x={-Math.PI / 2} position={[k * LANE_W, 0, -len / 2 + 20]}>
               <planeGeometry args={[0.08, len]} />
               <meshBasicMaterial color={COLORS.line} transparent opacity={0.45} />
            </mesh>
         ))}
         <mesh ref={paint} rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
            <planeGeometry args={[7.2, 1]} />
            <meshBasicMaterial map={rainbow} transparent opacity={0.3} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </mesh>
         {!c.cfg.boss && (
            <group position={[0, 0, -(c.length + 6)]}>
               <Model asset={ASSETS.gate} scale={11 / GLB_SIZE.gate.x} />
            </group>
         )}
      </>
   );
}

export function Street({ run }: { run: DashRun }) {
   return (
      <>
         <Road run={run} />
         <Kerbs run={run} />
         <Items run={run} />
         <Orbs run={run} />
      </>
   );
}
