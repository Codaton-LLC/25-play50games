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

Attach the five concepts first (`%USERPROFILE%\.play50\concepts\groupB\B01b` to `B01f`), then paste:

```
These five reference images are the five heroes of my game team, the Scale Squad: Riko (red), Nami (blue), Kiro (green), Zuno (yellow) and Vexa (purple). They are pangolins who can roll into a ball.

Create ONE new group picture of all five together as a team.

Keep every character exactly as in its reference image: the same face, the same scale colour and glow, the same headphones and visor, the same black suit, belt, shoulder pads and knee pads. Do not change the designs and do not swap the colours.

Pose: a natural team pose, not a T-pose and not a line-up. They stand close together and overlap like real friends in a group photo. Riko stands in the centre front with arms crossed. Nami and Kiro stand behind Riko's shoulders, one with a hand on the hip, one giving a thumbs up. Zuno crouches in front on one knee. Vexa is half rolled into a ball at the side, looking at the camera. All of them smile at the camera.

Framing: landscape 16:9. The whole group fits in the middle of the picture with empty space on the left and right. The heads are in the upper half. Full bodies are visible.

Style: the same 3D render style as the references, premium mobile game key art, soft studio light with a coloured rim light on each hero. Background: a plain dark navy studio backdrop with a soft floor shadow. No text, no logo, no frame.
```

If the faces or colours drift, answer in the same chat: "Keep the pose, but make each hero match its reference image exactly."

## Adding it to the app

1. Save the picture as `play50games-frontend/public/images/worlds/scale-squad.webp` (webp, about 1600 px wide, under 200 KB).
2. Set `SQUAD_PICTURE = "/images/worlds/scale-squad.webp"` in `play50games-frontend/src/components/Site/siteData.ts`, in the same commit.

Until then `SQUAD_PICTURE` is `null` and the site draws the five heroes as five balls in their colours (`components/Site/SquadArt`).
