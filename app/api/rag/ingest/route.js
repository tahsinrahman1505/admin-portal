/**
 * Server-side proxy for:
 *   GET  /ingest/list  — list knowledge base documents
 *   POST /ingest       — upload a new document
 * Keeps RAG_API_SECRET out of the browser bundle.
 */
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, enforceTenant } from '@/lib/auth'
import { demoGuard } from '@/lib/demoRoute'

const RAG_URL    = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'
const API_SECRET = process.env.RAG_API_SECRET || ''

export async function GET(request) {
  const _demo = demoGuard(request)
  if (_demo) return _demo
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id') || 'default'
    const denied = enforceTenant(auth, client_id)
    if (denied) return denied
    const res = await fetch(`${RAG_URL}/ingest/list?client_id=${encodeURIComponent(client_id)}`, {
      headers: { 'x-api-key': API_SECRET },
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ documents: [] }, { status: 500 })
  }
}

export async function POST(request) {
  const _demo = demoGuard(request)
  if (_demo) return _demo
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  try {
    // Forward the multipart/form-data directly to the RAG server
    const formData = await request.formData()
    const res = await fetch(`${RAG_URL}/ingest`, {
      method: 'POST',
      headers: { 'x-api-key': API_SECRET },
      body: formData,
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
