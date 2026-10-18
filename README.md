# DecisionDrift

Assistant local qui rappelle une décision d’équipe lorsqu’un passage visible dans votre travail semble la contredire. L’application ne bloque et ne modifie aucun document. Elle n’envoie pas l’activité des employés à un responsable.

## Prérequis

- macOS avec les notifications autorisées pour **DecisionDrift**. Cette installation a été vérifiée sur macOS ; les autres systèmes ne sont pas validés.
- Pour compiler depuis les sources : Node.js 22.19 ou plus récent, npm, puis `npm install`. Si npm indique que les scripts Electron/esbuild sont bloqués : `npm install-scripts approve electron esbuild`, puis `npm rebuild electron esbuild`.
- Screenpipe lancé, avec la capture d’écran autorisée et son API locale accessible (par défaut `http://localhost:3030`).
- Un preset IA fonctionnel dans Screenpipe. Le preset par défaut de DecisionDrift est `minimax` ; il est modifiable dans Réglages. L’accès Screenpipe et l’accès au fournisseur IA sont distincts. Les extraits analysés quittent l’ordinateur vers le fournisseur sélectionné.

L’application retrouve le CLI dans `~/.screenpipe/cli/<version>/screenpipe` ou dans le PATH, puis lui demande le jeton de l’API locale. Aucun jeton ni clé IA ne doit être ajouté au dépôt. Un chemin CLI explicite peut être enregistré dans Réglages si la découverte échoue. Les presets proviennent de la configuration locale de Screenpipe ; configurez leurs identifiants dans Screenpipe, pas dans DecisionDrift.

Le bundle macOS fournit un lanceur `node` privé utilisant le runtime d’Electron déjà présent. Les agents Screenpipe lancés par DecisionDrift ne dépendent donc pas du Node du Terminal, absent du `PATH` de Finder. Le `PATH` du système, le shell et les presets Screenpipe ne sont pas modifiés.

## Lancer

```sh
npm install
npm run dev
```

`npm run dev` compile, prépare le bundle macOS signé localement et l’ouvre. Ensuite, `npm start` suffit ; `npm run package:mac` reconstruit `release/DecisionDrift.app`. La signature est ad hoc, sans notarisation Apple : ce bundle est destiné à l’exécution locale, pas à une distribution publique prête à installer.

`npm test` vérifie les comportements métier et le cycle des sessions ; `npm run typecheck` vérifie les types. `npm run build` produit uniquement les fichiers compilés, sans reconstruire le bundle.

Trois vues : **Activité**, **Décisions**, **Réglages**. Le thème sombre utilise la transparence et le flou natifs de macOS ; les réglages d’accessibilité du système peuvent réduire ces effets.

L’application sauvegarde ses sources, approbations, réglages et alertes dans le dossier utilisateur Electron `CompanyBuddy` (sur macOS : `~/Library/Application Support/CompanyBuddy`). Une session de surveillance ne reprend jamais automatiquement au lancement. Fermer la fenêtre la masque ; le processus reste actif et le menu de l’application permet de l’afficher, de mettre la surveillance en pause ou de quitter. Quitter supprime les tâches Screenpipe appartenant à cette instance ; les tâches et presets de l’utilisateur restent inchangés.

Le nom affiché est **DecisionDrift**. Le dossier de données `CompanyBuddy`, l’identifiant de bundle `com.companybuddy.desktop` et le marqueur de fichier approuvé `companybuddy.approved.v1` restent volontairement stables : le renommage ne réinitialise ni les données ni l’identité des notifications et les exports existants restent importables. `DECISIONDRIFT_USER_DATA_DIR` permet d’isoler les données pour un essai ; aucune ancienne variable d’environnement ni API renderer n’est conservée.

## Démonstration : maintien de l’API V1

### Responsable des décisions

1. Dans **Décisions → Importer → Source à examiner**, sélectionner `examples/scenario1.json`.
2. Examiner les deux décisions candidates et leurs passages sources. Les trois actions attribuées restent du contexte séparé. Les noms `valide_par` ne valent pas approbation dans l’application.
3. Renseigner **Votre nom**, puis **Approuver**. Pour la première démo, la décision de maintien de l’API V1 suffit ; la seconde reste disponible pour approbation.
4. **Exporter** et transmettre le JSON au collègue. Il contient uniquement les décisions approuvées et leurs sources, sans réglages ni historique de travail.

