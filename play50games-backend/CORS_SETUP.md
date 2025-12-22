# CORS Configuration për Play50Games

## Setup në wp-config.php

Shto këto rreshta në fund të `wp-config.php` (para "That's all, stop editing!"):

### Për Production (Live):

```php
// Play50Games CORS Configuration
define('WP_ENVIRONMENT_TYPE', 'production');
define('PLAY50_CORS_ORIGIN', 'https://play50.games');
```

### Për Local Development:

```php
// Play50Games CORS Configuration
define('WP_ENVIRONMENT_TYPE', 'local');
define('PLAY50_CORS_ORIGIN', '*'); // Allow all origins në local
```

### Auto-Detection (Rekomanduar):

```php
// Play50Games CORS Configuration - Auto-detect environment
if (!defined('WP_ENVIRONMENT_TYPE')) {
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
    if (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false || strpos($host, '.local') !== false) {
        define('WP_ENVIRONMENT_TYPE', 'local');
        define('PLAY50_CORS_ORIGIN', '*');
    } else {
        define('WP_ENVIRONMENT_TYPE', 'production');
        define('PLAY50_CORS_ORIGIN', 'https://play50.games');
    }
}
```

## Multiple Frontend Domains

Nëse ke multiple frontend domains:

```php
define('PLAY50_CORS_ORIGIN', 'https://play50.games,https://www.play50.games,https://staging.play50.games');
```

## Test CORS

Pas konfigurimit, test në browser console:

```javascript
fetch('https://cms.play50.games/wp-json/play50/v1/games')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

Nëse nuk ke CORS error, do të shohësh rezultatin.

## Troubleshooting

### CORS error përsëri?
1. Kontrollo që `PLAY50_CORS_ORIGIN` është definuar në `wp-config.php`
2. Clear cache (WordPress cache, browser cache)
3. Kontrollo që theme është aktiv
4. Nëse përdor CDN/Proxy, kontrollo CORS settings atje

### Për më shumë siguri në production:
Në vend të `*`, përdor domain specifik:
```php
define('PLAY50_CORS_ORIGIN', 'https://play50.games');
```

