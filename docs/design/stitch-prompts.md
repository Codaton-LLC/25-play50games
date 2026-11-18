# Stitch prompts: Play50Games screens

How to use:

1. Open Google Stitch (stitch.withgoogle.com) and start a new **Web** project (a **Mobile** project for the phone prompts).
2. Paste the whole of `DESIGN.md` first, with the line: "Use this design system for every screen in this project."
3. Paste one prompt below per screen. Generate the dark theme first.
4. For the light version, follow up with: "Now the same screen in the light theme 'Day Deck' from the design system. Same layout, same type, same accent."

Every prompt ends with the same guard line. Keep it.

---

## 1. Hub, desktop (1440px)

```
Design the home page of Play50Games, a free browser game platform, in the dark theme "Night Deck".

Top bar (72px, sticky): shield logo mark and the wordmark "Play50Games"; a pill world switcher with three segments "Classic 50", "3D Arcade", "Scale Squad" (3D Arcade active on a Coral Wash thumb); on the right a field-shaped search button "Find a game" with a "Ctrl K" keycap, the text link "Leaderboards", a theme icon button and a quiet "Log in" button.

Hero, split 5fr / 7fr, as tall as its content:
- Left: label eyebrow "FREE IN YOUR BROWSER". Headline in Outfit 700: "Fifty brain games, [small rounded game screenshot] a 3D arcade [small rounded game screenshot] and the Scale Squad." The two screenshots sit inline at letter height. One sentence: "Three collections, one player card. Nothing to download." One coral primary button with a play triangle: "Play now".
- Right: the featured stage, a very round 16:10 game screenshot of "Robot Collector" (top-down warehouse, small white robot, orange crates). Under the art, a solid Deck info strip: game title, tagline "Grab 10 batteries before the clock runs out.", a five-pip level meter with 2 pips filled, best score "Best 1,412" in mono. Above the strip, four thin story-style progress segments, the first one filling.

Section "Jump back in": a horizontal rail of four game tiles (Office Escape, Tower Climb, Pigeon Crossing, Penalty Hero), art on top, title, pips and best score below. The fifth tile is cut off at the right edge.

Section "Three worlds": three tall art panels in one row, accordion style. The middle panel "3D Arcade" is expanded (3fr): plate glyph "3D", title, the sentence "Fifty 3D mini-games, five levels each. Every game keeps its own leaderboard.", counts in mono "30 games, 150 levels", quiet button "Enter 3D Arcade". The left panel "Classic 50" and the right panel "Scale Squad" are narrow (1fr) and show only their plate glyph ("50", "5") and the name set vertically.

Section "New in the arcade": bento grid, one large tile spanning two columns and two rows (Castle Defender, badge "New") and four small tiles (Treasure Island, Delivery Drone, Mini Golf 3D, Penguin Ice Slide).

Section "Top of the boards", split 7fr / 5fr: left a leaderboard table without cards, hairline rows: gold shield "1", player "Arta K.", game "Robot Collector", score "1,412"; then "Dion B." Office Escape "148,220"; "Lea M." Tiny Escape Room "00:19.84"; "Besnik H." Tower Climb "17,930"; "Yll R." Penalty Hero "1,390". Right: a quiet block "Your best scores" with the sentence "Log in to keep your scores on every device." and a quiet "Log in" button.

A slim three-step line separated by hairlines: "Pick a world", "Play at your pace", "Save your scores", one short sentence each.

Footer with four unequal columns: logo and one line, Play, Account, Help.

No emojis, no gradients, no glow, no centred hero, no three equal cards. All numbers in Geist Mono.
```

## 2. Hub, phone (390px)

