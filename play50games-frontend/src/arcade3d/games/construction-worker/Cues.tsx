"use client";

// Readability cues, visual only (they read the run, never write it):
// - the pile to pick: a gold ring on the ground, a bouncing arrow and its key number above it,
//   the other piles dimmed; a red ring and a red tint on a refused pile for the 1 s lock;
// - the 0.25 s pickup dwell: a ring round the hook block that fills while the dwell holds;
// - while carrying: the drop gate (r >= 8.9, tower 9.02) as a band on the ground, green once the
//   trolley is inside it, a beam over the target slot, and a plumb line plus a ground mark under the hook.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   BufferGeometry,
   CanvasTexture,
   ConeGeometry,
   CylinderGeometry,
   DoubleSide,
   Float32BufferAttribute,
   Line,
   LineBasicMaterial,
   MeshBasicMaterial,
   RingGeometry,
   SpriteMaterial,
   SRGBColorSpace,
   type Group,
   type Mesh,
   type Sprite,
} from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { shadowTop, VISUAL_EXTENSION } from "./dropGuide";
import { COLORS } from "./looks";
import { KIND_SCALE, pileGeos, pileMats, ringGeo, slotMat } from "./Primitives";
import {
   CUE_WRONG,
   DROP_R,
   DROP_R_TOWER,
   DWELL_S,
   FLOOR,
   LOCK_S,
   PLAN,
   pileAt,
   pileUnder,
   slotAt,
   type Run,
} from "./rules";

const GATE_SPAN = 1.4;
/* RingGeometry lies in xy; rotated -PI/2 about x a ring angle t lands at (cos t, 0, -sin t), so
   the crane angle a (x = r sin a, z = r cos a) is t = a - PI/2. */
const GATE_START = -Math.PI / 2 - GATE_SPAN / 2;
const gateGeo = new RingGeometry(DROP_R, 10.15, 48, 1, GATE_START, GATE_SPAN);
const gateTowerGeo = new RingGeometry(DROP_R_TOWER, 10.15, 48, 1, GATE_START, GATE_SPAN);
const DWELL_SEGMENTS = 40;
/* Starts at 12 o'clock; the mesh is mirrored on x so it fills clockwise. */
const dwellGeo = new RingGeometry(0.78, 0.98, DWELL_SEGMENTS, 1, Math.PI / 2, Math.PI * 2);
const arrowGeo = new ConeGeometry(0.34, 0.72, 16).rotateX(Math.PI);
const beamGeo = new CylinderGeometry(0.5, 0.5, 1, 24, 1, true).translate(0, 0.5, 0);
const PILE_TOP = pileGeos.map((g) => {
   g.computeBoundingBox();
   return g.boundingBox?.max.y ?? 0.4;
});

/** Pile key numbers 1-5 in one strip; the sprite shows one cell through offset / repeat. */
function drawKeys(): CanvasTexture | null {
   if (typeof document === "undefined") return null;
   const canvas = document.createElement("canvas");
   canvas.width = 640;
   canvas.height = 128;
   const ctx = canvas.getContext("2d");
   if (!ctx) return null;
   for (let i = 0; i < 5; i++) {
      const cx = i * 128 + 64;
      ctx.fillStyle = COLORS.craneDark;
      ctx.beginPath();
      ctx.arc(cx, 64, 58, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = COLORS.guideGold;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 78px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), cx, 68);
   }
   const map = new CanvasTexture(canvas);
   map.colorSpace = SRGBColorSpace;
   map.repeat.set(0.2, 1);
   return map;
}

const at = { x: 0, z: 0 };
const surfaceAt = { x: 0, z: 0 };

