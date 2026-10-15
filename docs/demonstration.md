# Démonstration

## Automatique et reproductible

```bash
PYTHONPATH=. .venv/bin/python scripts/demo.py
```

Le script crée deux portefeuilles éphémères, utilise les routes Flask via leur
client de test, mine 10 MTC pour Alice, signe et soumet 4 MTC vers Bob, mine une
récompense pour Bob, puis vérifie Alice=6, Bob=14 et offre=20. Il recharge le
fichier sauvegardé et valide la chaîne. Il falsifie ensuite une copie de l'ancien
bloc 1 : cette copie est rejetée. Les assertions arrêtent immédiatement le script
si un résultat diffère. Le fichier réel du serveur n'est pas modifié.

`demo-resultat.json` contient le résultat réellement obtenu, uniquement données
publiques. Les adresses et timestamps changent entre exécutions ; Genesis reste
identique.

## Interactive

Suivre [le parcours entièrement dans le site](interface.md) : créer et sauvegarder
Alice et Bob, miner pour Alice, déverrouiller Alice, envoyer 4 MTC à Bob avec le
formulaire, puis miner pour Bob. Consulter les soldes et les blocs dans l'explorateur.
Sur une chaîne neuve, Alice a 6 MTC et Bob 14 MTC. Les anciens portefeuilles CLI
restent utilisables séparément ; le site ne les importe pas automatiquement.

Arrêter et relancer le serveur : les blocs, soldes, nonces et réservations
persistés restent identiques. Recharger la page verrouille le portefeuille ;
il faut son mot de passe pour signer à nouveau. Ne pas modifier la chaîne active
pour montrer une falsification ; le script utilise une copie isolée.

## Vérification visuelle restante

Aucun navigateur connecté n'était disponible lors de la réalisation. Les routes
HTML/CSS/JS et les fonctions API sont testées, mais aucune capture ni vérification
visuelle à 390 px et 1280 px n'est revendiquée. À réaliser dans un navigateur :
contraste, absence de débordement, navigation au clavier, formulaires, erreurs,
validation, puis captures du tableau de bord et du bloc de transfert.
