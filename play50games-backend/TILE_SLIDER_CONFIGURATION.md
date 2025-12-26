# Tile Slider Configuration Guide

## 📋 Si të konfigurohet Tile Slider në WordPress Backend

### Hapi 1: Hyr në WordPress Admin

1. Shko te: `https://cms.play50.games/wp-admin`
2. Bëj login me kredencialet e tua admin
3. Në sidebar majtas, kliko **Games** → **Add New** (ose **Edit** për lojë ekzistuese)

---

### Hapi 2: Plotëso Fushat Bazë

#### Fushat e Kërkuara:

- **Title**: `Tile Slider` (ose çfarëdo emri dëshiron)
- **Game Order**: Numri i renditjes (p.sh. `5`)
- **Game Type**: Zgjidh `logic`
- **Difficulty**: `1-5` (1 = më e lehtë, 5 = më e vështirë)
- **Time Limit**: `60` (sekonda)
- **Passing Score**: `70` (minimum për të kaluar)
- **Unlock Requirement**: ID e lojës që duhet të kryhet më parë (lëre bosh për lojën e parë)
- **Description**: `Rearrange tiles into correct order`

---

### Hapi 3: Konfiguro Game Config (JSON)

Në fushën **Game Config**, vendos këtë JSON:

#### Konfigurim Bazë (Default):

```json
{
  "gameType": "tile-slider",
  "gridSize": 3,
  "showHints": true,
  "maxHints": 5
}
```

#### Konfigurim me 10 Hints:

```json
{
  "gameType": "tile-slider",
  "gridSize": 3,
  "showHints": true,
  "maxHints": 10
}
```

#### Konfigurim me Unlimited Hints (pa share):

```json
{
  "gameType": "tile-slider",
  "gridSize": 3,
  "showHints": true,
  "maxHints": 0
}
```

Ose:

```json
{
  "gameType": "tile-slider",
  "gridSize": 3,
  "showHints": true,
  "maxHints": 1000
}
```

#### Konfigurim pa Hints:

```json
{
  "gameType": "tile-slider",
  "gridSize": 3,
  "showHints": false
}
```

#### Konfigurim për Grid 4x4:

```json
{
  "gameType": "tile-slider",
  "gridSize": 4,
  "showHints": true,
  "maxHints": 10
}
```

---

## 📝 Fusha të Detajuara

### `gameType` (i detyrueshëm)
- **Vlera**: `"tile-slider"`
- **Përshkrim**: Identifikon llojin e lojës

### `gridSize` (opsionale)
- **Vlera**: `3` ose `4`
- **Default**: `3`
- **Përshkrim**: 
  - `3` = Grid 3x3 (8 tiles + 1 empty space)
  - `4` = Grid 4x4 (15 tiles + 1 empty space)

### `showHints` (opsionale)
- **Vlera**: `true` ose `false`
- **Default**: `true`
- **Përshkrim**: Aktivizon butonin "Show Hint"

### `maxHints` (opsionale)
- **Vlera**: Numër (0, 1, 2, 3, 5, 10, 1000, etj.)
- **Default**: `5`
- **Përshkrim**: 
  - Numër normal (p.sh. `5`, `10`): Numri maksimal i hints të lejuara
  - `0` ose `>= 1000`: Unlimited hints (zgjidh puzzle plotësisht automatikisht)
  - Nëse nuk specifikohet, përdoret default `5`

---

## ✅ Validimi i JSON

1. Pas vendosjes së JSON, kliko butonin **Validate JSON**
2. Nëse JSON është i saktë, do të shfaqet mesazh jeshil
3. Nëse ka gabim, do të shfaqet mesazh i kuq me detaje

---

## 🎮 Si Funksionon

### Hints System:

1. **Limited Hints** (p.sh. `maxHints: 10`):
   - Përdoruesi ka 10 hints
   - Çdo hint ekzekuton 2-3 lëvizje optimale
   - Counter shfaq: "Hints: 2 / 10"
   - Pas 10 hints, butoni bllokohet

2. **Unlimited Hints** (`maxHints: 0` ose `>= 1000`):
   - Përdoruesi ka hints të pakufizuara
   - Butoni ndryshon në "Solve Puzzle"
   - Përdor BFS algorithm për zgjidhje të plotë
   - Counter shfaq: "Hints: Unlimited"

3. **Share to Unlock**:
   - Përdoruesi mund të ndajë lojën për unlimited hints
   - Nëse ndan, `maxHints` bëhet automatikisht `0`
   - Nuk ka nevojë për konfigurim në backend

---

## 📋 Shembuj të Plotë

### Shembull 1: Lojë e Thjeshtë (3x3, 5 hints)

```json
{
  "gameType": "tile-slider",
  "gridSize": 3,
  "showHints": true,
  "maxHints": 5
}
```

### Shembull 2: Lojë e Vështirë (4x4, 10 hints)

```json
{
  "gameType": "tile-slider",
  "gridSize": 4,
  "showHints": true,
  "maxHints": 10
}
```

### Shembull 3: Lojë pa Hints

```json
{
  "gameType": "tile-slider",
  "gridSize": 3,
  "showHints": false
}
```

### Shembull 4: Lojë me Unlimited Hints

```json
{
  "gameType": "tile-slider",
  "gridSize": 3,
  "showHints": true,
  "maxHints": 0
}
```

---

## ⚠️ Shënime të Rëndësishme

1. **JSON duhet të jetë valid**: Përdor `Validate JSON` button për të kontrolluar
2. **Vlerat numerike**: `maxHints` duhet të jetë numër, jo string (p.sh. `10` jo `"10"`)
3. **Default values**: Nëse nuk specifikon një fushë, përdoret vlera default
4. **Share override**: Nëse përdoruesi ndan lojën, `maxHints` bëhet automatikisht `0` (unlimited)

---

## 🔍 Troubleshooting

### Problemi: `maxHints` nuk funksionon siç duhet

**Zgjidhje:**
- Sigurohu që JSON është valid (përdor Validate JSON)
- Kontrollo që `maxHints` është numër, jo string
- Nëse vendos `10`, duhet të jetë `10` jo `"10"`

### Problemi: Hints nuk shfaqen

**Zgjidhje:**
- Kontrollo që `showHints` është `true`
- Nëse `showHints` është `false`, hints nuk do të shfaqen fare

### Problemi: Unlimited hints nuk funksionon

**Zgjidhje:**
- Për unlimited hints, vendos `maxHints: 0` ose `maxHints: 1000`
- Ose përdor "Share for Unlimited Hints" button në frontend

---

## 📚 Referenca

- Për më shumë informacion, shiko: `WORDPRESS_GAMES_CONFIGURATION.md`
- Për të gjitha lojërat, shiko: `GAMES_LIST.md`
- Për konfigurim të shpejtë, shiko: `QUICK_REFERENCE_GAMES.md`

