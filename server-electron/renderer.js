// Récupération des éléments DOM
const detectionStatus = document.getElementById('detection-status');
const ipAddress = document.getElementById('ip-address');
const ipInfo = document.getElementById('ip-info');
const errorBox = document.getElementById('error-box');
const errorMessage = document.getElementById('error-message');
const successBox = document.getElementById('success-box');
const qrContainer = document.getElementById('qr-container');
const connectionUrl = document.getElementById('connection-url');
const refreshIpBtn = document.getElementById('refresh-ip');
const connectionStatus = document.getElementById('connection-status');
const videoElement = document.getElementById('videoElement');
const placeholder = document.getElementById('placeholder');
const serverStatus = document.getElementById('server-status') || document.createElement('div');

// Importer QRCode si nous sommes dans Electron
let QRCode = null;
try {
  // Dans Electron, nous pouvons charger les modules Node.js
  if (window.electronAPI) {
    // La bibliothèque QRCode sera chargée par preload.js
    QRCode = window.qrcode;
  }
} catch (e) {
  console.error('Erreur lors du chargement de QRCode:', e);
}

// Variables globales
let detectedIp = null;
let peerConnection = null;
let dataChannel = null;

// Initialisation de l'application
function initializeApp() {
  console.log('Initialisation de l\'application...');
  
  // Afficher les versions d'Electron, Chrome et Node
  if (window.electronAPI) {
    const appInfo = window.electronAPI.getAppInfo();
    document.getElementById('chrome-version').textContent = appInfo.versions.chrome || 'N/A';
    document.getElementById('node-version').textContent = appInfo.versions.node || 'N/A';
    document.getElementById('electron-version').textContent = appInfo.versions.electron || 'N/A';
  }
  
  // Configurer les écouteurs d'événements pour l'API Electron
  setupElectronListeners();
  
  // Configurer l'interface utilisateur
  setupUI();
}

// Configuration des écouteurs d'événements pour l'API Electron
function setupElectronListeners() {
  if (window.electronAPI) {
    // Écouter les événements d'adresse Wi-Fi
    window.electronAPI.onWifiAddress((ip) => {
      detectedIp = ip;
      detectionStatus.textContent = 'Adresse détectée';
      ipAddress.textContent = ip;
      
      // Construire l'URL de connexion
      const url = `http://${ip}:3000/camera`;
      connectionUrl.textContent = url;
      
      // Afficher les informations
      ipInfo.style.display = 'block';
      successBox.style.display = 'block';
      qrContainer.style.display = 'block';
      
      // Générer le QR code
      generateQRCode(url);
      
      // Initialiser la connexion WebRTC pour le mode visualisation
      setupViewerMode(ip);
    });
    
    window.electronAPI.onWifiError((error) => {
      detectionStatus.textContent = 'Erreur de détection';
      errorMessage.textContent = error;
      errorBox.style.display = 'block';
    });
    
    // Écouter les événements de statut du serveur
    if (window.electronAPI.onServerStatus) {
      window.electronAPI.onServerStatus((status) => {
        if (status.status === 'online') {
          connectionStatus.textContent = `Serveur en ligne sur le port ${status.port}, prêt pour la connexion`;
          connectionStatus.style.color = 'green';
          
          if (serverStatus) {
            serverStatus.textContent = 'Serveur: En ligne';
            serverStatus.style.color = 'green';
          }
        } else {
          connectionStatus.textContent = `Erreur du serveur: ${status.error}`;
          connectionStatus.style.color = 'red';
          
          if (serverStatus) {
            serverStatus.textContent = 'Serveur: Erreur';
            serverStatus.style.color = 'red';
          }
        }
      });
    }
  }
}

