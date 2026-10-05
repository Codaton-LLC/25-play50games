// The GLB files that really exist under public/models/3d. Owned by Claude: every assets PR adds
// one line per GLB it commits (modelManifest.test.ts fails when this list and the folder differ).
// useModel / <Model> only fetch a url listed here. Any other url goes straight to its primitive,
// so a game whose models are not generated yet makes no .glb requests (no 404s, no waiting).
// Plain data, server-safe.

export const MODEL_MANIFEST: readonly string[] = [
   // "/models/3d/shared/robot.glb",
];

const LISTED: ReadonlySet<string> = new Set(MODEL_MANIFEST);

/** Is there a GLB at this url (public/models/3d/...)? */
export function hasModel(url: string): boolean {
   return LISTED.has(url);
}
