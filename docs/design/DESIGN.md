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
- **Dim** (#8089A5): metadata, placeholders, locked items. (Was #7A84A0: 4.30:1 on Raised Deck, below AA.)

### Light theme, "Day Deck" (default when the system prefers light)

- **Paper Mist** (#F2F4F8): page canvas.
- **White Card** (#FFFFFF): header, cards, menus, sheets.
- **Sunk Paper** (#E8ECF3): hover surfaces, input wells, chips, skeleton base.
- **Hairline Day** (#D9DFEA): 1px borders and dividers.
- **Ink** (#0E1322): primary text and icons.
- **Slate** (#4F5A73): secondary text, taglines, descriptions.
- **Dim Slate** (#5C667F): metadata, placeholders, locked items. (Was #626C85: 4.43:1 on Sunk Paper, below AA.)

### The single accent

- **Arcade Coral** (#E75F40): primary button fill, active navigation indicator, filled level pips, progress fill, focus ring, coral text and icons on dark surfaces. Saturation 78%.
- **Ember Coral** (#C2452A): the same accent one step deeper, the pressed state of the primary button. Coral text, links and icons on light surfaces use **Ember Text** (#B83F26), so coral text on Coral Wash passes AA (4.63:1; #C2452A gave 4.19:1).
- **Coral Wash** (#2A1D24 on dark, #FBE6E0 on light; the dark one was #2F2129, 4.46:1 under coral text): background of the selected chip, the active menu row and the active world in the switcher.
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

What is built (the hub and the site chrome on 2026-11-17, the rest of the pages on 2026-11-18), and how it maps to this document.

- **Tokens:** `play50games-frontend/src/app/theme.css`. Light values on `:root`, dark values under `prefers-color-scheme: dark` and under `data-theme="dark"`. Every token is named `--p50-*`.
- **Scope:** a redesigned page wraps itself in the class `p50`. Inside it the legacy variables (`--bg`, `--card`, `--text`, `--muted`, `--stroke`, `--accent`) are mapped onto the new palette, so older components follow the theme. Every page of the site is `p50` now (`/diagnostics` was the last one, 2026-11-18). The class `p50-night` pins the dark values on one island whatever the theme (the 3D HUD). The classic game page no longer uses it: its stage follows the theme (see "Classic game page" and "Classic boards in the light theme" below).
- **Theme switch:** `src/lib/theme.ts`. The choice is stored under `play50games_theme`; a small script in `<head>` applies it before the first paint. "System" stores nothing.
- **Fonts:** Outfit (display), **DM Sans** (body) and **JetBrains Mono** (numbers), loaded with `next/font/google` in `app/layout.tsx`. Geist and Geist Mono are not in the font list of Next 14.2, so the documented fallbacks are used. Swapping to Geist later is a change in `layout.tsx` only (the `--font-body` and `--font-mono` variables).
- **Shared parts:** `src/components/Site/ui.module.css` (buttons, plate, keycap, pips, meter), `form.module.css` (label above, 48px well, helper or error below), `ProgressRing` (the thin ring with the count at its centre), `SitePage` + `PageHead` (the frame of a plain page: header, main column, footer, the heading block, the split layout, prose, facts and notices). `globals.css` styles every `<button>` and `button:hover`, so each new button class sets its own background for both states.
- **Chrome:** `src/components/Site/` (`SiteHeader`, `SearchPalette`, `SiteFooter`, `BoardRows`, `ClassicPath`, `SquadArt`). The world switcher uses real links; the mega panel opens on hover and on keyboard focus. Any page opens the header's sign-in sheet with `openLogin()` (`siteData.ts`), or its register sheet with `openLogin("register")`.
- **Pages done:** `/` (hub), `/3d` (catalogue), `/leaderboards` (needs the leaderboard flag), `/scale-squad` (teaser, needs `NEXT_PUBLIC_SQUAD_TEASER`), `/classic` (the path), `/progress` (the player card), `/faq`, `/contact-us`, `/privacy-policy`, `/terms-and-conditions`, `/verify`, `/certificate`, `/certificate/[id]`, the sign-in sheet (login and register), the game lobby (the start card of `/3d/[slug]`) with the shell's pause, loading and error sheets.
- **Sign-in sheet (§6 item 8):** `src/components/Auth/AuthSheet.tsx` is the frame and the field; `LoginModal` and `RegisterModal` keep their props. Errors show under their field (the forms are `noValidate`), the server's answer above the fields.
- **Classic 50 (§6 item 4):** `src/app/classic/ClassicView.tsx`. Ten nodes to a row on a desktop (a chapter is one row), five on a tablet, one column on a phone (the path runs down the left). The line is drawn by each stop (`::after`): ink once its game is finished, the turn at the end of a row, a line down to the certificate. The category chips fade the other kinds instead of removing them (on a phone they filter). Data and unlock chain are loaded exactly as the old dashboard did.
- **Player card (§6 item 7):** `src/app/progress/PlayerCard.tsx`. No "member since" (the account API has no date). The arcade total counts the levels of the playable games (games x 5), not 500. The leaderboard name switch is `app/3d/ArcadePrivacyToggle` (also on `/3d`).
- **Game lobby (§6 item 3):** the start card of the shell (`src/arcade3d/core/ShellOverlays.tsx`, `GameShell.module.css`). On a wide screen (1040px and up, 620px tall and up) one sheet with two columns: the art (the game's thumbnail), the title, the level tiles and Play on the left; how to play, the controls as keycaps and the top 10 on the right. Phones and short screens keep the one-column card with Play pinned. The overlays follow the theme; the HUD and the countdown sit on the canvas and keep a dark glass look in both themes (the size of a HUD chip must not change: the games' camera fits were measured with it). Inside an overlay `--game-accent` is coral: the chrome never uses a game's own colour.
- **Classic game page (2026-11-18, second version the same day):** `src/app/games/[id]/` (`page.tsx` server, `GameView.tsx` client, `page.module.css`). The page is a page of the site like the hub: `p50`, the site header and footer, a breadcrumb (back to the path, the category chip), and it follows the theme. `SiteHeader` takes `immersive` on a game page: the bar scrolls away instead of sticking (the boards' phone fit scrolls the score bar to the top of the screen) and phones get no tab bar (the game's controls sit at the bottom). The game itself sits on a **stage** (`.stage` in `GameView`), which follows the theme like the rest of the page (light version 2026-11-18, see "Classic boards in the light theme" below); in both themes the stage is the page canvas and does not show as a box. **Colours:** the stage maps the boards' legacy variables onto the palette (`--accent` and `--primary` coral, `--ok` green, `--warn` red, `--text`, `--muted`; `--card` and `--stroke` stay translucent, an opaque surface would hide a card inside a card), so every board that reads them is on the design's colours. The board rules of `globals.css` are on the palette themselves (next bullet); the engine's own CSS modules read `rgba(var(--accent-rgb, 125, 211, 252), a)`. Accent-to-green gradients a board sets inline (progress fills) are one accent on the stage (`[style*="var(--accent) 0%, var(--ok) 100%"]`). The Example Round panel is a quiet raised panel, and gradient text inside a game is plain display type. The five final games take Trophy Gold (`--accent` gold on the stage). `GameEngine.tsx` is unchanged apart from `siteHeader={false}`. **Left as it is:** the tints each board writes inline (blue `59, 130, 246`, teal, mint: about 2,600 places in the TSX). They are often game content (the blue player of Avoid the Red must not turn coral next to red), and `globals.css` recolours the final games by matching those inline strings (`[style*="rgba(125, 211, 252, 0.1)"]`), so they cannot be replaced mechanically: that is a per-game pass. No "game 7 of 50": the API's `game_order` has a gap. **Score bar on narrow phones:** up to 430 px wide the title sits on its own line above the Score / Time / Target chips and the X spans both lines (`GameEngine.module.css`); beside the chips it had about 40 px at 360 px and broke ("One-Han…"). The bar is exactly as tall as before (title line + chips fit in the X's 44 px), so the boards' phone fit is unchanged. In final games the progress fill is one flat gold with no glow.
- **Global styles on the palette (2026-11-18, the user asked for it):** `globals.css` is the legacy sheet and still not the place for new UI, but its base now follows the hub. `:root` legacy variables are the design's dark values (`--bg` #0b0f1a, `--text` #f1f3f8, `--muted` #a3acbf, `--accent` / `--primary` coral #e75f40, `--ok` / `--secondary` green #3fb57f, `--warn` #f0708a, plus `--accent-rgb`; `--card` and `--stroke` stay translucent whites). `body` is the plain canvas in the body face (DM Sans): the three coloured glows are gone, final games get one gold light. In every rule the old colours written as numbers were replaced **in declaration values only**: cyan to coral, mint and green-500 to the system green, salmon and red-500 to the system red, amber to gold; an accent-to-green gradient became one accent. **Never touched:** selectors (the final games are recoloured by `body.final-game ...[style*="rgba(125, 211, 252, 0.1)"]` rules that match inline strings), the final-game rules themselves, colour-named content classes (`.speed-item.blue`) and the memory games' flash cue. The 3D shell's frame names the system face, so the games' own HUD panels keep the font they were laid out with. The **cookie banner** (`components/PrivacyConsent`) is a glass bar of the system with one coral action; its look moved from inline styles to its CSS module, and it stays docked to the bottom edge at full width because the boards and the 3D shell measure it there. `theme.css` adds the selection colour and the scrollbar colours.
- **3D game page (2026-11-18):** `app/3d/[slug]/ArcadeChrome.tsx` lays the site header (`immersive`) over the shell's top edge while no run is on screen (loading, the lobby, the result) and unmounts it for the countdown, the run and the pause, so the canvas never changes size. The shell's sheets start under it through `--site-header-h` (`GameShell.module.css` `--overlay-pad-top`, `.resultWrap`; `ArcadeGameMount.module.css`); no header on a landscape phone (under 520px tall). The **result panel** (`ui/ResultPanel`) is now a sheet of the system: `.resultLayer` maps its legacy variables onto the tokens, the score is in the mono face, a new best is gold, the buttons are the lobby's.
- **3D arcade theme audit (2026-11-18, branch `claude/arcade-theme`):** the catalogue and six games of different kinds (robot-collector, escape-room, tower-climb, clean-city, zoo-escape, mini-golf) were captured in light and dark at 390x844 and 844x390 (touch), 820x1180 and 1440x900: the lobby, the loading and error sheets, the countdown, the HUD, the pause sheet, the result and the cookie banner, with an automatic WCAG check. Fixed: the site header over the lobby and the result is opaque (`ArcadeChrome.module.css` sets `--p50-bar` to the surface: its glass turned grey over the scrim in light); the result's "Level n unlocked!" is Ember Text on the light sheet; the "or" between keycap groups lost its extra 0.8 opacity (3.8:1 in light); the countdown number has a tight ink edge so it reads over a bright scene; the canvas controls (joystick, Jump / Action, the camera button and its labels) and the hint dots use the palette (coral, gold, green, the dark red) instead of the old sky blue, the camera button has a focus ring; no en or em dash in the shell's text (an empty level best is "-", no lives left is "0"). **Dark on purpose in both themes:** the HUD chips and buttons, the countdown, the hint line, the touch controls and the camera button (they sit on the canvas), and the phone drawing in How to play (it pictures the canvas). Left for later: the camera hint starts with a camera emoji (core and about 20 games' own hints use it, a separate sweep); luggage-rush's keyboard text has "1–3" (its `meta.ts`); Chrome on Windows draws the arrow buttons of a thin scrollbar at the corners of the lobby and result sheets.
- **Classic boards in the light theme (2026-11-18):** the stage reads the theme's tokens (`theme.css`: `--p50-accent-rgb`, `--p50-gold-rgb`, `--p50-green-text`, `--p50-ink-rgb`, `--p50-shade-rgb`, `--p50-shade-k`, `--p50-scheme`), so the theme switch flips a running board at once. On the light stage: `--accent` is Ember Coral (#C2452A, deep enough to read on white; the site's small coral text uses Ember Text #B83F26), the final games' gold is Deep Gold (#96660B), `--ok` is #1A7D52 (the documented #1E8A5A is 4.3:1 on white, under AA for small text), `--warn` #C22A47, `--card` / `--stroke` are ink at 6 % / 12 %. The boards write their overlays as `rgba(var(--board-ov, 255, 255, 255), a)` (white in the dark, ink in the light) and their shadows as `rgba(var(--board-shade, 0, 0, 0), calc(a * var(--board-shade-k, 1)))` (black in the dark; ink at 40 % of the alpha in the light: one diffused ink-tinted shadow). A colour that only the light theme changes is a light-only variable with the dark literal as its fallback, so the dark look is exactly as before: `--board-ink`, `--board-ink-2` (light text and greys drawn for the dark), `--board-sunk`, `--board-well` (floors and wells), `--board-glass` (pills over a play area), `--board-navy` (navy shadows), `--board-gold` (the final games' gold text in `globals.css`), `--board-on-fill` (the label on a filled accent / green / red: white on the deeper light fills), `--board-ok-ink` / `--board-bad-ink` / `--board-ok-ring` / `--board-bad-ring` (the mark and ring of a pastel green or red piece), `--board-content-mix` (a pale content colour mixed towards ink for its mark and ring: the sound pads). The list lives in `page.module.css`. Content colours stay the game's (the blue player of Avoid the Red, the colour pads); on white they get a deeper ring or mark from those variables. The six canvas games read the stage through `skillgames-parts/boardTheme.ts` (`boardOv`, `isLightBoard`, `cssVar`, `useThemeChange` repaints a canvas when the theme flips). Cursor Maze's collision reads the pixels of its hidden walls canvas, which is still drawn white on navy; the light theme draws a recoloured copy for display only. `globals.css` changed only in declaration values (overlays, shadows, the final games' `color: #eab308`); no selector changed, so the inline-string rules of the final games still match.
- **Lobby top 10 and "More like this" (2026-11-18):** the lobby's top 10 is the site's board (`components/Site/BoardList`, the display half of `BoardRows`, which the hub and `/leaderboards` still load through): shields for ranks 1 to 3, `#04` numerals below, mono scores, the player's row in Coral Wash, and when the player is outside the ten their row sits under the list. Loading is a skeleton of rows, an empty board draws a faint outline of three rows with one sentence (no second Play: the lobby's Play is pinned on screen), an error has a quiet "Try again". The rows are 48px in the sheet (`dense`). "More like this" (`arcade3d/ui/MoreLikeThis`, picked by `arcade3d/related.ts`) is the last block of the sheet: four other **live** games as the catalogue's own tiles (`ArcadeCardLive`), chosen by shared section, control scheme, time trial or points, orientation and difficulty; a "soon" or "dev" game is never offered. On the wide lobby it lies under both columns as one row of four; on a narrow sheet it is a rail that scrolls inside itself with the next tile showing partly. The **result panel** still draws its top 10 with the old table (`ui/LeaderboardTable`).
- **Mock boards (dev previews):** with `NEXT_PUBLIC_ARCADE_API_MOCK` on, `?mockBoard=empty | outside | listed | error` in the page address picks what the mock leaderboard answers (`lib/api/arcade.ts`), to look at a board's states without WordPress.
- **Not done yet:** the result panel's top 10 is still the old table (`arcade3d/ui/LeaderboardTable`; the lobby's is the site's board, above).
- **Left over from the old look:** pruned on 2026-11-19 (branch `claude/globals-cleanup`, see the next bullet). `components/Footer`, `components/Nav/SectionTabs` and `components/Header/HeaderWithAuth` were removed on 2026-11-18; `components/Header/Header` stays (GameEngine imports it).
- **globals.css pruned (2026-11-19, branch `claude/globals-cleanup`):** 5,947 to 2,308 lines. 479 rules were removed whole, in two commits: the old page styles (203 rules: home, nav, footer, game cards and category filter, progress, certificate, login, QR, back links, error and retry, modal, form, verify, PDF viewer, FAQ, contact, info card) and the classic board classes the modern pass stopped using (276 rules: tile slider, sudoku, circuit path, pattern completion, the rotate to fit and mirror match parts, shape/memory/speed items, hints, share bar, success notification), plus 9 keyframes only those rules used. **The test for a class:** no TS/TSX/JS/MDX/HTML/JSON/CSS module in `src`, `tools` or `public` (nor the CMS FAQ and game JSON) has it as a whole token, and no className, `class=`, `classList` or `clsx`/`cn` call builds it from a prefix (`faq-${id}` in FaqList is an `aria-controls` id, not a class). A rule went only when every selector in it needs such a class; no selector that stays was edited. **Kept on purpose:** every `.maze-*` and `.number-keypad` rule (even `.maze-escape-game .game-feedback`), the base element rules (`button`, `button:hover`, inputs), every `[style*=...]` and `body.final-game` rule whose element still renders, and classes that are also common words in the code (`title`, `success`, `error`, `green`, `red`, `selected`...): the token test keeps those. **Final-game greens narrowed:** `body.final-game div/button[style*="rgba(134, 239, 172"]` gilded anything with that green on a final page. The only board a final page renders that writes it is Reaction Test (Final Test, id 58; GameEngine's 25 copies sit in Example Round demos of non-final games), so the rules now match its exact inline strings as Chrome serializes them: `border: 3px solid rgba(134, 239, 172, 0.8)` (lights, targets, shape options), `linear-gradient(90deg, var(--ok), rgba(134, 239, 172, 0.8))` (timing fill), `box-shadow: rgba(134, 239, 172, 0.4) 0px 0px 0px 4px inset` (master pad; Chrome puts the colour first) and the button `background: rgba(134, 239, 172, 0.2)` (next memory cell). The `display: inline-flex` variant matched nothing on any final page and is gone. A new inline green on a final board needs its own rule here (or, better, its gold in the board's CSS module).
- **Theme audit (2026-11-18, branch `claude/site-theme-audit`):** every page, the header (mega panel, search, account menu, theme menu), the sign-in and register sheets, the footer, the cookie banner and a 3D result panel were captured at 390x844, 820x1180 and 1440x900 in light and dark, with an automatic WCAG check of every text against its background. Fixed: the AA misses above (Dim on raised surfaces, coral text on Coral Wash: token values in `theme.css`), the light theme's art hairline on the hero's inline art, the search thumbnails, the leaderboards rail and the hub's best-score thumbnails (an inside `outline`, so no size changes), the result panel's white scrollbar thumb, and the result panel's two coral buttons for a guest (Log in is quiet now; Retry or Next level is the one primary). **`/diagnostics`** is redesigned: `SitePage` + `PageHead`, the checks as hairline rows with line icons and status badges (no emoji), a quiet Run again, skeleton rows; its requests are unchanged (GET only, plus the old OPTIONS fallback when a GET shows no CORS header). Known and left: input wells in light use a #D9DFEA hairline on #E8ECF3 (the field reads by its fill against the white card, as §4 specifies); several new arcade games have no thumbnail yet (an empty art tile).
- **Contact form:** sends to `POST play50/v1/contact` (`lib/api/contact.ts`, backend `includes/contact-api.php`: mail to the admin, each message also kept in wp-admin "Contact messages"). Field errors under the fields, a notice with Try again for server errors, a calm notice for the rate limit, a hidden honeypot. **Known gap:** until the user uploads `includes/contact-api.php` + `functions.php`, the server answers 404 and the form shows "We could not send your message. Please try again."
- **Scale Squad art:** the group picture of the five heroes, `public/images/worlds/scale-squad.webp` (made by the user, approved 2026-11-17), set through `SQUAD_PICTURE` in `components/Site/siteData.ts`. With `null` the world shows five rolled-up balls in the hero colours, drawn in CSS. How the picture was made: `docs/design/scale-squad-picture.md`.
- **Flags:** with `NEXT_PUBLIC_SQUAD_TEASER` off (the default) the site shows two worlds. With the arcade flag off it shows Classic 50 and the arcade as "soon".
