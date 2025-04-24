const { contextBridge, ipcRenderer } = require('electron');
const qrcode = require('qrcode');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'electronAPI', {
        // Communication WiFi
        onWifiAddress: (callback) => ipcRenderer.on('wifi-address', (_, address) => callback(address)),
        onWifiError: (callback) => ipcRenderer.on('wifi-error', (_, error) => callback(error)),
        getWifiAddress: () => ipcRenderer.invoke('get-wifi-address'),
        
        // Status du serveur
        onServerStatus: (callback) => ipcRenderer.on('server-status', (_, status) => callback(status)),
        
        // Store access
        getStoreValue: (key) => ipcRenderer.invoke('store-get', key),
        setStoreValue: (key, value) => ipcRenderer.invoke('store-set', { key, value }),
        
        // App info
        getAppInfo: () => {
            return {
                versions: {
                    chrome: process.versions.chrome,
                    node: process.versions.node,
                    electron: process.versions.electron
                }
            };
        }
    }
);

// Exposer la bibliothèque QRCode pour le renderer process
contextBridge.exposeInMainWorld('qrcode', qrcode);

// Log when preload script has been loaded
console.log('Preload script loaded successfully');
