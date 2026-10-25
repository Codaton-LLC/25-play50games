# IP-risk review: the 50 classic 2D games (2026-10-25)

## What this is, and what it is not

This is a read-only check of the 50 classic 2D games at `/classic` for resemblance to known games, brands and characters (trademark and copyright). It was written by an AI agent to prepare one consultation with an IP lawyer (Fachanwalt für Urheber- und Medienrecht / IT-Recht).

**This is not legal advice.** The ratings below only say how much a title, look, asset or text *resembles* something protected, and how cheap a fix would be. The lawyer decides what is actually a risk under German/EU law and what has to change.

**What was checked (branch `claude/ip-review-classic`, at main `9390d21`):**

- The list of the 50 games: titles and descriptions in `play50games-backend/play50games/wt-cpt/games.php` (the wp-admin templates used to create the games; the live titles come from the WordPress database through `getAllGames()`, see question 9).
- All game code: `play50games-frontend/src/components/GameEngine/GameEngine.tsx` (14k lines), `game-types/*Games.tsx`, every `*-parts/<Game>.tsx` (logic, memory, speed, skill, final + the four final mini-games).
- The card previews `src/components/GamePreview/GamePreview.tsx`, the instructions `src/lib/utils/gameInstructions.ts`, the `/classic` page and layout, `GAME_REQUIREMENTS.md`, the old prototypes in `html-css-js-games/`.
- Every image, sound and font file under `play50games-frontend/public/` that the classic part uses (the logo, cover and OG images were viewed).
- Searches over all of the above for: Tetris, Pac-Man, Flappy Bird, Candy Crush, Angry Birds, Mario, Sonic, 2048, Wordle, Minecraft, Pokémon, Fruit Ninja, Temple Run, Subway Surfers, Among Us, Simon, Whac-A-Mole, Mastermind, Rubik, Stack, Color Switch, Nintendo, Sega, Xbox, PlayStation, Disney, LEGO and similar, plus every capitalised string literal in the game code (read by hand), plus licence/credit/copyright files.

Not checked: the 3D arcade (`/3d`, Hyper3D models) except where the lawyer questions below touch it; the live database content; the certificate PDF; trademark registers (DPMA, EUIPO/TMview, WIPO) - those searches are for the lawyer or a register search.

## Summary of findings

