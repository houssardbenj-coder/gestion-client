# Pense intelligent

Appli Android personnelle : routines du mois à cocher, clients suivis sur des parcours types,
rappels et demandes de RDV, agenda visuel relié à l'agenda Google du téléphone.

**Aucune donnée personnelle n'est stockée ici** : clients, routines et RDV restent uniquement
sur le téléphone. Ce dépôt ne contient que le code de l'appli.

## Organisation

- `pense-bete.html` : toute l'interface (écrans, logique).
- `appli/src/localdb.js` : stockage des données sur le téléphone.
- `appli/src/native.js` : notifications, agenda Android, sauvegarde, mise à jour automatique.
- `appli/build.js` : assemble l'interface (`appli/www` pour l'APK, `docs/` pour la publication).
- `docs/` : publié sur GitHub Pages. L'appli y lit `version.json` et télécharge `app.html`
  quand le numéro de version augmente.

## Publier une mise à jour de l'interface

1. Modifier `pense-bete.html` (ou `appli/src/`).
2. Augmenter le nombre dans `appli/version-interface.txt` et décrire le changement dans `appli/notes-version.txt`.
3. `node appli/build.js`, puis committer et pousser `docs/`.
4. Les téléphones se mettent à jour à la prochaine ouverture de l'appli.

Une modification de la partie Android (autorisations, nouveaux modules) demande de refabriquer
l'APK avec `appli/fabriquer.ps1` et de le réinstaller par-dessus.
