// What the Scene shares with the HUD's live widgets (the mini-map and the edge arrow) without a store
// write per frame: the current run and the lit beacon's screen direction. The Scene writes it in its
// frame loop; the HUD reads it in its own animation frame. Plain data, never saved.
import type { CityRun } from "./rules";

export interface HudFeed {
   run: CityRun | null;
   /** the guide point is off screen: show the edge arrow at this angle (rad, 0 = right, CCW, screen) */
   edge: boolean;
   angle: number;
   /** the camera's yaw (the mini-map turns with it) */
   yaw: number;
}

export const hudFeed: HudFeed = { run: null, edge: false, angle: 0, yaw: 0 };
