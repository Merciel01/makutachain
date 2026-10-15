# Sécurité et limites

Les clés privées n'entrent jamais dans l'API. Le navigateur crée et signe localement avec Ed25519 ; seules les transactions publiques signées sont transmises. La CLI les génère localement et crée
les fichiers sans écrasement, en mode 600. Les fichiers privés de la CLI ne sont pas chiffrés : un
utilisateur ayant accès au compte ou au disque peut les lire. La perte de clé
empêche de signer ; la restauration navigateur exige une sauvegarde chiffrée et son mot de passe. Aucun mécanisme de récupération sans sauvegarde n'est implémenté.

Le serveur lie uniquement 127.0.0.1, vérifie l'adresse source et l'en-tête Host.
Les POST exigent JSON et une autorisation locale : jeton Bearer comparé en temps constant pour la CLI, ou cookie de session HttpOnly/SameSite Strict pour le site. Le bootstrap `/api/session` exige Origin exacte et un en-tête personnalisé, comme les mutations par cookie. Le jeton CLI est conservé en mode 600. Les origines navigateur différentes sont refusées. Aucun CORS ouvert,
aucun débogueur, aucune route de signature serveur. Le navigateur utilise
textContent pour afficher les données, une CSP restrictive, aucun script externe
et aucun stockage persistant du jeton API accessible à JavaScript. Aucun secret n'est mis dans les URL.

Les corps sont limités à 32 Kio, le mempool à 100 transferts, un bloc à 101
transactions, le fichier chargé à 64 Mio. Les erreurs structurées ne renvoient pas
de traces. Les erreurs internes produisent uniquement un message de log générique.
Ne pas activer de middleware qui journalise les en-têtes Authorization ou les corps.

Les tests couvrent signatures falsifiées, mauvaise clé, changement de réseau,
montants incorrects, booléens/floats, nonces et replays, sorties simultanées,
récompenses illégitimes, plafond, PoW, anciens blocs falsifiés, reprise et erreurs
API. Le verrou des opérations empêche deux dépenses concurrentes du même nonce.

Ce prototype ne possède pas de pairs, propagation, choix de branche, difficulté
adaptative, consensus distribué ni protection contre une attaque majoritaire.
La difficulté faible permet de recalculer toute l'histoire avec des clés légitimes.
Les signatures empêchent de falsifier les dépenses d'un autre portefeuille ; le
stockage local ne constitue pas une preuve d'histoire inviolable. Pas de valeur
marchande affichée, pas d'audit de sécurité indépendant, pas d'usage financier réel.

Le serveur de développement Flask convient à cette démonstration locale. Un
programme local malveillant peut attaquer localhost ; le jeton n'isole pas les
processus possédant les mêmes droits. Aucune TLS ni gestion de sessions distante.
Les méthodes internes sont destinées à du code de confiance. Seul le lancement
CLI met en place le verrou de processus : ne pas démarrer plusieurs instances
programmatiques sur le même stockage.

Une interruption après remplacement du fichier mais avant réponse peut laisser
une opération persistée malgré une réponse absente/échouée. Toujours consulter
chaîne et nonce avant de réessayer. Pas de journal transactionnel multi-fichiers,
de chiffrement du disque, de rotation automatique du jeton ni de limitation de
débit sophistiquée. La relecture complète et les exports complets limitent la
scalabilité ; le fichier de 64 Mio est une limite explicite de cette démonstration.

## Coffre navigateur

Les clés PKCS#8 sont chiffrées par AES-256-GCM avec PBKDF2-SHA256 (310 000
itérations), sel et IV aléatoires. Les métadonnées sont authentifiées. Le JSON
chiffré est conservé dans localStorage et peut être téléchargé. La restauration
vérifie le mot de passe, la cohérence clé/adresse et le réseau avant enregistrement.
Les sauvegardes altérées et les mots de passe incorrects sont refusés. Une donnée
locale corrompue est conservée et bloque l'écrasement par un nouveau portefeuille.

Le mot de passe et la clé déverrouillée restent en mémoire. La clé opérationnelle
est non exportable ; verrouillage après cinq minutes, changement de portefeuille
ou sortie de page. JavaScript ne garantit pas l'effacement de tous les objets
intermédiaires ou une isolation contre un navigateur compromis. Un script injecté
ou une extension malveillante pourrait lire le mot de passe ou signer pendant le
déverrouillage. Utiliser un navigateur de confiance. Ce coffre ne remplace pas
un portefeuille matériel ou une extension isolée.

Les tests de Web Crypto s'exécutent avec Node et vérifient l'interopérabilité
réelle des signatures avec Python. Ils ne prouvent pas le fonctionnement visuel
ou la compatibilité de tous les navigateurs. Sources de l'API native :
[Web Crypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto),
[export des clés](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/exportKey).
