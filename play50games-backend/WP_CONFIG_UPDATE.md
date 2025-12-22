# Përditësimi i wp-config.php për Live

## Shto këto rreshta në wp-config.php

Gjeje këtë rresht në `wp-config.php`:
```php
@ini_set('display_errors', 0);
```

Dhe **para** këtij rreshti:
```php
/* That's all, stop editing! Happy blogging. */
```

Shto këto rreshta:

```php
// ============================================
// Play50Games CORS Configuration
// ============================================
// Production environment - specify your frontend domain
define('WP_ENVIRONMENT_TYPE', 'production');
define('PLAY50_CORS_ORIGIN', 'https://play50.games');
// ============================================
```

## Rezultati final

Duhet të duket kështu:

```php
@ini_set('display_errors', 0);

// ============================================
// Play50Games CORS Configuration
// ============================================
// Production environment - specify your frontend domain
define('WP_ENVIRONMENT_TYPE', 'production');
define('PLAY50_CORS_ORIGIN', 'https://play50.games');
// ============================================

/* That's all, stop editing! Happy blogging. */
```

## Nëse frontend është në domain tjetër

Nëse frontend nuk është në `play50.games`, ndrysho:
```php
define('PLAY50_CORS_ORIGIN', 'https://your-frontend-domain.com');
```

## Multiple Domains

Nëse ke multiple frontend domains:
```php
define('PLAY50_CORS_ORIGIN', 'https://play50.games,https://www.play50.games,https://staging.play50.games');
```

## Pas përditësimit

1. **Save** file-in `wp-config.php`
2. **Test** API endpoint: `https://cms.play50.games/wp-json/play50/v1/games`
3. Nëse funksionon, frontend duhet të lidhet me sukses

## Shënim

- **Mos** ndrysho gjë tjetër në `wp-config.php`
- **Mos** fshi rreshtat ekzistues
- **Vetëm** shto konfigurimin e CORS para "That's all, stop editing!"

