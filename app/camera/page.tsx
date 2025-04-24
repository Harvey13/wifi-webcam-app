/**
 * Camera Mode Page - Version optimisée
 */

"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RotateCw, Smartphone } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import { useSearchParams } from "next/navigation"

export default function Camera() {
  const [isFrontCamera, setIsFrontCamera] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [connected, setConnected] = useState(false)
  const [pcId, setPcId] = useState<string | null>(null)
  const [cameraStarted, setCameraStarted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const { toast } = useToast()
  
  // Initialiser l'URL de base
  const baseUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.host}`
    : '';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) setPcId(id);

    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const apiCall = async (endpoint: string, options?: RequestInit) => {
    try {
      console.log(`Appel API: ${baseUrl}${endpoint}`);
      const response = await fetch(`${baseUrl}${endpoint}`, options);
      if (!response.ok) throw new Error(`Erreur API ${response.status}`);
      return response;
    } catch (error) {
      console.error("Erreur API:", error);
      throw error;
    }
  };

  const toggleCamera = async () => {
    if (!cameraStarted) return;

    try {
      const newConstraints = {
        video: {
          facingMode: !isFrontCamera ? "user" : "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      // 1. Obtenir le nouveau stream
      const newStream = await navigator.mediaDevices.getUserMedia(newConstraints);
      
      // 2. Mettre à jour la vidéo
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      // 3. Si connecté, mettre à jour le track WebRTC
      if (peerConnectionRef.current && connected) {
        const sender = peerConnectionRef.current.getSenders()
          .find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newStream.getVideoTracks()[0]);
        }
      }

      // 4. Nettoyer l'ancien stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      setStream(newStream);
      setIsFrontCamera(!isFrontCamera);
      
      toast({
        title: "Caméra basculée",
        description: `Mode ${!isFrontCamera ? "frontal" : "arrière"}`,
      });
    } catch (error) {
      console.error("Erreur basculement caméra:", error);
      toast({
        title: "Erreur",
        description: "Impossible de basculer la caméra",
        variant: "destructive",
      });
    }
  };

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: isFrontCamera ? "user" : "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setCameraStarted(true);

        if (pcId) {
          await setupWebRTC(pcId, mediaStream);
        }
      }
    } catch (error) {
      console.error("Erreur caméra:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'accéder à la caméra",
        variant: "destructive",
      });
    }
  };

  const setupWebRTC = async (pcId: string, videoStream: MediaStream) => {
    if (!videoStream) return;

    // Nettoyer l'ancienne connexion
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    peerConnection.onconnectionstatechange = () => {
      setConnected(peerConnection.connectionState === 'connected');
    };

    videoStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, videoStream);
    });

    // Buffer pour les candidats ICE
    let iceCandidates = [];
    let iceTimeout = null;

    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        iceCandidates.push(event.candidate);
        
        if (iceTimeout) clearTimeout(iceTimeout);
        
        iceTimeout = setTimeout(async () => {
          if (iceCandidates.length > 0) {
            try {
              await apiCall(`/api/ice-candidates/${pcId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(iceCandidates)
              });
              iceCandidates = [];
            } catch (error) {
              console.error("Erreur envoi candidats ICE:", error);
            }
          }
        }, 1000);
      }
    };

    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      await apiCall(`/api/offer/${pcId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offer)
      });

      peerConnectionRef.current = peerConnection;

      const waitForAnswer = async () => {
        try {
          const response = await apiCall(`/api/answer/${pcId}`);
          const answer = await response.json();
          
          if (answer && peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(answer)
            );
          }
        } catch (error) {
          console.error("Erreur récupération réponse:", error);
          setTimeout(waitForAnswer, 1000);
        }
      };

      waitForAnswer();
    } catch (error) {
      console.error("Erreur WebRTC:", error);
      toast({
        title: "Erreur",
        description: "Erreur de connexion WebRTC",
        variant: "destructive",
      });
    }
  };

  const stopStreaming = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    setStream(null);
    peerConnectionRef.current = null;
    setCameraStarted(false);
    setConnected(false);
  };

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
              <Input 
                placeholder="ID du PC" 
                value={pcId || ''} 
                onChange={(e) => setPcId(e.target.value)} 
              />
              <Button onClick={() => pcId && setupWebRTC(pcId, stream!)}>
                Connecter
              </Button>
            </div>
            <p className="text-sm text-center mt-2 text-gray-500">
              Ou scannez le QR code affiché sur votre PC
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          Caméra {isFrontCamera ? "frontale" : "arrière"}
          {pcId && <span> • ID: {pcId.substring(0, 6)}</span>}
        </p>
        {connected && (
          <p className="text-green-600 mt-1">Connecté au PC</p>
        )}
      </div>
    </div>
  );
}
