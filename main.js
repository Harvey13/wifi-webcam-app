const { app, BrowserWindow, ipcMain } = require('electron');
const Store = require('electron-store');
const { exec } = require('child_process');
const path = require('path');
const { startServer, stopServer } = require('./server-electron/server');

// Application constants
const AppName = 'WiFi Webcam';
let expressPort = 3000;

// Initialize store with schema and defaults
const store = new Store({
    name: 'config',
    defaults: {
        theme: 'light',
        language: 'fr',
        windowSize: { width: 1024, height: 768 },
        lastIpAddress: null
    }
});

let mainWindow;

// Désactive complètement le support HTTPS côté Electron pour éviter tout handshake SSL
// (on ne gère plus aucun certificat ni requête https)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.startsWith('https://')) {
    event.preventDefault();
    callback(false); // Refuse tout HTTPS
  }
});

async function createWindow() {
    try {
        // Démarrer le serveur express
        await startServer(expressPort);
        console.log('✅ Serveur Express démarré');

        // Get window size from store
        const windowSize = store.get('windowSize');

        mainWindow = new BrowserWindow({
            width: windowSize.width,
            height: windowSize.height,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js'),
                webSecurity: true
            }
        });

        // Supprimer le menu par défaut en production
        if (process.env.NODE_ENV !== 'development') {
            mainWindow.setMenu(null);
        }

        mainWindow.loadFile('index.html'); // On garde le chargement du HTML natif

        // Désactive l'ouverture automatique des DevTools
        // mainWindow.webContents.openDevTools();

        // Ajoute un raccourci clavier pour ouvrir DevTools (Ctrl+Shift+I)
        mainWindow.webContents.on('before-input-event', (event, input) => {
            if (input.control && input.shift && input.key.toLowerCase() === 'i') {
                mainWindow.webContents.openDevTools();
            }
        });

        // Sauvegarder la taille de la fenêtre quand elle change
        mainWindow.on('resize', () => {
            const { width, height } = mainWindow.getBounds();
            store.set('windowSize', { width, height });
        });

        // Debug logging
        mainWindow.webContents.on('did-finish-load', () => {
            console.log('Window loaded successfully');
            
            // Détecter l'adresse IP automatiquement au démarrage
            getWiFiAddress()
                .then((result) => {
                    if (result.success) {
                        mainWindow.webContents.send('wifi-address', result.ip);
                        store.set('lastIpAddress', result.ip);
                        console.log('Adresse IP détectée:', result.ip);
                    } else {
                        mainWindow.webContents.send('wifi-error', result.error);
                        console.error('Erreur de détection IP:', result.error);
                    }
                })
                .catch((error) => {
                    mainWindow.webContents.send('wifi-error', error.message);
                    console.error('Exception lors de la détection IP:', error);
                });
        });

    } catch (error) {
        console.error('❌ Erreur lors du démarrage:', error);
        app.quit();
    }
}

