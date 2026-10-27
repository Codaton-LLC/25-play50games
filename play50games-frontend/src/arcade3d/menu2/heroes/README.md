# Menu 2 hero choice (`menu2/heroes`)

Which hero a Color Roll Heroes game preselects, the player's remembered pick, and the shared picker.
Sky Tower Jump is the reference adoption (`heroes.ts`, `Hud.tsx`, `Scene.tsx`).

## Default hero (`heroPick.ts`)

`defaultHeroFor(slug)` reads the world of the game (`menu2/worldMap/worlds.ts`, `worldOfSlug`):

| World | Lead (preselected) |
|---|---|
| W1 Ember Heights | Riko |
| W2 Sky & Sea (Sky Tower Jump) | Nami |
| W3 | Kiro |
| W4 | Zuno |
| W5 | Vexa |
| W6 Prism Fortress | the player's last pick in any game, else Riko |

A slug in no world gets Riko. `initialHeroFor(slug)` returns the player's own last pick **in this game**
when there is one, else that default. `createHeroPick(slug)` is the live store a game shares between its
picker and its Scene: `get()` (lazy), `set(id)` (remembers the pick), `subscribe(fn)`.

Storage is here only (`play50games_m2_hero`: `{ last, bySlug }`), behind a never-throwing adapter like
core audio's mute; game code never writes localStorage. The rules' own default hero (bots, limit proofs)
is not this: Sky Tower Jump's `createRun(seed)` still defaults to Riko, so every proof is unchanged.

## Picker (`HeroPicker.tsx`)

```tsx
const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
<HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />
```

- Shown **between runs**: on the start card (`ready`), in the pause menu (`paused`) and on the result
  screen (`over` once the result is shown). Never during play.
- Wide screens: the row of heroes, always open, top-right (clear of the start card's top-left back link).
  Phones / narrow windows (<= 700 px): a "change hero" chip (the current hero, 44 px tall) that opens a
  sheet of 56 px cards under it; a pick, Esc or a tap outside closes it.
- Portaled to the page at z-index 40, above the start card, pause and result overlays (20-30).
- The pick is the **next run's** option. On the start card the Scene may show it at once (Sky Tower Jump
  rebuilds its run so the intro shows the picked hero); after that the running Scene keeps the hero its
  run started with (`useMemo(() => pickedHero(), [runId])`), and Retry / Next level / Restart use the new
  pick. A W6 tag-switch mid-run is a separate, later system.
