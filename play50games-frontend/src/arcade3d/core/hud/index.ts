// HUD pieces games share (06 §F.3). Owned by Claude. core/README.md "HUD: target markers and the timing ring".
export { TargetMarkers, type MarkerTarget, type TargetMarkersProps } from "./TargetMarkers";
export { MARKER_MARGIN, markerBounds, placeMarker, type MarkerPlacement } from "./markerPlacement";
export { TimingRing, type TimingRingProps } from "./TimingRing";
export { arcPath, inZone, judgeTiming, needlePosition, ringPoint, zoneLength, zoneProgress, type TimingGrade, type TimingZone } from "./timingMath";
export { TargetBeacon, type BeaconTarget, type TargetBeaconProps } from "./TargetBeacon";
export { BEACON_ARROW_SIZE, BEACON_MAX_SCALE, BEACON_MIN_PX, BEACON_STYLES, beaconLabel, beaconMotion, beaconScale, type BeaconMotion, type BeaconStyle, type BeaconVariant } from "./beacon";
export { HintLine, useHudSignal, type HintLineProps } from "./HintLine";
export { EMPTY_HINT, HINT_AGAIN_MS, HINT_FIRST_MS, createHudSignal, hintVisible, nextHintMark, sameHint, type HintMark, type HintState, type HintTone, type HudSignal } from "./hintTiming";
export { useReducedMotion } from "./useReducedMotion";
