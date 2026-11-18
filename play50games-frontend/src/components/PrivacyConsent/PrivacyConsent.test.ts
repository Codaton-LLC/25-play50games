// The cookie banner's buttons are full-size touch targets on touch screens (44 px) and a little
// lower with a mouse (40 px). The banner's look lives in its CSS module since the redesign; this
// guards the rules the touch size rests on.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import styles from "./PrivacyConsent.module.css";

const read = (file: string) => readFileSync(path.join(__dirname, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("cookie banner buttons", () => {
   it("are at least 44 px tall on coarse pointers only", () => {
      const css = read("PrivacyConsent.module.css");
      const coarse = css.match(/@media\s*\(pointer:\s*coarse\)\s*\{([\s\S]*?)\}\s*\}/)?.[1] ?? "";
      const height = Number(coarse.match(/\.button\s*\{[^}]*min-height:\s*(\d+)px/)?.[1]);
      expect(height).toBeGreaterThanOrEqual(44);
      // with a mouse the buttons are lower: the 44 px comes from the media query alone
      const base = css.replace(/@media[\s\S]*$/, "");
      const desktop = Number(base.match(/\.button\s*\{[^}]*min-height:\s*(\d+)px/)?.[1]);
      expect(desktop).toBeGreaterThan(0);
      expect(desktop).toBeLessThan(44);
      // no :hover rule sets a height, so a hover cannot shrink a touch target
      expect(css).not.toMatch(/:hover[^{]*\{[^}]*min-height/);
   });

   it("both carry the class", () => {
      const source = read("PrivacyConsent.tsx");
      // each button element, from its tag to its closing tag
      const buttons = source.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
      expect(buttons).toHaveLength(2);
      for (const button of buttons) expect(button).toMatch(/className=\{`\$\{styles\.button\} /);
      expect(styles.button).toBeTruthy();
   });
});