// Configuration de l'interface utilisateur
function setupUI() {
  // Bouton pour actualiser l'adresse IP
  refreshIpBtn.addEventListener('click', async () => {
    if (window.electronAPI) {
      detectionStatus.textContent = 'Détection en cours...';
      ipInfo.style.display = 'none';
      errorBox.style.display = 'none';
      successBox.style.display = 'none';
      qrContainer.style.display = 'none';
      
      try {
        const result = await window.electronAPI.getWifiAddress();
        if (result.success) {
          detectedIp = result.ip;
          detectionStatus.textContent = 'Adresse détectée';
          ipAddress.textContent = result.ip;
          
          // Construire l'URL de connexion
          const url = `http://${result.ip}:3000/camera`;
          connectionUrl.textContent = url;
          
          // Afficher les informations
          ipInfo.style.display = 'block';
          successBox.style.display = 'block';
          qrContainer.style.display = 'block';
          
          // Générer le QR code
          generateQRCode(url);
          
          // Réinitialiser la connexion WebRTC
          setupViewerMode(result.ip);
        } else {
          detectionStatus.textContent = 'Erreur de détection';
          errorMessage.textContent = result.error;
          errorBox.style.display = 'block';
        }
      } catch (error) {
        detectionStatus.textContent = 'Erreur de détection';
        errorMessage.textContent = error.toString();
        errorBox.style.display = 'block';
      }
    }
  });
}

// Fonction pour générer le QR code
function generateQRCode(url) {
  const qrcodeContainer = document.getElementById('qrcode');
  qrcodeContainer.innerHTML = '';
  
  console.log('Génération du QR code pour l\'URL:', url);
  
  try {
    if (window.qrcode) {
      console.log('La bibliothèque QRCode est disponible, création du QR code...');
      
      // Méthode alternative plus fiable pour générer le QR code en utilisant toDataURL
      window.qrcode.toDataURL(url, {
        errorCorrectionLevel: 'H',
        width: 250,
        margin: 4,
        color: {
          dark: '#1E88E5',
          light: '#FFFFFF'
        }
      }, (err, dataURL) => {
        if (err) {
          console.error('Erreur lors de la génération du QR code:', err);
          createFallbackQR(url);
        } else {
          console.log('QR code généré avec succès (dataURL)!');
          // Créer une image avec le dataURL
          const img = document.createElement('img');
          img.src = dataURL;
          img.style.width = '200px';
          img.style.height = '200px';
          qrcodeContainer.appendChild(img);
        }
      });
    } else {
      console.warn('La bibliothèque QRCode n\'est pas disponible, utilisation du fallback');
      createFallbackQR(url);
    }
  } catch (e) {
    console.error('Erreur lors de la génération du QR code:', e);
    createFallbackQR(url);
  }
}

// Création d'un QR code de secours
function createFallbackQR(url) {
  const qrcodeContainer = document.getElementById('qrcode');
  qrcodeContainer.innerHTML = `
    <div style="padding: 10px; background: white; border-radius: 4px; text-align: center;">
      <div style="font-size: 14px; word-break: break-all;">${url}</div>
      <div style="margin-top: 10px; font-size: 12px; color: #777;">
        QR Code non disponible, utilisez l'URL directement
      </div>
    </div>
  `;
}

// Configurer le mode visualisation (viewer)
function setupViewerMode(ip) {
  console.log('Démarrage en mode visualisation avec l\'adresse IP:', ip);
  
  // Mettre à jour l'état de la connexion
  connectionStatus.textContent = 'Prêt pour la connexion';
  placeholder.textContent = 'Scannez le QR code avec votre téléphone pour diffuser la webcam';
  
  // Tester la connexion au serveur
  testServerConnection(ip);
}

// Tester la connexion au serveur
function testServerConnection(ip) {
  const url = `http://${ip}:3000/api/status`;
  
  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Statut HTTP: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.status === 'online') {
        connectionStatus.textContent = 'Serveur en ligne, prêt pour la connexion';
        connectionStatus.style.color = 'green';
      }
    })
    .catch(error => {
      console.error('Erreur de connexion au serveur:', error);
      connectionStatus.textContent = 'Serveur inaccessible. Vérifiez votre connexion.';
      connectionStatus.style.color = 'red';
    });
}

// Fonction de journalisation pour le débogage
function logDebugInfo(message) {
  console.log(message);
}

// Écouteur d'événements pour les erreurs d'exécution
window.addEventListener('error', (event) => {
  logDebugInfo(`Runtime error: ${event.message}`);
});

// Initialiser l'application lorsque le document est chargé
document.addEventListener('DOMContentLoaded', () => {
  console.log('Document chargé, démarrage de l\'application...');
  initializeApp();
});
