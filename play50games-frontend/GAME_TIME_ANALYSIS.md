# Analizë e Kohës për Lojërat

## Si funksionon koha në lojërat

### 1. **Time Limit (Koha maksimale për lojë)**
- Çdo lojë ka një `time_limit` në sekonda
- Timer fillon kur loja fillon dhe numëron poshtë
- Kur timer arrin 0, loja përfundon automatikisht

### 2. **Rounds (Rundet)**
- Shumë lojëra kanë multiple rounds (p.sh. 5 rounds)
- Lojëra mund të përfundojnë para se timer të mbarojë nëse:
  - Të gjitha rounds janë përfunduar
  - Lojtari arrin objektivin e lojës

### 3. **Lojëra të shpejta (mund të luhen në pak sekonda)**
- **Balance the Scale**: 1 round, ~5-10 sekonda
- **Match the Shapes**: 5 rounds, ~30-45 sekonda (6-9 sekonda/round)
- **Number Order**: 3 rounds, ~20-30 sekonda
- **Find the Odd One**: 5 rounds, ~25-40 sekonda
- **Click the Green**: ~30-60 sekonda (varet nga shpejtësia)
- **Quick Compare**: 15 rounds, ~45-60 sekonda (3-4 sekonda/round)
- **Reaction Test**: 10 rounds, ~30-45 sekonda

### 4. **Lojëra standard (1-2 minuta)**
- **Color Sequence**: 5 rounds, ~60-90 sekonda
- **Card Flip Memory**: ~90-120 sekonda
- **Fast Math**: 10 rounds, ~60-90 sekonda
- **Target Aim**: 10 targets, ~60-90 sekonda

### 5. **Lojëra komplekse (2-5 minuta)**
- **Tile Slider**: ~120 sekonda
- **Light Switch Puzzle**: ~90 sekonda
- **Maze Escape**: ~120 sekonda
- **Sudoku 4x4**: ~120 sekonda
- **Ball Balance**: ~120 sekonda

### 6. **Lojëra finale (5-10 minuta)**
- **Boss Puzzle**: 600 sekonda (10 minuta)
- **Final Certification Test**: 600 sekonda (10 minuta)
- **Survival Mode**: 300 sekonda (5 minuta)

## Llogaritja e lojërave që mund të luhen

### Në 60 sekonda (1 minutë):
- **Balance the Scale**: ~6-10 lojëra
- **Match the Shapes**: ~1-2 lojëra
- **Quick Compare**: ~1 lojë
- **Reaction Test**: ~1-2 lojëra

### Në 300 sekonda (5 minuta):
- **Balance the Scale**: ~30-50 lojëra
- **Match the Shapes**: ~6-10 lojëra
- **Color Sequence**: ~3-5 lojëra
- **Card Flip Memory**: ~2-3 lojëra
- **Fast Math**: ~3-5 lojëra

### Në 600 sekonda (10 minuta):
- **Balance the Scale**: ~60-100 lojëra
- **Match the Shapes**: ~12-20 lojëra
- **Color Sequence**: ~6-10 lojëra
- **Card Flip Memory**: ~5-6 lojëra
- **Fast Math**: ~6-10 lojëra
- **1 Final Game**: ~1 lojë

## Shënime të rëndësishme

1. **Lojërat me rounds** përfundojnë kur rounds përfundojnë, jo kur timer mbaron
2. **Lojërat pa rounds** (si Balance the Scale) përfundojnë kur lojtari zgjedh përgjigjen
3. **Timer-i** është maksimal - lojëra mund të përfundojnë më shpejt
4. **Lojërat e shpejta** si Balance the Scale mund të luhen shumë herë brenda kohës së caktuar

## Rekomandime

- Për lojëra të shpejta: 30-60 sekonda
- Për lojëra standard: 60-120 sekonda  
- Për lojëra komplekse: 120-180 sekonda
- Për lojëra finale: 300-600 sekonda

