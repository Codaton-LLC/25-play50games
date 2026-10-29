"use client";

// The Soot Bat Queen (level 5): m2CaveBat at 4x in ash grey with glowing red eyes. She perches on the
// roof beams, flaps (her blackout), dives to hang over a lantern, and passes over the roof brazier;
// her eyes burn bright in the dark roof of the last phase. Her place comes from rules.ts queenPos, her
// step from the menu2/boss machine; this file only draws.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, MeshBasicMaterial, SphereGeometry, type Group, type Mesh } from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { bossTimeScale, stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS, GLB_SIZE, QUEEN_WIDTH } from "./assets";
import { COLORS } from "./look";
import { QUEEN } from "./progression";
import { queenPos, type TempleRun } from "./rules";

const POS = { x: 0, y: 0, z: 0 };
/** The Queen's model: the shared bat in ash grey, scaled to her width (one asset object, never rebuilt). */
const QUEEN_ASSET = { ...ASSETS.bat, id: "m2CaveBatQueen", scale: QUEEN_WIDTH / GLB_SIZE.bat.x, material: { color: COLORS.queen, roughness: 0.95, metalness: 0 } };

export default function Queen({ run }: { run: TempleRun }) {
   const root = useRef<Group>(null);
   const eyeL = useRef<Mesh>(null);
   const eyeR = useRef<Mesh>(null);
   const body = useRef<Group>(null);
   const time = useGameTime();
   const geo = useMemo(() => new SphereGeometry(0.2, 10, 8), []);
   const mat = useMemo(() => new MeshBasicMaterial({ color: COLORS.eye, blending: AdditiveBlending, transparent: true, toneMapped: false }), []);
   useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
   const k = QUEEN_WIDTH / GLB_SIZE.bat.x;

   useFrame(() => {
      const g = root.current;
      const b = run.boss;
      if (!g) return;
      if (!b || !run.bossActive) {
         g.visible = false;
         return;
      }
      g.visible = true;
      queenPos(run, POS);
      const hover = Math.sin(time.now * 1.6) * 0.25;
      const defeated = b.defeatMs >= 0;
      const sink = defeated ? Math.min(1, b.defeatMs / QUEEN.defeatMs) * 6 : 0;
      g.position.set(POS.x, POS.y + hover - sink, POS.z);
      // she turns to the hero
      g.rotation.y = Math.atan2(run.hero.x - POS.x, run.hero.z - POS.z);
      const t = stepProgress(b, QUEEN);
      const flap = b.step === "attack" || b.step === "telegraph" ? 1 + 0.5 * Math.sin(time.now * 22) * (b.step === "attack" ? 1 : t) : 1 + 0.12 * Math.sin(time.now * 5);
      if (body.current) {
         body.current.scale.set(1, flap, 1);
         body.current.rotation.z = defeated ? Math.min(1.4, b.defeatMs / 800) : 0;
      }
      const flash = b.flashMs > 0;
      const glow = b.step === "telegraph" ? 0.7 + 0.5 * Math.sin(time.now * 18) : b.step === "vulnerable" ? 0.5 : 1;
      mat.color.set(flash ? "#ffffff" : COLORS.eye);
      mat.opacity = defeated ? Math.max(0, 1 - b.defeatMs / QUEEN.defeatMs) : Math.max(0.25, Math.min(1, glow));
      const s = (flash ? 1.5 : 1) * (defeated ? 0.8 : 1);
      eyeL.current?.scale.setScalar(s * 1.2);
      eyeR.current?.scale.setScalar(s * 1.2);
      // the visual time scale of the finish is the juice's; here the slow flap only
      void bossTimeScale(b, QUEEN);
   });
   return (
      <group ref={root} visible={false}>
         <group ref={body}>
            <Model asset={QUEEN_ASSET} position={[0, -GLB_SIZE.bat.y * k * 0.5, 0]} />
         </group>
         <mesh ref={eyeL} geometry={geo} material={mat} position={[-0.55, 0.25, 1.2]} />
         <mesh ref={eyeR} geometry={geo} material={mat} position={[0.55, 0.25, 1.2]} />
      </group>
   );
}
