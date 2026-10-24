// Bots for the limit proof and the witness gate. They only build a StepInput; rules.ts decides.
import { AI, lineOfSight, type Kid, type Run, type StepInput } from "./rules";

const POCKET = 0.9 + 0.45;

function toward(px: number, pz: number, tx: number, tz: number, aim: number, scoop: boolean, fire: boolean, tapId: number): StepInput {
   let mx = tx - px;
   let mz = tz - pz;
   const mag = Math.hypot(mx, mz);
   if (mag < 0.35) { mx = 0; mz = 0; }
   else { mx /= mag; mz /= mag; }
   return { moveX: mx, moveY: mz, camYaw: 0, scoop, fire, tapId, aimYaw: aim };
}

function zero(aim: number, scoop = false): StepInput {
   return { moveX: 0, moveY: 0, camYaw: 0, scoop, fire: false, tapId: -1, aimYaw: aim };
}

export function idleInput(run: Run): StepInput {
   return zero(run.kids[0].yaw);
}

export function spammerInput(run: Run): StepInput {
   const player = run.kids[0];
   const aim = 0;
   let scoop = false;
   if (run.scooping) scoop = run.scoopT < 0.55;
   else if (player.ammo < 3) scoop = true;
   const throwNow = player.ammo > 0 && !scoop && run.throwCd <= 0;
   return {
      moveX: 1, moveY: 0, camYaw: 0, scoop, aimYaw: aim,
      fire: throwNow && !run.coarse,
      tapId: throwNow && run.coarse ? 1 : -1,
   };
}

export function camperInput(run: Run): StepInput {
   const player = run.kids[0];
   let tx = player.x;
   let tz = player.z;
   let best = Infinity;
   for (let i = 0; i < run.forts.length; i++) {
      const fort = run.forts[i];
      if (fort.hp < 1) continue;
      const z = fort.z + Math.sign(player.z - fort.z || 1) * POCKET;
      const d = Math.hypot(fort.x - player.x, z - player.z);
      if (d < best) { best = d; tx = fort.x; tz = z; }
   }
   return toward(player.x, player.z, tx, tz, player.yaw, false, false, -1);
}

export function spinnerInput(run: Run): StepInput {
   const ang = run.time * 6;
   return toward(run.kids[0].x, run.kids[0].z, Math.cos(ang) * 1.1, 5 + Math.sin(ang) * 1.1, run.kids[0].yaw, false, false, -1);
}

interface BrainOpts {
   coarse: boolean;
   reaction: number;
   window: number;
   range: number;
   sidestep: number;
   /** Throw near the end of a peek so the ball arrives during the wind-up. */
   early: boolean;
}

function livingRivals(run: Run): Kid[] {
   const out: Kid[] = [];
   for (let i = 1; i < run.kids.length; i++) if (run.kids[i].present && run.kids[i].alive) out.push(run.kids[i]);
   return out;
}

function inYard(x: number, z: number): boolean {
   return x >= -11.4 && x <= 11.4 && z >= -8.4 && z <= 8.4 && Math.hypot(x, z) > 1.7;
}

/** A spot about 5 m from the rival that can see them. Falls back to a sideways step. */
function standOf(run: Run, rival: Kid, player: Kid): { x: number; z: number } {
   let bestX = player.x;
   let bestZ = player.z;
   let best = Infinity;
   let found = false;
   for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = rival.x + Math.sin(a) * 5.1;
      const z = rival.z + Math.cos(a) * 5.1;
      if (!inYard(x, z)) continue;
      if (!lineOfSight(run.forts, x, z, rival.x, rival.z)) continue;
      const d = Math.hypot(x - player.x, z - player.z);
      if (d < best) { best = d; bestX = x; bestZ = z; found = true; }
   }
   if (found) return { x: bestX, z: bestZ };
   const dx = rival.x - player.x;
   const dz = rival.z - player.z;
   const len = Math.hypot(dx, dz) || 1;
   return { x: player.x - (dz / len) * 2.4, z: player.z + (dx / len) * 2.4 };
}

