# CompanyBuddy

Assistant local qui rappelle une décision d’équipe lorsqu’un passage visible dans votre travail semble la contredire. L’application ne bloque et ne modifie aucun document. Elle n’envoie pas l’activité des employés à un responsable.

## Prérequis

- macOS avec les notifications de bureau autorisées pour l’application Electron. Cette installation a été développée sur macOS ; les autres systèmes ne sont pas validés.
- Node.js 22.19 ou plus récent, npm, puis `npm install`. Si npm indique que les scripts Electron/esbuild sont bloqués : `npm install-scripts approve electron esbuild`, puis `npm rebuild electron esbuild`.
- Screenpipe lancé, avec la capture d’écran autorisée et son API locale accessible (par défaut `http://localhost:3030`).
- Un preset IA fonctionnel dans Screenpipe. Le preset par défaut de CompanyBuddy est `minimax` ; il est modifiable dans Réglages. L’accès Screenpipe et l’accès au fournisseur IA sont distincts. Les extraits analysés quittent l’ordinateur vers le fournisseur sélectionné.

L’application retrouve le CLI dans `~/.screenpipe/cli/<version>/screenpipe` ou dans le PATH, puis lui demande le jeton de l’API locale. Aucun jeton ni clé IA ne doit être ajouté au dépôt. Un chemin CLI explicite peut être enregistré dans Réglages si la découverte échoue. Les presets proviennent de la configuration locale de Screenpipe ; configurez leurs identifiants dans Screenpipe, pas dans CompanyBuddy.

## Lancer

```sh
npm install
npm run dev
```

`npm run dev` compile et ouvre l’application. Après compilation, `npm start` suffit. `npm run typecheck` vérifie les types et `npm run build` produit `dist/` et `dist-electron/`.

L’application sauvegarde ses sources, approbations, réglages et alertes dans le dossier utilisateur Electron `CompanyBuddy` (sur macOS : `~/Library/Application Support/CompanyBuddy`). Une session de surveillance ne reprend jamais automatiquement au lancement. Fermer la fenêtre la masque ; le processus reste actif et le menu de l’application permet de l’afficher, de mettre la surveillance en pause ou de quitter. Quitter supprime les tâches Screenpipe appartenant à cette instance ; les tâches et presets de l’utilisateur restent inchangés.

## Démonstration : maintien de l’API V1

### Responsable des décisions

1. Dans **Décisions**, choisir **Importer une source** et sélectionner `examples/scenario1.json`.
2. Examiner les deux décisions candidates et leurs passages sources. Les trois actions attribuées restent du contexte séparé. Les noms `valide_par` ne valent pas approbation dans l’application.
3. Renseigner la personne qui approuve et cliquer sur **Approuver cette décision**. Pour la première démo, la décision de maintien de l’API V1 suffit ; la seconde reste disponible pour approbation.
4. **Exporter les décisions approuvées** et transmettre ce fichier JSON au collègue. Le fichier contient uniquement les décisions approuvées et leurs sources, sans réglages ni historique de travail.

Markdown et notes collées sont également acceptés : leur extraction utilise une vraie tâche Screenpipe avec le preset choisi. Le scénario JSON structuré est importé directement ; aucun modèle n’est nécessaire pour recopier ses décisions.

### Employé

1. Installer l’application et configurer Screenpipe sur son ordinateur.
2. Dans **Décisions**, utiliser **Importer un fichier approuvé** avec le fichier transmis par le responsable.
3. Dans **Réglages**, vérifier la connexion. Choisir le preset, l’application observée et une partie du titre du document. Le chemin CLI est facultatif si sa découverte fonctionne.
4. Sur macOS, les réglages de démonstration sont **TextEdit** et **plan-migration**. Ouvrir `examples/plan-migration.md` dans TextEdit :

   ```sh
   open -a TextEdit examples/plan-migration.md
   ```

