# Utiliser Makutachain depuis le site

Le serveur se lance avec `./scripts/run.sh`. Après un changement de code serveur,
arrêter avec Ctrl+C, relancer cette commande et actualiser le navigateur. Utiliser
la même URL à chaque fois : `localhost` et `127.0.0.1` ont des stockages navigateur
séparés. Les opérations courantes se font ensuite entièrement sur le site.

## Les menus

| Menu | Utilisation |
|---|---|
| Accueil | Solde disponible, circulation, hauteur, étapes de découverte, activité |
| Portefeuilles | Créer, choisir, déverrouiller, verrouiller, sauvegarder, restaurer |
| Envoyer des MTC | Destinataire, montant, vérification, confirmation et signature locale |
| Recevoir des MTC | Afficher et copier l'adresse publique du portefeuille actif |
| Minage | Miner vers le portefeuille actif et confirmer les transferts en attente |
| Explorateur | Consulter blocs, récompenses, transferts, soldes et validation |

## Première démonstration, sans commande de portefeuille

1. Dans **Portefeuilles**, créer « Alice » avec un mot de passe d'au moins 12
   caractères et sa confirmation. Cliquer sur **Sauvegarder** sur sa carte.
2. Créer « Bob » et sauvegarder aussi ce portefeuille. Les deux mots de passe
   peuvent être différents. Garder les fichiers chiffrés et mots de passe.
3. Sélectionner **Alice** dans le menu « Portefeuille actif » en haut de page.
4. Dans **Minage**, cliquer sur **Miner un bloc**. Alice reçoit 10 MTC.
5. Dans **Portefeuilles**, déverrouiller Alice avec son mot de passe.
6. Dans **Envoyer des MTC**, sélectionner Bob dans la liste, saisir **4**, puis
   **Vérifier le transfert**. Vérifier l'adresse et cliquer **Signer et envoyer**.
7. Le transfert est maintenant en attente. Choisir **Bob** comme portefeuille
   actif et miner un bloc. Alice a 6 MTC, Bob a 14 MTC (4 reçus + 10 de récompense).
8. Ouvrir **Explorateur** pour voir le transfert confirmé et les nouveaux blocs.

Ces soldes sont ceux du premier parcours sur une chaîne neuve ; si le réseau
contient déjà des blocs ou transferts, ils s'ajoutent aux soldes existants.

## Portefeuilles et sécurité

La création et la signature utilisent Web Crypto (Ed25519) dans le navigateur.
Le serveur n'a aucune route recevant les clés privées ni les mots de passe.
Le portefeuille chiffré reste dans le stockage local du navigateur. Le
mot de passe n'est pas une connexion à un compte serveur et ne peut être réinitialisé.

Une sauvegarde JSON contient la clé privée **chiffrée**. Pour restaurer : choisir
ce fichier dans **Portefeuilles**, entrer son mot de passe et cliquer **Restaurer**.
La clé est vérifiée avant enregistrement. Le solde est retrouvé depuis la chaîne.
Les fichiers CLI `.key` de l'ancienne version restent inchangés et utilisables par
la CLI ; ils ne sont pas des sauvegardes navigateur au format JSON.

Le déverrouillage dure au maximum cinq minutes. Recharger/quitter la page,
changer de portefeuille ou cliquer **Verrouiller** supprime la référence à la
clé déverrouillée. Recevoir et miner nécessitent seulement l'adresse publique.
Si la session serveur expire, une nouvelle tentative reconnecte automatiquement
la page ; vérifier l'activité avant de réessayer un transfert après une panne.

Navigateur récent avec Ed25519/Web Crypto requis. Ouvrir le serveur sur localhost
ou 127.0.0.1. Le module donne une erreur explicite si Ed25519 est indisponible.
Le mode privé ou le blocage du stockage peut empêcher la conservation des
portefeuilles. La copie d'adresse dépend du droit d'accès au presse-papiers ;
à défaut, sélectionner et copier l'adresse affichée.

Ne pas partager le mot de passe ou la sauvegarde. Un navigateur compromis ou un
script malveillant exécuté dans le site peut accéder au portefeuille déverrouillé.
Ce prototype n'offre pas l'isolation d'un portefeuille matériel ou d'une extension
indépendante. Aucune compatibilité Ethereum, token ERC-20, gas ou valeur marchande
n'est implémentée ; l'expérience s'inspire des usages de portefeuilles blockchain.

## Comparer les soldes du site et de MakutaWallet

Depuis la version 0.1.2, les deux écrans relisent automatiquement leur solde
lorsqu'ils sont visibles, environ toutes les cinq secondes et au retour du focus.
Vérifier l'adresse et le serveur affichés avant de comparer. Le solde principal
est disponible, après soustraction des fonds réservés ; les cartes de portefeuilles
du site indiquent explicitement le confirmé. L'heure de lecture est affichée.
Changer de compte dans MakutaWallet peut demander de reconnecter le site.

## Tableau de bord décisionnel

La rubrique « Tableau de bord » (`#tableau-de-bord`) présente le réseau entier,
indépendamment du portefeuille sélectionné. Elle contient des indicateurs et
graphiques de lecture, sans formulaire ni commande de transfert ou de minage.
Les autres rubriques conservent leur présentation.

Les données proviennent de GET /api/dashboard : validation, copie de la chaîne et
du mempool sont réalisées sous le verrou API. Le calcul ne modifie aucun solde.
Le relevé contient sa date et la hauteur de référence.

- Offre émise et pourcentage du plafond ; unités restant à émettre.
- Volume et nombre de transferts confirmés sur les dernières 24 heures.
  Les récompenses sont exclues. La fenêtre utilise les horodatages des blocs :
  les dates futures, autorisées par le protocole, en sont exclues et signalées.
- Adresses distinctes ayant envoyé ou reçu un transfert sur cette fenêtre.
  Ce nombre n'est pas un nombre de personnes ni de portefeuilles installés.
- Transferts en attente, montant réservé et occupation de la capacité de 100.
- Volume par bloc sur les 20 derniers blocs minés ; Genesis est exclu.
  Les totaux de volume et de transferts portent sur tout l'historique.
- Soldes confirmés des cinq premières adresses positives, part détenue et nombre
  total d'adresses au solde positif. Les fonds en attente ne les créditent pas.
- Validation, hauteur, ancienneté du dernier bloc au relevé et intervalle médian
  entre blocs minés. Genesis est exclu du calcul des intervalles.

Une chaîne vide ou des blocs sans transfert ne génèrent pas d'activité fictive.
Les moyennes et intervalles impossibles à calculer sont affichés comme
indisponibles. Les mesures sont relues avec la synchronisation existante quand
la rubrique est visible ; une erreur laisse un avertissement de données anciennes.
Aucun cours de marché, rendement financier ou score de décentralisation n'est
déduit de ce prototype à un seul nœud.
