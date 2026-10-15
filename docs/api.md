# API REST

Base : `http://127.0.0.1:5000`. Toutes les réponses API sont JSON. Aucune route ne
crée, reçoit ou retourne une clé privée. Champs supplémentaires des transferts,
blocs et requêtes de minage refusés.

| Méthode / chemin | Résultat |
|---|---|
| POST /api/session | Connexion locale du navigateur, cookie HttpOnly ; aucun secret dans le JSON |
| GET /api/chain | Identité réseau et tous les blocs |
| GET /api/blocks | Tous les blocs |
| GET /api/blocks/INDEX | Bloc demandé, 404 s'il est absent |
| GET /api/transactions | Listes confirmed (récompenses comprises) et pending |
| POST /api/transactions | Transaction signée, réponse transaction et HTTP 201 |
| GET /api/balance/ADRESSE | confirmed, reserved, available, next_nonce |
| POST /api/mine | Objet recipient, réponse block et HTTP 201 |
| GET /api/validate | valid: true ou erreur de validation |
| GET /api/stats | Hauteur, hash, circulation, plafond, attente, unité, difficulté |

Pour les deux POST : `Content-Type: application/json` et
`Authorization: Bearer JETON_LOCAL`. Le jeton se trouve dans `data/api.token`.
Ne jamais mettre le jeton dans une URL. Exemple Bash (remplacer ADRESSE_ALICE,
la transaction signée se prépare avec la CLI du README) :

```bash
MTC_TOKEN=$(cat data/api.token)
curl http://127.0.0.1:5000/api/stats
curl http://127.0.0.1:5000/api/balance/ADRESSE_ALICE
curl -X POST http://127.0.0.1:5000/api/mine \
  -H "Authorization: Bearer $MTC_TOKEN" -H 'Content-Type: application/json' \
  -d '{"recipient":"ADRESSE_ALICE"}'
curl -X POST http://127.0.0.1:5000/api/transactions \
  -H "Authorization: Bearer $MTC_TOKEN" -H 'Content-Type: application/json' \
  --data-binary @transaction-signee.json
unset MTC_TOKEN
```

Erreurs : `{"error":{"code":"invalid","message":"..."}}`. Statuts : 400
protocole/JSON invalide, 401 jeton absent ou incorrect, 403 accès/origine refusé,
404 absent, 413 corps trop gros, 415 type de contenu, 500 opération interne
impossible. Un succès de soumission réserve les fonds ; seul le minage confirme.
Les exports sont complets et non paginés pour ce petit prototype.

## Session du site

Le site appelle `POST /api/session` avec `{}`, une Origin exactement identique
à celle du serveur et `X-Mithimbo-Client: web`. Si présent, `Sec-Fetch-Site` doit
être `same-origin`. La réponse contient `connected: true` et un cookie HttpOnly,
SameSite Strict, chemin `/api`, durée huit heures. Les POST ultérieurs utilisant
ce cookie exigent les mêmes contrôles d'origine et l'en-tête personnalisé. Aucun
mot de passe ni clé de portefeuille ne doit être envoyé à cette route.
Le cookie n'est pas Secure uniquement parce que le serveur est HTTP en loopback ;
aucun accès réseau externe n'est pris en charge. La capacité change au redémarrage.
