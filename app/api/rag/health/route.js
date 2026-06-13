import { NextResponse } from 'next/server'

const RAG_URL = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'

export async function GET() {
  try {
    const res = await fetch(`${RAG_URL}/health`, { next: { revalidate: 0 } })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ status: 'unreachable' }, { status: 503 })
  }
}
