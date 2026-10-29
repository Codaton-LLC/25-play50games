"use client";

// Every steel coin of the level in one instanced pool (code-drawn: a bevelled steel disc with a brass
// rim, two draw calls for all of them). Piles stack in a small heap, a swarm tumbles after its hero
// tinted faintly to its sign, loose coins spin as they fall, stolen ones dangle under their drone;
// banked and lost coins are not drawn (a lost one reappears on its pile).
import { useEffect, useMemo } from "react";
import { Color, CylinderGeometry, Euler, Matrix4, MeshStandardMaterial, Quaternion, TorusGeometry, Vector3 } from "three";
import { DynamicInstanced } from "../../core/render/DynamicInstanced";
import { useGameTime } from "../../core/gameTime";
import type { World } from "./rules";
import { roomX } from "./space";

const E = new Euler();
const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3(1, 1, 1);
const PLUS = new Color("#ffd6d6");
const MINUS = new Color("#d6e4ff");
const WHITE = new Color("#ffffff");

export function Coins({ world }: { world: World }) {
   const time = useGameTime();
   const list = useMemo(() => world.rooms.flatMap((r, k) => r.coins.map((c, i) => ({ c, k, i }))), [world]);
   const parts = useMemo(() => {
      const face = new CylinderGeometry(0.17, 0.17, 0.05, 20).rotateX(Math.PI / 2);
      const rim = new TorusGeometry(0.17, 0.025, 6, 20);
      const local = new Matrix4();
      return [
         { geometry: face, material: new MeshStandardMaterial({ color: "#d4d9e0", metalness: 0.85, roughness: 0.28 }), locals: [local] },
         { geometry: rim, material: new MeshStandardMaterial({ color: "#d9a441", metalness: 0.75, roughness: 0.3 }), locals: [local] },
      ];
   }, []);
   useEffect(
      () => () => {
         for (const p of parts) {
            p.geometry.dispose();
            p.material.dispose();
         }
      },
      [parts]
   );
   return (
      <DynamicInstanced
         count={Math.max(1, list.length)}
         parts={parts}
         tinted
         update={(n, m, color) => {
            const e = list[n];
            if (!e) return false;
            const { c, k, i } = e;
            if (c.state === "banked" || c.state === "lost") return false;
            const t = time.now;
            const x = roomX(k) + c.x;
            if (c.state === "pile") {
               // a little heap: rings of coins lying flat-ish
               const ring = i % 6;
               const layer = Math.floor(i / 6);
               V.set(x + Math.cos(ring * 1.05) * 0.2 * (layer % 2 ? 0.5 : 1), c.y - 0.08 + layer * 0.07, Math.sin(ring * 1.05) * 0.2);
               E.set(Math.PI / 2 - 0.25, ring, 0);
            } else {
               V.set(x, c.y, c.state === "stolen" ? 0.2 : Math.sin(i * 2.3) * 0.25);
               E.set(t * (c.state === "free" ? 6 : 2) + i, t * 3 + i * 0.7, 0);
            }
            Q.setFromEuler(E);
            m.compose(V, Q, S);
            color.copy(c.state === "swarm" ? (c.sign > 0 ? PLUS : MINUS) : WHITE);
         }}
      />
   );
}
