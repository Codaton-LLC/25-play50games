"use client";

// The mission objects: each site's ring (orange, yellow while working, green when done) with a dead-centre
// target, a progress arc while the rover works, a tall light pillar over every site still to do (the
// nearest brightest), the site's object (a crystal deposit to drill, a beacon / ancient beacon to scan, a
// broken solar panel to repair) with a status lamp; the charger pads with their station and panel (a green
// pillar when the battery runs low); the base pad and the lander, where the mission ends.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, Color, CylinderGeometry, DoubleSide, Euler, PlaneGeometry, Quaternion, RingGeometry, ShaderMaterial, Vector3, type BufferGeometry, type Matrix4, type Mesh, type PointLight } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { DynamicInstanced, Instanced, useCanvasTexture, type InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, FIT } from "./assets";
import type { MarsLevel } from "./levels";
import { COLORS, MISSION_COLOR } from "./looks";
import { BeaconPrimitive, ChargerPrimitive, LanderPrimitive, RelicPrimitive, crystalParts, useParts } from "./Primitives";
import { BASE_PAD_RADIUS, CENTER_BONUS_RADIUS, CHARGER_PAD_RADIUS, SITE_RING_RADIUS, type Run } from "./rules";
import type { HeightFn } from "./terrain";
import type { Vis } from "./visual";

const V = new Vector3();
const Q = new Quaternion();
const E = new Euler();
const S = new Vector3();
const C1 = new Color();
const RING_IDLE = new Color(COLORS.siteRing);
const RING_HOLD = new Color(COLORS.siteRingActive);
const RING_DONE = new Color(COLORS.siteRingScanned);
const PAD_IDLE = new Color(COLORS.chargerPad);
const PAD_ON = new Color(COLORS.chargerPadActive);
const BLACK = new Color(0, 0, 0);
const LAMP_DONE = new Color("#4ade80");
const BASE_PILLAR = new Color(COLORS.basePadActive);
const CHARGE_PILLAR = new Color(COLORS.chargerPad);
/** the pillar's height (m) */
const PILLAR_H = 46;

/** Geometry built once per mount (flat decals are turned to lie on the ground), disposed on unmount. */
function useGeometry(make: () => BufferGeometry): BufferGeometry {
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const g = useMemo(make, []);
   useEffect(() => () => g.dispose(), [g]);
   return g;
}
const flat = <T extends BufferGeometry>(g: T) => g.rotateX(-Math.PI / 2);

/** Live shared state the Scene writes: the current target and the low-battery flag. */
export interface Guide {
   /** the site the arrow and the brightest pillar point to (-1: the base) */
   target: number;
   lowBattery: boolean;
   allDone: boolean;
}

function drawPillar(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const g = ctx.createLinearGradient(0, h, 0, 0);
   g.addColorStop(0, "rgba(255,255,255,1)");
   g.addColorStop(0.08, "rgba(255,255,255,0.75)");
   g.addColorStop(0.45, "rgba(255,255,255,0.22)");
   g.addColorStop(1, "rgba(255,255,255,0)");
   ctx.fillStyle = g;
   ctx.fillRect(0, 0, w, h);
   // a brighter core down the middle
   const c = ctx.createLinearGradient(0, 0, w, 0);
   c.addColorStop(0, "rgba(0,0,0,0.55)");
   c.addColorStop(0.5, "rgba(0,0,0,0)");
   c.addColorStop(1, "rgba(0,0,0,0.55)");
   ctx.globalCompositeOperation = "destination-out";
   ctx.fillStyle = c;
   ctx.fillRect(0, 0, w, h);
   ctx.globalCompositeOperation = "source-over";
}

