"use client";

// Night/rush-hour street dressing, drawn only on run levels 4 and 5 (Night Traffic / Rush Hour):
// a street-lamp line and a parked rush-taxi line, strictly OUTSIDE the play bounds. Every copy
// stands at |x| = decorX(horizon.coverX), on the side cover's top just past its inner edge (see assets.ts), world-anchored to an absolute street row; decorRow recycles a copy
// to the far end of its line once it is DECOR_RECYCLE_ROWS behind the pigeon, off the camera's
// rear ground envelope. On every other level the pools' update returns false and nothing draws.
import { memo, useCallback, useEffect, useMemo } from "react";
import { BoxGeometry, CylinderGeometry, Matrix4, MeshStandardMaterial, type Material } from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import type { InstancePart } from "@/arcade3d/core/render";
import {
   ASSETS, createLampSpots, createTaxiSpots, decorRow, decorX, DECOR_Y,
   isDecorLevel, LAMP_COUNT, LAMP_HEIGHT, LAMP_SPACING,
   RUSH_TAXI_COUNT, RUSH_TAXI_SPACING, type StreetDecorSpot,
} from "./assets";
import type { Horizon } from "./camera";
import type { StreetParts } from "./Primitives";
import { ROW_PITCH, type PigeonRun } from "./rules";

interface DecorProps {
   run: PigeonRun;
   horizon: Horizon;
   parts: StreetParts;
}

/** Stand-in while streetLampNight.glb is missing or broken: one pole and one cross-arm part. */
function useLampParts(): InstancePart[] {
   const parts = useMemo<InstancePart[]>(() => {
      const material = new MeshStandardMaterial({ color: "#2f3b52", roughness: 0.6 });
      return [
         { geometry: new CylinderGeometry(0.07, 0.09, LAMP_HEIGHT, 10).translate(0, LAMP_HEIGHT / 2, 0), material },
         { geometry: new BoxGeometry(0.9, 0.12, 0.24).translate(0, LAMP_HEIGHT - 0.06, 0), material },
      ];
   }, []);
   useEffect(
      () => () => {
         for (const part of parts) {
            part.geometry.dispose();
            (part.material as Material).dispose();
         }
      },
      [parts]
   );
   return parts;
}

/**
 * One decor line as a <DynamicInstancedModel> pool. `spots` and their base turn matrices are
 * fixed; each frame the update recycles the spot's row (decorRow), then writes its placement:
 * x just outside the cover, z from the absolute row. Returns false on other levels / no spot.
 */
function useDecorPool(
   spots: StreetDecorSpot[],
   spacing: number,
   run: PigeonRun,
   horizon: Horizon
) {
   const bases = useMemo(() => spots.map((spot) => new Matrix4().makeRotationY(spot.rotY)), [spots]);
   return useCallback(
      (i: number, matrix: Matrix4) => {
         if (!isDecorLevel(run.level)) return false;
         const spot = spots[i];
         const row = decorRow(spot, run.player.row, spacing, spots.length);
         matrix.copy(bases[i]).setPosition(spot.side * decorX(horizon.coverX), DECOR_Y, -row * ROW_PITCH);
      },
      [run, horizon, spots, spacing, bases]
   );
}

const StreetLamps = memo(function StreetLamps({ run, horizon }: DecorProps) {
   const spots = useMemo(createLampSpots, []);
   const update = useDecorPool(spots, LAMP_SPACING, run, horizon);
   const fallbackParts = useLampParts();
   return <DynamicInstancedModel asset={ASSETS.streetLampNight} count={LAMP_COUNT} update={update} fallbackParts={fallbackParts} name="street-lamps" />;
});

const ParkedTaxis = memo(function ParkedTaxis({ run, horizon, parts }: DecorProps) {
   const spots = useMemo(createTaxiSpots, []);
   const update = useDecorPool(spots, RUSH_TAXI_SPACING, run, horizon);
   // The live taxi fleet's stand-in parts: same drawn size as the fitted rushTaxi GLB.
   return <DynamicInstancedModel asset={ASSETS.rushTaxi} count={RUSH_TAXI_COUNT} update={update} fallbackParts={parts.vehicles[1]} name="parked-taxis" />;
});

export const StreetDecor = memo(function StreetDecor({ run, horizon, parts }: DecorProps) {
   return (
      <group name="night-street-decor">
         <StreetLamps run={run} horizon={horizon} parts={parts} />
         <ParkedTaxis run={run} horizon={horizon} parts={parts} />
      </group>
   );
});
