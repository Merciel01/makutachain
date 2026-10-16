# Journal d'avancement — 13 octobre 2026

Cahier des charges lu intégralement (4 pages). Développement effectué dans le
workspace Ubuntu, sans blockchain tierce, publication ni installation système.
Python observé : 3.14.4 ; Git : 2.53.0. Le workspace était vide à l'exception des
répertoires réservés `.git`, `.agents`, `.codex`, `.aws`. Aucun fichier préexistant
n'a été écrasé. `.git` vide et en lecture seule : `git status --short` indique
« not a git repository ». Initialisation et commits non effectués.

| Jalon | Statut | Réalisation et résultats observés |
|---|---|---|
| J1 | Terminé | Paquet, JSON canonique, SHA-256, Block, Genesis, chaînage et tests |
| J2 | Terminé | Ed25519, adresses, signatures CLI, réservations et nonces ; J1+J2 : 19 tests réussis |
| J3 | Terminé | PoW, validation complète, plafond, stockage et reprise ; 30 tests réussis |
| J4 | Terminé pour API ; vérification visuelle en attente | Routes Flask, interface responsive, CLI, jeton local, écritures sérialisées ; 46 tests réussis |
| J5 | Terminé pour le périmètre MVP | Sécurité/intégration, dépenses concurrentes, falsification même après recalcul PoW, reprise des nonces ; 61 puis 64 tests réussis |
| J6 | Documentation et démonstration terminées ; captures en attente | README, cinq documents techniques, résultat public de démonstration et journal ; navigateur indisponible |
| P2P | Non implémenté | Extension facultative ; aucune prétention de décentralisation |

## Commandes et résultats réels

- `python3 --version` → Python 3.14.4.
- `git --version` → git version 2.53.0.
- `python3 -m venv .venv` → environnement créé.
- Installation initiale dans le bac à sable → échec DNS ; première invocation de
  pytest → module manquant, aucun test exécuté à ce stade.
- Installation réseau autorisée : `.venv/bin/python -m pip install 'pytest>=8,<10'
  'cryptography>=43,<49' 'Flask>=3.1,<4'` → succès. Versions installées : pytest
  9.1.1, cryptography 48.0.1, Flask 3.1.3. Verrou complet dans requirements.lock.txt.
- `.venv/bin/python -m pytest -q` après J2 → **19 passed in 0.11s**.
- Même commande après J3 → **30 passed in 6.62s**.
- Même commande après J4 → **46 passed in 6.72s**.
- Même commande après tests de sécurité → **61 passed in 6.88s**.
- Dernière suite complète, CLI et authentification Unicode compris →
  **64 passed in 7.79s**, **0 échoué**.
- `.venv/bin/python -m compileall -q mithimbochain scripts` → succès.
- `node --check web/app.js` → succès.
- `bash -n scripts/run.sh` → succès.
- `.venv/bin/python -m mithimbochain wallet /tmp/mithimbo-cli-check.key` → clé
  locale créée en mode 600 ; sortie limitée à l'adresse et la clé publique.
- `PYTHONPATH=. .venv/bin/python scripts/demo.py > docs/demo-resultat.json` →
  succès, assertions validées : Alice=6 MTC, Bob=14 MTC, circulation=20 MTC,
  relecture valide, bloc falsifié rejeté. Aucun secret dans le résultat livré.
- `./scripts/run.sh` en bac à sable → ouverture de socket refusée ; relancement
  autorisé hors bac à sable → serveur actif sur 127.0.0.1:5000, debug désactivé.
- Requête locale autorisée `curl --fail --silent --show-error
  http://127.0.0.1:5000/api/stats` → succès HTTP, hauteur=0, circulation=0,
  hash Genesis conforme.
- Recherche de navigateur via le skill Browser → aucun navigateur disponible.
  Aucune capture, aucune validation visuelle ou interaction navigateur exécutée.

## Fichiers livrés

`mithimbochain/` : protocol, block, blockchain, transaction, wallet, consensus,
mempool, storage, api, CLI. `web/` : index.html, style.css, app.js.
`tests/` : suites J1/J2/J3, API, sécurité, CLI. `scripts/` : run.sh, demo.py.
`docs/` : architecture.md, protocole.md, securite.md, api.md, demonstration.md,
demo-resultat.json et ce journal. À la racine : README.md, pyproject.toml,
requirements.lock.txt et .gitignore.

## Travaux restants explicites

