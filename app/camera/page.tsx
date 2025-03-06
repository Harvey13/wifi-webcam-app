"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RotateCw, Smartphone } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"

export default function CameraPage() {
  const [isFrontCamera, setIsFrontCamera] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [peerId, setPeerId] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const { toast } = useToast()

  // Generate a unique ID for this camera session
  useEffect(() => {
    const id = Math.random().toString(36).substring(2, 15)
    setPeerId(id)
    // Vérifier s'il y a un ID dans l'URL
    const searchParams = new URLSearchParams(window.location.search)
    const idFromUrl = searchParams.get("id")
    if (idFromUrl) {
      setPeerId(idFromUrl)
      toast({
        title: "ID PC détecté",
        description: `Prêt à se connecter au PC: ${idFromUrl.substring(0, 6)}...`,
      })
    }
  }, [toast])

  // Get the viewer URL with the peer ID
  const getViewerUrl = () => {
    const baseUrl = window.location.origin
    return `${baseUrl}/viewer?id=${peerId}`
  }

  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      // Définir les contraintes de manière plus explicite
      const constraints = {
        video: {
          facingMode: isFrontCamera ? "user" : "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      }

      console.log("Demande d'accès à la caméra avec mode:", isFrontCamera ? "frontale" : "arrière")
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      setIsStreaming(true)

      // Si nous avons un ID de PC, connectons-nous immédiatement
      const searchParams = new URLSearchParams(window.location.search)
      const idFromUrl = searchParams.get("id")
      if (idFromUrl) {
        connectToPC(idFromUrl)
      }

      toast({
        title: "Caméra activée",
        description: `Utilisation de la caméra ${isFrontCamera ? "frontale" : "arrière"}`,
      })
    } catch (error) {
      console.error("Erreur d'accès à la caméra:", error)
      toast({
        title: "Erreur",
        description: "Impossible d'accéder à la caméra. Essayez l'autre caméra.",
        variant: "destructive",
      })
    }
  }

  const connectToPC = async (pcId: string) => {
    if (!streamRef.current) {
      toast({
        title: "Erreur",
        description: "Veuillez d'abord activer la caméra",
        variant: "destructive",
      })
      return
    }

    try {
      // Créer une nouvelle connexion RTCPeerConnection
      const configuration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
      const peerConnection = new RTCPeerConnection(configuration)
      peerConnectionRef.current = peerConnection

      // Ajouter tous les tracks du stream à la connexion peer
      streamRef.current.getTracks().forEach((track) => {
        if (streamRef.current) {
          peerConnection.addTrack(track, streamRef.current)
        }
      })

      // Configurer les gestionnaires d'événements ICE
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // Dans une application réelle, vous enverriez ceci au serveur de signalisation
          console.log("Nouveau candidat ICE:", event.candidate)
          const candidates = JSON.parse(localStorage.getItem(`ice-candidates-${pcId}`) || "[]")
          candidates.push(event.candidate)
          localStorage.setItem(`ice-candidates-${pcId}`, JSON.stringify(candidates))
        }
      }

      // Vérifier s'il y a une offre du PC
      const checkForOffer = () => {
        const offerString = localStorage.getItem(`offer-${pcId}`)
        if (offerString) {
          const offer = JSON.parse(offerString)
          handleRemoteOffer(offer, pcId)
          localStorage.removeItem(`offer-${pcId}`)
        } else {
          setTimeout(checkForOffer, 1000)
        }
      }

      checkForOffer()

      toast({
        title: "Connexion en cours",
        description: `Tentative de connexion au PC: ${pcId.substring(0, 6)}...`,
      })
    } catch (error) {
      console.error("Erreur de connexion:", error)
      toast({
        title: "Erreur",
        description: "Impossible de se connecter au PC",
        variant: "destructive",
      })
    }
  }

  const handleRemoteOffer = async (offer: RTCSessionDescriptionInit, pcId: string) => {
    if (!peerConnectionRef.current) return

    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await peerConnectionRef.current.createAnswer()
      await peerConnectionRef.current.setLocalDescription(answer)

      // Envoyer la réponse (simplifié pour la démo)
      localStorage.setItem(`answer-${pcId}`, JSON.stringify(answer))

      // Vérifier les candidats ICE du PC
      const checkForIceCandidates = () => {
        const candidatesString = localStorage.getItem(`pc-ice-candidates-${pcId}`)
        if (candidatesString) {
          const candidates = JSON.parse(candidatesString)
          candidates.forEach((candidate: RTCIceCandidateInit) => {
            peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(candidate))
          })
          localStorage.removeItem(`pc-ice-candidates-${pcId}`)
        } else {
          setTimeout(checkForIceCandidates, 1000)
        }
      }

      checkForIceCandidates()

      toast({
        title: "Connexion établie",
        description: "Votre caméra est maintenant connectée au PC",
      })
    } catch (error) {
      console.error("Erreur lors de la gestion de l'offre:", error)
      toast({
        title: "Erreur",
        description: "Problème lors de la connexion au PC",
        variant: "destructive",
      })
    }
  }

  const handleConnect = () => {
    if (peerId.trim()) {
      connectToPC(peerId)
    } else {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un ID de PC",
        variant: "destructive",
      })
    }
  }

  const toggleCamera = () => {
    setIsFrontCamera(!isFrontCamera)
    if (isStreaming) {
      startCamera()
    }
  }

  const stopStreaming = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    setIsStreaming(false)
  }

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 p-4">
      <div className="w-full max-w-md flex flex-col items-center">
        <h1 className="text-2xl font-bold text-blue-900 mb-4">Mode Caméra</h1>

        <Card className="w-full overflow-hidden">
          <CardContent className="p-0 relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-auto ${!isStreaming ? "hidden" : ""}`}
            />

            {!isStreaming && (
              <div className="aspect-video bg-gray-900 flex items-center justify-center">
                <Smartphone className="w-16 h-16 text-gray-700" />
              </div>
            )}

            <div className="absolute bottom-4 right-4 flex gap-2">
              {isStreaming && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full bg-white/80 backdrop-blur-sm"
                  onClick={toggleCamera}
                >
                  <RotateCw className="h-5 w-5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 w-full">
          {!isStreaming ? (
            <Button className="w-full" size="lg" onClick={startCamera}>
              Démarrer la caméra
            </Button>
          ) : (
            <Button className="w-full" size="lg" variant="destructive" onClick={stopStreaming}>
              Arrêter la caméra
            </Button>
          )}
        </div>

        {isStreaming && (
          <div className="mt-8 w-full">
            <h2 className="text-lg font-medium text-center mb-2">Connectez-vous à un PC</h2>
            <div className="flex gap-2">
              <Input placeholder="Entrez l'ID du PC" value={peerId} onChange={(e) => setPeerId(e.target.value)} />
              <Button onClick={handleConnect}>Connecter</Button>
            </div>
            <p className="text-sm text-center mt-2 text-gray-500">Ou scannez le QR code affiché sur votre PC</p>
          </div>
        )}
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          Caméra {isFrontCamera ? "frontale" : "arrière"} • ID: {peerId.substring(0, 6)}
        </p>
      </div>
    </div>
  )
}

