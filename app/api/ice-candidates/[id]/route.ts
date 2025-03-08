import { NextResponse } from 'next/server'
import { store } from '@/app/lib/store'

// Stockage temporaire des candidats ICE
const iceCandidates = new Map<string, any[]>()

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const candidate = await request.json()
  store.addIceCandidate(params.id, candidate)
  return new NextResponse(null, { status: 201 })
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const candidates = store.getIceCandidates(params.id)
  if (!candidates) {
    return NextResponse.json({ error: 'No ICE candidates found' }, { status: 404 })
  }
  store.clearIceCandidates(params.id) // On vide après récupération
  return NextResponse.json(candidates)
}