Vérifier l'interface au navigateur (desktop/mobile/clavier), exécuter le parcours
interactif et produire les captures du J6. Initialiser Git et faire des commits
lorsque `.git` sera accessible en écriture. P2P reste hors MVP. Aucun audit ni
validation de sécurité de production n'est revendiqué.

## Nouvelle exécution à la demande de l'utilisateur

- `.venv/bin/python -m pytest -q` → **64 passed in 7.83s**, **0 échoué**.
- `PYTHONPATH=. .venv/bin/python scripts/demo.py` → code de sortie 0 ;
  Alice=6 MTC, Bob=14 MTC, circulation=20 MTC ; relecture valide et falsification
  rejetée. Démonstration isolée, sans modification des données du serveur.

## Correction du lancement après les tests

Le serveur de test resté actif empêchait le lancement utilisateur en conservant
le verrou de chaîne. Processus identifié hors bac à sable puis arrêté par SIGTERM.
Acquisition du verrou vérifiée ensuite : libre. La CLI explique désormais
explicitement le conflit et précise que changer le port ne libère pas le verrou.
Test de régression ajouté ; suite complète : **65 passed in 7.83s**, 0 échoué.

## Refonte de l'expérience à la demande de l'utilisateur

L'interface de champs techniques est remplacée par une application à six menus :
Accueil, Portefeuilles, Envoyer, Recevoir, Minage et Explorateur. Création, sauvegarde,
restauration, choix du portefeuille, déverrouillage et signature se font dans le
navigateur. Le transfert comporte une étape de vérification puis confirmation.
Le destinataire peut être choisi dans les portefeuilles locaux ou saisi par adresse.
Nonce et JSON signé sont gérés automatiquement. Le minage crédite le portefeuille
actif. Les erreurs de connexion ou de réception incertaine invitent à vérifier
l'activité avant de réessayer.

Nouveau module `web/wallet.mjs` : Ed25519/Web Crypto, sauvegardes PKCS#8 chiffrées
AES-256-GCM/PBKDF2-SHA256 (310 000 itérations), métadonnées authentifiées, clés de
signature non exportables après déverrouillage. Le coffre est verrouillé après
cinq minutes, changement de portefeuille ou sortie de page. Aucune clé privée
ni aucun mot de passe ne sont transmis au serveur. Les données corrompues du
stockage local ne sont pas écrasées.

L'API ajoute un bootstrap de session locale, avec cookie HttpOnly/SameSite Strict,
Origin exacte et en-tête personnalisé. Le jeton manuel n'est plus dans le parcours
web ; la CLI et les appels Bearer restent disponibles. Aucun déploiement externe,
aucune migration vers Ethereum, aucune modification des données de chaîne existantes.
Les anciens fichiers CLI sont conservés ; les sauvegardes navigateur constituent
un autre format, décrit dans `docs/interface.md`.

Vérifications réellement exécutées :

- Suite complète `.venv/bin/python -m pytest -q` : **74 passed in 8.21s**, 0 échoué.
- Contrôle ciblé après ajout du parcours WebCrypto → session API → minage/transfert :
  **26 passed in 1.18s**, 0 échoué.
- `node --check web/wallet.mjs` et `node --input-type=module --check < web/app.js` :
  succès. Tests natifs Web Crypto exécutés par Node 22.22.1 : chiffrement/restauration,
  mauvais mot de passe, métadonnées/ciphertext altérés, mauvaise clé, fractions,
  auto-transfert, signatures acceptées par Python et par les routes avec cookie.
- Routes des nouveaux assets et navigation vérifiées par tests Flask.
- Skill Browser : liste des navigateurs toujours vide. Aucun parcours navigateur
  réel ni capture revendiqué ; cette vérification reste à faire sur la machine
  de l'utilisateur après redémarrage de son serveur.

Utilisation : Ctrl+C dans le terminal du serveur, `./scripts/run.sh`, puis actualiser
http://127.0.0.1:5000. Toutes les opérations de portefeuille se font ensuite sur le site.

## Correction de la page figée après captures utilisateur

Consigne conservée : aucun changement de design, de disposition ou de fond.
Contrôle HTTP du serveur utilisateur : `/assets/wallet.mjs` renvoyait 404.
Le serveur conservait l'ancienne liste des routes Python tandis que le HTML/CSS
étaient déjà actualisés. L'import du portefeuille interrompait donc l'exécution
avant la navigation et les gestionnaires de boutons.

