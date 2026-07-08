import { NextResponse } from 'next/server'
import { IS_DEMO } from '@/lib/demoRoute'

const RAG_URL = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'

export async function GET() {
  if (IS_DEMO) return NextResponse.json({ status: 'ok', demo: true }, { status: 200 })
  try {
    const res = await fetch(`${RAG_URL}/health`, { next: { revalidate: 0 } })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ status: 'unreachable' }, { status: 503 })
  }
}
