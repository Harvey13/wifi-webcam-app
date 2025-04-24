// Serveur Express pour gérer les connexions au streaming
const express = require('express');
const path = require('path');
const http = require('http');
const webrtcStore = require('./webrtc-store');

// Créer l'application Express
const app = express();
const server = http.createServer(app);

// Configurer les routes statiques et le middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes principales
app.get('/camera', (req, res) => {
  res.sendFile(path.join(__dirname, 'camera.html'));
});

app.get('/viewer', (req, res) => {
  res.sendFile(path.join(__dirname, 'viewer.html'));
});

// Route API pour vérifier si le serveur est en ligne
app.get('/api/status', (req, res) => {
  res.json({ status: 'online' });
});

// Routes WebRTC
// Stocker une offre
app.post('/api/offer/:id', (req, res) => {
  const { id } = req.params;
  webrtcStore.setOffer(id, req.body);
  res.json({ success: true });
});

// Récupérer une offre
app.get('/api/offer/:id', (req, res) => {
  const { id } = req.params;
  const offer = webrtcStore.getOffer(id);
  if (offer) {
    res.json(offer);
  } else {
    res.status(404).json({ error: 'Offre non trouvée' });
  }
});

// Stocker une réponse
app.post('/api/answer/:id', (req, res) => {
  const { id } = req.params;
  webrtcStore.setAnswer(id, req.body);
  res.json({ success: true });
});

// Récupérer une réponse
app.get('/api/answer/:id', (req, res) => {
  const { id } = req.params;
  const answer = webrtcStore.getAnswer(id);
  if (answer) {
    res.json(answer);
  } else {
    res.status(404).json({ error: 'Réponse non trouvée' });
  }
});

// Ajouter un candidat ICE
app.post('/api/ice-candidates/:id', (req, res) => {
  const { id } = req.params;
  webrtcStore.addIceCandidate(id, req.body);
  res.json({ success: true });
});

// Récupérer les candidats ICE
app.get('/api/ice-candidates/:id', (req, res) => {
  const { id } = req.params;
  const candidates = webrtcStore.getIceCandidates(id);
  webrtcStore.clearIceCandidates(id); // Nettoyer après lecture
  res.json(candidates);
});

// Fonction pour démarrer le serveur
function startServer(port = 3000) {
  return new Promise((resolve, reject) => {
    try {
      server.listen(port, () => {
        console.log(`Serveur démarré sur le port ${port}`);
        resolve({ success: true, port });
      });
      
      server.on('error', (error) => {
        console.error('Erreur du serveur:', error);
        reject({ success: false, error });
      });
    } catch (error) {
      console.error('Exception lors du démarrage du serveur:', error);
      reject({ success: false, error });
    }
  });
}

// Fonction pour arrêter le serveur
function stopServer() {
  return new Promise((resolve, reject) => {
    try {
      server.close(() => {
        console.log('Serveur arrêté');
        resolve({ success: true });
      });
    } catch (error) {
      console.error('Exception lors de l\'arrêt du serveur:', error);
      reject({ success: false, error });
    }
  });
}

module.exports = { startServer, stopServer };
