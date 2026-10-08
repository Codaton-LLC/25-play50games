// 3D Arcade analytics: pushes events to the GTM dataLayer when it exists (no-op otherwise).
// GameShell sends these; games never call it. GTM triggers match on `event`.
export type ArcadeEventName = "arcade_start" | "arcade_game_over" | "arcade_new_best";

export interface ArcadeEventPayload {
   /** game slug */
   game: string;
   score: number;
   duration_ms: number;
   /** arcade_game_over only: how the run's ticket turned out (core/runTicket.ts), never the ticket */
   ticket?: "ok" | "late" | "failed" | "none";
}

export function trackArcade(event: ArcadeEventName, payload: ArcadeEventPayload): void {
   if (typeof window === "undefined") return;
   try {
      const dataLayer = (window as unknown as { dataLayer?: unknown }).dataLayer;
      if (!Array.isArray(dataLayer)) return;
      dataLayer.push({
         event,
         game: payload.game,
         score: Math.round(payload.score),
         duration_ms: Math.round(payload.duration_ms),
         ...(payload.ticket ? { ticket: payload.ticket } : {}),
      });
   } catch {
      // analytics must never break a game
   }
}
