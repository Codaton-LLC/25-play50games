# Match the Shapes - Konfigurimi në Backend

## Si të konfigurosh "Match the Shapes" në WordPress

### Hapat:

1. **Hyr në WordPress Admin**

   -  Shko te: `https://cms.play50.games/wp-admin`
   -  Kliko **Games** → **All Games** ose **Add New**

2. **Gjej ose krijo lojën "Match the Shapes"**

   -  Nëse ekziston, kliko mbi titullin për ta edituar
   -  Nëse nuk ekziston, kliko **Add New**

3. **Konfiguro fushat e mëposhtme:**

```
Title: Match the Shapes
Game Order: 1 (ose numri që duhet)
Game Type: logic
Difficulty: 1
Time Limit: 60 (ose sa sekonda dëshiron)
Passing Score: 70 (ose 70-80, varet nga vështirësia)
Unlock Requirement: (lëre bosh për lojën e parë, ose ID e lojës së mëparshme)
Description: Match the target shape with the correct option
Game Config:
{
  "gameType": "match-shapes",
  "shapes": ["circle", "square", "triangle", "star"],
  "rounds": 20
}
```

### Rëndësia e fushave:

#### **Title**

-  Emri i lojës që shfaqet për përdoruesit
-  Shembull: `Match the Shapes`

#### **Game Order**

-  Numri i renditjes së lojës (1-50)
-  Përcakton rendin në të cilin shfaqen lojërat
-  Shembull: `1` për lojën e parë

#### **Game Type**

-  Kategoria e lojës
-  Për "Match the Shapes": `logic`

#### **Difficulty**

-  Vështirësia e lojës (1-5)
-  1 = Easiest, 5 = Hardest
-  Për "Match the Shapes": `1` ose `2`

#### **Time Limit**

-  Koha në sekonda për të luajtur lojën
-  Rekomandim: `60` sekonda për 20 raunde
-  Ose `90` sekonda për më shumë kohë

#### **Passing Score**

-  Pika minimale për të kompletuar lojën (0-100)
-  "Match the Shapes" jep **100 pikë max** (20 raunde × 5 pikë)
-  Rekomandim: `70` ose `75` pikë

#### **Unlock Requirement**

-  ID e lojës që duhet kompletuar para se të hapet kjo lojë
-  Për lojën e parë: **lëre bosh** ose `0`
-  Për lojëra të tjera: vendos ID e lojës së mëparshme

#### **Description**

-  Përshkrim i shkurtër i lojës
-  Shembull: `Match the target shape with the correct option`

#### **Game Config (JSON)**

Ky është fusha më e rëndësishme për konfigurimin e lojës:

```json
{
   "gameType": "match-shapes",
   "shapes": ["circle", "square", "triangle", "star"],
   "rounds": 20
}
```

**Fushat në Game Config:**

-  **gameType** (i detyrueshëm): `"match-shapes"` - identifikon lojën
-  **shapes** (opsionale): Array i formave që do të përdoren
   -  Default: `["circle", "square", "triangle"]`
   -  Mund të shtosh: `"star"`, `"diamond"`, `"heart"`, etj.
   -  Shembull: `["circle", "square", "triangle", "star", "diamond"]`
-  **rounds** (opsionale): Numri i raundeve
   -  Default: `20` (për 100 pikë max)
   -  Mund të ndryshosh: `10`, `15`, `20`, `25`, etj.

### Shembuj të konfigurimeve:

#### **Konfigurim minimal (mjafton vetëm gameType):**

```json
{
   "gameType": "match-shapes"
}
```

-  Përdor default values: 3 forma, 20 raunde

#### **Konfigurim i plotë:**

```json
{
   "gameType": "match-shapes",
   "shapes": ["circle", "square", "triangle", "star"],
   "rounds": 20
}
```

#### **Konfigurim me më shumë forma:**

```json
{
   "gameType": "match-shapes",
   "shapes": [
      "circle",
      "square",
      "triangle",
      "star",
      "diamond",
      "heart",
      "hexagon",
      "octagon",
      "cross",
      "arrow",
      "crescent"
   ],
   "rounds": 20
}
```