function drawBolt(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.clearRect(0, 0, w, h);
   ctx.fillStyle = "rgba(34,197,94,0.28)";
   ctx.beginPath();
   ctx.arc(w / 2, h / 2, w * 0.48, 0, Math.PI * 2);
   ctx.fill();
   ctx.fillStyle = "#bbf7d0";
   ctx.beginPath();
   const p = [[0.56, 0.12], [0.3, 0.55], [0.48, 0.55], [0.42, 0.88], [0.7, 0.42], [0.52, 0.42]];
   ctx.moveTo(p[0][0] * w, p[0][1] * h);
   for (const [x, y] of p.slice(1)) ctx.lineTo(x * w, y * h);
   ctx.closePath();
   ctx.fill();
}

function drawBase(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.clearRect(0, 0, w, h);
   const cx = w / 2;
   ctx.fillStyle = "rgba(15,23,42,0.45)";
   ctx.beginPath();
   ctx.arc(cx, cx, w * 0.49, 0, Math.PI * 2);
   ctx.fill();
   ctx.strokeStyle = "rgba(224,242,254,0.9)";
   ctx.lineWidth = w * 0.03;
   ctx.setLineDash([w * 0.06, w * 0.04]);
   ctx.beginPath();
   ctx.arc(cx, cx, w * 0.42, 0, Math.PI * 2);
   ctx.stroke();
   ctx.setLineDash([]);
   // an arrow pointing into the pad: "park here"
   ctx.fillStyle = "rgba(224,242,254,0.95)";
   ctx.font = `bold ${Math.round(w * 0.3)}px system-ui, sans-serif`;
   ctx.textAlign = "center";
   ctx.textBaseline = "middle";
   ctx.fillText("H", cx, cx + w * 0.02);
   void h;
}

/** The progress arc: a ring whose drawn share is `uProgress` (clockwise from the top). */
function useArcMaterial(color: string) {
   const mat = useMemo(
      () =>
         new ShaderMaterial({
            uniforms: { uProgress: { value: 0 }, uColor: { value: new Color(color) } },
            vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
            fragmentShader:
               "uniform float uProgress; uniform vec3 uColor; varying vec2 vP; void main(){ float a = atan(vP.x, vP.y); float t = a < 0.0 ? a / 6.2831853 + 1.0 : a / 6.2831853; if (t > uProgress) discard; gl_FragColor = vec4(uColor, 0.95); }",
            transparent: true,
            depthWrite: false,
            toneMapped: false,
         }),
      [color]
   );
   useEffect(() => () => mat.dispose(), [mat]);
   return mat;
}

