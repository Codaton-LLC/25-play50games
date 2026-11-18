// Light / dark theme of the redesigned pages (docs/design/DESIGN.md §9). Server-safe.
// "system" stores nothing and sets no attribute, so the OS preference decides.

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_KEY = "play50games_theme";

export function isThemeChoice(value: unknown): value is ThemeChoice {
   return value === "system" || value === "light" || value === "dark";
}

/** The choice stored on this device; "system" when nothing (or anything else) is stored. */
export function storedTheme(raw: string | null): ThemeChoice {
   return raw === "light" || raw === "dark" ? raw : "system";
}

/**
 * Runs in <head> before the first paint, so a stored choice never flashes the other theme.
 * Kept as a string: it must not depend on the bundle.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;

/** Applies a choice to <html> and remembers it. Safe when storage is blocked. */
export function applyTheme(choice: ThemeChoice): void {
   const root = document.documentElement;
   if (choice === "system") root.removeAttribute("data-theme");
   else root.setAttribute("data-theme", choice);
   try {
      if (choice === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, choice);
   } catch {
      /* private mode, or storage blocked: the choice lasts for this page only */
   }
}

/** The choice currently on <html>. */
export function currentTheme(): ThemeChoice {
   return storedTheme(document.documentElement.getAttribute("data-theme"));
}
