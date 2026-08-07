/**
 * Server-side proxy for:
 *   GET /doctors/:id/schedule?client_id=X  — get weekly schedule (ownership verified by backend)
 *   PUT /doctors/:id/schedule?client_id=X  — replace weekly schedule (ownership verified by backend)
 */
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, enforceTenant } from '@/lib/auth'

const RAG_URL    = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'
const API_SECRET = process.env.RAG_API_SECRET || ''

export async function GET(request, { params }) {
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const denied = enforceTenant(auth, searchParams.get('client_id'))
    if (denied) return denied
    const client_id = auth.botClientId
    const res = await fetch(
      `${RAG_URL}/doctors/${encodeURIComponent(id)}/schedule?client_id=${encodeURIComponent(client_id)}`,
      { headers: { 'x-api-key': API_SECRET } }
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ schedule: [] }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const denied = enforceTenant(auth, searchParams.get('client_id'))
    if (denied) return denied
    const client_id = auth.botClientId
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