export function Sites({ run, vis, level, height, guide, doneAt }: { run: Run; vis: Vis; level: MarsLevel; height: HeightFn; guide: Guide; doneAt: Float32Array }) {
   const time = useGameTime();
   const camera = useThree((s) => s.camera);
   const pillarTex = useCanvasTexture(64, 256, drawPillar);
   const boltTex = useCanvasTexture(256, 256, drawBolt);
   const baseTex = useCanvasTexture(512, 512, drawBase);
   const arcMat = useArcMaterial(COLORS.siteRingActive);
   const arc = useRef<Mesh>(null);
   const baseRim = useRef<Mesh>(null);
   const landerLight = useRef<PointLight>(null);
   const lander = run.props.find((p) => p.kind === "lander");
   const missionColor = useMemo(() => new Color(MISSION_COLOR[level.mission]), [level.mission]);
   const siteH = useMemo(() => run.sites.map((s) => height(s.x, s.z)), [run, height]);
   const crystalFallback = useParts(crystalParts);
   const ringGeo = useGeometry(() => flat(new RingGeometry(SITE_RING_RADIUS - 0.24, SITE_RING_RADIUS, 48)));
   const bullGeo = useGeometry(() => flat(new RingGeometry(CENTER_BONUS_RADIUS - 0.1, CENTER_BONUS_RADIUS, 40)));
   const padGeo = useGeometry(() => flat(new RingGeometry(CHARGER_PAD_RADIUS - 0.3, CHARGER_PAD_RADIUS, 40)));
   const decalGeo = useGeometry(() => flat(new PlaneGeometry(1, 1)));
   const pillarGeo = useGeometry(() => new CylinderGeometry(0.55, 0.75, PILLAR_H, 16, 1, true).translate(0, PILLAR_H / 2, 0));

   const propSpots = (kind: string, extra: Partial<InstanceSpot> = {}): InstanceSpot[] =>
      run.props.filter((p) => p.kind === kind).map((p) => ({ x: p.x, y: height(p.x, p.z), z: p.z, rotY: 0, ...extra }));
   const beaconSpots = useMemo(() => propSpots("beacon"), [run, height]); // eslint-disable-line react-hooks/exhaustive-deps
   const relicSpots = useMemo(() => propSpots("relic"), [run, height]); // eslint-disable-line react-hooks/exhaustive-deps
   const stationSpots = useMemo(() => propSpots("station"), [run, height]); // eslint-disable-line react-hooks/exhaustive-deps
   const stationPanelSpots = useMemo(() => propSpots("stationPanel", { scale: FIT.panelWidth, rotY: Math.PI }), [run, height]); // eslint-disable-line react-hooks/exhaustive-deps
   const panelProps = useMemo(() => run.props.filter((p) => p.kind === "panel"), [run]);
   const padDecals = useMemo<InstanceSpot[]>(() => run.chargers.map((c) => ({ x: c.x, y: height(c.x, c.z) + 0.035, z: c.z, sx: 2 * (CHARGER_PAD_RADIUS - 0.35), sy: 1, sz: 2 * (CHARGER_PAD_RADIUS - 0.35) })), [run, height]);
   const lamps = useMemo(() => run.props.filter((p) => p.site >= 0), [run]);
   const lampY = level.mission === "beacon" ? FIT.beaconHeight * 0.92 : level.mission === "relic" ? FIT.relicHeight * 0.72 : 1.2;

   const placeRing = (i: number, m: Matrix4, color: Color) => {
      const s = run.sites[i];
      if (!s) return false;
      const pulse = s.scanned ? 1 : 1 + Math.sin(time.now * 3 + i) * 0.04;
      V.set(s.x, siteH[i] + 0.05, s.z);
      Q.identity();
      S.set(pulse, 1, pulse);
      m.compose(V, Q, S);
      color.copy(s.scanned ? RING_DONE : s.holdTime > 0 ? RING_HOLD : RING_IDLE);
   };
   const placeBull = (i: number, m: Matrix4, color: Color) => {
      const s = run.sites[i];
      if (!s || s.scanned) return false;
      V.set(s.x, siteH[i] + 0.045, s.z);
      Q.identity();
      S.set(1, 1, 1);
      m.compose(V, Q, S);
      color.copy(s.holdTime > 0 ? RING_HOLD : RING_IDLE).multiplyScalar(0.8);
   };
   const placePad = (i: number, m: Matrix4, color: Color) => {
      const c = run.chargers[i];
      if (!c) return false;
      V.set(c.x, height(c.x, c.z) + 0.05, c.z);
      Q.identity();
      const on = run.charging && Math.hypot(c.x - run.rover.x, c.z - run.rover.z) <= CHARGER_PAD_RADIUS;
      const pulse = on ? 1 + Math.sin(time.now * 10) * 0.04 : 1;
      S.set(pulse, 1, pulse);
      m.compose(V, Q, S);
      color.copy(on ? PAD_ON : PAD_IDLE);
   };
   // pillars: sites still to do (the target brightest), the base once every site is done, chargers when low
   const nSites = run.sites.length;
   const placePillar = (i: number, m: Matrix4, color: Color) => {
      let x: number;
      let z: number;
      let w = 1;
      if (i < nSites) {
         const s = run.sites[i];
         if (s.scanned) return false;
         x = s.x;
         z = s.z;
         const target = guide.target === i;
         w = target ? 1.25 + Math.sin(time.now * 4) * 0.12 : 0.85;
         color.copy(missionColor).multiplyScalar(target ? 1 : 0.42);
      } else if (i === nSites) {
         if (!guide.allDone) return false;
         x = run.basePad.x;
         z = run.basePad.z;
         w = 1.5 + Math.sin(time.now * 4) * 0.15;
         color.copy(BASE_PILLAR);
      } else {
         const c = run.chargers[i - nSites - 1];
         if (!c || !guide.lowBattery) return false;
         x = c.x;
         z = c.z;
         w = 1.1 + Math.sin(time.now * 8) * 0.15;
         color.copy(CHARGE_PILLAR);
      }
      // fade a pillar the camera comes close to, so it never floods the screen
      const near = Math.min(1, Math.max(0.08, (Math.hypot(camera.position.x - x, camera.position.z - z) - 3) / 12));
      color.multiplyScalar(near);
      V.set(x, height(x, z), z);
      Q.identity();
      S.set(w, 1, w);
      m.compose(V, Q, S);
   };
   const placeCrystal = (i: number, m: Matrix4) => {
      const s = run.sites[i];
      if (!s || s.scanned) return false;
      const sink = vis.active === i ? vis.progress * 0.22 : 0;
      V.set(s.x, siteH[i] - sink, s.z);
      E.set(0, i * 1.7 + (vis.active === i ? time.now * 2 : 0), 0);
      Q.setFromEuler(E);
      const shake = vis.active === i ? 1 + Math.sin(time.now * 50) * 0.03 : 1;
      S.set(shake, shake, shake);
      m.compose(V, Q, S);
   };
   const placePanel = (i: number, m: Matrix4) => {
      const p = panelProps[i];
      if (!p) return false;
      const t = doneAt[p.site];
      // broken: slumped and twisted on its frame; repaired: it swings upright over 0.8 s
      const k = t >= 0 ? Math.min(1, (time.now - t) / 0.8) : 0;
      const ease = 1 - (1 - k) * (1 - k);
      const working = vis.active === p.site;
      const jiggle = working ? Math.sin(time.now * 40) * 0.03 : 0;
      V.set(p.x, height(p.x, p.z) - 0.12 * (1 - ease), p.z);
      E.set(-0.5 * (1 - ease) + jiggle, Math.PI + 0.35 * (1 - ease), 0.32 * (1 - ease));
      Q.setFromEuler(E);
      S.set(1, 1, 1);
      m.compose(V, Q, S);
   };
   const placeLamp = (i: number, m: Matrix4, color: Color) => {
      const p = lamps[i];
      if (!p) return false;
      const s = run.sites[p.site];
      const done = s.scanned;
      const blink = done ? 1 : 0.5 + 0.5 * Math.sign(Math.sin(time.now * 5 + i));
      V.set(p.x, height(p.x, p.z) + lampY, p.z);
      Q.identity();
      const r = done ? 1.4 : 1;
      S.set(r, r, r);
      m.compose(V, Q, S);
      if (done) color.copy(LAMP_DONE);
      else color.copy(missionColor).lerp(BLACK, 1 - blink * 0.9);
   };

   useFrame(() => {
      // the progress arc at the site being worked
      const a = arc.current;
      if (a) {
         const s = vis.active >= 0 ? run.sites[vis.active] : null;
         a.visible = !!s && vis.progress > 0;
         if (s) {
            a.position.set(s.x, siteH[vis.active] + 0.07, s.z);
            arcMat.uniforms.uProgress.value = vis.progress;
         }
      }
      if (baseRim.current) {
         const m = baseRim.current.material as import("three").MeshBasicMaterial;
         m.opacity = guide.allDone ? 0.75 + Math.sin(time.now * 5) * 0.2 : 0.45;
         m.color.set(guide.allDone ? COLORS.basePadActive : COLORS.basePad);
      }
      if (landerLight.current) landerLight.current.intensity = vis.winT >= 0 ? 6 + Math.sin(time.now * 14) * 5 : guide.allDone ? 2 + Math.sin(time.now * 4) : 0;
   }, FRAME_PRIORITY.visuals);

   const baseY = height(run.basePad.x, run.basePad.z);

   return (
      <>
         {/* site rings and their dead-centre targets */}
         <DynamicInstanced count={nSites} update={placeRing} name="site-rings" tinted>
            <primitive object={ringGeo} attach="geometry" />
            <meshBasicMaterial transparent opacity={0.95} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={nSites} update={placeBull} name="site-centres" tinted>
            <primitive object={bullGeo} attach="geometry" />
            <meshBasicMaterial transparent opacity={0.55} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
         <mesh ref={arc} rotation-x={-Math.PI / 2} visible={false} material={arcMat} renderOrder={3}>
            <ringGeometry args={[SITE_RING_RADIUS - 0.05, SITE_RING_RADIUS + 0.28, 64]} />
         </mesh>

         {/* light pillars: visible from anywhere on the plain, through the dust */}
         <DynamicInstanced count={nSites + 1 + run.chargers.length} update={placePillar} name="pillars" tinted>
            <primitive object={pillarGeo} attach="geometry" />
            <meshBasicMaterial map={pillarTex} transparent blending={AdditiveBlending} depthWrite={false} side={DoubleSide} fog={false} toneMapped={false} />
         </DynamicInstanced>

         {/* the site objects */}
         {level.mission === "crystal" && <DynamicInstancedModel asset={ASSETS.crystal} count={nSites} update={placeCrystal} fallbackParts={crystalFallback} name="crystals" />}
         {beaconSpots.length > 0 && <InstancedModel asset={ASSETS.beacon} spots={beaconSpots} fallback={<BeaconPrimitive spots={beaconSpots} />} />}
         {relicSpots.length > 0 && <InstancedModel asset={ASSETS.relic} spots={relicSpots} fallback={<>{relicSpots.map((p, i) => <group key={i} position={[p.x, p.y, p.z]}><RelicPrimitive /></group>)}</>} />}
         {panelProps.length > 0 && <DynamicInstancedModel asset={ASSETS.panel} count={panelProps.length} update={placePanel} name="panels" />}
         {lamps.length > 0 && (
            <DynamicInstanced count={lamps.length} update={placeLamp} name="site-lamps" tinted>
               <sphereGeometry args={[0.16, 12, 8]} />
               <meshBasicMaterial toneMapped={false} />
            </DynamicInstanced>
         )}

         {/* chargers */}
         <DynamicInstanced count={run.chargers.length} update={placePad} name="charger-pads" tinted>
            <primitive object={padGeo} attach="geometry" />
            <meshBasicMaterial transparent opacity={0.95} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
         <Instanced spots={padDecals} name="charger-decals">
            <primitive object={decalGeo} attach="geometry" />
            <meshBasicMaterial map={boltTex} transparent depthWrite={false} toneMapped={false} />
         </Instanced>
         <InstancedModel asset={ASSETS.charger} spots={stationSpots} fallback={<ChargerPrimitive spots={stationSpots} />} />
         <InstancedModel asset={ASSETS.solarPanel} spots={stationPanelSpots} fallback={null} />

         {/* the base pad and the lander */}
         <mesh rotation-x={-Math.PI / 2} position={[run.basePad.x, baseY + 0.03, run.basePad.z]}>
            <circleGeometry args={[BASE_PAD_RADIUS, 48]} />
            <meshBasicMaterial map={baseTex} transparent depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh ref={baseRim} rotation-x={-Math.PI / 2} position={[run.basePad.x, baseY + 0.05, run.basePad.z]}>
            <ringGeometry args={[BASE_PAD_RADIUS - 0.25, BASE_PAD_RADIUS, 48]} />
            <meshBasicMaterial color={COLORS.basePad} transparent opacity={0.45} depthWrite={false} toneMapped={false} />
         </mesh>
         {lander && (
            <group position={[lander.x, height(lander.x, lander.z), lander.z]} rotation-y={0.5}>
               <Model asset={ASSETS.lander} fallback={<LanderPrimitive />} />
               <pointLight ref={landerLight} position={[1.6, 2.2, 0.6]} color={COLORS.basePadActive} intensity={0} distance={9} decay={1.5} />
            </group>
         )}
      </>
   );
}

