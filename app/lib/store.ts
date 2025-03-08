// Store temporaire en mémoire pour les offres, réponses et candidats ICE
class Store {
  private offers: Map<string, any>
  private answers: Map<string, any>
  private iceCandidates: Map<string, any[]>

  constructor() {
    this.offers = new Map()
    this.answers = new Map()
    this.iceCandidates = new Map()
  }

  // Offres
  setOffer(id: string, offer: any) {
    console.log("💾 Stockage de l'offre pour l'ID:", id, offer)
    this.offers.set(id, offer)
  }

  getOffer(id: string) {
    const offer = this.offers.get(id)
    console.log("📖 Lecture de l'offre pour l'ID:", id, offer || "non trouvée")
    return offer
  }

  // Réponses
  setAnswer(id: string, answer: any) {
    console.log("💾 Stockage de la réponse pour l'ID:", id, answer)
    this.answers.set(id, answer)
  }

  getAnswer(id: string) {
    const answer = this.answers.get(id)
    console.log("📖 Lecture de la réponse pour l'ID:", id, answer || "non trouvée")
    return answer
  }

  // Candidats ICE
  addIceCandidate(id: string, candidate: any) {
    if (!this.iceCandidates.has(id)) {
      this.iceCandidates.set(id, [])
    }
    console.log("❄️ Ajout d'un candidat ICE pour l'ID:", id, candidate)
    this.iceCandidates.get(id)?.push(candidate)
  }

  getIceCandidates(id: string) {
    const candidates = this.iceCandidates.get(id) || []
    console.log("❄️ Lecture des candidats ICE pour l'ID:", id, candidates.length, "candidats")
    return candidates
  }

  clearIceCandidates(id: string) {
    console.log("🧹 Nettoyage des candidats ICE pour l'ID:", id)
    this.iceCandidates.delete(id)
  }
}

// Export une instance unique
export const store = new Store()
