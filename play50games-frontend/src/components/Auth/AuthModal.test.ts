// The Login / Register modals stay usable with the cookie banner open (measured in headless Chrome
// at 740 x 360 to 1280 x 800: the banner covered the submit button and a tall card lost its title
// off the top). This guards the rules that fix it.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import styles from "./AuthModal.module.css";

const read = (file: string) => readFileSync(path.join(__dirname, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rule = (css: string, selector: string) => {
   const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
   return css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
};

describe("auth modals and the cookie banner", () => {
   const css = read("AuthModal.module.css");
   const base = css.replace(/@media[\s\S]*$/, "");
   const overlay = rule(base, ".overlay:global(.modal-overlay)");
   const content = rule(base, ".content:global(.modal-content)");

   it("sit above the banner", () => {
      const banner = read("../PrivacyConsent/PrivacyConsent.tsx");
      const bannerZ = Number(banner.match(/zIndex:\s*(\d+)/)?.[1]);
      expect(bannerZ).toBeGreaterThan(0);
      expect(Number(overlay.match(/z-index:\s*(\d+)/)?.[1])).toBeGreaterThan(bannerZ);
   });

   it("scroll instead of clipping a card taller than the window", () => {
      expect(overlay).toMatch(/overflow-y:\s*auto/);
      expect(overlay).toMatch(/align-items:\s*flex-start/);
      expect(content).toMatch(/margin-block:\s*auto/);
      expect(content).toMatch(/flex-shrink:\s*0/);
   });

   it("are used by both modals", () => {
      for (const file of ["LoginModal.tsx", "RegisterModal.tsx"]) {
         const source = read(file);
         expect(source).toContain("modal-overlay ${styles.overlay}");
         expect(source).toContain("modal-content ${styles.content}");
      }
      expect(styles.overlay).toBeTruthy();
      expect(styles.content).toBeTruthy();
   });
});
