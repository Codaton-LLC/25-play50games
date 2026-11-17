# Design System: Play50Games

Source of truth for generating Play50Games screens in Google Stitch. Paste this whole file into Stitch as the design brief, then use one prompt from `stitch-prompts.md` per screen.

Decisions the owner made (2026-11-17): three worlds in the main menu (the third one is named Scale Squad: five pangolin heroes who roll into a ball), a "console premium" direction inspired by Apple Arcade and the PlayStation Store, one accent colour (Arcade Coral), dark and light themes of equal quality.

---

## 1. Visual Theme & Atmosphere

Play50Games is a free browser game platform with three worlds: **Classic 50** (fifty 2D brain games that unlock one after another and end in a certificate), **3D Arcade** (fifty 3D mini-games with five levels each and one leaderboard per game) and **Scale Squad** (platform and runner games played with five pangolin heroes who roll into a ball).

The interface feels like the home screen of a modern console: calm ink surfaces, large cinematic game art, and a scoreboard's precision in every number. The game art carries all the colour. The chrome around it stays quiet, so a screenshot of a game always looks brighter than the page that holds it.

- **Density: 4 of 10 (Daily App Balanced).** Generous space around art, compact rows only inside leaderboards.
- **Variance: 7 of 10 (Offset Asymmetric).** Split heroes, unequal grid tracks, one large tile beside several small ones. Never a centred hero, never three equal cards in a row.
- **Motion: 6 of 10 (Fluid CSS).** Spring-like easing, staggered reveals, a few perpetual micro-loops. No scroll hijacking.

Five motifs make the system recognisable. Use them on every screen:

1. **The art is the card.** A game tile is its 16:9 screenshot with generously rounded corners. Title, tagline and score sit below the art on the page background, not inside a box.
2. **Scoreboard numerals.** Every number (scores, times, ranks, counts, level numbers) is set in the monospace face with tabular figures, like a stadium scoreboard: `1,412`, `00:19.84`, `07 / 50`, `#04`.
3. **The five-pip level meter.** Every 3D game shows five short rounded bars. A cleared level fills its pip with coral. All five cleared turns the meter gold.
4. **Shield ranks.** Rank badges use the hexagon shield shape of the logo. Ranks 1 to 3 are filled shields, the rest are plain numerals.
5. **Keycap hints.** Controls are shown as small keycaps (`W A S D`, `Space`, `E`) and touch glyphs, never as sentences.

---

## 2. Color Palette & Roles

One cool ink-navy neutral family in both themes (it comes from the navy shield in the logo). One accent. Colour beyond that belongs to game art.

### Dark theme, "Night Deck" (default when the system prefers dark)

