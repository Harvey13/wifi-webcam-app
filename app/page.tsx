/**
 * Home Page (Landing Page)
 * 
 * This is the main landing page of the WiFi Webcam application.
 * It provides navigation buttons to either:
 * 1. Camera Mode (for mobile devices)
 * 2. Viewer Mode (for PC/desktop)
 */

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Camera, Monitor } from "lucide-react"

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-900">WiFi Webcam</h1>
          <p className="mt-2 text-gray-600">Utilisez votre téléphone comme webcam pour votre PC</p>
        </div>

        <div className="grid grid-cols-1 gap-6 mt-8">
          <Link href="/camera" className="w-full">
            <Button className="w-full h-20 text-lg flex items-center justify-center gap-3" size="lg">
              <Camera className="w-6 h-6" />
              Mode Caméra
              <span className="text-xs text-blue-200">(Sur votre téléphone)</span>
            </Button>
          </Link>

          <Link href="/viewer" className="w-full">
            <Button className="w-full h-20 text-lg flex items-center justify-center gap-3" size="lg" variant="outline">
              <Monitor className="w-6 h-6" />
              Mode Visualisation
              <span className="text-xs text-gray-400">(Sur votre PC)</span>
            </Button>
          </Link>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Les deux appareils doivent être connectés au même réseau WiFi</p>
        </div>
      </div>
    </div>
  )
}
