# Scale Squad group picture

The art of the third world (hub panel, mega panel, `/scale-squad`). The user makes it in ChatGPT from the five hero concepts and hands it to Claude, who adds it to the app.

Why a new image: the concepts are five separate T-pose figures. Cutting them out and stacking them looks like a collage (the user rejected that on 2026-11-17). The squad has to be drawn together in one picture.

## What the picture must be

- One image of all five heroes together, as a team. Never a T-pose line-up, never cut-outs.
- Landscape 16:9, at least 1600 x 900 px.
- The heads in the upper half and the group in the middle third: the hub panel crops the sides when it is narrow, and the mega panel crops top and bottom.
- No text, no logo, no frame in the picture.
- Each hero keeps its own design and colour: Riko red, Nami blue, Kiro green, Zuno yellow, Vexa purple.

## Prompt for ChatGPT

Attach ONE file first: `%USERPROFILE%\.play50\concepts\groupB\B01-five-heroes-sheet.jpg` (a 2400 x 1600 sheet of the five hero concepts: Riko, Nami and Kiro on the top row, Zuno and Vexa on the bottom row). Do not attach `B01-all-six-sheet.jpg`: the user decided on 2026-11-17 that the sixth, dark character (`B12-shadow-plates`) is not in the group picture. Then paste:

```
This reference sheet shows the five heroes of my game team, the Scale Squad. Top row, left to right: Riko (red), Nami (blue), Kiro (green). Bottom row: Zuno (yellow), Vexa (purple). They are pangolins who can roll into a ball.

Create ONE new group picture of these five together as a team. Exactly five characters, nobody else.

Keep every character exactly as on the sheet: the same face, the same scale colour and glow, the same headphones and visor, the same black suit, belt, shoulder pads and knee pads. Do not change the designs and do not swap the colours.

Pose: a natural team pose, not a T-pose and not a line-up. They stand close together and overlap like real friends in a group photo. Riko stands in the centre front with arms crossed. Nami and Kiro stand behind Riko's shoulders, one with a hand on the hip, one giving a thumbs up. Zuno crouches in front on one knee. Vexa is half rolled into a ball at the side, looking at the camera. All of them smile at the camera.

Framing: landscape 16:9. The whole group fits in the middle of the picture with empty space on the left and right. The heads are in the upper half. Full bodies are visible.

Style: the same 3D render style as the sheet, premium mobile game key art, soft studio light with a coloured rim light on each hero. Background: a plain dark navy studio backdrop with a soft floor shadow. No text, no logo, no frame.
```

If the faces or colours drift, answer in the same chat: "Keep the pose, but make each hero match the reference sheet exactly." If a sixth character appears: "Only the five from the sheet, remove everyone else."

## Status

Done on 2026-11-17: the user made the picture with the prompt above and approved it. It is in the app as `play50games-frontend/public/images/worlds/scale-squad.webp` (1600 x 900, webp), and `SQUAD_PICTURE` in `play50games-frontend/src/components/Site/siteData.ts` points at it. The original is kept outside the repo at `%USERPROFILE%\.play50\concepts\groupB\B01-scale-squad-group.webp`.

To replace it later: save the new picture over the same file (webp, about 1600 px wide, under 200 KB). `SQUAD_PICTURE = null` falls back to five balls drawn in CSS (`components/Site/SquadArt`).
