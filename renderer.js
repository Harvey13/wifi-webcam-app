// Récupération des éléments DOM (uniquement ceux qui existent encore)
const ipAddress = document.getElementById('ip-address');
const errorBox = document.getElementById('error-box');
const errorMessage = document.getElementById('error-message');
const qrContainer = document.getElementById('qr-container');
const videoElement = document.getElementById('videoElement');
const placeholder = document.getElementById('placeholder');
const connectionStatus = document.getElementById('connection-status');

// Variables globales
const VERSION_VIEWER = '0.0.1'; // <-- Modifier ici pour changer la version du viewer
let detectedIp = null;
let peerId = Math.floor(Math.random() * 1e16).toString(); // ID unique dès le chargement

// Affichage temporaire de la version dans un overlay
function showVersionOverlay() {
    let overlay = document.createElement('div');
    overlay.id = 'version-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '12px';
    overlay.style.left = '50%';
    overlay.style.transform = 'translateX(-50%)';
    overlay.style.background = 'rgba(0,0,0,0.85)';
    overlay.style.color = '#fff';
    overlay.style.padding = '7px 22px';
    overlay.style.borderRadius = '18px';
    overlay.style.fontSize = '16px';
    overlay.style.fontWeight = 'bold';
    overlay.style.zIndex = 9999;
    overlay.textContent = `WiFi Webcam Viewer v${VERSION_VIEWER}`;
    document.body.appendChild(overlay);
    setTimeout(() => {
        overlay.remove();
    }, 5000);
}

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
        if (ipAddress) ipAddress.textContent = ip;
        // Générer le QR code (fonctionnalité conservée)
        const url = `http://${ip}:3000/camera`;
        generateQRCode(url);
        if (qrContainer) qrContainer.style.display = 'block';
    });
    
    window.api.onWifiError((error) => {
        if (errorMessage) errorMessage.textContent = error;
        if (errorBox) errorBox.style.display = 'block';
        if (qrContainer) qrContainer.style.display = 'none';
        if (videoElement) videoElement.style.display = 'none';
        if (placeholder) {
            placeholder.textContent = "Erreur réseau : Le WiFi est désactivé ou déconnecté. Veuillez activer le WiFi pour utiliser l’application.";
            placeholder.style.color = '#e74c3c';
        }
        if (connectionStatus) connectionStatus.textContent = 'Erreur réseau';
    });


}

// Configuration de l'interface utilisateur
function setupUI() {
    // Bouton pour actualiser l'adresse IP

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
            console.log('[VIEWER] Track vidéo reçu, affichage du flux !');
            videoElement.srcObject = event.streams[0];
            videoElement.play().catch(e => console.error('Erreur lecture vidéo:', e));
            placeholder.style.display = 'none';

            // Affiche l'IP reçue dans l'offre si elle existe (ne pas écraser par ICE)
            if (window.lastOfferMobileIp) {
                document.title = `Connecté à ${window.lastOfferMobileIp}`;
                if (connectionStatus) connectionStatus.textContent = `Connecté à ${window.lastOfferMobileIp}`;
                console.log('[VIEWER] IP du mobile reçue dans l\'offre (persistée):', window.lastOfferMobileIp);
            } else {
                document.title = 'Connecté';
                if (connectionStatus) connectionStatus.textContent = 'Connecté';
                console.error('[VIEWER][ontrack] window.lastOfferMobileIp est undefined !');
            }
        }
    };

    // Récupérer l'offre du mobile
    console.log('[VIEWER] Utilisation du peerId:', peerId);
    const offer = await pollForOffer(peerId);
    if (!offer) {
        showError('Aucune offre WebRTC reçue. Assurez-vous que le mobile est connecté.');
        return;
    }
    console.log('[VIEWER] Offre reçue pour peerId', peerId, ':', offer);
