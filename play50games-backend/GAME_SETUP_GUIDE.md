# Udhëzues për Konfigurimin e Lojërave

## Lojëra e Parë: Match the Shapes

### Hapat në WordPress Admin:

1. **Shko te:** WordPress Admin → **Games** → **Add New**

2. **Title:** `Match the Shapes`

3. **Game Order:** `1` (kjo është loja e parë)

4. **Game Type:** `logic`

5. **Difficulty:** `1` (më e lehtë)

6. **Time Limit:** `60` (sekonda)

7. **Passing Score:** `70` (pikët minimale për të kaluar)

8. **Unlock Requirement:** `(lëre bosh)` - kjo është loja e parë, nuk ka kërkesë

9. **Description:** `Drag shapes into correct outlines`

10. **Game Config (JSON):** Vendos këtë:
```json
{
  "gameType": "match-shapes",
  "shapes": ["circle", "square", "triangle"],
  "rounds": 5
}
```

11. **Publish** lojën

---

## Lojëra e Dytë: Color Sequence

1. **Title:** `Color Sequence`
2. **Game Order:** `2`
3. **Game Type:** `logic`
4. **Difficulty:** `1`
5. **Time Limit:** `90`
6. **Passing Score:** `70`
7. **Unlock Requirement:** `(ID e lojës së parë)` - vendos ID-në e lojës "Match the Shapes"
8. **Description:** `Repeat an increasing color pattern`
9. **Game Config:**
```json
{
  "gameType": "color-sequence",
  "rounds": 5
}
```

---

## Lojëra e Tretë: Card Flip Memory

1. **Title:** `Card Flip Memory`
2. **Game Order:** `3`
3. **Game Type:** `memory`
4. **Difficulty:** `2`
5. **Time Limit:** `120`
6. **Passing Score:** `80`
7. **Unlock Requirement:** `(ID e lojës së dytë)`
8. **Description:** `Classic matching pairs`
9. **Game Config:**
```json
{
  "gameType": "card-flip",
  "gridSize": 4,
  "pairs": 8
}
```

---

## Lojëra e Katërt: Click the Green

1. **Title:** `Click the Green`
2. **Game Order:** `4`
3. **Game Type:** `speed`
4. **Difficulty:** `2`
5. **Time Limit:** `30`
6. **Passing Score:** `75`
7. **Unlock Requirement:** `(ID e lojës së tretë)`
8. **Description:** `Click only green items`
9. **Game Config:**
```json
{
  "gameType": "click-green"
}
```

---

## Lojëra e Pestë: Ball Balance

1. **Title:** `Ball Balance`
2. **Game Order:** `5`
3. **Game Type:** `skill`
4. **Difficulty:** `3`
5. **Time Limit:** `60`
6. **Passing Score:** `70`
7. **Unlock Requirement:** `(ID e lojës së katërt)`
8. **Description:** `Keep ball centered`
9. **Game Config:**
```json
{
  "gameType": "ball-balance"
}
```

---

## Shënime të Rëndësishme:

- **Unlock Requirement:** Për lojën e parë, lëre bosh. Për lojërat e tjera, vendos **ID-në** e lojës që duhet të përfundojë më parë.
- Për të gjetur ID-në e një loje, shiko në listën e lojërave në WordPress admin - ID-ja shfaqet në URL kur e editon lojën.
- **Game Config** duhet të jetë JSON i vlefshëm - kontrollo që të mos ketë gabime sintakse.
- Pas krijimit të lojës, ajo do të shfaqet automatikisht në frontend nëse është unlocked.

