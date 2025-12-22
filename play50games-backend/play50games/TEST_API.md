# Test REST API Endpoints

Për të testuar që REST API funksionon, provo këto URL në browser ose Postman:

## Test Endpoints

### 1. Test Games Endpoint
```
https://cms.play50.games/wp-json/play50/v1/games
```

Duhet të kthejë një array me lojëra (mund të jetë bosh nëse nuk ke krijuar lojëra akoma).

### 2. Test Single Game
```
https://cms.play50.games/wp-json/play50/v1/games/1
```
(Zëvendëso `1` me ID-në e një loje ekzistuese)

### 3. Test Unlock Status
```
https://cms.play50.games/wp-json/play50/v1/unlock-status
```

### 4. Test WordPress REST API Base
```
https://cms.play50.games/wp-json/
```

Duhet të shohësh një JSON me të gjitha namespaces e disponueshme.

## Nëse merr Error 404

Kontrollo:
1. Theme është aktiv në WordPress Admin
2. File `includes/rest-api.php` është i ngarkuar në `functions.php`
3. Permalinks janë refresh (Settings → Permalinks → Save Changes)

## Nëse merr CORS Error

CORS headers janë tashmë të shtuara në `rest-api.php`. Nëse përsëri ke probleme:
1. Kontrollo që theme është aktiv
2. Clear cache nëse ke caching plugin
3. Kontrollo server configuration (nginx/apache) për CORS

## Nëse merr Empty Array []

Kjo është normale nëse nuk ke krijuar lojëra akoma. Krijoni lojëra në WordPress Admin → Games.

