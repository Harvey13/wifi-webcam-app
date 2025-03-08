import { NextResponse } from 'next/server'
import { store } from '@/app/lib/store'

// Stockage temporaire des offres
const offers = new Map<string, any>()

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log("📝 POST /api/offer/[id] - ID:", params.id)
  try {
    const offer = await request.json()
    console.log("Offre reçue:", offer)
    store.setOffer(params.id, offer)
    return new NextResponse(null, { status: 201 })
  } catch (error) {
    console.error("Erreur lors du stockage de l'offre:", error)
    return new NextResponse(null, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log("📖 GET /api/offer/[id] - ID:", params.id)
  const offer = store.getOffer(params.id)
  if (!offer) {
    console.log("❌ Aucune offre trouvée pour l'ID:", params.id)
    return new NextResponse(null, { status: 404 })
  }
  console.log("✅ Offre trouvée:", offer)
  return NextResponse.json(offer)
}
