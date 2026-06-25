/**
 * Server-side proxy for:
 *   PUT    /doctors/:id?client_id=X  — update doctor details
 *   DELETE /doctors/:id?client_id=X  — deactivate doctor (soft delete)
 * client_id is required by the backend ownership check (C7).
 */
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized } from '@/lib/auth'

const RAG_URL    = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'
const API_SECRET = process.env.RAG_API_SECRET || ''
const CLIENT_ID  = process.env.NEXT_PUBLIC_CLIENT_ID || 'dental_demo'

export async function PUT(request, { params }) {
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id') || CLIENT_ID
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
    const client_id = searchParams.get('client_id') || CLIENT_ID
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