Ajout d'un démarrage léger dans `web/app.js`, chargé par la route existante, qui
active la navigation et importe `web/interface.mjs`. Un import défaillant affiche
une erreur explicite et les instructions de redémarrage. Les requêtes API ont
un délai maximum de dix secondes. CSS et HTML visuels laissés inchangés.

Le serveur local identifié a été arrêté par SIGTERM puis relancé avec les nouvelles
routes, sans modification des données de chaîne. Suite réellement exécutée :
**75 passed in 8.58s**, 0 échoué. Vérification de syntaxe JavaScript réussie.
Aucun navigateur connecté disponible ; contrôle visuel/interactions réelles
restent à confirmer dans le navigateur utilisateur.

## Renommage visuel demandé : Makutachain / Makutacoin

Noms visibles remplacés dans `web/index.html` et les messages de
`web/interface.mjs` : Makutachain pour le réseau, Makutacoin pour la monnaie.
Les nouvelles sauvegardes téléchargées portent le préfixe `makutachain-`.
Design, disposition, couleurs et symbole MTC conservés. Les identifiants internes
du protocole, les adresses, le stockage navigateur et le contenu des sauvegardes
restent compatibles avec les portefeuilles et blocs existants.
Vérification syntaxique du module réussie ; deux tests existants des assets et du
démarrage exécutés : **2 passed in 0.08s**. Actualiser la page suffit pour les assets.

## Palette professionnelle et symbole Makutacoin

À la demande de l'utilisateur : palette bleu nuit, surfaces bleu ardoise,
accents cyan et dégradés discrets. La disposition, les dimensions des cartes,
menus et formulaires restent conservées. Le logo de la barre latérale affiche
MTC ; le médaillon d'accueil affiche MTC et Makutacoin. Changements limités à
`web/style.css` et `web/index.html` ; aucune modification fonctionnelle.
Contrastes calculés : texte principal/panneau 15,16:1 ; texte secondaire/panneau
8,55:1 ; liens/panneau 10,20:1 ; texte du logo/fond bleu 6,28:1.
Pas de nouveau test fonctionnel nécessaire pour cette modification visuelle.
Actualisation du navigateur suffisante pour charger les nouveaux assets.

## Menu déroulant à trois barres

Bouton carré à trois barres ajouté sous le logo ; les six rubriques sont masquées
au chargement. Clic pour ouvrir/fermer, fermeture après sélection, clic extérieur
ou touche Échap. Attributs aria-expanded/aria-controls et gestion du focus clavier.
Le menu reste une liste verticale sur mobile. Palette et emplacement de la barre
latérale conservés. Modifications : index.html, app.js et règles CSS ciblées.
Syntaxe JavaScript vérifiée ; deux tests existants des assets et du bootstrap :
**2 passed in 0.13s**. Vérification visuelle au navigateur non exécutée ici.

## Regroupement de la marque et du menu dans l'en-tête

Après accord de l'utilisateur : logo MTC et bouton de menu déplacés dans
l'en-tête, avec titre de rubrique à côté et portefeuille actif à droite.
La colonne latérale permanente est supprimée ; le contenu n'a plus de marge
réservée à cette colonne. Navigation temporaire ancrée sous le bouton, masquée
par défaut, avec les informations du réseau en bas du panneau. Palette conservée,
hauteur de l'en-tête réduite et adaptation mobile. Les gestionnaires existants
(clic, sélection, clic extérieur, Échap) restent utilisés.
Fichiers modifiés : web/index.html et web/style.css. Syntaxe JS vérifiée ;
contrôles existants des assets/démarrage : **2 passed in 0.08s**. Vérification
visuelle navigateur non exécutée ici. Actualiser la page pour voir le résultat.

## Préparation du dépôt public Makutachain — 15 octobre 2026

À la demande de l'utilisateur : préparation d'un dépôt public GitHub avec un
README de présentation complet, diagrammes Mermaid (architecture et transfert),
arborescence, installation, démonstration, API et limites du prototype.
Ajout de CONTRIBUTING.md, SECURITY.md et d'un workflow GitHub Actions pour les
vérifications Python/Web Crypto, la syntaxe JavaScript et la démonstration.
Les documents techniques adoptent les noms Makutachain/Makutacoin ; les identités
internes sont conservées pour la compatibilité des signatures et des données.

