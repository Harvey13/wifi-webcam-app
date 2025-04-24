const path = require('path');
const { ipcRenderer } = require('electron');

// Application constants
const AppName = 'App';

// Debug function
function logDebugInfo(message) {
    console.log(`[DEBUG] ${message}`);
    const debugElement = document.getElementById('debugInfo');
    const timestamp = new Date().toISOString();
    debugElement.textContent += `\n[${timestamp}] ${message}`;
}

// Initialize the app
async function initializeApp() {
    try {
        // Récupérer les différentes parties de la configuration
        const theme = await ipcRenderer.invoke('store-get', 'theme');
        const language = await ipcRenderer.invoke('store-get', 'language');
        const windowSize = await ipcRenderer.invoke('store-get', 'windowSize');

        const config = {
            theme,
            language,
            windowSize
        };

        logDebugInfo('Configuration récupérée :');
        logDebugInfo(JSON.stringify(config, null, 2));

        // Afficher la configuration
        document.getElementById('configContent').textContent = 
            JSON.stringify(config, null, 2);
        logDebugInfo('Config loaded successfully');

        // Exemple de modification de la configuration
        document.getElementById('configContent').addEventListener('click', async () => {
            // Toggle le thème pour démontrer la sauvegarde
            const currentTheme = await ipcRenderer.invoke('store-get', 'theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            await ipcRenderer.invoke('store-set', { 
                key: 'theme', 
                value: newTheme 
            });
            logDebugInfo(`Theme changed to: ${newTheme}`);
            
            // Mettre à jour l'affichage
            const updatedConfig = {
                theme: newTheme,
                language: await ipcRenderer.invoke('store-get', 'language'),
                windowSize: await ipcRenderer.invoke('store-get', 'windowSize')
            };
            document.getElementById('configContent').textContent = 
                JSON.stringify(updatedConfig, null, 2);
        });

    } catch (error) {
        const errorMessage = `Error loading config: ${error.message}`;
        document.getElementById('configContent').textContent = errorMessage;
        logDebugInfo(`ERROR: ${errorMessage}`);
        console.error(error);
    }
}

// Start the app when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    
    // Add some test console messages for DevTools
    console.log('Page loaded - check DevTools console');
    console.warn('This is a warning message for testing');
    console.error('This is an error message for testing');
});

// Add event listener for testing
window.addEventListener('error', (event) => {
    logDebugInfo(`Runtime error: ${event.message}`);
});
