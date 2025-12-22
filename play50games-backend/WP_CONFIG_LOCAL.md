# CORS Configuration for Local Development

## Add to wp-config.php for Local Development

Add this code **BEFORE** the line `/* That's all, stop editing! Happy blogging. */`:

```php
// ============================================
// Play50Games CORS Configuration - LOCAL
// ============================================
// Local development - allow localhost origins
define('PLAY50_CORS_ORIGIN', 'http://localhost:3000,http://localhost:3001');
// ============================================
```

## Alternative: Allow All Origins (Easier for Local Dev)

If you want to allow any localhost port:

```php
// ============================================
// Play50Games CORS Configuration - LOCAL
// ============================================
// Local development - allow all origins (easier for testing)
define('PLAY50_CORS_ORIGIN', '*');
// ============================================
```

## Complete Example for Local Development

Your `wp-config.php` should look like this at the end:

```php
@ini_set('display_errors', 0);

// ============================================
// Play50Games CORS Configuration - LOCAL
// ============================================
define('PLAY50_CORS_ORIGIN', 'http://localhost:3000,http://localhost:3001');
// ============================================

/* That's all, stop editing! Happy blogging. */
```

## Frontend Configuration

Make sure your `.env.local` file in `play50games-frontend/` has:

```bash
NEXT_PUBLIC_WORDPRESS_API_URL=http://localhost/wp-json/play50/v1
```

(Assuming your WordPress is running on `http://localhost`)

## Testing

1. Start your Next.js dev server:
   ```bash
   cd play50games-frontend
   npm run dev
   ```

2. It should start on `http://localhost:3000` (or 3001 if 3000 is taken)

3. The frontend should now be able to connect to WordPress REST API without CORS errors

## Switching Between Local and Production

You can use environment detection:

```php
// ============================================
// Play50Games CORS Configuration
// ============================================
// Auto-detect environment
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
if (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false) {
    // Local development
    define('PLAY50_CORS_ORIGIN', '*');
} else {
    // Production
    define('PLAY50_CORS_ORIGIN', 'https://play50.games');
}
// ============================================
```

This way, it automatically uses the right CORS settings based on where WordPress is running.

