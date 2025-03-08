import { NextResponse } from 'next/server'
import { networkInterfaces } from 'os'

export async function GET() {
  try {
    const interfaces = networkInterfaces()
    let wifiIP = ''

    // Parcourir toutes les interfaces réseau
    for (const [name, addresses] of Object.entries(interfaces)) {
      // Chercher l'interface Wi-Fi avec une adresse IPv4
      if (name.toLowerCase().includes('wi-fi') && addresses) {
        for (const addr of addresses) {
          if (addr.family === 'IPv4') {
            wifiIP = addr.address
            break
          }
        }
      }
    }

    if (!wifiIP) {
      return NextResponse.json({ error: 'Wi-Fi IP not found' }, { status: 404 })
    }

    return NextResponse.json({ ip: wifiIP })
  } catch (error) {
    console.error('Error getting Wi-Fi IP:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
