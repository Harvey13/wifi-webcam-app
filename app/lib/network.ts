'use client';

import { useState, useEffect } from 'react';

// Liste des adresses IP privées connues (pour le débogage)
const KNOWN_WIFI_IPS = [
  '192.168.1.147', // Votre adresse Wi-Fi
  '192.168.1.161'  // Votre adresse Ethernet
];

const isPrivateIP = (ip: string): boolean => {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') || ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') || ip.startsWith('172.19.') ||
    ip.startsWith('172.20.') || ip.startsWith('172.21.') ||
    ip.startsWith('172.22.') || ip.startsWith('172.23.') ||
    ip.startsWith('172.24.') || ip.startsWith('172.25.') ||
    ip.startsWith('172.26.') || ip.startsWith('172.27.') ||
    ip.startsWith('172.28.') || ip.startsWith('172.29.') ||
    ip.startsWith('172.30.') || ip.startsWith('172.31.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('169.254.')
  );
};

export const useNetworkAddresses = () => {
  const [addresses, setAddresses] = useState<{ address: string, isWifi: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isWifiConnected, setIsWifiConnected] = useState(false);

  useEffect(() => {
    const getNetworkAddresses = async () => {
      try {
        // Vérifier si on est bien côté client
        if (typeof window === 'undefined') {
          setError("Détection d'adresse indisponible côté serveur");
          return;
        }

        // Approche 1: Utiliser les adresses IP connues en priorité
        const knownAddresses = KNOWN_WIFI_IPS.map(ip => ({
          address: ip,
          isWifi: true
        }));

        if (knownAddresses.length > 0) {
          console.log("✅ Utilisation d'adresses IP connues:", knownAddresses);
          setAddresses(knownAddresses);
          setIsWifiConnected(true);
          return;
        }

        // Approche 2: Utiliser RTCPeerConnection comme fallback
        const peerConnection = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        peerConnection.createDataChannel('');

        const addressList: { address: string, isWifi: boolean }[] = [];
        let hasPrivateIp = false;

        peerConnection.onicecandidate = (event) => {
          if (!event.candidate) return;

          const candidateInfo = event.candidate.candidate;
          
          if (candidateInfo) {
            const ipMatch = /\d+\.\d+\.\d+\.\d+/.exec(candidateInfo);
            if (ipMatch) {
              const ipAddress = ipMatch[0];
              
              if (!ipAddress.startsWith('127.')) {
                const isPrivate = isPrivateIP(ipAddress);
                const isWifiNetwork = isPrivate;
                
                if (isPrivate) {
                  console.log("✅ Adresse privée détectée:", ipAddress);
                  hasPrivateIp = true;
                } else {
                  console.log("ℹ️ Adresse publique détectée (ignorée pour WebRTC local):", ipAddress);
                }
                
                if (!addressList.some(item => item.address === ipAddress)) {
                  if (isPrivate) {
                    addressList.push({ address: ipAddress, isWifi: isWifiNetwork });
                  }
                }
              }
            }
          }
          
          if (hasPrivateIp) {
            setIsWifiConnected(true);
          }
          
          setAddresses(addressList);
        };

        try {
          await peerConnection.createOffer();
          await peerConnection.setLocalDescription();
          
          setTimeout(() => {
            peerConnection.close();
            
            if (addressList.length === 0) {
              console.warn("⚠️ Aucune adresse réseau privée détectée, utilisation de localhost");
              // Si aucune adresse n'est trouvée, utiliser les adresses connues comme dernier recours
              if (KNOWN_WIFI_IPS.length > 0) {
                const knownAddresses = KNOWN_WIFI_IPS.map(ip => ({
                  address: ip,
                  isWifi: true
                }));
                setAddresses(knownAddresses);
                setIsWifiConnected(true);
              } else {
                // Si vraiment rien ne fonctionne, utiliser localhost
                addressList.push({ address: 'localhost', isWifi: false });
                setAddresses(addressList);
                setError("Aucune adresse réseau locale trouvée, utilisation de localhost");
              }
            } else {
              console.log("✅ Adresses réseau locales détectées:", addressList);
              setIsWifiConnected(true);
            }
          }, 2000);
        } catch (err) {
          console.error("Erreur lors de la récupération des adresses:", err);
          setError("Erreur lors de la détection des adresses réseau");
        }
      } catch (err) {
        console.error("Erreur lors de l'initialisation:", err);
        setError("Erreur lors de la détection du réseau");
      }
    };

    getNetworkAddresses();
  }, []);

  return { addresses, isWifiConnected, error };
};

export const getNetworkConfig = (addresses: { address: string, isWifi: boolean }[]) => {
  // Privilégier l'adresse Wi-Fi connue
  const wifiAddress = addresses.find(a => KNOWN_WIFI_IPS.includes(a.address))?.address;
  
  // Sinon, utiliser la première adresse Wi-Fi détectée
  const detectedWifiAddress = addresses.find(a => a.isWifi && a.address.includes('.'))?.address;
  
  // Sinon, utiliser la première adresse IPv4 valide
  const fallbackAddress = addresses.find(a => a.address.includes('.') && a.address !== 'localhost')?.address;
  
  // En dernier recours, utiliser localhost
  const ipAddress = wifiAddress || detectedWifiAddress || fallbackAddress || 'localhost';
  
  // Port par défaut
  const port = 3000;
  
  // Determiner si on est en HTTPS
  const useHttps = process.env.NODE_ENV === 'production';
  
  // Créer l'URL de base
  const baseUrl = `${useHttps ? 'https' : 'http'}://${ipAddress}${port ? `:${port}` : ''}`;
  
  console.log("Adresses détectées:", addresses);
  console.log("Adresse IP choisie pour WebRTC local:", ipAddress);
  console.log("URL de base:", baseUrl);
  
  return {
    ipAddress,
    port,
    useHttps,
    baseUrl
  };
};