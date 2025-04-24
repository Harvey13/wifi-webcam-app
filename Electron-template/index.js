const { app, BrowserWindow, ipcMain } = require('electron');
const Store = require('electron-store');
const path = require('path');

// Application constants
const AppName = 'App';

// Initialize store with schema and defaults
const store = new Store({
    name: 'config',
    defaults: {
        theme: 'light',
        language: 'fr',
        windowSize: { width: 1024, height: 768 }
    }
});

let mainWindow;

function createWindow() {
    // Point d'arrêt pour le débogage
    debugger;

    // Get window size from store
    const windowSize = store.get('windowSize');

    mainWindow = new BrowserWindow({
        width: windowSize.width,
        height: windowSize.height,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: false,
            devTools: true
        }
    });

    // Supprimer le menu par défaut
    mainWindow.setMenu(null);

    // Ouvrir DevTools avant de charger la page
    mainWindow.webContents.openDevTools({ mode: 'detach' });

    mainWindow.loadFile('index.html');

    // Sauvegarder la taille de la fenêtre quand elle change
    mainWindow.on('resize', () => {
        const { width, height } = mainWindow.getBounds();
        store.set('windowSize', { width, height });
    });

    // Debug logging
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('Window loaded successfully');
        console.log('Current config:', store.store);
    });

    // Error handling
    mainWindow.webContents.on('crashed', (event) => {
        console.error('Window crashed:', event);
    });

    mainWindow.on('unresponsive', () => {
        console.error('Window became unresponsive');
    });

    // Add keyboard shortcuts
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
            mainWindow.webContents.toggleDevTools();
            event.preventDefault();
        }
        // Ajouter le raccourci Ctrl+Shift+R pour recharger
        if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'r') {
            mainWindow.reload();
            event.preventDefault();
        }
    });
}

// Enable debug logging
app.on('ready', () => {
    console.log('App is ready');
    console.log('Store path:', store.path);
    createWindow();
});

// Setup IPC handlers for store access
ipcMain.handle('store-get', (event, key) => {
    const value = store.get(key);
    console.log('store-get:', { key, value });
    return value;
});

ipcMain.handle('store-set', (event, { key, value }) => {
    console.log('store-set:', { key, value });
    store.set(key, value);
    return true;
});

ipcMain.handle('store-delete', (event, key) => {
    console.log('store-delete:', key);
    store.delete(key);
    return true;
});

// Additional debug logging
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
});

app.on('window-all-closed', () => {
    console.log('All windows closed');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    console.log('App activated');
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Ajouter les gestionnaires IPC
ipcMain.handle('get-app-path', (event, name) => {
    return app.getPath(name);
});