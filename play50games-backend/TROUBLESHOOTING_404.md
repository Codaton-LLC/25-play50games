# Troubleshooting REST API 404 Error

Nëse merr 404 për `https://cms.play50.games/wp-json/play50/v1/games`, provo këto hapa:

## 1. Verifiko që Theme është Aktiv

1. Shko në WordPress Admin → **Appearance → Themes**
2. Kontrollo që **play50games** theme është aktiv (jo vetëm installed)
3. Nëse nuk është aktiv, kliko **Activate**

## 2. Refresh Permalinks (MË E RËNDËSISHME!)

1. Shko në WordPress Admin → **Settings → Permalinks**
2. **Mos ndrysho asgjë**, vetëm kliko **Save Changes** në fund
3. Kjo do të regenerojë `.htaccess` dhe do të aktivizojë REST API routes

## 3. Test WordPress REST API Base

Hap në browser:
```
https://cms.play50.games/wp-json/
```

Duhet të shohësh një JSON me namespaces. Nëse merr 404 edhe këtu, problemi është me REST API në përgjithësi.

## 4. Test Play50 Namespace

Hap në browser:
```
https://cms.play50.games/wp-json/play50/v1
```

Nëse merr 404, routes nuk janë regjistruar.

## 5. Kontrollo që File-t janë të Ngarkuar

Verifiko që këto file ekzistojnë:
- `wp-content/themes/play50games/includes/rest-api.php`
- `wp-content/themes/play50games/functions.php`

Dhe që `functions.php` përmban:
```php
require_once(get_stylesheet_directory() . '/includes/rest-api.php');
```

## 6. Kontrollo Error Logs

Shko në WordPress Admin → **Tools → Site Health → Info → Server**
Ose kontrollo `wp-content/debug.log` nëse `WP_DEBUG_LOG` është aktiv.

## 7. Deactivate dhe Reactivate Theme

1. Shko në **Appearance → Themes**
2. Aktivizo një theme tjetër (p.sh. Twenty Twenty-Three)
3. Pastaj aktivizo përsëri **play50games**
4. Refresh Permalinks përsëri

## 8. Kontrollo .htaccess

File-i `.htaccess` në root të WordPress duhet të përmbajë:
```
# BEGIN WordPress
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteRule ^index\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.php [L]
</IfModule>
# END WordPress
```

Nëse nuk ekziston, WordPress do ta krijojë automatikisht kur refresh Permalinks.

## 9. Test me Plugin

Instalo plugin-in "REST API Test" ose përdor Postman/curl për të testuar:
```bash
curl https://cms.play50.games/wp-json/play50/v1/games
```

## 10. Kontrollo Server Configuration

Nëse përdor Apache, sigurohu që `mod_rewrite` është aktiv.
Nëse përdor Nginx, kontrollo rewrite rules.

## Zgjidhja më e shpeshtë:

**Refresh Permalinks** (Hapi 2) zakonisht zgjidh problemin në 90% të rasteve!

