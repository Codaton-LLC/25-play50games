# Shop plan (Menu 2 — Color Roll Heroes)

Status: **planned** (user decision 2026-10-25). Built when Menu 2 starts, after Menu 1 (games 31–50) is finished. More shop ideas will be added later.

## Goal

Players buy premium characters (and later other items) in a shop, both from a shop page and from inside a game. Each item shows its image AND a live 3D model the player can rotate before buying. Purchases belong to the WordPress account, so they work on every device.

## First catalogue: 9 premium heroes

Image-to-3D at Hyper3D's highest tier from the user's concepts (kept outside git in `%USERPROFILE%\.play50\concepts\premium\`):

| Id | Name | Theme |
|---|---|---|
| premiumAbyssor | ABYSSOR | deep sea |
| premiumAurion | AURION | gold / light |
| premiumFrostbite | FROSTBITE | ice |
| premiumInferno | INFERNO | lava / fire |
| premiumKageon | KAGEON | shadow samurai |
| premiumNebula | NEBULA | space |
| premiumSandrex | SANDREX | desert |
| premiumSylvaron | SYLVARON | forest |
| premiumVoltar | VOLTAR | lightning |

Each hero has two GLBs: a **shop** version for the 3D viewer (up to ~60k tris, 2048 px, ≤ 4 MB, loaded only on the shop/detail view) and an **in-game** version (≤ 20k tris, 1024 px, ≤ 1.5 MB) driven by the core auto-rig like the five base heroes. The free base heroes (Riko, Nami, Kiro, Zuno, Vexa) stay free.

## Frontend (Next.js, `play50games-frontend`)

- `/shop` page (hub link) + an in-game shop overlay (from the Menu 2 hero-select screen and the result panel), behind a new flag `NEXT_PUBLIC_SHOP_ENABLED` (default off, like the arcade flags).
- Item card: image (webp thumbnail), name, theme, price, owned/locked badge.
- Detail view: a lazy-loaded R3F viewer (orbit/rotate, auto-spin, idle pose through the core auto-rig, quality tier on phones), "Buy" button, "Equip" when owned.
- Owned items come from the account; equipped hero is used by every Menu 2 game. Guests can browse; buying needs login.
- Fairness: premium heroes are cosmetic only — same hitbox, speed and timing as the base heroes, so one leaderboard stays fair (decision 7).

## Backend (WordPress theme, REST `play50/v1`)

- `includes/shop-api.php` (Claude; uploaded by the user like the other backend files), guarded require in `functions.php`.
- Catalogue: `includes/shop-items.json` (id, name, type, price, currency, image, model urls, active) — same pattern as `arcade-games.json`.
- Entitlements table `{prefix}play50_shop_owned` (user_id, item_id, source, order_ref, created_at).
- Endpoints: `GET shop/items`, `GET shop/me` (owned + equipped, JWT), `POST shop/equip` (JWT), `POST shop/checkout` (JWT → payment session), payment-provider webhook → grants the item (idempotent by order_ref).
- wp-admin page: items, owners, manual grant/refund.

## Open decisions (ask the user before building)

1. Payment provider (e.g. Stripe or PayPal) and prices; real money only, or also a soft currency earned in games.
2. Legal: terms of sale, EU right-of-withdrawal wording for digital goods, VAT/invoicing, age/parental rules — check with the IP/IT lawyer (see `docs/ip-review-classic-2026-10-25.md` questions) before launch.
3. Hyper3D commercial-use terms for sold models (lawyer question 6).
4. Which other shop items come later (outfits, trails, emotes, power-up packs).

## Order of work (when Menu 2 starts)

1. Backend catalogue + entitlements + `GET` endpoints (no payment yet), wp-admin grant page.
2. Frontend `/shop` + 3D viewer + equip, using manual grants for testing.
3. Payment provider + webhook (after decision 1), sandbox first, then production by the user.
4. In-game shop overlay in Menu 2.
