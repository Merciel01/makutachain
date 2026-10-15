# Contribuer à Makutachain

## Préparer l'environnement

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock.txt
```

Node.js 22 ou supérieur permet de vérifier l'interopérabilité entre Web Crypto et
le moteur Python. Sans Node, ce test est ignoré ; pour une validation complète,
installer Node dans son environnement de développement.

## Avant une proposition de modification

1. Décrire le comportement attendu et la raison du changement.
2. Respecter les invariants monétaires et la sérialisation canonique.
3. Ajouter des tests utiles si la modification touche au protocole ou à la sécurité.
4. Exécuter les vérifications :

```bash
.venv/bin/python -m pytest -q
node --check web/app.js
node --check web/interface.mjs
node --check web/wallet.mjs
PYTHONPATH=. .venv/bin/python scripts/demo.py
```

5. Mettre à jour la documentation si les commandes, formats ou parcours changent.
6. Dans la pull request, indiquer le problème résolu, le résultat attendu et les
   tests effectivement exécutés.

## Règles du projet

- Ne jamais ajouter de clés privées, jetons, mots de passe, fichiers `.env`, données
  utilisateur ou sauvegardes de portefeuille.
- Utiliser des clés éphémères et des répertoires temporaires dans les tests.
- Garder les clés privées et la signature côté client.
- Documenter toute modification de l'identité réseau ou de Genesis : elle peut
  invalider les données existantes.
- Préserver les limites du prototype dans les descriptions publiques ; ne pas
  présenter une chaîne locale comme un réseau décentralisé de production.
