"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { useSearchParams } from "next/navigation"
import { Monitor, RefreshCw } from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"

export default function ViewerPage() {
  const [peerId, setPeerId] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const { toast } = useToast()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Générer un ID unique pour cette session
    const id = Math.random().toString(36).substring(2, 15)
    setPeerId(id)

    // Démarrer automatiquement la connexion
    setTimeout(() => {
      if (!isConnected && !isConnecting) {
        connectToCamera(id)
      }
    }, 1000)
  }, [isConnected, isConnecting])

  const connectToCamera = async (id: string) => {
    setIsConnecting(true)

    try {
      // Create a new RTCPeerConnection
      const configuration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
      const peerConnection = new RTCPeerConnection(configuration)
      peerConnectionRef.current = peerConnection

      // Set up event handlers
      peerConnection.ontrack = (event) => {
        console.log("Track reçu:", event.track.kind)
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0]
          setIsConnected(true)
          setIsConnecting(false)

          toast({
            title: "Connexion établie",
            description: "La caméra est maintenant connectée",
          })
        }
      }

      // Configurer les gestionnaires d'événements ICE
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // Dans une application réelle, vous enverriez ceci au serveur de signalisation
          console.log("Nouveau candidat ICE:", event.candidate)
          const candidates = JSON.parse(localStorage.getItem(`pc-ice-candidates-${id}`) || "[]")
          candidates.push(event.candidate)
          localStorage.setItem(`pc-ice-candidates-${id}`, JSON.stringify(candidates))
        }
      }

      // Create an offer
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })
      await peerConnection.setLocalDescription(offer)

      // Send the offer to the camera (simplified for demo)
      localStorage.setItem(`offer-${id}`, JSON.stringify(offer))

      // Wait for answer (simplified for demo)
      checkForAnswer(id)

      toast({
        title: "Connexion en cours",
        description: "Tentative de connexion à la caméra...",
      })
    } catch (error) {
      console.error("Erreur de connexion:", error)
      setIsConnecting(false)
      toast({
        title: "Erreur",
        description: "Impossible de se connecter à la caméra",
        variant: "destructive",
      })
    }
  }

  const checkForAnswer = (id: string) => {
    const checkInterval = setInterval(() => {
      const answerString = localStorage.getItem(`answer-${id}`)
      if (answerString) {
        const answer = JSON.parse(answerString)
        handleRemoteAnswer(answer, id)
        localStorage.removeItem(`answer-${id}`)
        clearInterval(checkInterval)
      }
    }, 1000)

    // Clear interval after 30 seconds if no answer
    setTimeout(() => {
      clearInterval(checkInterval)
      if (!isConnected && isConnecting) {
        setIsConnecting(false)
        toast({
          title: "Connexion échouée",
          description: "Aucune réponse de la caméra",
          variant: "destructive",
        })
      }
    }, 30000)
  }

  const handleRemoteAnswer = async (answer: RTCSessionDescriptionInit, id: string) => {
    if (!peerConnectionRef.current) return

    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer))

      // Vérifier les candidats ICE de la caméra
      const checkForIceCandidates = () => {
        const candidatesString = localStorage.getItem(`ice-candidates-${id}`)
        if (candidatesString) {
          const candidates = JSON.parse(candidatesString)
          candidates.forEach((candidate: RTCIceCandidateInit) => {
            peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(candidate))
          })
          localStorage.removeItem(`ice-candidates-${id}`)
        } else {
          setTimeout(checkForIceCandidates, 1000)
        }
      }

      checkForIceCandidates()
    } catch (error) {
      console.error("Erreur lors de la gestion de la réponse:", error)
      toast({
        title: "Erreur",
        description: "Problème lors de la connexion à la caméra",
        variant: "destructive",
      })
    }
  }

  const disconnectFromCamera = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setIsConnected(false)
  }

  const handleConnect = () => {
    if (peerId.trim()) {
      connectToCamera(peerId)
    } else {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un ID de caméra",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 p-4">
      <div className="w-full max-w-2xl flex flex-col items-center">
        <h1 className="text-2xl font-bold text-blue-900 mb-4">Mode Visualisation</h1>

        <Card className="w-full overflow-hidden">
          <CardContent className="p-0 relative">
            <video ref={videoRef} autoPlay playsInline className={`w-full h-auto ${!isConnected ? "hidden" : ""}`} />

            {!isConnected && (
              <div className="aspect-video bg-gray-900 flex items-center justify-center">
                <Monitor className="w-16 h-16 text-gray-700" />
              </div>
            )}

            {isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <RefreshCw className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
          </CardContent>
        </Card>

        {!isConnected ? (
          <div className="mt-4 w-full">
            <h2 className="text-lg font-medium text-center mb-2">Scannez ce QR code avec votre téléphone</h2>
            <div className="flex justify-center">
              <QRCodeCanvas value={`${window.location.origin}/camera?id=${peerId}`} size={200} />
            </div>
            <p className="text-sm text-center mt-2 text-gray-500">ID de connexion: {peerId}</p>
            <p className="text-sm text-center mt-1 text-gray-500">
              Ou ouvrez cette URL sur votre téléphone: {`${window.location.origin}/camera?id=${peerId}`}
            </p>
            <div className="mt-4 flex justify-center">
              <Button onClick={() => connectToCamera(peerId)} disabled={isConnecting} className="w-full max-w-xs">
                {isConnecting ? "Connexion en cours..." : "Réessayer la connexion"}
              </Button>
            </div>
          </div>
        ) : (
          <Button className="mt-4 w-full" variant="destructive" onClick={disconnectFromCamera}>
            Déconnecter
          </Button>
        )}
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>{isConnected ? `Connecté à la caméra: ${peerId.substring(0, 6)}` : "En attente de connexion"}</p>
      </div>
    </div>
  )
}

