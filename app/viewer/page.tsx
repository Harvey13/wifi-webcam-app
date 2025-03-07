/**
 * Viewer Mode Page
 * 
 * This page runs on the PC/desktop and handles:
 * 1. QR code generation for easy mobile connection
 * 2. WebRTC connection to receive camera stream
 * 3. Video display and connection status
 * 4. Network IP detection and URL generation
 */

"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { useSearchParams } from "next/navigation"
import { Monitor, RefreshCw } from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import { internalIpV4 } from 'internal-ip';

export default function ViewerPage() {
  const [peerId, setPeerId] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [origin, setOrigin] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const { toast } = useToast()
  const searchParams = useSearchParams()

  useEffect(() => {
    const getLocalNetworkIP = async () => {
      try {
        console.log(" Recherche de l'adresse IP locale...");
        const ip = await internalIpV4();
        console.log(" Adresse IP trouvée:", ip);
        setOrigin(`https://${ip}:3000`);
      } catch (error) {
        console.error(" Erreur lors de la récupération de l'IP:", error);
      }
    };

    if (typeof window !== 'undefined') {
      getLocalNetworkIP();
    }
  }, []);

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
      console.log(" Démarrage de la connexion WebRTC...");
      console.log("ID de la caméra cible:", id);

      // Create a new RTCPeerConnection
      const configuration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
      console.log("Configuration WebRTC:", JSON.stringify(configuration, null, 2));
      
      const peerConnection = new RTCPeerConnection(configuration)
      peerConnectionRef.current = peerConnection

      // Set up event handlers
      peerConnection.ontrack = (event) => {
        console.log(" Track reçu:", event.track.kind);
        console.log("Informations du track:", {
          kind: event.track.kind,
          id: event.track.id,
          label: event.track.label,
          enabled: event.track.enabled,
          muted: event.track.muted
        });

        if (videoRef.current && event.streams[0]) {
          console.log("Association du flux vidéo à l'élément video");
          videoRef.current.srcObject = event.streams[0]
          setIsConnected(true)
          setIsConnecting(false)

          toast({
            title: "Connexion établie",
            description: "La caméra est maintenant connectée",
          })
        }
      }

      peerConnection.oniceconnectionstatechange = () => {
        console.log("État de la connexion ICE:", peerConnection.iceConnectionState);
      };

      peerConnection.onconnectionstatechange = () => {
        console.log("État de la connexion peer:", peerConnection.connectionState);
      };

      // Configurer les gestionnaires d'événements ICE
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(" Nouveau candidat ICE:", event.candidate.type);
          const candidates = JSON.parse(localStorage.getItem(`pc-ice-candidates-${id}`) || "[]")
          candidates.push(event.candidate)
          localStorage.setItem(`pc-ice-candidates-${id}`, JSON.stringify(candidates))
        }
      }

      // Create an offer
      console.log("Création de l'offre WebRTC...");
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })
      console.log("Offre créée:", offer.type);
      
      await peerConnection.setLocalDescription(offer)
      console.log("Description locale définie");

      // Send the offer to the camera (simplified for demo)
      localStorage.setItem(`offer-${id}`, JSON.stringify(offer))
      console.log("Offre enregistrée dans le localStorage");

      // Wait for answer (simplified for demo)
      console.log(" En attente de la réponse de la caméra...");
      checkForAnswer(id)

      toast({
        title: "Connexion en cours",
        description: "Tentative de connexion à la caméra...",
      })
    } catch (error) {
      console.error(" Erreur de connexion:", error);
      console.log("Message d'erreur:", error.message);
      setIsConnecting(false)
      toast({
        title: "Erreur",
        description: "Impossible de se connecter à la caméra: " + error.message,
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

        <Card className="w-full overflow-hidden mb-4">
          <CardContent className="p-0 relative">
            <video ref={videoRef} autoPlay playsInline className={`w-full h-auto ${!isConnected ? "hidden" : ""}`} />

            {!isConnected && (
              <div className="aspect-video bg-gray-900 flex items-center justify-center">
                <Monitor className="w-16 h-16 text-gray-700" />
              </div>
            )}
          </CardContent>
        </Card>

        {!isConnected ? (
          <div className="w-full">
            <Button 
              onClick={() => connectToCamera(peerId)} 
              disabled={isConnecting} 
              className="w-full mb-4"
            >
              {isConnecting ? "Connexion en cours..." : "Réessayer la connexion"}
            </Button>

            {origin && (
              <div className="bg-white p-4 rounded-lg shadow-md">
                <h2 className="text-lg font-medium text-center mb-2">Scannez ce QR code avec votre téléphone</h2>
                <div className="flex justify-center">
                  <QRCodeCanvas value={`${origin}/camera?id=${peerId}`} size={200} />
                </div>
                <p className="text-sm text-center mt-2 text-gray-500">ID de connexion: {peerId}</p>
                <p className="text-sm text-center mt-1 text-gray-500">
                  Ou ouvrez {origin}/camera sur votre téléphone
                </p>
              </div>
            )}
          </div>
        ) : (
          <Button 
            onClick={disconnectFromCamera} 
            variant="destructive" 
            className="w-full"
          >
            Déconnecter la caméra
          </Button>
        )}
      </div>
    </div>
  )
}
