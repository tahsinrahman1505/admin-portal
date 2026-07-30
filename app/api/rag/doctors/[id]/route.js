/**
 * Server-side proxy for:
 *   PUT    /doctors/:id?client_id=X  — update doctor details
 *   DELETE /doctors/:id?client_id=X  — deactivate doctor (soft delete)
 * client_id is required by the backend ownership check (C7).
 */
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, enforceTenant } from '@/lib/auth'

const RAG_URL    = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'
const API_SECRET = process.env.RAG_API_SECRET || ''

export async function PUT(request, { params }) {
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    // Never trust a caller-supplied client_id: reject a mismatch, then force the
    // request onto the logged-in clinic's own client_id. (Previously this fell
    // back to searchParams.client_id when botClientId was null — a self-
    // registered attacker could then modify another clinic's doctor.)
    const denied = enforceTenant(auth, searchParams.get('client_id'))
    if (denied) return denied
    const client_id = auth.botClientId
    const body = await request.json()
    const res = await fetch(
      `${RAG_URL}/doctors/${encodeURIComponent(id)}?client_id=${encodeURIComponent(client_id)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_SECRET },
        body: JSON.stringify(body),
      }
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Failed to update doctor' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const denied = enforceTenant(auth, searchParams.get('client_id'))
    if (denied) return denied
    const client_id = auth.botClientId
    const res = await fetch(
      `${RAG_URL}/doctors/${encodeURIComponent(id)}?client_id=${encodeURIComponent(client_id)}`,
      { method: 'DELETE', headers: { 'x-api-key': API_SECRET } }
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Failed to deactivate doctor' }, { status: 500 })
  }
}
