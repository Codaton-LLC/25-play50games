"use client";

// The Howler King (level 5): m2JungleMonkey at 3x in ash-grey fur with dark plates on his shoulders
// (Shadow Plates' lieutenant) and amber eyes. He squats on his perch branch (phase 1, throwing pod
// volleys), hangs by one arm over the arena (phase 2, roaring), and swings on his own vine opposite the
// hero (phase 3). He flashes white on a hit and tumbles off the canopy on the defeat. His place comes
// from rules.ts kingPos, his step from the menu2/boss machine; this file only draws.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BoxGeometry, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, type Group, type Mesh } from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS, GLB_SIZE, KING_H } from "./assets";
import { COLORS } from "./look";
import { HOWLER } from "./progression";
import { kingPos, type VineRun } from "./rules";

const POS = { x: 0, y: 0, z: 0 };
const KS = KING_H / GLB_SIZE.monkey.y;
/** The King's model: the shared monkey in ash grey, scaled 3x (one asset object, never rebuilt). */
const KING_ASSET = { ...ASSETS.monkey, id: "m2JungleMonkeyKing", scale: KS, material: { color: COLORS.king, roughness: 0.95, metalness: 0 } };
const PERCH = { ...ASSETS.stub, id: "m2BranchPlatformPerch", scale: 2.6 / GLB_SIZE.stub.x };

export default function Howler({ run }: { run: VineRun }) {
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const perch = useRef<Group>(null);
   const eyeL = useRef<Mesh>(null);
   const eyeR = useRef<Mesh>(null);
   const time = useGameTime();
   const eyeGeo = useMemo(() => new SphereGeometry(0.11, 10, 8), []);
   const eyeMat = useMemo(() => new MeshBasicMaterial({ color: COLORS.eye, blending: AdditiveBlending, transparent: true, toneMapped: false }), []);
   const plateGeo = useMemo(() => new BoxGeometry(0.75, 0.22, 0.6), []);
   const plateMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.plates, roughness: 0.4, metalness: 0.5 }), []);
   useEffect(() => () => { eyeGeo.dispose(); eyeMat.dispose(); plateGeo.dispose(); plateMat.dispose(); }, [eyeGeo, eyeMat, plateGeo, plateMat]);
   const arena = run.course.arena;

   useFrame(() => {
      const g = root.current;
      const b = run.boss;
      if (!g) return;
      if (!b || !arena) {
         g.visible = false;
         if (perch.current) perch.current.visible = false;
         return;
      }
      // before the fight he waits on his perch, visible from below
      g.visible = true;
      kingPos(run, POS);
      const defeated = b.defeatMs >= 0;
      const fall = defeated ? Math.min(1, b.defeatMs / HOWLER.defeatMs) : 0;
      const bob = b.phase === 0 ? Math.sin(time.now * 2.2) * 0.08 : 0;
      g.position.set(POS.x, POS.y - KING_H * 0.45 + bob - fall * fall * 14, POS.z);
      g.rotation.y = Math.atan2(run.hero.x - POS.x, run.hero.z - POS.z);
      const bb = body.current;
      if (bb) {
         const t = stepProgress(b, HOWLER);
         const shake = b.step === "telegraph" ? Math.sin(time.now * 30) * 0.08 * t : 0;
         // phase 3 he hangs on his vine: the body leans with his swing
         const kv = run.course.vines[arena.kingVine];
         const swing = b.phase === 2 && !defeated ? -run.kingTheta * Math.sign(kv.dx * Math.sin(g.rotation.y) + kv.dz * Math.cos(g.rotation.y) || 1) : 0;
         bb.rotation.set(swing, 0, shake + fall * 2.4);
         const roar = b.step === "attack" ? 1 + 0.06 * Math.sin(time.now * 24) : 1;
         bb.scale.set(roar, roar, roar);
      }
      const flash = b.flashMs > 0;
      eyeMat.color.set(flash ? "#ffffff" : COLORS.eye);
      eyeMat.opacity = defeated ? Math.max(0, 1 - fall) : b.step === "vulnerable" ? 0.55 : 1;
      plateMat.color.set(flash ? "#ffffff" : COLORS.plates);
      const s = flash ? 1.5 : 1;
      eyeL.current?.scale.setScalar(s);
      eyeR.current?.scale.setScalar(s);
      const p = perch.current;
      if (p) {
         p.visible = true;
         p.position.set(arena.perch.x, arena.perch.y - KING_H * 0.47, arena.perch.z);
      }
   });
   if (!arena) return null;
   return (
      <>
         <group ref={perch}>
            <Model asset={PERCH} />
         </group>
         <group ref={root} visible={false}>
            <group ref={body}>
               <Model asset={KING_ASSET} />
               <mesh geometry={plateGeo} material={plateMat} position={[-0.62, KING_H * 0.68, 0]} rotation-z={0.35} />
               <mesh geometry={plateGeo} material={plateMat} position={[0.62, KING_H * 0.68, 0]} rotation-z={-0.35} />
               <mesh ref={eyeL} geometry={eyeGeo} material={eyeMat} position={[-0.2, KING_H * 0.83, 0.62]} />
               <mesh ref={eyeR} geometry={eyeGeo} material={eyeMat} position={[0.2, KING_H * 0.83, 0.62]} />
            </group>
         </group>
      </>
   );
}
