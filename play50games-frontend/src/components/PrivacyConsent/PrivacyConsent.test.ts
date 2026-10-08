// The cookie banner's buttons are full-size touch targets on touch screens (measured in a browser:
// 38 px tall before, 44 px now, desktop unchanged); this guards the rule they rest on.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import styles from "./PrivacyConsent.module.css";

const read = (file: string) => readFileSync(path.join(__dirname, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("cookie banner buttons", () => {
   it("are at least 44 px tall on coarse pointers only", () => {
      const css = read("PrivacyConsent.module.css");
      const coarse = css.match(/@media\s*\(pointer:\s*coarse\)\s*\{([\s\S]*)\}/)?.[1] ?? "";
      const height = Number(coarse.match(/\.button\s*\{[^}]*min-height:\s*(\d+)px/)?.[1]);
      expect(height).toBeGreaterThanOrEqual(44);
      // nothing outside the media query changes the desktop look
      expect(css.replace(/@media[\s\S]*$/, "").trim()).toBe("");
   });

   it("both carry the class", () => {
      const source = read("PrivacyConsent.tsx");
      // each button element, from its tag to its closing tag
      const buttons = source.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
      expect(buttons).toHaveLength(2);
      for (const button of buttons) expect(button).toContain("className={styles.button}");
      expect(styles.button).toBeTruthy();
   });
});
