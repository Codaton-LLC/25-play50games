# Setup Instructions

## Konfigurimi i API URL

Për të lidhur frontend me WordPress backend, krijo një file `.env.local` në folder-in `play50games-frontend`:

```bash
# .env.local
# Për cms.play50.game (pa 's'):
NEXT_PUBLIC_WORDPRESS_API_URL=https://cms.play50.game/wp-json/play50/v1

# Ose për cms.play50.games (me 's'):
# NEXT_PUBLIC_WORDPRESS_API_URL=https://cms.play50.games/wp-json/play50/v1
```

**Shënim:** Nëse nuk krijon `.env.local`, aplikacioni do të përpiqet të detektojë automatikisht URL-në bazuar në domain-in ku po ekzekutohet. Por është më mirë ta konfigurosh manualisht.

### Për lokal development:
```bash
NEXT_PUBLIC_WORDPRESS_API_URL=http://localhost/wp-json/play50/v1
```

### Pas krijimit të file-it:

1. **Restart Next.js dev server:**
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

2. **Kontrollo që WordPress API është aktiv:**
   - Shko te: `https://cms.play50.game/wp-json/play50/v1/games` (ose `https://cms.play50.games/wp-json/play50/v1/games`)
   - Duhet të shohësh një array (mund të jetë bosh nëse nuk ke krijuar lojëra akoma)

3. **Nëse lojërat nuk shfaqen:**
   - Shko te faqja `/diagnostics` për të testuar lidhjen me API
   - Kontrollo browser console për mesazhe gabimi
   - Verifiko që URL-ja në `.env.local` është e saktë

## Troubleshooting

### Error: ERR_CONNECTION_REFUSED
- Kontrollo që WordPress është running
- Kontrollo URL-në në `.env.local`
- Kontrollo CORS settings në WordPress

### Error: CORS
Nëse ke CORS errors, shto në WordPress `wp-config.php`:
```php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
```

Ose përdor një CORS plugin për WordPress.

### Warning: Extra attributes (Grammarly)
Ky warning është i parëndësishëm - vjen nga Grammarly browser extension. Tashmë është shtuar `suppressHydrationWarning` për ta fshirë.