```
Design the phone home screen of Play50Games in the dark theme "Night Deck", 390px wide.

Top bar (56px): shield mark and "Play50", a search icon button, a quiet "Log in".

Hero in one column: eyebrow "FREE IN YOUR BROWSER", headline "Fifty brain games, a 3D arcade and the Scale Squad." in Outfit 700, a row of two small rounded game screenshots under the headline, one sentence, one full-width coral button "Play now". Then the featured stage: a 16:10 screenshot of Robot Collector with its solid info strip (title, tagline, five-pip meter, "Best 1,412").

"Jump back in": a rail of game tiles that scrolls sideways inside its own row, the third tile half visible.

"Three worlds": three full-width 16:10 art panels stacked: Classic 50 ("50 games, 1 certificate"), 3D Arcade ("30 games, 150 levels"), Scale Squad ("Opens soon"). Each with plate glyph, title, one line and a chevron.

"Top of the boards": five hairline rows, shield or numeral, player, game, score in mono.

Bottom tab bar (64px plus safe area): Home (active, coral icon and label with a short coral pill above), Classic, Arcade, Squad, Ranks.

No emojis, no gradients, no glow, no horizontal page scroll. All numbers in Geist Mono. Tap areas at least 44px.
```

## 3. Mega panel open, desktop

```
Design the Play50Games top bar with the "3D Arcade" mega panel open, dark theme "Night Deck", over a dimmed home page.

The panel is a very round (28px) floating Deck surface as wide as the page container, 8px under the bar. Three unequal zones (5fr / 3fr / 4fr):
- Zone A: plate glyph "3D", world title "3D Arcade", the sentence "Fifty 3D mini-games, five levels each. Every game keeps its own leaderboard.", progress in mono "34 of 250 levels cleared" with a thin coral progress bar, one coral primary button "Enter 3D Arcade".
- Zone B: label "BROWSE", then a plain link list: All games, New this month, Originals, Adventure, Skill, Time trials, Leaderboards. The hovered row has a Coral Wash fill.
- Zone C: label "FEATURED", one large 16:9 tile (Castle Defender) and two small tiles under it (Tower Climb, Office Escape), each with title and five-pip meter.

Also show, as a second frame, the "Classic 50" panel: Zone A with a progress ring "07 / 50" and the button "Continue game 8"; Zone B links: All 50 games, My progress, Certificate, Verify a certificate; Zone C three thumbnails of classic 2D games.

No emojis, no gradients, no glow. All numbers in Geist Mono.
```

## 4. Search palette and account menu, desktop

```
Design two overlay states of Play50Games in the dark theme "Night Deck".

Frame 1, search palette: a centred very round (28px) panel, 640px wide, over a dimmed and blurred page. Large input with a search icon and the typed text "rob". Results as rows with a 56px thumbnail, game title, world label and best score in mono: "Robot Collector, 3D Arcade, Best 1,412" (highlighted with Coral Wash), "Robot Factory Sorter, 3D Arcade, No score yet". Footer line with keycaps: "Enter" open, arrow keys move, "Esc" close.

Frame 2, account menu: a 320px dropdown under an avatar chip with the initials "DP". Header: avatar, "Dren P.", the line "Scores show as First L." Links: Player card, Classic progress, Certificate, Leaderboard name and privacy. Divider. A three-part segmented control: System, Light, Dark (Dark selected). Divider. Help, Contact, Log out in Signal Red.

No emojis, no gradients, no glow. All numbers in Geist Mono.
```

## 5. 3D Arcade catalogue, desktop

```
Design the 3D Arcade catalogue page of Play50Games in the dark theme "Night Deck".

Top bar as in the design system, "3D Arcade" active in the world switcher.

Title band, left aligned: plate glyph "3D", world title "3D Arcade", counts in mono "30 games, 150 levels, 12 live", one sentence "Pick any game. No unlock chain."

Filter row: chips All (selected, Coral Wash), Originals, Adventure, Skill, Time trials; on the right a sort menu "Newest".

Section "Originals": a four-column gallery where the art is the card. The first tile spans two columns and two rows (Robot Collector, badge "Live"). Other tiles: Office Escape, Pigeon Crossing, Tower Climb, Penalty Hero, Warehouse Rush, Clean the City, Tiny Escape Room (badge "Time trial"), Food Catcher 3D, Obstacle Race (badge "Time trial"). Under each art: title, five-pip meter (different fill counts, one fully gold), tagline, "Best 1,412" in mono or "No score yet" in Dim.

Section "Adventure": Treasure Island, Museum Guard, Delivery Drone, Dino Egg Rescue, two of them with the "Soon" badge and desaturated art.

No emojis, no gradients, no glow, no boxes around the titles. All numbers in Geist Mono.
```