Markdown et notes collées sont également acceptés : leur extraction utilise une vraie tâche Screenpipe avec le preset choisi. Le scénario JSON structuré est importé directement ; aucun modèle n’est nécessaire pour recopier ses décisions.

### Employé

1. Installer l’application et configurer Screenpipe sur son ordinateur.
2. Dans **Décisions → Importer → Fichier approuvé**, sélectionner le fichier transmis.
3. Dans **Réglages**, vérifier la connexion et choisir le preset. Laisser **Application** et **Titre contenant** vides pour observer toutes les applications capturées par Screenpipe, hors DecisionDrift. Ces filtres et le chemin CLI sont facultatifs.
4. Utiliser **Tester la notification**. Autoriser DecisionDrift dans **Réglages Système → Notifications** et vérifier les modes Concentration si la bannière n’apparaît pas.
5. Dans **Activité**, cliquer sur **Démarrer**, puis afficher un document de travail. Aucun nom de fichier ni éditeur n’est imposé. Par exemple :

   ```sh
   open -a TextEdit examples/plan-migration.md
   ```

6. La phrase proposant de désactiver `/api/v1/users` produit un conflit possible avec la décision de maintien. La notification affiche le titre de la décision, par exemple **Maintien de l’API V1**, avec un message générique sans passage capturé. Son clic ouvre la preuve : passage observé, décision, source, application, heure et accès à la capture Screenpipe. Le titre de la décision est donc visible partout où macOS présente la notification, notamment pendant un partage d’écran si cette présentation est autorisée. La surveillance continue lorsque la fenêtre DecisionDrift est fermée.
7. Cliquer sur **Pause**, fermer le document contradictoire, puis ouvrir `examples/plan-migration-conforme.md` et redémarrer. Ce document conserve V1 tout en améliorant V2 et ne doit pas produire de conflit.

Un même conflit pour une décision et une fenêtre ne notifie qu’une fois par session. **Pause** empêche les nouvelles analyses et les notifications tardives ; elle ne coupe pas la capture indépendante de Screenpipe. Une analyse déjà soumise peut finir en arrière-plan, mais son résultat est ignoré après l’arrêt.

## Fonctionnement et limites

- DecisionDrift demande les captures OCR/accessibilité de l’API locale (`content_type=ocr`), avec les filtres facultatifs enregistrés. Il analyse uniquement la capture correspondante la plus récente de la période, pour ne pas relancer des rappels à partir d’anciennes fenêtres. Screenpipe doit réellement avoir capturé le texte : le simple accès à un fichier sur disque ne suffit pas.
- L’analyse s’exécute dans une tâche manuelle Screenpipe, avec le preset explicitement sélectionné. DecisionDrift ne reconstruit pas de harness et n’appelle pas directement le fournisseur IA.
- Les résultats sont lus depuis un fichier JSON propre à chaque exécution. Les identifiants de décision et de capture doivent être connus ; les citations sont rattachées au texte original. Seules les différences typographiques de guillemets/apostrophes et d’espaces sont tolérées, puis le passage original est affiché.
- Les vérifications ne se chevauchent pas. L’intervalle configuré (30 secondes par défaut, 15 à 3 600 autorisées) s’écoule après la fin d’une analyse ; il ne garantit pas une notification sous 30 secondes. Le modèle et Screenpipe peuvent être plus lents.
- **Aucune capture**, **aucun conflit**, **conflit possible** et **erreur** sont des états distincts. Un manque de capture ne prouve pas l’absence de conflit.
- L’IA ne peut pas prouver qu’un test manque ou qu’une API est cassée à partir d’un écran partiel. Une échéance minimale de maintien n’est pas une permission de supprimer l’API une fois cette date passée.
- Selon le moteur de capture, le texte peut inclure des fenêtres visibles en arrière-plan. Pour une démonstration non ambiguë, ne laissez ouvert qu’un seul des deux documents de migration ; la capture est une indication de contexte, pas une lecture garantie du fichier sur disque.
- Les approbations et le partage de fichiers sont manuels, sans authentification organisationnelle ni garantie cryptographique. Ne pas présenter ce mécanisme de hackathon comme un système de conformité.