Git initialisé sur main avec autorisation ; connexion GitHub existante vérifiée.
Aucun jeton partagé dans le chat n'est enregistré dans les fichiers ou utilisé.
Exclusions renforcées : clés, jetons, environnements, données locales, sauvegardes
utilisateur et configurations privées. Le résultat public de démonstration est
constitué uniquement d'adresses et statistiques de test.

Commandes réellement exécutées : suite complète **75 passed in 8.91s**, contrôles
`node --check` des trois modules et démonstration isolée terminés avec succès.
Le workflow CI est préparé ; son résultat distant doit être vérifié après publication.

## MakutaWallet v0.1 — 16 octobre 2026

Après accord de l'utilisateur : ajout local d'une extension Manifest V3 pour
Chrome/Chromium 137+, sans remplacement du portefeuille existant du site, sans
migration de chaîne et sans modification des adresses, règles monétaires ou
signatures. La version est un prototype local non audité, non publié sur un store.

Fichiers : `extension/makutawallet/` (manifest, provider, bridge, worker, moteur,
fenêtre et copie du module cryptographique), `scripts/build_makutawallet.py`,
`tests/test_extension.mjs`, `tests/test_extension_package.py`, guide web et
`docs/makutawallet.md`. Intégration ciblée dans l'interface : connexion/déconnexion,
sélection du portefeuille externe et signature via confirmation dans l'extension.
Le style et le portefeuille locaux restent disponibles. Le workflow CI est adapté
pour assembler le paquet et vérifier la syntaxe des scripts ; aucun push de cette
version prototype n'est effectué pendant cette étape.

L'extension stocke uniquement des coffres chiffrés. La fenêtre déchiffre et signe
localement, avec mot de passe à chaque signature. Le service worker ne détient
pas de clé déchiffrée. Origines/ports loopback, contexte d'émetteur, onglet,
autorisation par site, champs du transfert, nonce et expiration sont contrôlés.
La connexion seule ne donne pas de droit de signature. Fermeture/refus/navigation
annulent les demandes en attente. Les demandes sont conservées dans storage.session
pour supporter la suspension du worker, avec une limite de deux minutes.

Résultats réellement observés :

- `.venv/bin/python -m pytest -q` : **78 passed in 9.44s**, 0 échoué, dont le
  test qui exécute les 19 contrôles Node du moteur de l'extension.
- `node tests/test_extension.mjs` : **19 contrôles réussis**, 0 échoué.
- Après ajout du contrôle de la transaction issue du moteur par le consensus
  Python : suite ciblée paquet/guide/sécurité **3 passed in 0.77s**.
- Syntaxe des scripts web et des scripts de l'extension vérifiée avec Node.
- Compilation Python et `git diff --check` : succès.
- Paquet `dist/makutawallet.zip` assemblé et vérifié, neuf fichiers sans données
  utilisateur. Guide et téléchargement via le client Flask : HTTP 200.
- Tentative de connexion via le skill Browser : aucun navigateur disponible.
  Aucun chargement réel de l'extension, parcours Chrome ou capture n'est revendiqué.

Vérification manuelle restante : redémarrer le serveur, charger le dossier
`extension/makutawallet` via chrome://extensions, actualiser le site, restaurer
un portefeuille de test, autoriser la connexion, miner puis signer/refuser un
transfert dans la fenêtre de l'extension. Vérifier soldes, confirmations,
déconnexion et fermeture des demandes. Le guide indique ces étapes et les limites.

## Guide MakutaWallet introuvable — correction du serveur actif

Après capture utilisateur : le code courant renvoie HTTP 200 pour le guide et
le téléchargement dans le client Flask, mais le serveur actif renvoyait encore
404. Vérification réelle de localhost : ancienne table de routes confirmée.
Serveur ancien arrêté par SIGTERM, puis relancé avec le code actuel, sans
modification des données de chaîne ni des portefeuilles.
Test ciblé du guide : **1 passed in 0.13s**. La première demande de contrôle
hors bac à sable a expiré en revue automatique ; son unique nouvelle tentative
a été autorisée et a permis le diagnostic.
Le message « créez ou restaurez un portefeuille » est distinct : l'extension
installée ne partage pas automatiquement les portefeuilles du site. Restaurer
une sauvegarde JSON chiffrée du site dans l'extension conserve adresse et solde.

## MakutaWallet v0.1.1 — fenêtre stable

