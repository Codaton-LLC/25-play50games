// HUD pieces games share (06 §F.3). Owned by Claude. core/README.md "HUD: target markers and the timing ring".
export { TargetMarkers, type MarkerTarget, type TargetMarkersProps } from "./TargetMarkers";
export { MARKER_MARGIN, markerBounds, placeMarker, type MarkerPlacement } from "./markerPlacement";
export { TimingRing, type TimingRingProps } from "./TimingRing";
export { arcPath, inZone, judgeTiming, needlePosition, ringPoint, zoneLength, zoneProgress, type TimingGrade, type TimingZone } from "./timingMath";
