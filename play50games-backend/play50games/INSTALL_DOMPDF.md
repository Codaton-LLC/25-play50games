# Instalimi i DomPDF për WordPress

## Instalim në Live System (Production)

### Metoda 1: Përmes SSH (Rekomanduar)

#### Hapi 1: Lidhu me server përmes SSH

```bash
ssh username@your-server.com
# ose
ssh username@your-server-ip
```

#### Hapi 2: Navigo në theme directory

```bash
cd /path/to/wordpress/wp-content/themes/play50games
# Shembull: cd /var/www/html/wp-content/themes/play50games
```

#### Hapi 3: Kontrollo nëse Composer është i instaluar

```bash
composer --version
```

Nëse nuk është i instaluar, instaloje:

```bash
# Për Linux
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
```

#### Hapi 4: Instalo DomPDF

```bash
composer install
```

Ose nëse dëshiron vetëm DomPDF:

```bash
composer require dompdf/dompdf
```

#### Hapi 5: Verifikimi

```bash
ls -la vendor/
# Duhet të shohësh vendor/dompdf/dompdf/
```

#### Hapi 6: Sigurohu për permissions

```bash
chmod -R 755 vendor/
chown -R www-data:www-data vendor/  # ose përdoruesi i web server-it
```

---

### Metoda 2: Upload vendor/ directory (Nëse nuk ke SSH)

#### Hapi 1: Instalo lokal në kompjuterin tënd

```bash
cd play50games-backend/play50games
composer install
```

#### Hapi 2: Upload vendor/ directory

-  Kompreso `vendor/` directory në ZIP
-  Upload në server përmes FTP/SFTP ose File Manager
-  Ekstrakto në: `wp-content/themes/play50games/vendor/`

#### Hapi 3: Verifikimi

Kontrollo që ekziston: `wp-content/themes/play50games/vendor/autoload.php`

---

### Metoda 3: Përmes cPanel File Manager

#### Hapi 1: Hap File Manager në cPanel

-  Shko te File Manager
-  Navigo te: `public_html/wp-content/themes/play50games/`

#### Hapi 2: Upload composer.json

-  Upload `composer.json` që kam krijuar

#### Hapi 3: Përdor Terminal në cPanel

-  Shko te Terminal në cPanel (nëse është i aktivizuar)
-  Ose përdor SSH Access në cPanel
-  Ekzekuto: `composer install`

---

### Metoda 4: Përmes WordPress Plugin (Alternative)

Nëse nuk mund të përdorësh Composer, mund të përdorësh WordPress plugin:

1. Instalo plugin "Composer Manager" ose "WP Composer"
2. Ose përdor plugin "PDF Generator" që përfshin DomPDF

---

## Verifikimi i Instalimit

### Metoda 1: Përdor Test File (Rekomanduar) ⭐

1. **Upload test file:**

   -  File-i `test-dompdf.php` është krijuar automatikisht në theme directory
   -  Upload në server nëse nuk ekziston: `wp-content/themes/play50games/test-dompdf.php`

2. **Hap në browser:**

   ```
   https://your-site.com/wp-content/themes/play50games/test-dompdf.php
   ```

   Ose:

   ```
   https://cms.play50.games/wp-content/themes/play50games/test-dompdf.php
   ```

3. **Kontrollo rezultatin:**

   -  ✅ **Nëse të gjitha testet kalojnë** → DomPDF është instaluar me sukses!
   -  ❌ **Nëse ka gabime** → Shiko mesazhet për zgjidhje

4. **FSHI test file pas testimit për siguri:**
   ```bash
   rm test-dompdf.php
   ```
   Ose fshi përmes FTP/File Manager!

### Metoda 2: Test përmes WordPress

1. Shko te WordPress Admin
2. Gjenero një certifikatë
3. Kontrollo që file-i është `.pdf` dhe jo `.html`
4. Shkarko dhe hap PDF-në për të verifikuar

### Metoda 3: Test përmes Command Line

```bash
cd wp-content/themes/play50games
php -r "require 'vendor/autoload.php'; echo class_exists('Dompdf\Dompdf') ? 'DomPDF OK' : 'DomPDF FAIL';"
```

Nëse shfaqet **"DomPDF OK"** → Instalimi është i suksesshëm!

---

## Troubleshooting

### Problem: "Composer command not found"

**Zgjidhje:** Instalo Composer në server ose përdor Metodën 2 (upload vendor/)

### Problem: "Permission denied"

**Zgjidhje:**

```bash
chmod -R 755 vendor/
chown -R www-data:www-data vendor/
```

### Problem: "mbstring extension not found"

**Zgjidhje:** Aktivizo mbstring në PHP:

```bash
# Në cPanel: PHP Selector → Extensions → mbstring
# Ose në php.ini: extension=mbstring
```

### Problem: "Memory limit exceeded"

**Zgjidhje:** Rrit memory limit në php.ini:

```ini
memory_limit = 256M
```

---

## Kërkesat:

-  PHP >= 7.4
-  Composer (për instalim përmes SSH)
-  mbstring extension
-  Memory limit >= 128M (rekomanduar 256M)

---

## Shënim:

Nëse nuk e instalon DomPDF, certifikatat do të ruhen si HTML me extension `.pdf` (mund të hapen në browser dhe të printohen si PDF). Sistemi do të funksionojë, por PDF-të nuk do të jenë "të vërteta".

---

## Metoda Alternative: WordPress Plugin

### Opsioni 1: WordPress PDF Plugin

Instalo një plugin që përfshin DomPDF:

-  **PDF Generator for WordPress** - përfshin DomPDF
-  **WP PDF Generator** - përfshin DomPDF
-  **Easy PDF Generator** - përfshin DomPDF

Pas instalimit të plugin-it, DomPDF do të jetë i disponueshëm për theme-in.

### Opsioni 2: Manual Download dhe Upload

1. **Shkarko DomPDF manualisht:**

   -  Shko te: https://github.com/dompdf/dompdf/releases
   -  Shkarko versionin e fundit (ZIP file)

2. **Upload në server:**
   -  Ekstrakto ZIP file
   -  Upload `dompdf/` directory në: `wp-content/themes/play50games/vendor/dompdf/dompdf/`
   -  Krijo `vendor/autoload.php` manualisht

---

## Metoda Alternative: External API

Nëse nuk mund të instalosh DomPDF, mund të përdorësh një external API për PDF generation:

-  **API2PDF** - https://www.api2pdf.com/
-  **PDFShift** - https://pdfshift.io/
-  **Gotenberg** - Self-hosted solution

---

## Rekomandim

**Më e lehtë:** Metoda 2 (Upload vendor/ directory) - nëse nuk ke SSH
**Më e shpejtë:** Metoda 1 (SSH + Composer) - nëse ke SSH
**Më e thjeshtë:** WordPress Plugin që përfshin DomPDF

---

## Zgjidhje për çdo situatë:

-  **Nëse ke SSH:** Përdor Metodën 1 (SSH + Composer)
-  **Nëse ke vetëm FTP:** Përdor Metodën 2 (Upload vendor/)
-  **Nëse nuk ke asgjë:** Përdor WordPress Plugin që përfshin DomPDF
-  **Nëse nuk mund të instalosh:** Përdor External API për PDF generation