// Log détaillé de toutes les clés du payload reçu
Object.keys(offer).forEach(key => {
    console.log(`[VIEWER][PAYLOAD] ${key}:`, offer[key]);
});
    // Affiche l'IP du mobile si présente dans l'offre
    if (offer.mobileIp) {
        window.lastOfferMobileIp = offer.mobileIp;
        console.log('[VIEWER] window.lastOfferMobileIp défini à', window.lastOfferMobileIp);
    }
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    // Créer et envoyer la réponse
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    let urlBase = detectedIp ? `http://${detectedIp}:3000` : '';
    try {
        const response = await fetch(`${urlBase}/api/answer/${peerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pc.localDescription)
        });
        console.log('[VIEWER] POST ANSWER status:', response.status);
        if (!response.ok) {
            const msg = await response.text();
            console.error('[VIEWER] POST ANSWER failed:', msg);
        } else {
            console.log('[VIEWER] Réponse WebRTC envoyée avec succès pour peerId', peerId);
        }
    } catch (e) {
        console.error('[VIEWER] POST ANSWER error:', e);
    }

    // Gestion des ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            let urlBase = detectedIp ? `http://${detectedIp}:3000` : '';
            console.log('[VIEWER] ICE candidate local généré, envoi au serveur:', event.candidate);
            fetch(`${urlBase}/api/ice-candidates/${peerId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event.candidate)
            });
        } else {
            console.log('[VIEWER] Fin de génération des ICE candidates locaux.');
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
    let urlBase;
    let tries = 0;
    while (true) {
        urlBase = detectedIp ? `http://${detectedIp}:3000` : '';
        if (!urlBase) {
            await new Promise(r => setTimeout(r, 1000));
            continue;
        }
        try {
            const res = await fetch(`${urlBase}/api/offer/${id}`);
            console.log(`[VIEWER] Tentative GET /api/offer/${id} | status:`, res.status);
            if (res.ok) {
                const data = await res.json();
                console.log(`[VIEWER] Offre trouvée pour peerId ${id}:`, data);
                return data;
            }
        } catch (e) {
            console.error(`[VIEWER] Erreur lors du GET /api/offer/${id}:`, e);
        }
        tries++;
        await new Promise(r => setTimeout(r, 1000));
    }
}

async function pollRemoteIceCandidates() {
    let receivedCount = 0;
    let emptyTries = 0;
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
                console.log(`[VIEWER] ICE candidates distants reçus (${candidates.length}):`, candidates);
                if (candidates.length > 0) {
                    for (const c of candidates) {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(c));
                            console.log('[VIEWER] ICE candidate distant ajouté:', c);
                        } catch (err) {
                            console.error('[VIEWER] Erreur ajout ICE candidate distant:', err, c);
                        }
                    }
                    receivedCount += candidates.length;
                    emptyTries = 0;
                } else {
                    emptyTries++;
                }
                // Arrête le polling si on a reçu des candidats et qu'on a eu 5 tours à vide
                if (receivedCount > 0 && emptyTries >= 5) {
                    console.log('[VIEWER] Arrêt du polling ICE: tous les candidats reçus.');
                    break;
                }
            }
        } catch (e) {
            console.error('[VIEWER] Erreur lors de la récupération des ICE distants:', e);
        }
        await new Promise(r => setTimeout(r, 1000));
    }
}

// Démarrage automatique du viewer dans la zone vidéo dès le chargement
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Document chargé, démarrage de l\'application...');
        initializeApp();
        // Affiche la version dans le titre pendant 5s
        const originalTitle = document.title;
        document.title = originalTitle + ' - v' + VERSION_VIEWER;
        setTimeout(() => {
            document.title = originalTitle;
        }, 5000);
        // Ajoute le Toast version sur clic du titre
        const titleSelector = document.querySelector('title');
        // Pour Electron ou apps web, le titre est souvent dans le DOM sous .titlebar ou h1/h2, on tente plusieurs options
        let clickableTitle = document.querySelector('.titlebar') || document.querySelector('h1') || document.querySelector('h2');
        if (!clickableTitle) {
            // fallback: créer un titre cliquable si inexistant
            clickableTitle = document.createElement('h1');
            clickableTitle.textContent = 'WiFi Webcam Viewer';
            clickableTitle.style.cursor = 'pointer';
            document.body.insertBefore(clickableTitle, document.body.firstChild);
        }
        clickableTitle.style.cursor = 'pointer';
        clickableTitle.addEventListener('click', () => {
            showViewerVersionToast();
        });
        startViewerWebRTC();
    });
}

function showViewerVersionToast() {
    // Supprime l'ancien toast s'il existe
    const old = document.getElementById('viewer-version-toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.id = 'viewer-version-toast';
    toast.textContent = 'VERSION_VIEWER: v' + VERSION_VIEWER;
    toast.style.position = 'fixed';
    toast.style.bottom = '32px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(0,0,0,0.92)';
    toast.style.color = '#fff';
    toast.style.padding = '12px 32px';
    toast.style.borderRadius = '18px';
    toast.style.fontSize = '16px';
    toast.style.fontWeight = 'bold';
    toast.style.zIndex = 99999;
    toast.style.boxShadow = '0 4px 24px rgba(0,0,0,0.18)';
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

