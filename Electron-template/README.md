# Electron Application Template

Un template d'application Electron avec configuration persistante intégrée, utilisant electron-store.

## Fonctionnalités

- 🔧 Configuration persistante avec `electron-store`
- 🎨 Thème clair/sombre
- 💾 Sauvegarde automatique de la taille de la fenêtre
- 🔍 DevTools intégrés avec raccourcis clavier
- 📦 Prêt pour le packaging avec Electron Forge

## Pour commencer

1. Clonez ce template :
```bash
git clone <votre-repo>
cd electron-app
```

2. Installez les dépendances :
```bash
npm install
```

3. Démarrez l'application :
```bash
npm start
```

## Scripts disponibles

- `npm start` : Démarre l'application en mode développement
- `npm run package` : Crée un package non compressé
- `npm run make` : Crée des installateurs pour votre plateforme
- `npm run publish` : Publie votre application

## Structure du projet

```
electron-app/
├── index.js          # Point d'entrée principal
├── index.html        # Interface utilisateur
├── renderer.js       # Code du processus renderer
├── styles.css        # Styles de l'application
└── package.json      # Configuration du projet
```

## Raccourcis clavier

- `Ctrl+Shift+I` : Ouvre/ferme les DevTools
- `Ctrl+Shift+R` : Recharge l'application

## Configuration

La configuration est gérée par `electron-store` et inclut par défaut :
- `theme` : 'light' ou 'dark'
- `language` : Code de langue (ex: 'fr')
- `windowSize` : Dimensions de la fenêtre

## Personnalisation

1. Modifiez `AppName` dans `index.js` et `renderer.js`
2. Ajoutez vos propres configurations dans le store
3. Personnalisez les styles dans `styles.css`
4. Modifiez les options de packaging dans `package.json`

## Sauvegarder sur GitHub

1. Créez un nouveau repository sur GitHub :
   - Allez sur [GitHub](https://github.com)
   - Cliquez sur "New repository"
   - Donnez un nom à votre repository
   - Laissez les autres options par défaut
   - Cliquez sur "Create repository"

2. Initialisez Git et poussez le code (dans un terminal) :
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://KEY@github.com/Harvey13/Electron-template.git
git push -u origin main
```

3. Pour les mises à jour suivantes :
```bash
git add .
git commit -m "Description des changements"
git push
```

## Bonnes pratiques Git

- Committez régulièrement avec des messages descriptifs
- Utilisez des branches pour les nouvelles fonctionnalités
- Vérifiez toujours les fichiers modifiés avec `git status`
- Consultez l'historique avec `git log`

## Build et Distribution

Pour créer un installateur :
```bash
npm run make
```

Les installateurs seront créés dans le dossier `out/make/`.
