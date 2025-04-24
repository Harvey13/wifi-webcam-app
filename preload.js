const { contextBridge, ipcRenderer } = require('electron');

// Expose les APIs protégées à la fenêtre de rendu
contextBridge.exposeInMainWorld('api', {
    onWifiAddress: (callback) => ipcRenderer.on('wifi-address', (event, address) => callback(address)),
    onWifiError: (callback) => ipcRenderer.on('wifi-error', (event, error) => callback(error)),
    getWifiAddress: () => ipcRenderer.invoke('get-wifi-address'),
    versions: {
        chrome: process.versions.chrome,
        node: process.versions.node,
        electron: process.versions.electron
    }
});
