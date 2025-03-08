import { NextResponse } from 'next/server'
import { store } from '@/app/lib/store'

// Stockage temporaire des réponses
const answers = new Map<string, any>()

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log("📝 POST /api/answer/[id] - ID:", params.id)
  try {
    const answer = await request.json()
    console.log("Réponse reçue:", answer)
    store.setAnswer(params.id, answer)
    return new NextResponse(null, { status: 201 })
  } catch (error) {
    console.error("Erreur lors du stockage de la réponse:", error)
    return new NextResponse(null, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log("📖 GET /api/answer/[id] - ID:", params.id)
  const answer = store.getAnswer(params.id)
  if (!answer) {
    console.log("❌ Aucune réponse trouvée pour l'ID:", params.id)
    return new NextResponse(null, { status: 404 })
  }
  console.log("✅ Réponse trouvée:", answer)
  return NextResponse.json(answer)
}
