/**
 * Server-side proxy for:
 *   GET /doctors/:id/schedule              — get weekly schedule
 *   PUT /doctors/:id/schedule?client_id=X  — replace weekly schedule (ownership verified by backend)
 */
import { NextResponse } from 'next/server'

const RAG_URL    = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'
const API_SECRET = process.env.RAG_API_SECRET || ''
const CLIENT_ID  = process.env.NEXT_PUBLIC_CLIENT_ID || 'dental_demo'

export async function GET(request, { params }) {
  try {
    const { id } = await params
    const res = await fetch(`${RAG_URL}/doctors/${encodeURIComponent(id)}/schedule`, {
      headers: { 'x-api-key': API_SECRET },
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ schedule: [] }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id') || CLIENT_ID
    const body = await request.json()
    const res = await fetch(
      `${RAG_URL}/doctors/${encodeURIComponent(id)}/schedule?client_id=${encodeURIComponent(client_id)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_SECRET },
        body: JSON.stringify(body),
      }
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 })
  }
}
