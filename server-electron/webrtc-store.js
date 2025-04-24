// Store pour gérer les offres, réponses et candidats ICE WebRTC
class WebRTCStore {
  constructor() {
    this.offers = new Map();
    this.answers = new Map();
    this.iceCandidates = new Map();
  }

  // Gestion des offres
  setOffer(id, offer) {
    console.log("💾 Stockage de l'offre pour l'ID:", id);
    this.offers.set(id, offer);
  }

  getOffer(id) {
    const offer = this.offers.get(id);
    console.log("📖 Lecture de l'offre pour l'ID:", id, offer ? "trouvée" : "non trouvée");
    return offer;
  }

  // Gestion des réponses
  setAnswer(id, answer) {
    console.log("💾 Stockage de la réponse pour l'ID:", id);
    this.answers.set(id, answer);
  }

  getAnswer(id) {
    const answer = this.answers.get(id);
    console.log("📖 Lecture de la réponse pour l'ID:", id, answer ? "trouvée" : "non trouvée");
    return answer;
  }

  // Gestion des candidats ICE
  addIceCandidate(id, candidate) {
    if (!this.iceCandidates.has(id)) {
      this.iceCandidates.set(id, []);
    }
    console.log("❄️ Ajout d'un candidat ICE pour l'ID:", id);
    this.iceCandidates.get(id).push(candidate);
  }

  getIceCandidates(id) {
    const candidates = this.iceCandidates.get(id) || [];
    console.log("❄️ Lecture des candidats ICE pour l'ID:", id, candidates.length, "candidats");
    return candidates;
  }

  clearIceCandidates(id) {
    console.log("🧹 Nettoyage des candidats ICE pour l'ID:", id);
    this.iceCandidates.delete(id);
  }
}

module.exports = new WebRTCStore();
