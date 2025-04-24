# Comment utiliser ce Template Electron

Ce guide explique comment utiliser ce template pour créer de nouvelles applications Electron.

## Méthode 1 : Utilisation du Script PowerShell (Recommandé)

Le script `create-project.ps1` automatise la création de nouveaux projets.

### Utilisation basique :
```powershell
.\create-project.ps1 -ProjectName "MonApp"
```

### Options avancées :
```powershell
# Avec une description personnalisée
.\create-project.ps1 -ProjectName "MonApp" -Description "Ma super application"

# Dans un dossier spécifique
.\create-project.ps1 -ProjectName "MonApp" -OutputPath "C:\MesProjets"
```

Le script s'occupe automatiquement de :
- Créer la structure du projet
- Renommer tous les fichiers nécessaires
- Mettre à jour les configurations

## Méthode 2 : Création Manuelle

Si vous préférez créer votre projet manuellement :

1. **Copier les fichiers** :
   - Copiez tous les fichiers du template dans un nouveau dossier
   ```
   index.js         # Processus principal
   index.html       # Interface utilisateur
   renderer.js      # Code du processus renderer
   styles.css       # Styles CSS
   package.json     # Configuration npm
   README.md        # Documentation
   assets/          # Dossier des ressources
   ```

2. **Modifier package.json** :
   ```json
   {
     "name": "votre-projet",
     "productName": "VotreProjet",
     "description": "Votre description",
     ...
   }
   ```

3. **Mettre à jour AppName** :
   - Dans `index.js` :
     ```javascript
     const AppName = 'VotreProjet';
     ```
   - Dans `renderer.js` :
     ```javascript
     const AppName = 'VotreProjet';
     ```

4. **Installer les dépendances** :
   ```bash
   npm install
   ```

## Développement

### Scripts disponibles :
- `npm start` : Lance l'application en mode développement
- `npm run package` : Crée un package non installable
- `npm run make` : Crée des installateurs
- `npm run publish` : Publie l'application

### Raccourcis clavier :
- `Ctrl+Shift+I` : Ouvre/ferme les DevTools
- `Ctrl+Shift+R` : Recharge l'application

## Configuration

La configuration est gérée par `electron-store` et inclut par défaut :
```javascript
{
    theme: 'light',
    language: 'fr',
    windowSize: { 
        width: 1024, 
        height: 768 
    }
}
```

## Packaging

Pour créer un installateur :
```bash
npm run make
```

Les installateurs seront créés dans :
- Windows : `out/make/squirrel.windows/x64`
- Linux : `out/make/deb/x64` ou `out/make/rpm/x64`
- macOS : `out/make/zip/darwin/x64`

## Structure des fichiers

```
votre-projet/
├── assets/           # Ressources (icônes, images)
├── index.js          # Point d'entrée principal
├── index.html        # Interface utilisateur
├── renderer.js       # Code du processus renderer
├── styles.css        # Styles CSS
├── package.json      # Configuration du projet
└── README.md         # Documentation
```
