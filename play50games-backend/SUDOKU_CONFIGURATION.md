# Sudoku 4x4 - Konfigurimi në Backend

## Si të konfigurosh Sudoku 4x4 në WordPress

### Hapat:

1. **Hyr në WordPress Admin**
   - Shko te: `https://cms.play50.games/wp-admin`
   - Kliko **Games** → **All Games** ose **Add New**

2. **Gjej ose krijo lojën Sudoku 4x4**
   - Nëse ekziston, kliko mbi titullin për ta edituar
   - Nëse nuk ekziston, kliko **Add New**

3. **Konfiguro fushat e mëposhtme:**

```
Title: Sudoku 4x4
Game Order: 10 (ose numri që duhet)
Game Type: logic
Difficulty: 3
Time Limit: 180 (ose sa sekonda dëshiron)
Passing Score: 85 (ose 80-90, varet nga vështirësia)
Unlock Requirement: [ID e lojës së mëparshme] (ose lëre bosh për lojën e parë)
Description: Complete the 4x4 sudoku grid
Game Config:
{
  "gameType": "sudoku-4x4"
}
```

### Rëndësia e Passing Score:

- **Passing Score** përcakton pikën minimale për të kompletuar lojën
- Për Sudoku 4x4, loja jep **100 pikë** kur puzzle është i kompletuar dhe i saktë
- Nëse vendos `passing_score: 85`, loja konsiderohet e kompletuar nëse merr 85 ose më shumë pikë
- Nëse vendos `passing_score: 100`, loja duhet të kompletohet perfektisht (100 pikë)

### Rekomandime:

- **Për lojëra të lehta**: `passing_score: 70-75`
- **Për lojëra mesatare**: `passing_score: 75-80`
- **Për lojëra të vështira**: `passing_score: 80-85`
- **Për Sudoku 4x4**: `passing_score: 85` (rekomanduar)

### Si të kontrollosh:

1. Pasi të ruash konfigurimin, shko te frontend
2. Luaj lojën dhe kompletoje me 100 pikë
3. Duhet të shfaqet "✓ Passed!" dhe butoni "Continue" duhet të funksionojë
4. Kliko "Continue" për të kthyer në home page

### Shënim:

- Nëse butoni "Continue" nuk funksionon, kontrollo nëse ka ndonjë error në browser console
- Sigurohu që loja është **Published** (jo Draft) në WordPress
- Pas ndryshimeve në backend, refresh faqen në frontend

