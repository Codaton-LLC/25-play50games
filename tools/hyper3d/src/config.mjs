// All wire field names and request defaults live here. Verified 2026-10-05.
export const API = Object.freeze({
   base: "https://api.hyper3d.com/api/v2",
   paths: { submit: "/rodin", status: "/status", download: "/download", balance: "/check_balance" },
   fields: {
      images: "images", prompt: "prompt", tier: "tier", quality: "quality_override",
      pose: "TAPose", format: "geometry_file_format", mesh: "mesh_mode", material: "material",
      seed: "seed", texture: "texture_mode", subscription: "subscription_key", task: "task_uuid"
   },
   defaults: { format: "glb", mesh: "Raw", material: "PBR" },
   creditEstimate: 0.5,
   reserve: 2,
   timeoutMs: 30000,
   pollDeadlineMs: 20 * 60 * 1000,
   privacyPolicy: "https://docs.hyper3d.ai/en/legal/data-retention-policy"
});

export function generationFields(asset, seed) {
   const f = API.fields;
   return {
      ...(asset.mode === "text" ? { [f.prompt]: asset.prompt } : {}),
      [f.tier]: asset.tier,
      [f.quality]: String(asset.qualityOverride),
      [f.pose]: String(asset.kind === "character"),
      [f.format]: API.defaults.format,
      [f.mesh]: API.defaults.mesh,
      [f.material]: API.defaults.material,
      [f.texture]: asset.kind === "character" ? "medium" : "low",
      [f.seed]: String(seed)
   };
}
