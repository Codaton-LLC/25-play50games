# Rregullimi i CORS për Localhost Development

## Problemi

Kur frontend është në `http://localhost:3000` dhe backend është në `https://cms.play50.games`, CORS headers nuk po dërgohen saktë.

## Zgjidhja

### Hapi 1: Përditëso `wp-config.php`

Në server-in ku është WordPress (cms.play50.games), hap `wp-config.php` dhe gjej konfigurimin e CORS. Duhet të duket kështu:

```php
// ============================================
// Play50Games CORS Configuration
// ============================================
// Auto-detect environment and set CORS accordingly
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
if (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false || strpos($host, '.local') !== false) {
    // Local development - allow all origins (easier for testing on localhost:3000, 3001, etc.)
    define('WP_ENVIRONMENT_TYPE', 'local');
    define('PLAY50_CORS_ORIGIN', '*');
} else {
    // Production environment - specify your frontend domain
    define('WP_ENVIRONMENT_TYPE', 'production');
    define('PLAY50_CORS_ORIGIN', 'https://play50.games,http://localhost:3000,http://127.0.0.1:3000');
}
// ============================================
```

**Shënim:** Vëre që në production, kemi shtuar `http://localhost:3000` dhe `http://127.0.0.1:3000` në listën e origins të lejuara.

### Hapi 2: Verifikoni që `rest-api.php` është i përditësuar

File-i `play50games/includes/rest-api.php` duhet të ketë logjikën e përmirësuar që lejon localhost origins. Nëse nuk është i përditësuar, kopjo kodin e ri nga repository.

### Hapi 3: Clear Cache

Pas përditësimit:

1. **Clear WordPress cache** (nëse përdor cache plugin)
2. **Clear browser cache** (Ctrl+Shift+Delete ose hard refresh me Ctrl+F5)
3. **Restart PHP-FPM** (nëse është e nevojshme në server)

### Hapi 4: Test

1. Shko te frontend: `http://localhost:3000/diagnostics`
2. Kliko "Run Diagnostics Again"
3. Tani "CORS Headers" duhet të tregojë ✅

## Alternative: Lejo të gjitha origins (VETËM për development)

Nëse vazhdon të ketë probleme, mund të lejosh të gjitha origins (vetëm për development, jo në production):

```php
define('PLAY50_CORS_ORIGIN', '*');
```

**Kujdes:** Mos e përdor `*` në production për arsye sigurie!

## Troubleshooting

### CORS headers ende nuk shfaqen?

1. **Kontrollo që theme është aktiv** - CORS kodi është në theme
2. **Kontrollo që `rest-api.php` është i ngarkuar** - Verifiko që file-i ekziston dhe është i përfshirë
3. **Kontrollo server logs** - Shiko nëse ka errors në PHP error log
4. **Test direkt në browser console:**
   ```javascript
   fetch('https://cms.play50.games/wp-json/play50/v1/games', {
     method: 'OPTIONS',
     headers: {
       'Origin': 'http://localhost:3000'
     }
   }).then(r => {
     console.log('CORS Headers:', {
       'Access-Control-Allow-Origin': r.headers.get('Access-Control-Allow-Origin'),
       'Access-Control-Allow-Methods': r.headers.get('Access-Control-Allow-Methods')
     });
   });
   ```

### Nëse përdor CDN/Proxy (Cloudflare, etc.)

Nëse përdor CDN ose proxy, mund të duhet të konfigurosh CORS edhe atje:

- **Cloudflare:** Shiko Page Rules ose Transform Rules
- **Nginx/Apache:** Shto CORS headers në server config

## Verifikimi i suksesshëm

Pas rregullimit, në `/diagnostics` duhet të shohësh:

- ✅ **CORS Headers:** `CORS configured: http://localhost:3000`
- ✅ **API Connectivity:** `Connected successfully!`

