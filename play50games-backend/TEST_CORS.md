# Testing CORS and REST API

## Quick Test

The REST API endpoint `https://cms.play50.games/wp-json/play50/v1` **IS WORKING** ✅

The response shows all routes are registered. However, you need to call **specific endpoints** to get data:

### Test Endpoints:

1. **Base namespace (route discovery):**
   ```
   https://cms.play50.games/wp-json/play50/v1
   ```
   Returns: List of available routes

2. **Get all games:**
   ```
   https://cms.play50.games/wp-json/play50/v1/games
   ```
   Returns: Array of games (may be empty if no games created)

3. **Test endpoint:**
   ```
   https://cms.play50.games/wp-json/play50/v1/test
   ```
   Returns: Success message

4. **Diagnostics:**
   ```
   https://cms.play50.games/wp-json/play50/v1/diagnostics
   ```
   Returns: REST API status information

## CORS Configuration

### Check if CORS is configured:

1. **Verify `wp-config.php` has:**
   ```php
   define('PLAY50_CORS_ORIGIN', 'https://play50.games');
   ```

2. **Test CORS from browser console:**
   ```javascript
   fetch('https://cms.play50.games/wp-json/play50/v1/games')
     .then(r => r.json())
     .then(data => console.log('Success:', data))
     .catch(err => console.error('CORS Error:', err));
   ```

### If you get CORS errors:

1. **Check `wp-config.php`:**
   - Make sure `PLAY50_CORS_ORIGIN` is set to your frontend domain
   - Example: `define('PLAY50_CORS_ORIGIN', 'https://play50.games');`

2. **For multiple domains:**
   ```php
   define('PLAY50_CORS_ORIGIN', 'https://play50.games,https://www.play50.games');
   ```

3. **Upload the updated `rest-api.php` file** to your server

4. **Clear any caching** (WordPress cache, browser cache, CDN cache)

## Frontend Configuration

### Make sure `.env.local` exists in `play50games-frontend/`:

```bash
NEXT_PUBLIC_WORDPRESS_API_URL=https://cms.play50.games/wp-json/play50/v1
```

### Restart Next.js server after setting env variable:

```bash
# Stop server (Ctrl+C)
npm run dev
```

## Common Issues

### Issue: "Cannot connect to WordPress API"
- **Solution:** Check that `NEXT_PUBLIC_WORDPRESS_API_URL` is set correctly
- **Solution:** Verify the WordPress site is accessible
- **Solution:** Check browser console for CORS errors

### Issue: CORS error in browser console
- **Solution:** Verify `PLAY50_CORS_ORIGIN` in `wp-config.php` matches your frontend domain
- **Solution:** Upload the updated `rest-api.php` file
- **Solution:** Clear all caches

### Issue: 404 on `/wp-json/play50/v1`
- **Solution:** Refresh Permalinks (Settings → Permalinks → Save Changes)
- **Solution:** Verify theme is active
- **Solution:** Check that `rest-api.php` is included in `functions.php`

## Verification Checklist

- [ ] `https://cms.play50.games/wp-json/` returns WordPress namespaces
- [ ] `https://cms.play50.games/wp-json/play50/v1` returns route list
- [ ] `https://cms.play50.games/wp-json/play50/v1/test` returns success message
- [ ] `PLAY50_CORS_ORIGIN` is set in `wp-config.php`
- [ ] `NEXT_PUBLIC_WORDPRESS_API_URL` is set in `.env.local`
- [ ] Next.js server has been restarted
- [ ] No CORS errors in browser console