- **The classic games are visually very plain and self-made.** Every game is drawn in code: CSS boxes, inline SVG, `<canvas>` rectangles and circles, Heroicons (MIT licence) and the device's own emoji font. **No classic game ships an image, sprite, sound file or font file.** Sounds (Sound Memory, countdown beeps) are sine tones generated with the Web Audio API. Fonts are system fonts (`system-ui`, Segoe UI, Roboto, Arial, monospace).
- **No character, mascot or sprite** from a known game appears. No known game's name appears as a game title.
- Most games use **generic mechanics** that nobody owns (memory pairs, sliding 15-puzzle, 4x4 sudoku, mazes, reaction tests, typing tests, whack-a-target, catching falling items, stacking, timing bars, polyomino tiling). Mechanics alone are not protected by copyright; the risk comes from names, look and copied assets, and those are clean here.
- One **brand-like name in in-game text**: the final game (#50) calls one of its mini-games "Color Switch", which is also the name of a well-known mobile game. Easy to rename.
- A few **names worth a quick look by the lawyer** but rated low: "Whack-a-Shape" (echo of the Whac-A-Mole trademark), "Sudoku" (was a Nikoli trademark in Japan), programming-language and product names in the Typing Sprint word lists (JavaScript, Java, Python, Swift, Unity, React...).
- The **site logo** (not a game) was very likely AI-generated and has no recorded source; its game controller resembles a modern console controller in general shape. Listed under "assets with unclear origin".

**Count: 49 low, 1 medium, 0 high.**

## Table: the 50 games

Risk = resemblance risk as flagged by this review (low / medium / high), for the lawyer to judge.

| # | Title | What it is | Risk | Why | Suggested fix |
|---|---|---|---|---|---|
| 1 | Match the Shapes | Pick the option that matches a target icon (Heroicons) | low | Generic matching; MIT icons | none |
| 2 | Color Sequence | Repeat a growing sequence of coloured buttons | low | Generic "repeat the sequence" mechanic; plain rounded boxes, no tones, not the 4-quadrant round Simon device | none |
| 3 | Number Order | Sort numbers smallest to largest | low | Generic | none |
| 4 | Find the Odd One | Spot the icon that differs | low | Generic | none |
| 5 | Tile Slider Puzzle | Sliding tile (15-)puzzle | low | 19th-century public-domain puzzle; plain numbered tiles | none |
| 6 | Balance the Scale | Decide which side of a scale is heavier | low | Generic | none |
| 7 | Circuit Path | Connect nodes to complete a circuit | low | Generic | none |
| 8 | Maze Escape | Move from start to exit in a grid maze | low | Generic | none |
| 9 | Pattern Completion | Find the missing element of a pattern | low | Generic IQ-test format | none |
| 10 | Sudoku 4x4 | 4x4 number sudoku | low | Mechanic is free; the word "Sudoku" is generic in the EU but was trademarked by Nikoli in Japan (question 4) | none, unless the lawyer advises "Number Grid 4x4" |
| 11 | Rotate to Fit | Rotate objects to their target orientation | low | Generic | none |
| 12 | Mirror Match | Pick the correct mirror image | low | Generic | none |
| 13 | Logic Gates | Work out AND/OR gate outputs | low | Generic (school electronics) | none |
| 14 | Sequence Arrows | Predict the next arrow in a sequence | low | Generic | none |
| 15 | Block Fill | Fill a grid with polyomino pieces (drag, rotate) | low | Pentomino tiling puzzle (public domain, older than Tetris); no falling pieces, no line clearing, no Tetris name or colour scheme; pieces named "L 4", "T 4", "Long 4", "Plus 5"... | none |
| 16 | Card Flip Memory | Classic pairs memory (Concentration) | low | Generic; SVG card backs drawn in code | none |
| 17 | Sound Memory | Repeat a sequence of 4 numbered tone pads | low | Generic; tones 220/330/440/550 Hz generated in code (not Simon's tones), square numbered pads in the site's palette | none |
| 18 | Emoji Memory | Remember emoji positions and click them in order | low | Emoji drawn by the visitor's system font, none shipped | none |
| 19 | Number Recall | Remember and type a number sequence | low | Generic digit-span test | none |
| 20 | Image Recall | Remember the order of flashed pictures (emoji) | low | Generic | none |
| 21 | Path Memory | Recreate a path that lit up on a grid | low | Generic | none |
| 22 | Word Memory | Click words in the order they flashed | low | Generic; common words only | none |
| 23 | Face Memory | Match emoji faces to first names | low | Emoji faces + generic first names (Alex, Sam, Emma...), no real persons | none |
| 24 | Color Grid Memory | Memorise and reproduce colours on a grid | low | Generic | none |
| 25 | Symbol Stack | Rebuild a stack of symbols bottom to top | low | Generic | none |
| 26 | Click the Green | Click only green items, avoid red | low | Generic reaction game | none |
| 27 | Avoid the Red | Dodge red obstacles for a set time | low | Generic | none |
| 28 | Reaction Test | 10 reaction mini-tests (colour flash, moving target...) | low | Generic reaction-time tests | none |
| 29 | Fast Math | Solve arithmetic quickly over 20 levels | low | Generic | none |
| 30 | Whack-a-Shape | Click the correct shape as it pops up | low | Generic mechanic; the name echoes "Whac-A-Mole" (a registered toy/arcade trademark), but different spelling, different noun, and "whack-a-mole" is also an everyday idiom (question 4) | none, or rename to "Shape Hunt" if the lawyer prefers |
| 31 | Typing Sprint | Typing speed and accuracy, 15 levels | low | Generic; word lists contain product/programming names (JavaScript, TypeScript, React, NodeJS, Python, Java, CSharp, Kotlin, Swift, Unity, GoLang) and the word "Supercalifragilisticexpialidocious"; sentences are proverbs, tongue-twisters and the public-domain pangram (question 4) | optional: drop the product names from the word list |
| 32 | Quick Compare | Pick the bigger number, 15 levels | low | Generic | none |
| 33 | Falling Objects | Catch good falling items, avoid bad ones | low | Generic catch game; emoji items; no slicing, not Fruit Ninja's look | none |
| 34 | Tap Counter | Tap as fast as possible | low | Generic | none |
| 35 | Reflex Arrow | Press the shown arrow direction quickly | low | Generic | none |
| 36 | Ball Balance | Tilt a platform to keep a ball centred | low | Generic; drawn in code | none |
| 37 | Target Aim | Click targets, moving and shrinking | low | Generic aim trainer | none |
| 38 | Line Tracer | Trace a path accurately | low | Generic | none |
| 39 | Timing Bar | Stop a moving bar in the green zone | low | Generic | none |
| 40 | Stack Blocks | Drop a moving block onto a stack, aligned | low | Generic stacking mechanic (also used by Ketchapp's "Stack", which is 3D isometric); here flat 2D canvas rectangles, different name | none |
| 41 | Precision Drop | Move an object and drop it into a target | low | Generic | none |
| 42 | Drag & Drop Sort | Sort emoji items into categories | low | Generic | none |
| 43 | Speed Drawing | Draw given shapes quickly and accurately | low | Generic | none |
| 44 | One-Hand Mode | One-button runner: jump over obstacles | low | Generic endless-runner mechanic; the player is a plain blue square with a glow, obstacles are rectangles: no dinosaur, no cactus, no Chrome "T-Rex" look | none |
| 45 | Cursor Maze | Move the cursor through a maze without touching walls | low | Generic | none |
| 46 | Mixed Quiz | Random mix of logic, memory and reaction tasks | low | Generic | none |
| 47 | Survival Mode | Several mini-games in a row without failing | low | Generic | none |
| 48 | Boss Puzzle | One harder puzzle combining mechanics | low | Generic | none |
| 49 | Time Challenge | Mini-game sequence against the clock | low | Generic | none |
| 50 | Final Game | 4 mini-games: Code Breaker, Flash Sequence, Color Switch, Precision Tap | **medium** | The speed mini-game is labelled **"Color Switch"**, the name of a well-known mobile game (Fortafy Games). The mechanic is different (tap the "opposite" colour of an emoji circle), but the name appears in in-game text | rename the label, e.g. "Opposite Colors" or "Color Flip" (text-only change, see detail) |

## Detail for medium / high

### #50 Final Game: mini-game label "Color Switch" (medium)

- **Where the name appears (in-game text):**
  - `play50games-frontend/src/components/GameEngine/GameEngine.tsx:8930`: the Final Game start instructions: "You'll face 4 unique mini-games: Code Breaker (Logic), Flash Sequence (Memory), Color Switch (Speed), and Precision Tap (Skill)".
  - `play50games-backend/play50games/wt-cpt/games.php:808`: the game description template (the same sentence ends up in the WordPress database and is shown on the game page).
- **What the mini-game is:** `play50games-frontend/src/components/GameEngine/game-types/final-game-parts/mini-games/FinalSpeedGame.tsx`: an emoji circle (🔴🔵🟢🟡) is shown and the player must tap its mapped "opposite" colour within a time limit. It does not copy the "Color Switch" game (a ball passing through rotating coloured rings), its look or its assets.
- **Why it is flagged:** "Color Switch" is the title (and, as far as this review knows, a registered mark in some markets) of a popular mobile game in the same field (casual games). Using the identical name for a game element in a commercial game site is the kind of thing a trademark holder notices, even though "colour switch" is also descriptive.
- **Suggested fix:** rename the label in both places to "Opposite Colors" (or "Color Flip"), and update the live WordPress description. This is a text change; per the project rules the classic games are not changed without the user's decision, so this is a recommendation only.
- **Other names in the same sentence:** "Code Breaker" (here: sort four numbers by a rule, not Mastermind) and "Flash Sequence", "Precision Tap" are descriptive and rated low.

## Assets with unclear origin

The classic games themselves use **no asset files**. The only files under `play50games-frontend/public/` that the classic part shows are site-wide branding images:

| File | What it is | Origin known? | Note |
|---|---|---|---|
| `public/images/logo/play50games.png`, `logo-play50games-full.png`, `logo-play50games-black.png`, `logo-play50games-white.png`, `favicon.png` | The Play50Games logo: game controller over a blue shield, "PLAY 50 GAMES" lettering | **No.** Added in commit `08bcbc4` (2026-01-08, "header fixes"); no source, licence or credit file. The glossy style suggests an AI image generator | Ask the user which tool made it and under which terms. The controller is a generic modern gamepad shape with coloured face buttons, similar in general to console controllers (Xbox/PlayStation); not a copy of a specific logo, but the lawyer may want a cleaner, clearly original icon before registering a mark (question 8) |
| `public/images/play50games-cover.jpg` | Cover/OG image with the same logo | **No.** Commit `4e57f48` (2026-01-08, "SEO completed") | Same as the logo |
| `public/images/og/classic.png`, `og/hub.png` | Open Graph cards (text "Play Classic 50 Games") | Yes: made by the project's own `tools/og` script (commit `8124c61`) | Original; uses the logo text only |

Libraries that draw things in the classic games: `@heroicons/react` (MIT licence, Tailwind Labs) for all icons; `react-icons` is a dependency but is not used in the classic code. Emoji are rendered by the visitor's own system emoji font (Apple, Google, Microsoft...), nothing is bundled. No licence/credit/attribution files exist in `public/` or `html-css-js-games/`, and none are needed for the classic games as they stand.

## Questions for the lawyer

1. **Name "Play50Games" / domain play50.games:** Is the name registrable as a word/figurative mark (DPMA, EUIPO) in classes 9, 28, 41, and does "Play" create a conflict with existing "Play..." marks (e.g. Google Play, PlayStation)? Should we register before launching the paid/ad-funded version?
2. **#50 "Color Switch" label:** Is using "Color Switch" as the name of a mini-game element a trademark infringement risk (EU/DE), given it is the title of a known mobile game? Is renaming it (to "Opposite Colors") enough, and does the old text need to be removed from the live database as well?
3. **Generic mechanics:** Can we rely on the principle that game mechanics (memory pairs, sliding puzzle, sudoku, whack-a-target, endless runner, stacking, catching) are not protected, as long as names, artwork and sounds are our own? Is there anything in German law (UWG, "unmittelbare Leistungsübernahme" / slavish imitation) that we should watch for with simple games?
4. **Minor names (all rated low):** Is "Whack-a-Shape" (#30) too close to the "Whac-A-Mole" trademark or fine as a play on a common idiom? Is "Sudoku" (#10) free to use as a game title in the EU/DE (it was a Nikoli trademark in Japan)? Is it fine to show product and language names (JavaScript, Java, Python, Swift, Unity, React...) and "Supercalifragilisticexpialidocious" as typing words in #31?
5. **Menu 2 "Color Roll Heroes" (planned 3D menu):** The hero was redesigned on 2026-10-25 from a "turtle ninja with coloured eye masks" (too close to Teenage Mutant Ninja Turtles) to an original armadillo/pangolin-style hero with a rolling shell, coloured shell plates, helmet and visor, no masks, no ninja weapons, no sewers/pizza/rats/sensei, five colour-coded heroes (Riko red, Nami blue, Kiro green, Zuno yellow, Vexa purple). (a) Is the redesigned concept far enough from TMNT and from other armadillo/rolling characters (e.g. Sonic's spin-dash ball, or any existing armadillo game hero)? (b) Is "Color Roll Heroes" registrable and free (DPMA, EUIPO/TMview check), and does the five-coloured-heroes-in-one-family idea itself create any risk (Power Rangers-style colour teams)? (c) Should the old "Color Shell Ninjas" name and turtle spec be removed from the public repository/marketing?
6. **Hyper3D (Rodin) generated 3D models:** The 3D arcade uses models generated with Hyper3D Rodin (text-to-3D and image-to-3D, via the account's MCP login). Do the Hyper3D terms for the user's plan grant commercial use and ownership/exclusive rights of the output? Are AI-generated models protectable by copyright at all in DE/EU (and if not, can competitors copy them freely)? What must we keep as proof (plan, terms version, generation dates)?
7. **AI concept images with the user's own face:** Several 3D characters (runner, chef, striker, keeper, the clean-city cleaner) were made image-to-3D from ChatGPT concept images that show the user's face (stylised: glasses, beard). The concept images are not published; the 3D characters are. (a) Any personality-rights or data-protection issue in using one's own likeness commercially (and for later "young version without a beard" characters)? (b) Do the OpenAI terms allow commercial use of these images and of 3D models derived from them? (c) If a co-founder/investor or buyer takes over the site later, how should the user's consent to the use of their likeness be documented?
8. **Logo and liability for unverified sources:** The logo and cover image (2026-01-08) have no recorded origin and were likely AI-generated. What should we document now (tool, prompt, terms), and is an AI-made logo a sound basis for a trademark application, or should we commission a designer and register that?
9. **Live content check:** The titles/descriptions shown on the site come from the WordPress database, which this review could not read. Is it enough that the user confirms the live texts match the templates reviewed here, or should the lawyer review the live site directly?

## How this review was done (for reproducibility)

- Game list: `play50games-backend/play50games/wt-cpt/games.php` lines 38-90 (titles 1-50) and 259-812 (descriptions).
- Brand search: case-insensitive grep over `play50games-frontend/src/components/GameEngine`, `src/components/GamePreview`, `src/app/classic`, `src/lib/utils/gameInstructions.ts` and `GAME_REQUIREMENTS.md` for the names listed at the top; zero hits apart from those reported.
- Asset search: grep for image/audio/font/model file extensions in the classic code (zero hits), `new Audio` / `AudioContext` (only generated oscillator tones in `memorygames-parts/SoundMemory.tsx`), `fontFamily` (only `monospace`), and a file listing of `public/`.
- Visual check: drawing code of the canvas games (`OneHandMode`, `StackBlocks`, `PrecisionDrop`), the piece set of `BlockFill`, the pad design of `SoundMemory` and `ColorSequence`, the face/name pool of `FaceMemory`, the word and sentence lists of `TypingSprint`, and the logo/cover/OG images under `public/images/`.