// Function to get WiFi address
async function getWiFiAddress() {
    try {
        const stdout = await new Promise((resolve, reject) => {
            exec('ipconfig', (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    reject(error);
                    return;
                }
                resolve(stdout);
            });
        });

        // Nouvelle logique : regrouper chaque interface réseau avec ses lignes
        const interfaceBlocks = [];
        const lines = stdout.split(/\r?\n/);
        let currentBlock = [];
        for (const line of lines) {
            if (/^Carte /.test(line.trim())) {
                if (currentBlock.length > 0) interfaceBlocks.push(currentBlock.join('\n'));
                currentBlock = [line];
            } else {
                currentBlock.push(line);
            }
        }
        if (currentBlock.length > 0) interfaceBlocks.push(currentBlock.join('\n'));

        // DEBUG: Log tous les blocs d'interface
        console.log('--- Blocs d\'interface réseau ---');
        interfaceBlocks.forEach((block, idx) => {
            console.log(`Bloc ${idx}:\n${block}\n---`);
        });

        let wifiIp = null;
        let wifiDisconnected = false;
        // Recherche Wi-Fi (tolérance accents/casse)
        const wifiBlockRegex = /carte.*sans.?fil.*wi/i;
        let wifiBlockFound = false;
        for (const block of interfaceBlocks) {
            if (wifiBlockRegex.test(block)) {
                wifiBlockFound = true;
                console.log('--- Bloc Wi-Fi trouvé (tolérant) ---\n' + block + '\n--------------------------');
                if (/statut du m.{0,2}dia.*d.{0,2}connect.{0,2}/i.test(block)) {
                    console.log('Wi-Fi marqué comme déconnecté dans ipconfig (tolérant).');
                    console.log('==> Retour : Le WiFi est désactivé ou déconnecté.');
                    return { success: false, error: 'Le WiFi est désactivé ou déconnecté.' };
                }
                const ipv4Match = block.match(/Adresse IPv4.*: (\d+\.\d+\.\d+\.\d+)/);
                if (ipv4Match && ipv4Match[1]) {
                    console.log('Adresse IPv4 trouvée dans le bloc Wi-Fi:', ipv4Match[1]);
                    wifiIp = ipv4Match[1];
                    break;
                } else {
                    console.log('Aucune adresse IPv4 trouvée dans le bloc Wi-Fi.');
                }
            }
        }
        // Si un bloc Wi-Fi existe mais n'est pas connecté, on ne doit PAS utiliser Ethernet
        if (wifiBlockFound && !wifiIp) {
            console.log('==> Retour : Le WiFi est présent mais aucune IP trouvée (probablement déconnecté).');
            return { success: false, error: 'Le WiFi est désactivé ou déconnecté.' };
        }
        // Si aucune adresse Wi-Fi n'a été trouvée, chercher les interfaces Ethernet
        if (!wifiIp) {
            for (const block of interfaceBlocks) {
                if (block.includes('Ethernet')) {
                    const ipv4Match = block.match(/Adresse IPv4.*: (\d+\.\d+\.\d+\.\d+)/);
                    if (ipv4Match && ipv4Match[1]) {
                        wifiIp = ipv4Match[1];
                        break;
                    }
                }
            }
        }

        // Si une adresse a été trouvée
        if (wifiIp) {
            console.log("Adresse IPv4 détectée :", wifiIp);
            console.log('==> Retour : Adresse IP détectée avec succès.');
            return { success: true, ip: wifiIp };
        } else {
            const lastIp = store.get('lastIpAddress');
            if (lastIp) {
                console.log("Utilisation de la dernière adresse IP connue:", lastIp);
                console.log('==> Retour : Utilisation de la dernière adresse IP connue.');
                return { success: true, ip: lastIp };
            } else {
                console.log("Aucune adresse IPv4 détectée.");
                console.log('==> Retour : Aucune adresse IPv4 détectée.');
                return { success: false, error: 'Aucune adresse IPv4 détectée.' };
            }
        }
    } catch (error) {
        console.error("Erreur lors de la récupération de l'adresse Wi-Fi :", error);
        console.log('==> Retour : Erreur lors de la récupération de l\'adresse Wi-Fi.');
        return { success: false, error: error.message };
    }
}

// Setup IPC handlers
ipcMain.handle('get-wifi-address', async () => {
    try {
        const result = await getWiFiAddress();
        if (result.success) {
            mainWindow.webContents.send('wifi-address', result.ip);
            store.set('lastIpAddress', result.ip);
            return result.ip;
        } else {
            mainWindow.webContents.send('wifi-error', result.error);
            return null;
        }
    } catch (err) {
        mainWindow.webContents.send('wifi-error', err.message);
        return null;
    }
});

// Store access
ipcMain.handle('store-get', (event, key) => {
    return store.get(key);
});

ipcMain.handle('store-set', (event, { key, value }) => {
    store.set(key, value);
    return true;
});

// Enable debug logging
app.on('ready', () => {
    console.log('App is ready');
    console.log('Store path:', store.path);
    createWindow();
});

// Additional debug logging
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
});

app.on('window-all-closed', async () => {
    console.log('All windows closed');
    await stopServer();
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
