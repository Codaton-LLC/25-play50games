// The monsters at the serving hatch: one per window plus a dimmed one waiting in the queue. The Scene
// keeps a WindowLook per window (the live rules order ref, the one that just left, when); the motion
// runs in useFrame off the game clocks and the run state — the walk-in when an order appears, an
// impatient wobble that leans harder as patience drains, the served dance, the angry shake and the
// exit (hops away when served, storms off when angry). Type and tint re-render at 10 Hz (the Hud's
// cadence): the frame callbacks never setState.
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { hop, waddle, type BodyOffset } from "@/arcade3d/core/motion";
import { ASSETS, MONSTER_HEAD_ANCHOR_GLB } from "./assets";
import { HATCH_X, MONSTER_Z, QUEUE_Z } from "./Kitchen";
import { Headgear, MonsterPrimitive, TYPE_TINT } from "./Primitives";
import { ORDERS, PATIENCE, type Order, type RunState } from "./rules";

/** The Scene-side mirror of one serving window, written by its useRunFrame. */
export interface WindowLook {
   /** the live rules order (a stable ref while it exists), null once it left */
   cur: Order | null;
   /** the order that just left ("served" or "angry"), for the exit animation */
   last: Order | null;
   /** time.now when it left */
   leftAt: number;
}

const HEAD_SCALE = ASSETS.monster.scale ?? 1;
const HEAD_ANCHOR: [number, number, number] = [
   MONSTER_HEAD_ANCHOR_GLB.x * HEAD_SCALE,
   MONSTER_HEAD_ANCHOR_GLB.y * HEAD_SCALE,
   MONSTER_HEAD_ANCHOR_GLB.z * HEAD_SCALE,
];
const QUEUE_TINT = "#71717a";
const EXIT_S = 0.45;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function Monster({ look, x }: { look: WindowLook; x: number }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const [bob] = useState<BodyOffset>(() => ({ y: 0, roll: 0, yaw: 0, squash: 1 }));

   useFrame(() => {
      const g = root.current;
      const b = body.current;
      if (!g || !b) return;
      const now = time.now;
      const order = look.cur;
      if (order) {
         g.visible = true;
         b.scale.setScalar(1); // the exit shrinks the body: every new monster walks in full size
         let z = MONSTER_Z;
         if (order.phase === "ordering") {
            // walk in from the back, then wobble; the lean deepens as the patience drains
            const k = easeOutCubic(Math.min(1, Math.max(0, (time.play - (order.appearedAt - ORDERS.walkInS)) / ORDERS.walkInS)));
            z = MONSTER_Z - (1 - k) * 0.7;
            if (k < 1) hop(k * Math.PI * 2, 0.09 * (1 - k), bob);
            else waddle(now * 2.2 + x, 0.05, bob);
            const impatient = 1 - Math.min(1, order.patience / PATIENCE.max);
            b.rotation.x = 0.16 * impatient * impatient;
            g.position.set(x + (order.patience <= 0 ? Math.sin(now * 45) * 0.02 : 0), 0, z);
         } else {
            // served: eat, dance and tip
            hop(now * 7 + x, 0.1, bob);
            b.rotation.y = Math.sin(now * 7 + x) * 0.35;
            b.rotation.x = 0;
            g.position.set(x, 0, z);
         }
         b.position.y = bob.y;
         b.rotation.z = bob.roll;
      } else if (look.last && now - look.leftAt < EXIT_S) {
         // the served one hops away; the angry one storms off
         const k = (now - look.leftAt) / EXIT_S;
         const storm = look.last.phase === "angry";
         g.visible = true;
         hop(now * (storm ? 16 : 7), 0.1, bob);
         b.rotation.y = 0;
         b.rotation.x = 0;
         b.position.y = bob.y;
         b.scale.setScalar(Math.max(0.01, 1 - k));
         g.position.set(x + (storm ? Math.sin(now * 40) * 0.04 : 0), 0, MONSTER_Z - k * (storm ? 1.3 : 0.7));
      } else {
         g.visible = false;
      }
   });

   const shown = look.cur ?? look.last;
   const type = shown ? shown.type : "jolly";
   const tint = TYPE_TINT[type];
   return (
      <group ref={root} position={[x, 0, MONSTER_Z]} visible={false}>
         <group ref={body}>
            <Model asset={ASSETS.monster} tint={tint} fallback={<MonsterPrimitive tint={tint} />} />
            <group position={HEAD_ANCHOR}>
               <Headgear type={type} />
            </group>
         </group>
      </group>
   );
}

/** The dimmed third monster, waiting at the window that will open next. */
function QueueMonster({ run }: { run: RunState }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const [bob] = useState<BodyOffset>(() => ({ y: 0, roll: 0, yaw: 0, squash: 1 }));

   useFrame(() => {
      const g = root.current;
      const b = body.current;
      if (!g || !b) return;
      // the window with no order and a pending arrival, soonest first
      let at = Infinity;
      let x = 0;
      for (let w = 0; w < 2; w++) {
         const win = run.windows[w];
         if (!win.order && win.arriveAt < at) {
            at = win.arriveAt;
            x = HATCH_X[w];
         }
      }
      const visible = at - time.play < 2.2;
      g.visible = visible;
      if (!visible) return;
      waddle(time.now * 1.6, 0.04, bob);
      b.position.y = bob.y;
      b.rotation.z = bob.roll;
      g.position.set(x, 0, QUEUE_Z);
   });

   return (
      <group ref={root} visible={false}>
         <group ref={body}>
            <Model asset={ASSETS.monster} tint={QUEUE_TINT} fallback={<MonsterPrimitive tint={QUEUE_TINT} />} />
            <group position={HEAD_ANCHOR}>
               <Headgear type="jolly" />
            </group>
         </group>
      </group>
   );
}

export function Monsters({ run, windows }: { run: RunState; windows: [WindowLook, WindowLook] }) {
   // tint and headgear type follow the orders; they change with events, so re-render at the Hud cadence
   const [, setTick] = useState(0);
   useEffect(() => {
      const id = setInterval(() => setTick((t) => t + 1), 100);
      return () => clearInterval(id);
   }, []);
   return (
      <group name="monsters">
         <Monster look={windows[0]} x={HATCH_X[0]} />
         <Monster look={windows[1]} x={HATCH_X[1]} />
         <QueueMonster run={run} />
      </group>
   );
}
