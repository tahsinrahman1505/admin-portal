/**
 * Server-side proxy for:
 *   GET  /doctors/:id/leaves?client_id=X  — list upcoming leaves (ownership verified by backend)
 *   POST /doctors/:id/leaves?client_id=X  — add a leave record (ownership verified by backend)
 */
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, enforceTenant } from '@/lib/auth'

const RAG_URL    = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'
const API_SECRET = process.env.RAG_API_SECRET || ''
const CLIENT_ID  = process.env.NEXT_PUBLIC_CLIENT_ID || 'dental_demo'

export async function GET(request, { params }) {
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id') || CLIENT_ID
    const denied = enforceTenant(auth, client_id)
    if (denied) return denied
    const res = await fetch(
      `${RAG_URL}/doctors/${encodeURIComponent(id)}/leaves?client_id=${encodeURIComponent(client_id)}`,
      { headers: { 'x-api-key': API_SECRET } }
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ leaves: [] }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id') || CLIENT_ID
    const denied = enforceTenant(auth, client_id)
    if (denied) return denied
    const body = await request.json()
    const res = await fetch(
      `${RAG_URL}/doctors/${encodeURIComponent(id)}/leaves?client_id=${encodeURIComponent(client_id)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_SECRET },
        body: JSON.stringify(body),
      }
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Failed to add leave' }, { status: 500 })
  }
}
