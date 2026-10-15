# Protocole v1

Réseau fixe : `mithimbochain-local-v1`. 1 unité = 1 MTC entier. Offre initiale
nulle ; plafond 10 000 ; récompense `min(10, 10000 - offre_confirmée)`.
Seule la récompense peut émettre. Aucune commission ni fraction monétaire.

## Sérialisation et hashes

JSON avec clés triées, séparateurs `,` et `:`, UTF-8, sans échappement ASCII
obligatoire ; types autorisés : objet à clés texte, liste, texte, entier, booléen,
null. Les champs numériques de consensus exigent exactement `int` (pas bool).
Les floats, NaN et types Python non JSON sont refusés.

Le hash des transactions est SHA-256 de leur liste canonique complète, signatures
et identifiants compris. Le hash du bloc est SHA-256 de l'en-tête canonique :
`chain_id`, `index`, `previous_hash`, `timestamp`, `nonce`, `transactions_hash`.
L'export ajoute `transactions` et `hash`. Les imports exigent exactement ces clés,
les hashes hexadécimaux minuscules et une liste de 101 transactions au maximum.

## Genesis et PoW

Genesis : index 0, précédent de 64 zéros, timestamp 0, nonce 0, aucune transaction.
Hash Genesis : `3458fa49f8e8188fbe53b00b8494d64ec637e1d65d522b8e8a257c7361d3c826`.
Il est reconstruit par le code et comparé intégralement à l'import. C'est le seul
bloc exempté de PoW. Son identité est indépendante de l'heure et des portefeuilles.

La difficulté pédagogique configurée dans `protocol.py` est 2 : les hashes doivent
commencer par deux zéros hexadécimaux (cible stricte `hash < 2**248`). Elle est
fixe pour ce réseau et vérifiée à chaque import ; aucune difficulté fournie par
un client n'est acceptée. La changer implique un autre protocole et des données
incompatibles. Les timestamps sont des secondes Unix entières, non décroissantes ;
aucune garantie de temps réel ou limite supérieure n'est revendiquée.

## Transactions et adresses

Une adresse est `mtc_` + SHA-256 des 32 octets de la clé publique Ed25519.
Un transfert contient exactement `chain_id`, `kind="transfer"`, `sender`,
`recipient`, `amount`, `nonce`, `public_key`, `signature`, `id`. Clé et signature
sont hexadécimales minuscules, respectivement 32 et 64 octets. Le montant est un
entier entre 1 et 10 000 ; auto-transferts refusés.

La signature Ed25519 lie les sept champs précédant signature et id, sérialisés
canoniquement. L'id est le SHA-256 canonique de ces sept champs plus la signature.
La clé publique doit dériver l'adresse sender. Le réseau signé empêche le replay
sur un réseau d'identité différente.

Le premier nonce est 1. Chaque transaction confirmée incrémente le nonce de son
expéditeur d'une unité. Le mempool exige la suite contiguë après le nonce confirmé
et réserve la somme des sorties sur le solde confirmé ; il ne crédite aucune
entrée en attente. Il est limité à 100 transferts et persiste au redémarrage.

Une récompense contient `chain_id`, `kind="reward"`, `recipient`, `amount`,
`height`, `id` (hash des cinq autres champs). Elle n'est pas signée ; sa légitimité
vient des règles du bloc. Elle doit être la première et unique récompense tant
que l'offre est sous le plafond, avec hauteur et montant exacts. Au plafond, il
n'y a plus de récompense. Des blocs sans transfert restent possibles.

## Validation complète

1. Recréer et comparer Genesis ; partir de comptes vides et offre nulle.
2. Pour chaque bloc : vérifier format, engagements, hash, index contigu, lien au
   précédent, timestamp et PoW.
3. Vérifier la récompense attendue selon l'offre avant le bloc.
4. Vérifier chaque transfert : réseau, types, adresse/clé, signature, id, nonce
   contigu et absence de replay. Cumuler les sorties de chaque expéditeur contre
   ses fonds confirmés avant ce bloc. Ni récompense ni entrée du même bloc ne sont
   immédiatement dépensables.
5. Appliquer les débits/crédits, puis la récompense ; vérifier somme des soldes =
   offre et offre <= 10 000.
6. Revalider le mempool sur l'état reconstruit. Comparer l'état mémoire lors du
   contrôle explicite. Tout échec rejette la chaîne ou l'opération entière.
