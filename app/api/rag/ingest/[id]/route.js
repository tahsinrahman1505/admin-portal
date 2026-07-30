/**
 * Server-side proxy for DELETE /ingest/{id}
 * Keeps RAG_API_SECRET out of the browser bundle.
 */
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, forbidden } from '@/lib/auth'

const RAG_URL    = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'
const API_SECRET = process.env.RAG_API_SECRET || ''

export async function DELETE(request, { params }) {
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  // The RAG server REQUIRES a client_id and does its own ownership check
  // (a doc from clinic A can't be deleted with clinic B's id). Derive it
  // server-authoritatively from the logged-in clinic — never from the caller —
  // and default-deny an account with no clinic mapping.
  if (!auth.botClientId) return forbidden('No clinic associated with this account')
  try {
    const { id } = await params
    const res = await fetch(
      `${RAG_URL}/ingest/${encodeURIComponent(id)}?client_id=${encodeURIComponent(auth.botClientId)}`,
      {
        method: 'DELETE',
        headers: { 'x-api-key': API_SECRET },
      },
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