## Dépannage

- **CLI introuvable** : renseigner son chemin dans Réglages, puis enregistrer et vérifier la connexion.
- **Preset absent / erreur IA** : vérifier ce preset dans Screenpipe. Aucun autre modèle n’est utilisé silencieusement.
- **Capture absente** : réveiller et déverrouiller le Mac, vérifier les permissions et le moteur de capture Screenpipe, afficher le document et supprimer les filtres inutiles. Toutes les applications dont Screenpipe fournit le texte sont éligibles, y compris les navigateurs, éditeurs et terminaux. DecisionDrift est exclu pour éviter d’analyser ses propres preuves.
- **Erreur d’extension Pi** : l’installation de développement utilisait Pi `0.84.1` avec une extension `pi-subagents 0.79.0` incompatible. Elle a été corrigée en épinglant `pi-subagents 0.70.1`. L’application ne modifie pas automatiquement cette configuration sur les autres ordinateurs.
- **Pas de bannière** : utiliser **Réglages → Tester la notification**, vérifier les autorisations de **DecisionDrift**, le style de notification et les modes Concentration. macOS décide de la présentation ; les conflits enregistrés restent consultables dans **Activité**. Un échec de remise explicite est affiché, sans réessai silencieux.
- **Capture ou partage d’écran actif** : macOS peut recevoir une notification tout en masquant sa bannière. Dans **Réglages Système → Notifications**, l’option **Autoriser les notifications lors de la recopie ou du partage de l’écran** permet leur affichage pendant le partage. Elle est globale et peut exposer les notifications des autres apps : ne l’activer que si c’est souhaité, puis la désactiver après la démo si nécessaire. Un événement Electron `show` ou une entrée dans le Centre de notifications ne prouve pas, seul, qu’une bannière a été visible.

Le contrat fonctionnel se trouve dans `docs/implementation-spec.md` et les décisions de conception dans `docs/product-plan.md`.

## Icône macOS

L’illustration source est `assets/icon.png` : PNG de 1 024 × 1 024 pixels avec transparence. `npm run package:mac` centre d’abord l’illustration sur 824 × 824 pixels dans un canevas transparent de 1 024 × 1 024 avec `scripts/render-mac-icon.js`. Cette marge de 100 pixels par côté évite qu’un export iOS déjà arrondi paraisse plus gros que les icônes macOS voisines. Le paquet génère ensuite les dix tailles standard du `.iconset` avec `sips`, les assemble avec `iconutil` dans `Contents/Resources/DecisionDrift.icns`, renseigne `CFBundleIconFile`, puis signe le bundle. Aucun outil graphique supplémentaire n’est nécessaire.

[Icon Composer](https://developer.apple.com/icon-composer/) est facultatif : il sert aux icônes multicouches Liquid Glass intégrées à Xcode. Pour ce bundle Electron, une image aplatie convertie en `.icns` est le chemin le plus simple.

Pour changer d’icône, remplacer `assets/icon.png`, reconstruire le paquet et remplacer l’application installée après l’avoir quittée. Ne pas modifier uniquement l’icône dans Finder : ce changement ne serait pas inclus dans le paquet distribué.

macOS peut garder une ancienne icône en cache. Lors de cette installation, l’enregistrement de DecisionDrift a été rafraîchi et le processus `NotificationCenter` relancé ; une vraie notification a ensuite affiché la nouvelle icône. Cela ne nécessite ni changement d’identifiant de bundle, ni réinitialisation des permissions ou de l’historique des notifications.

Le Dock peut aussi conserver l’ancien bitmap après remplacement du paquet. Lors de la correction de taille, son processus a été relancé pour afficher la nouvelle icône ; aucun réglage de taille ou de grossissement du Dock n’a été modifié.