## 6. Game lobby, desktop

```
Design the lobby page of the game "Robot Collector" on Play50Games in the dark theme "Night Deck". This is the page before the game starts.

Split 7fr / 5fr.
Left: a very round 16:9 art stage (top-down warehouse, white robot, orange crates) with one coral primary button "Play" and a quiet "How to play". Under the stage, five level tiles in a row: "1 Warehouse", "2 Night shift", "3 Conveyor maze", "4 Power cut", "5 Overtime". Tiles 1 and 2 are cleared (best scores "1,412" and "1,180" in mono), tile 3 is current (coral outline), tiles 4 and 5 are locked (dim, small lock). Above the tiles: the five-pip meter with 2 pips filled and "Total 2,592" in mono.
Right: heading "Leaderboard". Hairline rows: gold shield 1 "Arta K." "6,870"; shield 2 "Dion B." "6,412"; shield 3 "Lea M." "6,105"; "#04 Besnik H. 5,930"; "#05 Yll R. 5,744". A pinned row with Coral Wash fill: "#27 You 2,592". Then heading "Controls" with keycaps: W A S D move, Space jump, E grab; and touch glyphs: joystick, tap. Then two sentences of description.

Under both columns: "More like this", a rail of four tiles.

No emojis, no gradients, no glow. All numbers in Geist Mono.
```

## 7. Classic 50, desktop

```
Design the Classic 50 world page of Play50Games in the dark theme "Night Deck".

Header, split: left the plate glyph "50", world title "Classic 50", the sentence "Fifty brain games. Each one unlocks the next. Finish all fifty to earn your certificate." and one coral primary button "Continue game 8". Right: a thin progress ring with "07 / 50" in mono at its centre.

The path: fifty numbered round nodes in five chapters of ten. Each chapter is one row with a label ("CHAPTER 1" to "CHAPTER 5") and a thin line that connects the nodes and turns at the end of each row. Nodes 1 to 7 are done (filled, small check). Node 8 is current: larger, with a coral ring, and a small card beside it with the game name "Memory Grid" and "Play". Nodes 9 to 50 are locked: dim with a small lock.

At the end of the path: the certificate block in Trophy Gold outline: "Your certificate waits here. 43 games to go."

No emojis, no gradients, no glow. All numbers in Geist Mono.
```

## 8. Scale Squad world, desktop

```
Design the Scale Squad world page of Play50Games in the dark theme "Night Deck".

World hero, split 5fr / 7fr: left the plate glyph "5", a "Soon" badge, the world title "Scale Squad", the sentence "Five pangolin heroes who roll into a ball. Each one has its own colour and its own power." and one quiet button "Play the 3D Arcade meanwhile". Right: a very round 16:10 group picture of the five heroes together: five friendly pangolins in red, blue, green, yellow and violet, two of them rolled into a ball. Never a T-pose line-up.

Section "The five": five hairline rows without cards. Each row: a ring in the hero colour, the name in Outfit 600, and a pill with the power. Riko, red, Dash. Nami, blue, Double Jump. Kiro, green, Shield. Zuno, yellow, Coin Magnet. Vexa, violet, Phase.

The hero colours appear only on the rings and in the picture. Buttons and navigation stay coral and neutral. No emojis, no gradients, no glow. All numbers in Geist Mono.
```

## 9. Leaderboards, desktop