export function Cues({ run }: { run: Run }) {
   const camera = useThree((s) => s.camera);
   const time = useGameTime();
   const keys = useMemo(drawKeys, []);
   const mats = useMemo(
      () => ({
         pileRing: new MeshBasicMaterial({ color: COLORS.guideGold, transparent: true, opacity: 0.9, depthWrite: false }),
         refused: new MeshBasicMaterial({ color: COLORS.flashRed, transparent: true, opacity: 0, depthWrite: false }),
         arrow: new MeshBasicMaterial({ color: COLORS.guideGold }),
         label: new SpriteMaterial({ map: keys, depthTest: false, transparent: true }),
         dwellBack: new MeshBasicMaterial({ color: COLORS.craneDark, transparent: true, opacity: 0.45, depthTest: false, depthWrite: false, side: DoubleSide }),
         dwell: new MeshBasicMaterial({ color: COLORS.guideMint, transparent: true, opacity: 1, depthTest: false, depthWrite: false, side: DoubleSide }),
         gate: new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.2, depthWrite: false }),
         beam: new MeshBasicMaterial({ color: COLORS.guideGold, transparent: true, opacity: 0.12, depthWrite: false, side: DoubleSide }),
         mark: new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85, depthWrite: false }),
      }),
      [keys],
   );
   const plumb = useMemo(() => {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3));
      return new Line(geometry, new LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.8, depthWrite: false }));
   }, []);
   const dwellFill = useMemo(() => {
      const geo = dwellGeo.clone();
      geo.setDrawRange(0, 0);
      return geo;
   }, []);
   useEffect(
      () => () => {
         for (const m of Object.values(mats)) m.dispose();
         keys?.dispose();
         plumb.geometry.dispose();
         plumb.material.dispose();
         dwellFill.dispose();
         // the pile materials are module-level: put them back for the next Scene
         for (const m of pileMats) {
            m.color.set("#ffffff");
            m.emissive.set("#000000");
         }
         slotMat.emissiveIntensity = 0.9;
      },
      [mats, keys, plumb, dwellFill],
   );

   const pileRing = useRef<Mesh>(null);
   const refusedRing = useRef<Mesh>(null);
   const arrow = useRef<Group>(null);
   const label = useRef<Sprite>(null);
   const dwell = useRef<Group>(null);
   const gate = useRef<Mesh>(null);
   const gateTower = useRef<Mesh>(null);
   const beam = useRef<Mesh>(null);
   const mark = useRef<Mesh>(null);
   const refused = useRef({ pile: -1, until: -1 });

   useFrame(() => {
      const now = time.now;
      const step = PLAN[run.planIndex];
      const playing = run.phase === "play";
      const carrying = run.carried >= 0;
      const target = step && playing && !carrying && run.cheer <= 0 ? step.kind : -1;
      const pulse = 0.5 + 0.5 * Math.sin(now * 6);

      if (run.cue & CUE_WRONG) {
         refused.current.pile = pileUnder(run);
         refused.current.until = now + LOCK_S;
      }
      const wrong = now < refused.current.until ? refused.current.pile : -1;
      const wrongK = wrong >= 0 ? (refused.current.until - now) / LOCK_S : 0;

      // piles: the target lit and pulsing, the rest dimmed; a refused pile tinted red
      for (let i = 0; i < pileMats.length; i++) {
         const m = pileMats[i];
         if (i === wrong) {
            m.color.setRGB(1, 0.55, 0.55);
            m.emissive.set(COLORS.flashRed).multiplyScalar(0.5 * wrongK);
         } else if (target < 0) {
            m.color.setScalar(carrying ? 0.7 : 1);
            m.emissive.setScalar(0);
         } else if (i === target) {
            m.color.setScalar(1);
            m.emissive.set(COLORS.guideGold).multiplyScalar(0.15 + 0.3 * pulse);
         } else {
            m.color.setScalar(0.38);
            m.emissive.setScalar(0);
         }
      }
      const ring = pileRing.current;
      if (ring) {
         ring.visible = target >= 0;
         if (target >= 0) {
            pileAt(target, at);
            ring.position.set(at.x, 0.04, at.z);
            ring.scale.setScalar(1.45 + 0.25 * pulse);
            mats.pileRing.opacity = 0.55 + 0.4 * pulse;
         }
      }
      const red = refusedRing.current;
      if (red) {
         red.visible = wrong >= 0;
         if (wrong >= 0) {
            pileAt(wrong, at);
            red.position.set(at.x, 0.05, at.z);
            red.scale.setScalar(1.3 + 0.9 * (1 - wrongK));
            mats.refused.opacity = 0.9 * wrongK;
         }
      }
      const a = arrow.current;
      if (a) {
         a.visible = target >= 0;
         if (target >= 0) {
            pileAt(target, at);
            a.position.set(at.x, (PILE_TOP[target] ?? 0.4) + 1.1 + 0.35 * Math.abs(Math.sin(now * 4)), at.z);
            const tex = mats.label.map;
            if (tex) tex.offset.set(target * 0.2, 0);
         }
      }

      // dwell: a ring round the hook block, filling over the 0.25 s
      const d = dwell.current;
      if (d) {
         const armed = run.armed >= 0 && !carrying && playing;
         d.visible = armed;
         if (armed) {
            d.position.set(run.hookX, run.hookY + 0.6, run.hookZ);
            d.quaternion.copy(camera.quaternion);
            const k = Math.min(1, run.dwell / DWELL_S);
            dwellFill.setDrawRange(0, 6 * Math.round(DWELL_SEGMENTS * k));
         }
      }

      // drop gate band, the target slot beam, the plumb line and the ground mark under the hook
      const tower = step?.building === 2;
      const gateR = tower ? DROP_R_TOWER : DROP_R;
      const inGate = run.radius >= gateR;
      const g = gate.current;
      const gt = gateTower.current;
      if (g) g.visible = carrying && playing && !tower;
      if (gt) gt.visible = carrying && playing && tower;
      mats.gate.color.set(inGate ? COLORS.guideMint : "#ffffff");
      mats.gate.opacity = inGate ? 0.35 + 0.15 * pulse : 0.18;
      const b = beam.current;
      if (b) {
         b.visible = carrying && playing && !!step;
         if (step) {
            slotAt(step.slot, at);
            const top = step.floor * FLOOR;
            b.position.set(at.x, top, at.z);
            b.scale.set(1, 3, 1);
            mats.beam.opacity = 0.07 + 0.09 * pulse;
         }
      }
      slotMat.emissiveIntensity = carrying ? 0.8 + 1.0 * pulse : 0.9;

      const surface = shadowTop(run, surfaceAt);
      const hang = carrying ? VISUAL_EXTENSION + (KIND_SCALE[run.carried]?.[1] ?? 0.4) : 0;
      plumb.visible = playing;
      if (playing) {
         const positions = plumb.geometry.attributes.position;
         positions.setXYZ(0, run.hookX, run.hookY - hang, run.hookZ);
         positions.setXYZ(1, run.hookX, surface + 0.03, run.hookZ);
         positions.needsUpdate = true;
      }
      const m = mark.current;
      if (m) {
         m.visible = playing;
         m.position.set(run.hookX, surface + 0.045, run.hookZ);
      }
   });

   return (
      <group name="construction-cues">
         <mesh ref={pileRing} geometry={ringGeo} material={mats.pileRing} rotation-x={-Math.PI / 2} dispose={null} name="pile-target-ring" />
         <mesh ref={refusedRing} geometry={ringGeo} material={mats.refused} rotation-x={-Math.PI / 2} dispose={null} name="pile-refused-ring" />
         <group ref={arrow} name="pile-arrow">
            <mesh geometry={arrowGeo} material={mats.arrow} dispose={null} />
            <sprite ref={label} material={mats.label} position-y={0.95} scale={[0.95, 0.95, 1]} renderOrder={10} />
         </group>
         <group ref={dwell} name="dwell-ring">
            <mesh geometry={dwellGeo} material={mats.dwellBack} renderOrder={11} dispose={null} />
            <mesh geometry={dwellFill} material={mats.dwell} scale-x={-1} renderOrder={12} dispose={null} />
         </group>
         <mesh ref={gate} geometry={gateGeo} material={mats.gate} rotation-x={-Math.PI / 2} position-y={0.025} dispose={null} name="drop-gate" />
         <mesh ref={gateTower} geometry={gateTowerGeo} material={mats.gate} rotation-x={-Math.PI / 2} position-y={0.025} dispose={null} name="drop-gate-tower" />
         <mesh ref={beam} geometry={beamGeo} material={mats.beam} dispose={null} name="slot-beam" />
         <primitive object={plumb} frustumCulled={false} name="hook-plumb-line" />
         <mesh ref={mark} geometry={ringGeo} material={mats.mark} rotation-x={-Math.PI / 2} scale={0.5} dispose={null} name="hook-ground-mark" />
      </group>
   );
}