/** Oracle (reaction 0, any wind-up, range 18) and witness (0.20 s, first 0.90 s, range 12). */
export function fighter(opts: BrainOpts): (run: Run) => StepInput {
   const seen = [0, 0, 0, 0];
   return (run: Run) => {
      const player = run.kids[0];
      const rivals = livingRivals(run);
      let focus: Kid | null = null;
      for (let i = 0; i < rivals.length; i++) {
         const kid = rivals[i];
         if (kid.state === "windup" && lineOfSight(run.forts, player.x, player.z, kid.x, kid.z)) { focus = kid; break; }
      }
      if (!focus) for (let i = 0; i < rivals.length; i++) if (rivals[i].state === "windup") { focus = rivals[i]; break; }
      if (!focus) for (let i = 0; i < rivals.length; i++) if (rivals[i].state === "peek") { focus = rivals[i]; break; }
      if (!focus && rivals.length) {
         focus = rivals[0];
         let best = Infinity;
         for (let i = 0; i < rivals.length; i++) {
            const d = Math.hypot(rivals[i].x - player.x, rivals[i].z - player.z);
            if (d < best) { best = d; focus = rivals[i]; }
         }
      }
      let danger = false;
      let sx = 1;
      let sz = 0;
      for (let i = 0; i < run.balls.length; i++) {
         const ball = run.balls[i];
         if (!ball.alive || ball.owner === 0) continue;
         const dx = ball.ix - player.x;
         const dz = ball.iz - player.z;
         if (Math.hypot(dx, dz) <= opts.sidestep) {
            danger = true;
            let px = -dz;
            let pz = dx;
            if (Math.hypot(px, pz) < 0.25) { px = -ball.vz; pz = ball.vx; }
            if (Math.hypot(px, pz) < 0.05) { px = 1; pz = 0; }
            const len = Math.hypot(px, pz);
            const sign = ball.owner % 2 === 0 ? 1 : -1;
            sx = sign * (px / len);
            sz = sign * (pz / len);
            break;
         }
      }
      const aim = focus ? Math.atan2(focus.x - player.x, focus.z - player.z) : player.yaw;
      let throwId = -1;
      for (let i = 1; i < run.kids.length; i++) {
         const kid = run.kids[i];
         const peekShot = opts.early && kid.state === "peek" && kid.timer <= 0.22 && player.ammo >= 2;
         if (!kid.present || !kid.alive || (kid.state !== "windup" && !peekShot)) { seen[i] = 0; continue; }
         const see = lineOfSight(run.forts, player.x, player.z, kid.x, kid.z);
         if (!see) { seen[i] = 0; continue; }
         if (seen[i] <= 0) seen[i] = run.time;
         const age = kid.state === "windup" ? AI.windup - kid.timer : opts.reaction;
         const dist = Math.hypot(kid.x - player.x, kid.z - player.z);
         if (run.time - seen[i] >= opts.reaction - 1e-4 && age <= opts.window + 1e-4 && dist <= opts.range && player.ammo > 0 && run.throwCd <= 0 && !run.scooping) {
            throwId = i;
            break;
         }
      }
      if (danger) return { moveX: sx, moveY: sz, camYaw: 0, scoop: false, fire: false, tapId: -1, aimYaw: aim };
      if (throwId > 0) {
         const target = run.kids[throwId];
         const shot = Math.atan2(target.x - player.x, target.z - player.z);
         return {
            moveX: 0, moveY: 0, camYaw: 0, scoop: false, aimYaw: shot,
            fire: !opts.coarse, tapId: opts.coarse ? throwId : -1,
         };
      }
      const seeFocus = focus ? lineOfSight(run.forts, player.x, player.z, focus.x, focus.z) : false;
      const threat = rivals.some((kid) => kid.state === "peek" || kid.state === "windup");
      const want = threat ? 1 : 3;
      const packing = player.ammo < want && (!run.scooping || run.scoopT < 0.55);
      if (!focus) return zero(aim, packing);
      const stand = standOf(run, focus, player);
      if (packing && (seeFocus || player.ammo < 1)) return zero(aim, true);
      if (!seeFocus) return toward(player.x, player.z, stand.x, stand.z, aim, false, false, -1);
      if (Math.hypot(player.x - stand.x, player.z - stand.z) < 1.2) return zero(aim, false);
      return toward(player.x, player.z, stand.x, stand.z, aim, false, false, -1);
   };
}

export const oracle = () => fighter({ coarse: false, reaction: 0, window: AI.windup, range: 18, sidestep: 1.35, early: true });
export const witness = (coarse: boolean) => fighter({ coarse, reaction: 0.2, window: 0.9, range: 12, sidestep: 1.6, early: false });

export function exposed(run: Run): boolean {
   const player = run.kids[0];
   for (let i = 1; i < 3; i++) {
      const kid = run.kids[i];
      if (!kid.present) continue;
      if (lineOfSight(run.forts, player.x, player.z, kid.x, kid.z) && Math.hypot(kid.x - player.x, kid.z - player.z) < 8) return true;
   }
   return false;
}

/** Park the player just off a rival's peek, on the open side, so the loss chain has line of sight. */
export function exposePlayer(run: Run): void {
   const rival = run.kids[1];
   const stand = standOf(run, rival, { ...run.kids[0], x: rival.x, z: rival.z - 1 });
   run.kids[0].x = stand.x;
   run.kids[0].z = stand.z;
   run.kids[0].vx = 0;
   run.kids[0].vz = 0;
      run.kids[0].yaw = Math.atan2(rival.x - stand.x, rival.z - stand.z);
   for (let k = 0; k < 8 && !lineOfSight(run.forts, run.kids[0].x, run.kids[0].z, rival.x, rival.z); k++) {
      run.kids[0].x -= (rival.x - run.kids[0].x) * 0.2 + 0.4;
      run.kids[0].z -= (rival.z - run.kids[0].z) * 0.2;
   }
}
