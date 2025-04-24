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

// Variables globales
let detectedIp = null;
let peerId = Math.floor(Math.random() * 1e16).toString(); // ID unique dès le chargement

// Initialisation de l'application
function initializeApp() {
    console.log('Initialisation de l\'application...');
    
    // Configurer les écouteurs d'événements pour l'API Electron
    setupElectronListeners();
    
    // Configurer l'interface utilisateur
    setupUI();
}

// Configuration des écouteurs d'événements pour l'API Electron
function setupElectronListeners() {
    // Écouter les événements d'adresse Wi-Fi
    window.api.onWifiAddress((ip) => {
        detectedIp = ip;
        detectionStatus.textContent = 'Adresse détectée';
        ipAddress.textContent = ip;
        
        // Construire l'URL de connexion (HTTP uniquement)
        const url = `http://${ip}:3000/camera`;
        connectionUrl.textContent = url;
        
        // Afficher les informations
        ipInfo.style.display = 'block';
        successBox.style.display = 'block';
        qrContainer.style.display = 'block';
        
        // Générer le QR code
        generateQRCode(url);
    });
    
    window.api.onWifiError((error) => {
        detectionStatus.textContent = 'Erreur de détection';
        errorMessage.textContent = error;
        errorBox.style.display = 'block';
        successBox.style.display = 'none';
        qrContainer.style.display = 'none';
        ipInfo.style.display = 'none'; 
        connectionUrl.textContent = '-'; 
        if (videoElement) videoElement.style.display = 'none';
        if (placeholder) {
            placeholder.textContent = "Erreur réseau : Le WiFi est désactivé ou déconnecté. Veuillez activer le WiFi pour utiliser l’application.";
            placeholder.style.color = '#e74c3c';
        }
        if (connectionStatus) connectionStatus.textContent = 'Erreur réseau';
    });

    // Affichage des versions Electron/Node/Chrome
    const versions = window.api.versions;
    document.getElementById('chrome-version').textContent = versions.chrome || '-';
    document.getElementById('node-version').textContent = versions.node || '-';
    document.getElementById('electron-version').textContent = versions.electron || '-';
}

// Configuration de l'interface utilisateur
function setupUI() {
    // Bouton pour actualiser l'adresse IP
    refreshIpBtn.addEventListener('click', async () => {
        detectionStatus.textContent = 'Détection en cours...';
        ipInfo.style.display = 'none';
        errorBox.style.display = 'none';
        successBox.style.display = 'none';
        qrContainer.style.display = 'none';
        
        try {
            await window.api.getWifiAddress();
        } catch (error) {
            detectionStatus.textContent = 'Erreur de détection';
            errorMessage.textContent = error.toString();
            errorBox.style.display = 'block';
        }
    });
}

// Fonction pour générer le QR code
function generateQRCode(url) {
    const qrcodeContainer = document.getElementById('qrcode');
    qrcodeContainer.innerHTML = '';
    new QRCode(qrcodeContainer, {
        text: url + `?peerId=${peerId}`,
        width: 200,
        height: 200
    });
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

// Fonction de journalisation pour le débogage
function logDebugInfo(message) {
    console.log(message);
}

// Écouteur d'événements pour les erreurs d'exécution
window.addEventListener('error', (event) => {
    logDebugInfo(`Runtime error: ${event.message}`);
});

// --- WebRTC Viewer Logic ---
let pc = null;
let videoTracks = [];
let currentTrackIndex = 0;

async function startViewerWebRTC() {
    pc = new RTCPeerConnection();
    videoTracks = [];
    currentTrackIndex = 0;

    pc.ontrack = (event) => {
        if (event.track.kind === 'video') {
            // Ajout automatique du flux vidéo reçu
            videoElement.srcObject = event.streams[0];
            placeholder.style.display = 'none';
        }
    };

    // Récupérer l'offre du mobile
    console.log('[VIEWER] Utilisation du peerId:', peerId);
    const offer = await pollForOffer(peerId);
    if (!offer) {
        showError('Aucune offre WebRTC reçue. Assurez-vous que le mobile est connecté.');
        return;
    }
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    // Créer et envoyer la réponse
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    try {
        const response = await fetch(`/api/answer/${peerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pc.localDescription)
        });
        console.log('[VIEWER] POST ANSWER status:', response.status);
        if (!response.ok) {
            const msg = await response.text();
            console.error('[VIEWER] POST ANSWER failed:', msg);
        }
    } catch (e) {
        console.error('[VIEWER] POST ANSWER error:', e);
    }

    // Gestion des ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            fetch(`/api/ice-candidates/${peerId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event.candidate)
            });
        }
    };
    pollRemoteIceCandidates();
}

function showError(msg) {
    placeholder.textContent = msg;
    placeholder.style.color = '#e74c3c';
    placeholder.style.display = 'block';
    if (connectionStatus) connectionStatus.textContent = 'Erreur WebRTC';
}

// --- Signalisation REST ---
async function pollForOffer(id) {
    for (let i = 0; i < 60; i++) {
        let urlBase = detectedIp ? `http://${detectedIp}:3000` : '';
        if (!urlBase) {
            await new Promise(r => setTimeout(r, 1000));
            continue;
        }
        try {
            const res = await fetch(`${urlBase}/api/offer/${id}`);
            if (res.ok) return await res.json();
        } catch (e) {}
        await new Promise(r => setTimeout(r, 1000));
    }
    return null;
}

async function pollRemoteIceCandidates() {
    while (true) {
        let urlBase = detectedIp ? `http://${detectedIp}:3000` : '';
        if (!urlBase) {
            await new Promise(r => setTimeout(r, 1000));
            continue;
        }
        try {
            const res = await fetch(`${urlBase}/api/ice-candidates/${peerId}`);
            if (res.ok) {
                const candidates = await res.json();
                for (const c of candidates) {
                    try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
                }
            }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 1000));
    }
}

// Démarrage automatique du viewer dans la zone vidéo dès le chargement
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Document chargé, démarrage de l\'application...');
        initializeApp();
        startViewerWebRTC();
    });
}
