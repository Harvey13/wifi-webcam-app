/**
 * Camera Mode Page
 * 
 * This page runs on the mobile device and handles:
 * 1. Camera access and streaming
 * 2. WebRTC connection to the viewer
 * 3. Front/back camera switching
 * 4. Connection status and error handling
 */

"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RotateCw, Smartphone } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import { useSearchParams } from "next/navigation"

// Type pour les erreurs
interface MediaError extends Error {
  name: string;
}

export default function Camera() {
  const [isFrontCamera, setIsFrontCamera] = useState(false)
  // État pour le flux vidéo et la connexion
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [connected, setConnected] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pcId, setPcId] = useState<string | null>(null)
  const [cameraStarted, setCameraStarted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [baseUrl, setBaseUrl] = useState('')

  useEffect(() => {
    // Obtenir l'URL de base depuis les paramètres de recherche
    const url = new URL(window.location.href)
    const baseUrl = `${url.protocol}//${url.host}`  // Port 443 est implicite pour HTTPS
    console.log("URL de base pour les appels API:", baseUrl)
    setBaseUrl(baseUrl)

    // Vérifier si nous sommes sur la bonne adresse IP Wi-Fi
    const host = url.host.split(':')[0]
    if (host !== '192.168.1.147') {
      toast({
        title: "Erreur de configuration",
        description: "Veuillez utiliser l'adresse IP Wi-Fi: 192.168.1.147",
        variant: "destructive",
      })
    }
  }, [])

  useEffect(() => {
    // Extraire l'ID du PC de l'URL
    const params = new URLSearchParams(window.location.search)
    const id = params.get('id')

    if (id) {
      console.log("✅ Utilisation de l'ID fourni dans l'URL:", id)
      setPcId(id)
    } else {
      console.log("❌ Aucun ID fourni dans l'URL")
      setErrorMessage("Veuillez scanner le QR code sur l'écran du PC")
    }

    // Nettoyer la connexion peer lors du démontage
    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Fonction utilitaire pour les appels API
  const apiCall = async (endpoint: string, options?: RequestInit) => {
    const url = `${baseUrl}${endpoint}`
    console.log("Appel API vers:", url)
    try {
      const response = await fetch(url, options)
      if (!response.ok) {
        console.error(`Erreur API ${response.status}: ${response.statusText}`)
        throw new Error(`Erreur API ${response.status}: ${response.statusText}`)
      }
      return response
    } catch (error: unknown) {
      const err = error as Error
      console.error("Erreur lors de l'appel API:", err.message)
      throw err
    }
  }

  // Fonction pour démarrer la caméra
  const startCamera = async () => {
    try {
      console.log("🎥 Démarrage de la caméra...")
      console.log("Mode caméra:", isFrontCamera ? "frontale" : "arrière");

      // Vérification détaillée de l'environnement
      console.log("Vérification de l'environnement...")
      console.log("Navigateur:", navigator.userAgent)
      console.log("Contexte sécurisé:", window.isSecureContext)
      console.log("mediaDevices disponible:", !!navigator.mediaDevices)
      console.log("getUserMedia disponible:", !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia))

      // Vérifier si nous sommes dans un contexte sécurisé
      if (!window.isSecureContext) {
        throw new Error("L'accès à la caméra nécessite une connexion HTTPS sécurisée")
      }

      // Vérifier si l'API mediaDevices est disponible
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Votre navigateur ne supporte pas l'accès à la caméra")
      }

      // Configuration de la caméra avec des contraintes plus précises
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: isFrontCamera ? "user" : "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
      }

      // Demander l'accès à la caméra
      console.log("Demande d'accès à la caméra avec les contraintes:", constraints)
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

      // Configurer le flux vidéo
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        setStream(mediaStream)
        setCameraStarted(true)
        console.log("✅ Caméra démarrée avec succès")
        
        // Configurer la connexion WebRTC si un ID est présent dans l'URL
        // On attend que le stream soit correctement configuré avant d'établir la connexion
        if (pcId) {
          console.log("ID PC détecté dans l'URL:", pcId)
          console.log("Stream disponible, configuration de WebRTC...")
          await new Promise(resolve => setTimeout(resolve, 500)) // Attendre que le stream soit stable
          await setupWebRTC(pcId, mediaStream)
        }
      }

      toast({
        title: "Caméra activée",
        description: `Utilisation de la caméra ${isFrontCamera ? "frontale" : "arrière"}`,
      })
    } catch (error: unknown) {
      const err = error as MediaError
      console.error("❌ Erreur d'accès à la caméra:", err)
      console.error("Type d'erreur:", err.constructor.name)
      console.error("Message d'erreur:", err.message)

      let errorMessage = "Impossible d'accéder à la caméra"
      if (err.message.includes("HTTPS")) {
        errorMessage = "L'accès à la caméra nécessite une connexion HTTPS sécurisée"
      } else if (err.name === "NotAllowedError") {
        errorMessage = "L'accès à la caméra a été refusé"
      } else if (err.name === "NotFoundError") {
        errorMessage = "Aucune caméra n'a été trouvée"
      }

      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const setupWebRTC = async (pcId: string, currentStream?: MediaStream) => {
    // Utiliser le stream passé en paramètre ou le stream d'état
    const videoStream = currentStream || stream
    
    if (!videoStream) {
      console.log("❌ Pas de flux vidéo disponible pour la connexion")
      toast({
        title: "Erreur",
        description: "Veuillez d'abord activer la caméra",
        variant: "destructive",
      })
      return
    }

    // S'assurer que nous n'avons pas déjà une connexion active
    if (peerConnectionRef.current) {
      console.log("Fermeture de la connexion précédente...")
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    try {
      console.log("🔄 Démarrage de la connexion WebRTC...")
      console.log("ID PC cible:", pcId)

      // Créer une nouvelle connexion RTCPeerConnection
      const configuration = { 
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ]
      }
      console.log("Configuration WebRTC:", JSON.stringify(configuration, null, 2))

      const peerConnection = new RTCPeerConnection(configuration)
      peerConnectionRef.current = peerConnection

      // Ajouter les tracks au peer connection
      console.log("Ajout des tracks au peer connection")
      videoStream.getTracks().forEach((track) => {
        if (videoStream) {
          console.log(`Ajout du track: ${track.kind} (${track.label})`)
          peerConnection.addTrack(track, videoStream)
        }
      })

      // Gérer les candidats ICE
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log("Nouveau candidat ICE:", event.candidate.type)
          try {
            await apiCall(`/api/ice-candidates/${pcId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(event.candidate)
            })
          } catch (error: unknown) {
            const err = error as Error
            console.error("Erreur lors de l'envoi du candidat ICE:", err.message)
          }
        }
      }

      // Surveiller l'état de la connexion
      peerConnection.oniceconnectionstatechange = () => {
        console.log("État de la connexion ICE:", peerConnection.iceConnectionState)
        if (peerConnection.iceConnectionState === 'connected') {
          toast({
            title: "Connexion établie",
            description: "La connexion WebRTC est active",
          })
        } else if (peerConnection.iceConnectionState === 'disconnected') {
          toast({
            title: "Déconnexion",
            description: "La connexion WebRTC a été perdue",
            variant: "destructive",
          })
        }
      }

      // Créer une offre et l'envoyer au PC
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      
      console.log("Envoi de l'offre au PC...", offer)
      const offerResponse = await apiCall(`/api/offer/${pcId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(offer)
      })

      if (!offerResponse.ok) {
        throw new Error("Erreur lors de l'envoi de l'offre")
      }

      console.log("✅ Offre envoyée avec succès!")
      toast({
        title: "Connexion en cours",
        description: "Offre envoyée au PC, attente de la réponse...",
      })

      // Attendre la réponse du PC
      console.log("🔍 Attente de la réponse du PC...")
      const checkForAnswer = async () => {
        console.log("🔍 Vérification de la réponse...")
        try {
          // Retardons légèrement pour s'assurer que le PC a eu le temps de traiter l'offre
          await new Promise(resolve => setTimeout(resolve, 500))
          
          console.log(`🔍 Vérification de la réponse pour l'ID: ${pcId}`)
          const response = await fetch(`${baseUrl}/api/answer/${pcId}`)
          console.log(`Réponse de l'API answer: ${response.status}`)
          
          if (!response.ok) {
            console.log(`Pas de réponse disponible (${response.status}), nouvelle tentative...`)
            setTimeout(checkForAnswer, 1000)
            return
          }
          
          // Traitement de la réponse
          const answer = await response.json()
          console.log("✅ Réponse reçue du PC:", answer)
          
          if (!answer) {
            console.log("Réponse vide, nouvelle tentative...")
            setTimeout(checkForAnswer, 1000)
            return
          }
          
          // Application de la réponse
          console.log("Application de la réponse...")
          try {
            if (peerConnectionRef.current) {
              await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer))
              console.log("✅ Description distante définie avec succès")
              setConnected(true)
              
              toast({
                title: "Connexion établie",
                description: "WebRTC connecté au PC",
              })
            } else {
              console.error("Erreur: Connexion peer non initialisée")
              setTimeout(checkForAnswer, 1000)
            }
          } catch (error: unknown) {
            const err = error as Error
            console.error("Erreur lors de la définition de la description distante:", err.message)
            setTimeout(checkForAnswer, 1000)
          }
        } catch (error: unknown) {
          const err = error as Error
          console.error("Erreur lors de la récupération de la réponse:", err.message)
          setTimeout(checkForAnswer, 1000)
        }
      }

      checkForAnswer()

      toast({
        title: "Connexion en cours",
        description: `Tentative de connexion au PC: ${pcId.substring(0, 6)}...`,
      })
    } catch (error: unknown) {
      const err = error as Error
      console.error("❌ Erreur de connexion WebRTC:", err.message)
      toast({
        title: "Erreur",
        description: "Impossible de se connecter au PC: " + err.message,
        variant: "destructive",
      })
    }
  }

  const handleConnect = () => {
    if (pcId) {
      setupWebRTC(pcId)
    } else {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un ID de PC",
        variant: "destructive",
      })
    }
  }

  const toggleCamera = async () => {
    // 1. Arrêter la connexion WebRTC actuelle
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
      setConnected(false)
    }
    
    // 2. Arrêter tous les tracks actuels
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    
    // 3. Changer la caméra
    setIsFrontCamera(!isFrontCamera)
    
    // 4. Redémarrer la caméra avec la nouvelle configuration
    if (cameraStarted) {
      // Petit délai pour s'assurer que tout est bien arrêté
      await new Promise(resolve => setTimeout(resolve, 500))
      await startCamera()
    }
  }

  const stopStreaming = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    setCameraStarted(false)
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
              className={`w-full h-auto ${!cameraStarted ? "hidden" : ""}`}
            />

            {!cameraStarted && (
              <div className="aspect-video bg-gray-900 flex items-center justify-center">
                <Smartphone className="w-16 h-16 text-gray-700" />
              </div>
            )}

            <div className="absolute bottom-4 right-4 flex gap-2">
              {cameraStarted && (
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
          {!cameraStarted ? (
            <Button className="w-full" size="lg" onClick={startCamera}>
              Démarrer la caméra
            </Button>
          ) : (
            <Button className="w-full" size="lg" variant="destructive" onClick={stopStreaming}>
              Arrêter la caméra
            </Button>
          )}
        </div>

        {cameraStarted && (
          <div className="mt-8 w-full">
            <h2 className="text-lg font-medium text-center mb-2">Connectez-vous à un PC</h2>
            <div className="flex gap-2">
              <Input placeholder="Entrez l'ID du PC" value={pcId || ''} onChange={(e) => setPcId(e.target.value)} />
              <Button onClick={handleConnect}>Connecter</Button>
            </div>
            <p className="text-sm text-center mt-2 text-gray-500">Ou scannez le QR code affiché sur votre PC</p>
          </div>
        )}
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          Caméra {isFrontCamera ? "frontale" : "arrière"} • ID: {pcId?.substring(0, 6)}
        </p>
      </div>
    </div>
  )
}