```
Design the Leaderboards page of Play50Games in the dark theme "Night Deck".

Split 4fr / 8fr.
Left: heading "Leaderboards", a search input "Find a game", then a list of games with a 48px thumbnail, title and the leader's score in mono. "Robot Collector" is selected with a Coral Wash fill.
Right: the game title "Robot Collector" with a quiet "Play" button. A podium of three columns with unequal heights, second place left, first place in the middle and tallest, third place right: shield rank, player name, score in mono. First place has a Trophy Gold shield. Under the podium, a table without cards, hairline rows: "#04 Besnik H. 5,930 03:41", "#05 Yll R. 5,744 03:52", "#06 Marta S. 5,610 04:05", "#07 Noel V. 5,480 03:58", "#08 Erza D. 5,301 04:11". A pinned row with Coral Wash fill at the bottom: "#27 You 2,592".

Also show the empty state as a second frame: a faint outlined five-row table, the sentence "No scores yet. Play one round to take first place." and a coral "Play" button.

No emojis, no gradients, no glow. All numbers in Geist Mono.
```

## 10. Player card, desktop

```
Design the Player card page of Play50Games (the signed-in profile) in the dark theme "Night Deck".

Split 5fr / 7fr.
Left: identity block: avatar with the initials "DP", public name "Dren P.", "Member since March 2026", the line "Scores show as First L." with a switch "Show my name on leaderboards" (on). Under it, totals in the largest mono size: "34 / 250" levels cleared, "07 / 50" classic games, "112" rounds played.
Right: three world meters, one per row, separated by hairlines: "Classic 50" with a thin progress bar and "07 / 50"; "3D Arcade" with "34 / 250 levels"; "Scale Squad" with "Opens soon" in Dim. Then heading "Recent best scores" and a table: thumbnail, game, level, score in mono, date: Robot Collector, Level 2, 1,180; Tower Climb, Level 1, 9,420; Tiny Escape Room, Level 1, 00:24.10. Then the certificate block: Trophy Gold outline, "Certificate: 43 games to go", quiet button "See the path".

No emojis, no gradients, no glow. All numbers in Geist Mono.
```

## 11. Sign in sheet

```
Design the sign-in sheet of Play50Games in the dark theme "Night Deck": a centred very round (28px) Deck panel, 440px wide, over a dimmed page.

Shield logo mark, heading "Log in", one sentence "Keep your scores and progress on every device." Two fields with the label above each: "Email" and "Password" (48px tall, well fill, hairline border). The password field shows an error state: Signal Red border and the text "That password does not match. Try again." below it. One full-width coral primary button "Log in". Under it the text link "No account yet? Sign up".

No emojis, no gradients, no glow, no floating labels, no social login buttons.
```

## 12. Result panel, phone

```
Design the result panel shown after a round of "Robot Collector" on Play50Games, phone width 390px, dark theme "Night Deck". The panel is a very round sheet over a dimmed game scene.

Label "LEVEL 2 CLEARED". The score "1,180" in the largest mono size. A Trophy Gold line "New best". The five-pip meter with 2 pips filled. Two mono facts in a row: "Rank #27" and "Time 00:48.20". One full-width coral primary button "Next level". Two quiet buttons side by side: "Retry" and "Exit". Under them, for guests: "Log in to put this score on the leaderboard." with the text link "Log in".

No emojis, no gradients, no glow, no confetti. All numbers in Geist Mono.
```

## 13. States sheet

```
Design one reference sheet of Play50Games component states in the dark theme "Night Deck", in three columns of unequal width.

Column 1, loading: skeletons in the exact shape of a game tile (16:9 block, two text lines, five small bars) and of five leaderboard rows, with a soft shimmer. No spinners.
Column 2, empty: an outlined empty leaderboard with "No scores yet. Play one round to take first place." and a coral "Play" button; an outlined empty rail with "Nothing played yet. Your recent games will show here."
Column 3, error: an inline notice in a row: Signal Red icon, "Could not load the leaderboard. Check your connection and try again.", quiet button "Try again"; a toast "Score saved" with a Go Green dot.

No emojis, no gradients, no glow.
```
