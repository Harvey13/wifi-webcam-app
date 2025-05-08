const { app, BrowserWindow } = require('electron');
const { startServer, stopServer } = require('./server.js');
const path = require('path');

let mainWindow;
let serverPort = 3000;

async function createWindow() {
  try {
    // Démarrer le serveur Express
    await startServer(serverPort);
    console.log(`✅ Serveur démarré sur le port ${serverPort}`);

    // Créer la fenêtre principale
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
	  icon: path.join(__dirname, 'icon.png'), // chemin vers ton icône
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // Charger l'URL du viewer
    mainWindow.loadURL(`http://localhost:${serverPort}/viewer`);

    // Ouvrir les outils de développement en mode développement
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

  } catch (error) {
    console.error('❌ Erreur lors du démarrage:', error);
    app.quit();
  }
}

// Quand Electron est prêt
app.whenReady().then(createWindow);

// Quitter quand toutes les fenêtres sont fermées
app.on('window-all-closed', async () => {
  await stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Gérer les erreurs non capturées
process.on('uncaughtException', async (error) => {
  console.error('❌ Erreur non capturée:', error);
  await stopServer();
  app.quit();
});
