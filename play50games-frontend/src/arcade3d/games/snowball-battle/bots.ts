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
}

function livingRivals(run: Run): Kid[] {
   const out: Kid[] = [];
   for (let i = 1; i < run.kids.length; i++) if (run.kids[i].present && run.kids[i].alive) out.push(run.kids[i]);
   return out;
}

function standOf(rival: Kid, player: Kid): { x: number; z: number } {
   let dx = rival.peekX - rival.destX;
   let dz = rival.peekZ - rival.destZ;
   let len = Math.hypot(dx, dz);
   if (len < 0.2) { dx = player.x - rival.x; dz = player.z - rival.z; len = Math.hypot(dx, dz) || 1; }
   dx /= len; dz /= len;
   let x = rival.x + dx * 5.2;
   let z = rival.z + dz * 5.2;
   const od = Math.hypot(x, z);
   if (od < 1.9) { x *= 1.9 / od; z *= 1.9 / od; }
   return { x, z };
}

/** Oracle (reaction 0, any wind-up) and witness (0.40 s, first 0.70 s, range 8). */
export function fighter(opts: BrainOpts): (run: Run) => StepInput {
   const seen = [0, 0, 0, 0];
   return (run: Run) => {
      const player = run.kids[0];
      const rivals = livingRivals(run);
      let focus: Kid | null = null;
      for (let i = 0; i < rivals.length; i++) {
         const kid = rivals[i];
         if (kid.state === "windup") { focus = kid; break; }
      }
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
         if (!kid.present || !kid.alive || kid.state !== "windup") { seen[i] = 0; continue; }
         const see = lineOfSight(run.forts, player.x, player.z, kid.x, kid.z);
         if (!see) { seen[i] = 0; continue; }
         if (seen[i] <= 0) seen[i] = run.time;
         const age = AI.windup - kid.timer;
         const dist = Math.hypot(kid.x - player.x, kid.z - player.z);
         if (run.time - seen[i] >= opts.reaction - 1e-4 && age <= opts.window + 1e-4 && dist <= opts.range && player.ammo > 0 && run.throwCd <= 0 && !run.scooping) {
            throwId = i;
            break;
         }
      }
      if (danger) return { moveX: sx, moveY: sz, camYaw: 0, scoop: false, fire: false, tapId: -1, aimYaw: aim };
      if (throwId > 0) {
         return {
            moveX: 0, moveY: 0, camYaw: 0, scoop: false, aimYaw: aim,
            fire: !opts.coarse, tapId: opts.coarse ? throwId : -1,
         };
      }
      const urgent = rivals.some((kid) => kid.state === "peek" || kid.state === "windup");
      let scoop = false;
      if (!urgent && player.ammo < 2) {
         if (run.scooping) scoop = run.scoopT < 0.55;
         else scoop = true;
      }
      if (!focus) return zero(aim, scoop);
      const stand = standOf(focus, player);
      const see = lineOfSight(run.forts, player.x, player.z, focus.x, focus.z);
      if (!see) {
         const side = Math.hypot(player.x - focus.x, player.z - focus.z) || 1;
         return toward(player.x, player.z, player.x + (focus.z - player.z) / side, player.z - (focus.x - player.x) / side, aim, scoop, false, -1);
      }
      return toward(player.x, player.z, stand.x, stand.z, aim, scoop, false, -1);
   };
}

export const oracle = () => fighter({ coarse: false, reaction: 0, window: AI.windup, range: 14, sidestep: 6 });
export const witness = (coarse: boolean) => fighter({ coarse, reaction: 0.2, window: 0.55, range: 10, sidestep: 2.4 });

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
   const stand = standOf(rival, { ...run.kids[0], x: rival.x, z: rival.z - 1 });
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
