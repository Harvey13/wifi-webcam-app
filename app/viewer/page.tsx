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

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { useSearchParams } from "next/navigation"
import { Monitor, RefreshCw } from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"

export default function Viewer() {
  // États
  const [id, setId] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const { toast } = useToast()
  const searchParams = useSearchParams()

  // Configure l'adresse IP Wi-Fi
  const [origin, setOrigin] = useState('')
  
  useEffect(() => {
    // Utilisez directement l'IP fixe
    const ipAddress = '192.168.1.147'
    console.log("✅ Utilisation de l'adresse IP Wi-Fi fixe:", ipAddress)
    
    // Configurez l'origine en fonction de l'adresse IP
    const origin = `https://${ipAddress}`
    setOrigin(origin)
    console.log("URL de base configurée:", origin)
    
    return () => {
      // Nettoyage de la connexion peer lors du démontage
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
    }
  }, [])

  // Génération de l'ID ou utilisation de l'ID de l'URL
  useEffect(() => {
    const idFromUrl = searchParams.get("id")
    
    if (idFromUrl) {
      console.log("✅ Utilisation de l'ID fourni dans l'URL:", idFromUrl)
      setId(idFromUrl)
    } else {
      // Générer un ID aléatoire si aucun n'est fourni
      const newId = Math.random().toString(36).substring(2, 14)
      console.log("✅ Génération d'un nouvel ID:", newId)
      setId(newId)
    }
  }, [searchParams])

  // Crée le QR code pour la connexion
  const qrCodeValue = useMemo(() => {
    if (!origin || !id) return ''
    return `${origin}/camera?id=${id}`
  }, [origin, id])
  
  // Configuration WebRTC et connexion à la caméra
  const connectToCamera = useCallback(() => {
    if (!origin || !id) {
      setErrorMessage("L'adresse IP ou l'ID n'est pas disponible")
      return
    }

    setIsWaiting(true)
    setErrorMessage(null)
    
    console.log("🔄 Démarrage de la connexion WebRTC...")
    console.log("ID de connexion:", id)

    // Configuration WebRTC
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    }
    console.log("Configuration WebRTC:", configuration)

    const peerConnection = new RTCPeerConnection(configuration)
    peerConnectionRef.current = peerConnection

    // Gestion des tracks
    peerConnection.ontrack = (event) => {
      console.log("✅ Track reçu:", event.track.kind)
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0]
        setIsConnected(true)
        setIsWaiting(false)
        
        toast({
          title: "Connecté!",
          description: "Flux vidéo de la caméra reçu",
        })
      }
    }

    // Gestion des candidats ICE
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          console.log("❄️ Envoi d'un candidat ICE à la caméra")
          await fetch(`${origin}/api/ice-candidates/${id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event.candidate)
          })
        } catch (error) {
          console.error("Erreur lors de l'envoi du candidat ICE:", error)
        }
      }
    }

    // Attendre l'offre de la caméra
    console.log("🔍 Attente de l'offre de la caméra...")
    const checkForOffer = async () => {
      try {
        console.log(`🔍 Vérification de l'offre pour l'ID: ${id}`)
        const response = await fetch(`${origin}/api/offer/${id}`)
        console.log(`Réponse de l'API offer: ${response.status}`)
        
        if (!response.ok) {
          console.log("En attente de l'offre... (status:", response.status, ")")
          setTimeout(checkForOffer, 1000)
          return
        }

        const offer = await response.json()
        if (!offer) {
          console.log("Offre vide, nouvelle tentative...")
          setTimeout(checkForOffer, 1000)
          return
        }
        
        console.log("✅ Offre reçue de la caméra!", offer)
        
        try {
          // Définir l'offre comme description distante
          console.log("Configuration de l'offre comme description distante...")
          await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
          console.log("✅ Description distante définie")
          
          // Créer et envoyer la réponse
          console.log("Création de la réponse...")
          const answer = await peerConnection.createAnswer()
          console.log("Réponse créée:", answer)
          console.log("Définition de la description locale...")
          await peerConnection.setLocalDescription(answer)
          console.log("✅ Description locale définie")
          
          console.log("Envoi de la réponse à la caméra...")
          console.log(`Envoi vers: ${origin}/api/answer/${id}`)
          const answerResponse = await fetch(`${origin}/api/answer/${id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(answer)
          })
          
          console.log("Réponse du serveur pour l'envoi de l'answer:", answerResponse.status)
          
          if (answerResponse.ok) {
            console.log("✅ Réponse envoyée à la caméra!")
            // Vérifions que notre réponse a bien été enregistrée
            setTimeout(async () => {
              try {
                const verificationResponse = await fetch(`${origin}/api/answer/${id}`)
                console.log("Vérification de l'enregistrement de la réponse:", verificationResponse.status)
                if (verificationResponse.ok) {
                  const savedAnswer = await verificationResponse.json()
                  console.log("Réponse enregistrée:", savedAnswer)
                }
              } catch (error) {
                console.error("Erreur lors de la vérification de la réponse:", error)
              }
            }, 500)
            
            toast({
              title: "Connexion en cours",
              description: "Réponse envoyée à la caméra",
            })
          } else {
            throw new Error(`Erreur lors de l'envoi de la réponse: ${answerResponse.status}`)
          }
        } catch (error: any) {
          console.error("Erreur lors du traitement de l'offre:", error)
          toast({
            title: "Erreur",
            description: "Erreur lors du traitement de l'offre: " + (error.message || String(error)),
            variant: "destructive",
          })
          setTimeout(checkForOffer, 1000)
        }
      } catch (error: any) {
        console.error("Erreur lors de la récupération de l'offre:", error)
        setTimeout(checkForOffer, 1000)
      }
    }

    checkForOffer()

    // Vérifier périodiquement les candidats ICE
    const checkForIceCandidates = async () => {
      try {
        const response = await fetch(`${origin}/api/ice-candidates/${id}`)
        if (response.ok) {
          const candidates = await response.json()
          for (const candidate of candidates) {
            try {
              await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
              console.log("❄️ Candidat ICE ajouté")
            } catch (error) {
              console.error("Erreur lors de l'ajout du candidat ICE:", error)
            }
          }
        }
        setTimeout(checkForIceCandidates, 1000)
      } catch (error) {
        console.error("Erreur lors de la récupération des candidats ICE:", error)
        setTimeout(checkForIceCandidates, 1000)
      }
    }

    checkForIceCandidates()
  }, [origin, id, toast])

  // Lance la connexion automatiquement quand l'ID et l'origine sont disponibles
  useEffect(() => {
    if (origin && id) {
      connectToCamera()
    }
  }, [origin, id, connectToCamera])

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
              onClick={connectToCamera} 
              disabled={isWaiting} 
              className="w-full mb-4"
            >
              {isWaiting ? "Connexion en cours..." : "Réessayer la connexion"}
            </Button>

            {origin && (
              <div className="bg-white p-4 rounded-lg shadow-md">
                <h2 className="text-lg font-medium text-center mb-2">Scannez ce QR code avec votre téléphone</h2>
                <div className="flex justify-center">
                  <QRCodeCanvas value={qrCodeValue} size={200} />
                </div>
                <p className="text-sm text-center mt-2 text-gray-500">ID de connexion: {id}</p>
                <p className="text-sm text-center mt-1 text-gray-500">
                  Ou ouvrez {origin}/camera sur votre téléphone
                </p>
              </div>
            )}
          </div>
        ) : (
          <Button 
            onClick={() => {
              if (peerConnectionRef.current) {
                peerConnectionRef.current.close()
                peerConnectionRef.current = null
              }

              if (videoRef.current) {
                videoRef.current.srcObject = null
              }

              setIsConnected(false)
            }} 
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