L'utilisateur signale une disparition rapide à l'ouverture depuis l'icône.
Tentative de contrôle du Chromium demandé via le skill Browser : sélection Chrome
indisponible, diagnostic de connexion lu. Aucun clic réel ni reproduction visuelle
revendiqué. Le code utilisait la popup d'action Chrome, qui se ferme à la perte
sélection/focus ; choix de la remplacer par une fenêtre indépendante durable.

Suppression de default_popup ; le clic sur l'action passe par un contrôleur de
fenêtre unique. Réutilisation et remise au premier plan de la fenêtre existante,
réouverture si fermée, chargement des confirmations dans cette fenêtre. Les messages
après approbation/refus restent affichés ; suppression de la fermeture automatique.
Stockage des coffres et contrôles de signature inchangés. Version 0.1.1 et ZIP
mis à jour ; guide mis à jour avec instructions de rechargement sans désinstallation.

Suite complète exécutée : **78 passed in 9.43s**, 0 échoué. Trois tests comportementaux
supplémentaires couvrent ouverture/réutilisation, affichage de la demande et
réouverture après fermeture. Contrôle ciblé final du paquet/guide/moteur exécuté
avec les 22 tests Node de l'extension. Syntaxe des scripts et git diff --check :
succès. Le test réel dans Chromium reste nécessaire après rechargement de l'extension.

## MakutaWallet v0.1.2 — cohérence des soldes et actualisation

Les captures utilisateur montraient des montants différents entre site et
extension. Lecture de la chaîne persistée : le compte illustré possède bien ses
fonds confirmés, sans réservation. Aucune modification des comptes ou du stockage
utilisateur n'a été faite pour obtenir un affichage différent.

Causes de désynchronisation présentes dans le code : affichages actualisés
ponctuellement, compte de l'extension mémorisé par le site, préférence de réseau
non persistée et absence de protection des réponses UI contre les changements de
compte/réponses concurrentes. Les captures ne permettent pas de prouver que les
deux interfaces utilisaient exactement la même adresse au moment de leur prise.

Corrections : coordinateur de lectures commun `web/sync.mjs` et copie assemblée
dans l'extension, requêtes anciennes ignorées, actualisation toutes les cinq
secondes environ dans les fenêtres visibles et au retour du focus. Révocation de
compte détectée par le site avec invitation à reconnecter. Adresse/origine et
heure de lecture affichées, disponibles/confirmés/réservés distingués ; aucune
panne représentée comme un solde nul. La préférence de réseau est persistée et
alignée sur le site lors de l'autorisation. Le moteur de l'extension refuse une
lecture demandée pour un compte devenu périmé.

L'API balance ajoute identité réseau, hauteur et hash courant sous le même verrou
que la lecture des comptes. Préservation des détails ouverts de l'explorateur et
limitation des reconstructions DOM pendant les lectures périodiques. La version
d'extension passe à 0.1.2 ; ZIP reconstruit avec onze fichiers. Aucun protocole,
montant, clé ou solde n'est migré ou réécrit par ces changements.

Vérifications : suite complète finale **80 passed in 9.64s**, 0 échoué ; elle
inclut les 25 contrôles Node de l'extension et huit contrôles de synchronisation
(réponses inversées, changement de compte, erreurs périmées, panne, nouvelle
lecture, absence de chevauchement et cycle des minuteries). Syntaxe JavaScript,
compilation Python et git diff --check : succès. Serveur local arrêté proprement
puis relancé pour charger le nouveau module et les métadonnées API.
La première revue automatique de l'inspection du processus a expiré ; l'unique
nouvelle tentative a été autorisée. L'installation/rechargement réel dans Chromium
reste à faire par l'utilisateur ; aucune validation graphique n'est revendiquée.

## Actualisation GitHub demandée — 16 octobre 2026

Préparation de la publication du code MakutaWallet v0.1.2 et de son intégration :
fenêtre durable, synchronisation automatique, contrôles de comptes et de réseau,
paquet reproductible, guides et tests. Le README expose désormais ces fonctionnalités.
Comparaison après fetch : main local et distant alignés avant cette publication.
Vérification locale réelle : **80 passed in 9.23s**, 0 échoué.
Contrôle des 60 fichiers source/documentation : aucun jeton GitHub ni clé privée
PEM détecté. Exclusions des fichiers privés, données, coffres et ZIP générés
confirmées ; motifs des répertoires privés renforcés pour exclure aussi les fichiers
ou liens portant ces noms. Les sources de l'extension sont publiables ; le ZIP
reste reproductible avec le script et n'est pas stocké dans Git.