5. Dans **Surveillance**, démarrer la session, puis remettre le document au premier plan pour obtenir une capture récente. Screenpipe doit réellement avoir capturé le texte ; ouvrir un fichier sur disque ne suffit pas à lui donner accès à son contenu.
6. La phrase proposant de désactiver `/api/v1/users` doit produire un conflit possible avec la décision de maintien. Une notification générique ouvre la fiche d’explication : passage observé, décision, source, application, heure et capture Screenpipe.
7. Arrêter la session et fermer le document contradictoire avant le cas négatif. Ouvrir `examples/plan-migration-conforme.md`, qui conserve V1 active tout en améliorant V2, puis démarrer une nouvelle session. Si nécessaire, régler le titre sur `plan-migration-conforme` pour isoler ce document.

Un même conflit pour une décision et une fenêtre ne notifie qu’une fois par session. **Arrêter la surveillance** empêche les nouvelles analyses et les notifications tardives ; cela ne coupe pas le recorder indépendant de Screenpipe. Une analyse déjà soumise à Screenpipe peut finir en arrière-plan, mais son résultat est ignoré après l’arrêt.

## Fonctionnement et limites

- CompanyBuddy demande à l’API locale les captures OCR/accessibilité exposées sous `content_type=ocr`, filtrées par application et titre de fenêtre. Il analyse uniquement la capture correspondante la plus récente de la période, pour ne pas relancer des rappels à partir d’anciennes fenêtres.
- L’analyse s’exécute dans une tâche manuelle Screenpipe, avec le preset explicitement sélectionné. CompanyBuddy ne reconstruit pas de harness et n’appelle pas directement le fournisseur IA.
- Les résultats sont lus depuis un fichier JSON propre à chaque exécution. Les identifiants de décision et de capture doivent être connus ; les citations sont rattachées au texte original. Seules les différences typographiques de guillemets/apostrophes et d’espaces sont tolérées, puis le passage original est affiché.
- Les vérifications ne se chevauchent pas. L’intervalle configuré (30 secondes par défaut, 15 à 3 600 autorisées) s’écoule après la fin d’une analyse ; il ne garantit pas une notification sous 30 secondes. Le modèle et Screenpipe peuvent être plus lents.
- **Aucune capture**, **aucun conflit**, **conflit possible** et **erreur** sont des états distincts. Un manque de capture ne prouve pas l’absence de conflit.
- L’IA ne peut pas prouver qu’un test manque ou qu’une API est cassée à partir d’un écran partiel. Une échéance minimale de maintien n’est pas une permission de supprimer l’API une fois cette date passée.
- Selon le moteur de capture, le texte peut inclure des fenêtres visibles en arrière-plan. Pour une démonstration non ambiguë, ne laissez ouvert qu’un seul des deux documents de migration ; la capture est une indication de contexte, pas une lecture garantie du fichier sur disque.
- Les approbations et le partage de fichiers sont manuels, sans authentification organisationnelle ni garantie cryptographique. Ne pas présenter ce mécanisme de hackathon comme un système de conformité.

## Dépannage

- **CLI introuvable** : renseigner son chemin dans Réglages, puis enregistrer et vérifier la connexion.
- **Preset absent / erreur IA** : vérifier ce preset dans Screenpipe. Aucun autre modèle n’est utilisé silencieusement.
- **Capture absente** : vérifier l’application exacte, le titre, les permissions Screenpipe et remettre le document au premier plan. Les terminaux et CompanyBuddy ne sont pas des surfaces observables dans cette version.
- **Erreur d’extension Pi** : l’installation de développement utilisait Pi `0.84.1` avec une extension `pi-subagents 0.79.0` incompatible. Elle a été corrigée en épinglant `pi-subagents 0.70.1`. L’application ne modifie pas automatiquement cette configuration sur les autres ordinateurs.
- **Pas de bannière** : vérifier les autorisations de notification et les modes Concentration de macOS. Les alertes produites restent consultables dans l’application.

Le contrat fonctionnel se trouve dans `docs/implementation-spec.md` et les décisions de conception dans `docs/product-plan.md`.