#### **Të gjitha format e disponueshme (12 forma):**

```json
{
   "gameType": "match-shapes",
   "shapes": [
      "Home", // HomeIcon → "Home" (was CircleStack)
      "Fingerprint", // FingerPrintIcon → "Fingerprint" (was Square2Stack)
      "Key", // KeyIcon → "Key" (was ArrowUp)
      "Star", // StarIcon → "Star"
      "Eye", // EyeIcon → "Eye" (was Diamond)
      "Heart", // HeartIcon → "Heart"
      "Camera", // CameraIcon → "Camera" (was Stop)
      "Cube", // CubeIcon → "Cube"
      "Bell", // BellIcon → "Bell" (was Octagon)
      "Plus", // PlusIcon → "Plus"
      "Gift", // GiftIcon → "Gift" (was ArrowRight)
      "Moon" // MoonIcon → "Moon"
   ],
   "rounds": 20
}
```

**Emrat e rekomanduara sipas Heroicons (pa "Icon" në fund):**

Format duhet të përdorin emrat e Heroicons pa "Icon":

-  `"Home"` → HomeIcon → Shfaqet si **"Home"** (was CircleStack)
-  `"Fingerprint"` → FingerPrintIcon → Shfaqet si **"Fingerprint"** (was Square2Stack)
-  `"Key"` → KeyIcon → Shfaqet si **"Key"** (was ArrowUp)
-  `"Star"` → StarIcon → Shfaqet si **"Star"**
-  `"Eye"` → EyeIcon → Shfaqet si **"Eye"** (was Diamond)
-  `"Heart"` → HeartIcon → Shfaqet si **"Heart"**
-  `"Camera"` → CameraIcon → Shfaqet si **"Camera"** (was Stop)
-  `"Cube"` → CubeIcon → Shfaqet si **"Cube"**
-  `"Bell"` → BellIcon → Shfaqet si **"Bell"** (was Octagon)
-  `"Plus"` → PlusIcon → Shfaqet si **"Plus"**
-  `"Gift"` → GiftIcon → Shfaqet si **"Gift"** (was ArrowRight)
-  `"Moon"` → MoonIcon → Shfaqet si **"Moon"**

**Shënim:** Emrat e vjetër ende funksionojnë për kompatibilitet:

-  `"circle"`, `"square"`, `"triangle"`, `"star"`, `"diamond"`, `"heart"`, `"stop"`, `"hexagon"`, `"octagon"`, `"cross"`, `"arrow"`, `"crescent"` - të gjitha funksionojnë
-  `"CircleStack"`, `"Square2Stack"`, `"ArrowUp"`, `"Diamond"`, `"Stop"`, `"Octagon"`, `"ArrowRight"` - ende funksionojnë

#### **Konfigurim me më pak raunde:**

```json
{
   "gameType": "match-shapes",
   "shapes": ["circle", "square", "triangle"],
   "rounds": 10
}
```

-  10 raunde = 50 pikë max (10 × 5)

### Si të gjejsh Game ID:

1. Shko te **Games** → **All Games**
2. Hover mbi titullin e lojës
3. Në URL shikoni: `post.php?post=123&action=edit`
4. Numri `123` është Game ID

### Rekomandime:

-  **Për lojëra të lehta**: `difficulty: 1`, `passing_score: 70`
-  **Për lojëra mesatare**: `difficulty: 2`, `passing_score: 75`
-  **Për lojëra të vështira**: `difficulty: 3`, `passing_score: 80`

### Shënime të rëndësishme:

1. **Publishing**: Loja duhet të jetë **Published** (jo Draft) për të shfaqur në API
2. **JSON Validation**: Sigurohu që JSON në Game Config është valid
3. **Rounds dhe Score**:
   -  20 raunde × 5 pikë = 100 pikë max
   -  Nëse ndryshon rounds, passing_score duhet të përshtatet
4. **Shapes**: Forma duhet të jenë të definuara në CSS për të shfaqur si duhet

### Pas konfigurimit:

1. Kliko **Update** ose **Publish**
2. Refresh faqen në frontend
3. Testo lojën për të siguruar që funksionon si duhet
