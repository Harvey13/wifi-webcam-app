/**
 * Home Page (Landing Page)
 * 
 * Cette page redirige automatiquement vers le mode visualisation (viewer)
 * qui est le mode par défaut pour l'utilisation sur PC.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirection automatique vers le mode visualisation
    router.push("/viewer");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 p-4">
      <div className="flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
        <h2 className="text-xl font-semibold text-blue-900">Chargement du mode visualisation...</h2>
      </div>
    </div>
  );
}
