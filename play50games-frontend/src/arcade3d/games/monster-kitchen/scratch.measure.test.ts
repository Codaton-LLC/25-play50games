import { it } from "vitest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";

const URLS = {
   apple: "/models/3d/food-catcher/apple.glb",
   burger: "/models/3d/food-catcher/burger.glb",
   sock: "/models/3d/food-catcher/sock.glb",
   chef: "/models/3d/food-catcher/chef.glb",
   banana: "/models/3d/shared/banana.glb",
   tinCan: "/models/3d/shared/tinCan.glb",
   monster: "/models/3d/monster-kitchen/monster.glb",
   cauldron: "/models/3d/monster-kitchen/cauldron.glb",
   fish: "/models/3d/shared/fish.glb",
};

it("measures GLBs", async () => {
   for (const [id, url] of Object.entries(URLS)) {
      const glb = await readCharacterGlb(url);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
      const n = glb.cloud.length / 3;
      for (let i = 0; i < n; i++) {
         const x = glb.cloud[i * 3], y = glb.cloud[i * 3 + 1], z = glb.cloud[i * 3 + 2];
         if (x < minX) minX = x; if (x > maxX) maxX = x;
         if (y < minY) minY = y; if (y > maxY) maxY = y;
         if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
      // eslint-disable-next-line no-console
      console.log(
         `${id}: ${(maxX - minX).toFixed(4)} x ${(maxY - minY).toFixed(4)} x ${(maxZ - minZ).toFixed(4)}` +
            `  min(${minX.toFixed(3)}, ${minY.toFixed(3)}, ${minZ.toFixed(3)}) max(${maxX.toFixed(3)}, ${maxY.toFixed(3)}, ${maxZ.toFixed(3)})` +
            ` verts=${n} node=[${glb.node.map((v) => v.toFixed(3)).join(",")}]`,
      );
      if (id === "monster") {
         // head profile: per y band, max |x| and z range
         for (let yb = 1.0; yb < 1.9; yb += 0.1) {
            let mx = 0, zmin = Infinity, zmax = -Infinity, count = 0;
            for (let i = 0; i < n; i++) {
               const y = glb.cloud[i * 3 + 1];
               if (y < yb || y >= yb + 0.1) continue;
               count++;
               mx = Math.max(mx, Math.abs(glb.cloud[i * 3]));
               zmin = Math.min(zmin, glb.cloud[i * 3 + 2]);
               zmax = Math.max(zmax, glb.cloud[i * 3 + 2]);
            }
            // eslint-disable-next-line no-console
            console.log(`  monster y ${yb.toFixed(1)}: |x|<=${mx.toFixed(3)} z ${zmin.toFixed(3)}..${zmax.toFixed(3)} n=${count}`);
         }
      }
      if (id === "cauldron") {
         // rim band radius
         let rMin = Infinity, rMax = 0;
         for (let i = 0; i < n; i++) {
            const y = glb.cloud[i * 3 + 1];
            if (y < 1.19 || y >= 1.29) continue;
            const r = Math.hypot(glb.cloud[i * 3], glb.cloud[i * 3 + 2]);
            rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
         }
         // eslint-disable-next-line no-console
         console.log(`  cauldron rim band r ${rMin.toFixed(3)}..${rMax.toFixed(3)}`);
      }
   }
});
