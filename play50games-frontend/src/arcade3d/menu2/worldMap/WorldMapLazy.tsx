"use client";

// The Menu 2 world map as an on-demand chunk. /3d (a server component) renders it only on preview builds;
// importing WorldMap there directly put its client code in every /3d first load.
import dynamic from "next/dynamic";
import type { WorldMapProps } from "./WorldMap";

const WorldMap = dynamic(() => import("./WorldMap"), { ssr: false });

export default function WorldMapLazy(props: WorldMapProps) {
   return <WorldMap {...props} />;
}