- **Night Ink** (#0B0F1A): page canvas. Never pure black.
- **Deck** (#121726): header, cards, menus, sheets.
- **Raised Deck** (#1A2133): hover surfaces, input wells, chips, skeleton base.
- **Hairline Night** (#252D42): 1px borders and dividers.
- **Chalk** (#F1F3F8): primary text and icons.
- **Fog** (#A3ACBF): secondary text, taglines, descriptions.
- **Dim** (#7A84A0): metadata, placeholders, locked items.

### Light theme, "Day Deck" (default when the system prefers light)

- **Paper Mist** (#F2F4F8): page canvas.
- **White Card** (#FFFFFF): header, cards, menus, sheets.
- **Sunk Paper** (#E8ECF3): hover surfaces, input wells, chips, skeleton base.
- **Hairline Day** (#D9DFEA): 1px borders and dividers.
- **Ink** (#0E1322): primary text and icons.
- **Slate** (#4F5A73): secondary text, taglines, descriptions.
- **Dim Slate** (#626C85): metadata, placeholders, locked items.

### The single accent

- **Arcade Coral** (#E75F40): primary button fill, active navigation indicator, filled level pips, progress fill, focus ring, coral text and icons on dark surfaces. Saturation 78%.
- **Ember Coral** (#C2452A): the same accent one step deeper. Coral text, links and icons on light surfaces, and the pressed state of the primary button.
- **Coral Wash** (#2F2129 on dark, #FBE6E0 on light): background of the selected chip, the active menu row and the active world in the switcher.
- **Label on coral is always Night Ink (#0B0F1A)**, in both themes. Never white text on coral.

### Functional colours (state only, never decoration, never on buttons or navigation)

- **Trophy Gold** (#E3A72F): the gold of the "50" in the logo. Reserved for achievement: new best score, rank 1 shield, a fully cleared five-pip meter, the certificate. Gold text on light surfaces uses **Deep Gold** (#96660B).
- **Go Green** (#3FB57F, text on light #1E8A5A): "Live" dot, score saved, form success.
- **Signal Red** (#D93654): form errors, offline notice, lives lost. A cool red, clearly different from the warm coral.

### Content colours (Scale Squad heroes only)

The five heroes keep their own colours, shown only as the ring around a hero portrait and the hero's ability chip: Riko Red (#EF4444), Nami Blue (#2563EB), Kiro Green (#22C55E), Zuno Yellow (#FACC15), Vexa Violet (#8B5CF6). They never colour buttons, links, tabs or headings.

### Banned colour patterns

No purple or blue neon glow. No gradient buttons. No gradient text. No second accent. No per-game colours on the chrome (a game's colour lives only inside its art). No pure black (#000000) and no pure white text on the dark canvas (use Chalk).

---

## 3. Typography Rules

- **Display: Outfit.** Weights 600 and 700. Tight tracking (-0.02em to -0.035em), short line height (0.98 to 1.05). Round geometric bowls that echo the chunky logo lettering. Used for the hero, world names, section headings and game titles. If Outfit is unavailable, use Sora.
- **Body and interface: Geist.** Weights 400, 500, 600. Line height 1.6 for paragraphs, 65 characters maximum per line. Secondary colour for descriptions. If Geist is unavailable, use DM Sans.
- **Numbers: Geist Mono.** Weights 500 and 600, tabular figures. Every score, time, rank, count and level number. If unavailable, use JetBrains Mono.
- **Banned:** Inter, Roboto, Arial, system-ui as the visible face, every serif, every "gamer" novelty font (pixel fonts, sci-fi fonts, graffiti fonts).

### Scale

| Role | Face | Size | Weight | Notes |
|---|---|---|---|---|
| Hero | Outfit | clamp(2.5rem, 5.2vw, 4.5rem) | 700 | line height 0.98, tracking -0.035em |
| World title | Outfit | clamp(2rem, 3.6vw, 3rem) | 700 | tracking -0.03em |
| Section heading | Outfit | 1.625rem (26px) | 600 | tracking -0.02em |
| Game title | Outfit | 1.0625rem (17px) | 600 | one line, ellipsis |
| Body | Geist | 1rem (16px) | 400 | line height 1.6 |
| Small | Geist | 0.875rem (14px) | 400 or 500 | taglines, helper text |
| Label | Geist | 0.75rem (12px) | 600 | uppercase, tracking +0.08em |
| Score, small | Geist Mono | 0.875rem (14px) | 500 | cards, chips |
| Score, table | Geist Mono | 1.125rem (18px) | 500 | leaderboard rows |
| Score, result | Geist Mono | clamp(2.5rem, 6vw, 4rem) | 600 | result panel, player card totals |

Hierarchy comes from weight and colour first, size second. The hero headline is confident, not screaming: it never exceeds 4.5rem.

---

## 4. Component Stylings

**Shape language.** Four radii only: softly rounded (8px) for keycaps and small badges, rounded (14px) for buttons and inputs, generously rounded (20px) for art tiles and cards, very round (28px) for the hero stage, world panels, mega panels and sheets. Chips, tabs and the world switcher are full pills.

**Elevation.** Light theme: one diffused shadow tinted with ink navy (`0 18px 40px -18px rgba(14, 19, 34, 0.18)`) on floating layers and on the hovered tile. Dark theme: no shadows on cards. Raised surfaces get a 1px top inner highlight (`inset 0 1px 0 rgba(255, 255, 255, 0.06)`) and floating layers a deep drop (`0 24px 60px -20px rgba(0, 0, 0, 0.6)`). No outer glows anywhere.

* **Primary button:** Arcade Coral fill, Night Ink label (Geist 600, 1rem), rounded (14px), 48px tall, 20px side padding, optional leading play triangle. Hover: fill lightens slightly (#EC7458). Active: moves down 1px and scales to 0.98, fill Ember Coral. Focus: 2px coral ring with a 2px gap. One primary button per view.
* **Quiet button:** transparent, 1px hairline border, primary text colour. Hover: Raised Deck or Sunk Paper fill. Same height and radius as the primary.
* **Icon button:** 44px square, rounded (14px), no border, hover fill. Used for search, theme, close.
* **Game tile:** 16:9 art, generously rounded (20px), 1px hairline in light theme only. Top left badge. Below the art, with 12px gap: title row (game title left, five-pip meter right), tagline in secondary colour (one line), best score line in mono ("Best 1,412" or "No score yet" in Dim). Hover: art scales to 1.04 inside its clipped frame over 420ms, a small "Play" chip slides up from the bottom left of the art. Active: whole tile scales to 0.98. A "soon" tile has desaturated art at 70% opacity and no hover lift.
* **Badges:** pill, 24px tall, Label type. "Live": Deck fill with a breathing Go Green dot. "New": Coral Wash fill, coral text. "Soon": Raised Deck fill, Dim text. "Time trial": hairline outline with a stopwatch glyph.
* **Five-pip level meter:** five bars, 14px by 4px, 3px gap, fully rounded. Empty: Hairline colour. Cleared: Arcade Coral. All five: Trophy Gold.
* **Shield rank:** hexagon shield 28px tall. Rank 1: Trophy Gold fill, Night Ink numeral. Ranks 2 and 3: Raised Deck fill with hairline, primary numeral. Rank 4 and below: no shield, mono numeral in secondary colour, zero padded (`#04`).
* **Keycap:** softly rounded (8px), 1px hairline, 2px darker bottom edge, Geist Mono 0.75rem, minimum 28px square.
* **Chips (filters):** pill, 36px tall (44px tap area), hairline outline. Selected: Coral Wash fill, coral text, no outline.
* **World switcher:** one pill track (Raised Deck or Sunk Paper) holding three segments: "Classic 50", "3D Arcade", "Scale Squad". The active segment sits on a Coral Wash fill that fades in. Each segment carries a small plate glyph: "50", "3D", "5".
* **Inputs:** label above (Small, 500), field 48px tall, rounded (14px), well fill, 1px hairline. Focus: coral ring. Helper text below in Dim. Error text below in Signal Red with the border in Signal Red. No floating labels, no placeholder-only fields.
* **Leaderboard row:** no card. Rows are separated by 1px hairlines: shield or numeral, player name ("Arta K."), score in mono right aligned, time in mono Dim. The player's own row has a Coral Wash fill and stays pinned at the bottom of the table when it is out of view.
* **Progress ring (Classic):** thin 6px ring, coral arc on a hairline track, count in mono at the centre (`07 / 50`).
* **Loading:** skeleton blocks in the exact shape of the content (16:9 tile, two text lines, pip row) with a slow shimmer. No circular spinners.
* **Empty states:** a composed block with a faint outlined version of the missing content, one sentence and one action. Example: an empty five-row leaderboard outline with "No scores yet. Play one round to take first place." and a "Play" button.
* **Error states:** inline, next to the thing that failed. "Could not load the leaderboard. Check your connection and try again." with a quiet "Try again" button.
* **Toast:** bottom centre on desktop, above the tab bar on phones, Deck fill, one line, 4 seconds. "Score saved", "Signed in".

---

## 5. Navigation & Menus

The three worlds are the navigation. Everything else is a utility.

### Desktop top bar (72px tall, sticky)

Deck or White Card surface. After scrolling it becomes 85% opaque with a 16px background blur and a hairline bottom border.

- **Left:** logo shield mark (36px) and the wordmark "Play50Games" in Outfit 700.
- **Centre left:** the world switcher: Classic 50, 3D Arcade, Scale Squad.
- **Right, in this order:** search button shaped like a field ("Find a game" with a `Ctrl K` keycap), the text link "Leaderboards", the theme icon button, then the account: a quiet "Log in" button for guests, or a 36px avatar chip with the player's initials when signed in.

### Mega panel (opens under the bar on hover or focus of a world segment)

A very round (28px) floating panel as wide as the page container, 8px below the bar. Three unequal zones in a `5fr 3fr 4fr` grid:

- **Zone A, the world card:** the plate glyph, the world name in World title type, a one-sentence promise, the player's progress in mono ("12 of 50 unlocked", "34 of 250 levels cleared", "Opens soon") and the one primary button ("Enter 3D Arcade").
- **Zone B, shortcuts:** a plain link list with a Label heading.
  - Classic 50: Continue where you stopped, All 50 games, My progress, Certificate, Verify a certificate.
  - 3D Arcade: All games, New this month, Originals, Adventure, Skill, Time trials, Leaderboards.
  - Scale Squad: the five heroes, each with its colour ring and its power.
- **Zone C, featured art:** one large 16:9 tile on top and two small tiles under it.

Items reveal with a 40ms stagger. The panel closes on Escape, on pointer leave and on focus leaving it.

### Search (command palette)

Opens with `Ctrl K` or the search button. A centred very round (28px) panel, 640px wide, over a dimmed and blurred page. Large input on top, then results as rows: 56px thumbnail, game title, world label, best score in mono. Arrow keys move, Enter opens. Before typing it lists "Jump back in" (recent games) and the three worlds.

### Account menu (dropdown, 320px)

Header: avatar, public name ("Dren P."), the line "Scores show as First L." Then: Player card, Classic progress, Certificate, Leaderboard name and privacy. Divider. Theme as a three-part segmented control: System, Light, Dark. Divider. Help, Contact, Log out (Signal Red text).

### Phone and small tablet navigation (below 900px)

- **Top bar (56px):** shield mark and "Play50", search icon button, avatar or "Log in".
- **Bottom tab bar (64px plus the safe area):** five tabs with icon and label: Home, Classic, Arcade, Squad, Ranks. The active tab has coral icon and label and a short coral pill above the icon. Deck surface, hairline top border. It hides while a game is being played.
- No mega panel on phones. Each world tab opens the world page directly. The account menu and search open as full-height sheets.

### In-game chrome

The play page is full screen. Only a back chevron (top left), the HUD chips in mono and a pause button remain. The 3D canvas is never themed.

### Footer

A hairline top border, four unequal columns: the logo with one line of text, then Play (Classic 50, 3D Arcade, Scale Squad, Leaderboards), Account (Player card, Certificate, Verify a certificate) and Help (FAQ, Contact, Privacy, Terms). On phones the columns stack and the footer sits above the tab bar.

---

## 6. Layout Principles

- **Container:** maximum width 1360px, centred, side padding `clamp(16px, 4vw, 40px)`.
- **Grid:** CSS Grid everywhere, never percentage flex math. Gaps of 16px, 24px or 32px.
- **Section rhythm:** vertical gaps of `clamp(3rem, 8vw, 6rem)` between sections.
- **No overlap.** Text never sits on top of art, except the one bottom info strip of the hero stage, which has its own solid Deck surface.
- **Hero (hub):** split `5fr 7fr`. Left: a Label eyebrow, the headline, one sentence, one primary button. Right: the featured stage. The hero is as tall as its content, not as tall as the screen.
- **Inline art in the headline.** The hub headline carries two small pieces of game art inline between its words, at the height of the letters, rounded (14px), like visual punctuation: "Fifty brain games, [art] a 3D arcade [art] and the Scale Squad." On phones the two images move into a small row under the headline.
- **Three worlds, never three equal cards.** On desktop the worlds are three tall art panels in one row that behave like an accordion: the active panel takes `3fr`, the two others `1fr` each and show only the plate glyph and the name set vertically. Hover or focus moves the active state. On phones they stack as three full-width 16:10 panels.
- **Game grids:** four columns on desktop, three on small laptops, two on tablets, one or two on phones (two below 520px only if the titles still fit). The first tile of a section spans two columns and two rows. Because the art is the card, the grid reads as a gallery, not as a wall of boxes.
- **Leaderboards and tables:** no cards. Hairline dividers and space.
- **Full-height areas** use `min-height: 100dvh`, never `100vh`.

### Page blueprints

1. **Hub `/`:** hero with the featured stage, a "Jump back in" rail for returning players, the three-world accordion, "New in the arcade" as a bento (one large tile and four small), "Top of the boards" (left a table of the first place of each live game, right "Your best scores" or a sign-in prompt), a slim three-step line (Pick a world, Play at your pace, Save your scores) separated by hairlines, footer.
2. **3D Arcade `/3d`:** a title band with counts in mono ("30 games, 150 levels, 12 live"), filter chips (All, Originals, Adventure, Skill, Time trials), a sort menu (Newest, A to Z, Difficulty), then the gallery in sections.
3. **Game lobby `/3d/[slug]`:** split `7fr 5fr`. Left: the art stage with the primary "Play" button, then five level tiles (number, name, best in mono, lock on locked levels). Right: the leaderboard (top ten and the pinned own row), the controls as keycaps, the description. Under both: "More like this".
4. **Classic 50 `/classic`:** a header with the progress ring and "Continue: game 8". Then the path: fifty numbered nodes in five chapters of ten, drawn as a line that turns at the end of each row. Done nodes are filled, the current node has a coral ring that pulses, locked nodes are dim with a small lock. The certificate waits at the end of the path in Trophy Gold.
5. **Scale Squad `/scale-squad`:** world hero with the title and "Soon", beside a group picture of the five heroes (never a T-pose line-up). Then the five as hairline rows: colour ring, name, power.
6. **Leaderboards `/leaderboards`:** split `4fr 8fr`. Left: a searchable list of games with small thumbnails. Right: the podium as three columns of unequal height (second, first, third), then the table.
7. **Player card `/progress`:** an identity block (avatar, public name, member since), three world meters, totals in large mono numerals (levels cleared of 500, games played), recent best scores as a table, certificate status, the leaderboard privacy switch.
8. **Sign in and sign up:** one centred sheet, label above every field, one primary button, the alternative as a text link.
9. **Result panel (after a run):** the score in the largest mono size, a Trophy Gold "New best" line when it applies, the new rank, then Retry (primary), Next level and Exit. Guests see "Log in to put this score on the leaderboard."

---

## 7. Responsive Rules

- Below 768px every multi-column layout becomes one column. No exceptions.
- No horizontal page scroll. Rails scroll inside their own container and show a partial next tile as the hint.
- Headlines scale with `clamp()`. Body text is never smaller than 1rem. Small text is never smaller than 0.875rem.
- Every control has a tap area of at least 44px.
- The inline art of the hero headline moves under the headline on phones.
- The top bar slims to 56px and the bottom tab bar appears. Page content gets bottom padding equal to the tab bar plus the safe area.
- Hover-only behaviour (the accordion, the tile "Play" chip) has a tap equivalent: on touch the world panels are all open and stacked, and the chip is always visible.

---

## 8. Motion & Interaction

- **Easing:** spring-like, `cubic-bezier(0.16, 1, 0.3, 1)`. The feel is weighty (stiffness 100, damping 20). No linear easing except progress bars.
- **Durations:** 160ms for presses, 240ms for hovers and menus, 420ms for art zoom and the accordion.
- **Only `transform` and `opacity` animate.** Never width, height, top or left. The accordion animates grid tracks once, on a deliberate hover, and nothing else changes layout.
- **Staggered reveals:** tiles, menu links and leaderboard rows enter with a 40ms cascade (8px rise and fade).
- **Perpetual micro-loops, one per component at most:** the featured stage advances every 7 seconds with thin story-style progress segments; the "Live" dot breathes; the current Classic node pulses; skeletons shimmer; a new best score counts up once.
- **Tactile feedback:** every pressable thing moves down 1px or scales to 0.98 on press.
- **Theme change:** colours cross-fade in 200ms. No flash.
- **Reduced motion:** all loops stop, reveals become instant, the stage stops advancing by itself.

---

## 9. Theme Rules

- Three settings: System (default), Light, Dark. The choice is remembered on the device.
- Both themes use the same layout, the same type and the same accent. Only surfaces and text colours change.
- Game art is never recoloured or dimmed by the theme. In the light theme every art tile gets a 1px hairline so pale screenshots keep their edge.
- The 3D game canvas keeps its own look in both themes. Only the chrome around it follows the theme.
- Design every screen in dark first, then check the same screen in light. A screen is not done until both are checked.

---

## 10. Voice and Sample Content

- English, short, concrete verbs: Play, Retry, Continue, Enter, Log in. A button says exactly what happens.
- Public player names use the format "First L.": Arta K., Dion B., Lea M., Besnik H., Yll R., Marta S., Noel V., Erza D.
- Numbers look real: `1,412`, `1,388`, `00:19.84`, `07 / 50`, `34 / 250`. Never `99.99%`, `100`, `1,000`.
- Real game names only: Robot Collector, Office Escape, Pigeon Crossing, Food Catcher 3D, Tower Climb, Penalty Hero, Warehouse Rush, Clean the City, Tiny Escape Room, Obstacle Race, Castle Defender, Treasure Island, Delivery Drone, Mini Golf 3D.
- Real taglines: "Grab 10 batteries before the clock runs out." "Late for the meeting. Run!" "Why did the pigeon cross the road?" "Jump higher. Do not look down." "10 shots. Beat the keeper."
- Banned words: elevate, seamless, unleash, next-gen, immersive, ultimate, epic, revolutionary, journey.

---

## 11. Anti-Patterns (Banned)

- No emojis anywhere. Icons are simple line icons with one stroke width (1.75px).
- No Inter, no system font as the visible face, no serif, no pixel or sci-fi novelty fonts.
- No pure black (#000000). No pure white text on the dark canvas.
- No neon, no outer glow, no gradient buttons, no gradient text, no glassy rainbow borders.
- No purple or blue "AI" palette. No second accent colour.
- No centred hero. No three equal cards in a row. No card inside a card.
- No text over game art (except the hero stage's own solid info strip).
- No custom mouse cursor. No scroll hijacking. No parallax on phones.
- No filler text: "Scroll to explore", "Swipe down", bouncing arrows.
- No circular loading spinners. No "No data" empty states.
- No generic names (John Doe, Acme, Nexus) and no fake round numbers.
- No stock photos and no AI portraits. Imagery is game screenshots and game art only. Placeholder art, if needed: `https://picsum.photos/seed/play50-<slug>/640/360`.
- No per-game colours on buttons, borders or headings.
- No hover-only information on touch screens.

---

## 12. Implementation Notes (Next app)

What is built on the branch `claude/redesign-hub` (2026-11-17), and how it maps to this document.

- **Tokens:** `play50games-frontend/src/app/theme.css`. Light values on `:root`, dark values under `prefers-color-scheme: dark` and under `data-theme="dark"`. Every token is named `--p50-*`.
- **Scope:** a redesigned page wraps itself in the class `p50`. Inside it the legacy variables (`--bg`, `--card`, `--text`, `--muted`, `--stroke`, `--accent`) are mapped onto the new palette, so older components follow the theme. Pages without `p50` (Classic 50, the classic game page, progress, certificate, FAQ) keep the old dark look until they are redesigned.
- **Theme switch:** `src/lib/theme.ts`. The choice is stored under `play50games_theme`; a small script in `<head>` applies it before the first paint. "System" stores nothing.
- **Fonts:** Outfit (display), **DM Sans** (body) and **JetBrains Mono** (numbers), loaded with `next/font/google` in `app/layout.tsx`. Geist and Geist Mono are not in the font list of Next 14.2, so the documented fallbacks are used. Swapping to Geist later is a change in `layout.tsx` only (the `--font-body` and `--font-mono` variables).
- **Shared parts:** `src/components/Site/ui.module.css` (buttons, plate, keycap, pips, meter). `globals.css` styles every `<button>` and `button:hover`, so each new button class sets its own background for both states.
- **Chrome:** `src/components/Site/` (`SiteHeader`, `SearchPalette`, `SiteFooter`, `BoardRows`, `ClassicPath`, `SquadArt`). The world switcher uses real links; the mega panel opens on hover and on keyboard focus.
- **Pages done:** `/` (hub), `/3d` (catalogue), `/leaderboards` (new, needs the leaderboard flag), `/scale-squad` (new teaser, needs `NEXT_PUBLIC_SQUAD_TEASER`).
- **Pages not done yet:** the game lobby (`/3d/[slug]`), Classic 50 as a path, the player card, the sign-in sheet (the old login and register modals are still used, in their old dark look), the result panel.
- **Scale Squad art:** until the group picture of the five heroes exists, the world shows five rolled-up balls in the hero colours, drawn in CSS. No concept image is shipped.
- **Flags:** with `NEXT_PUBLIC_SQUAD_TEASER` off (the default) the site shows two worlds. With the arcade flag off it shows Classic 50 and the arcade as "soon".
