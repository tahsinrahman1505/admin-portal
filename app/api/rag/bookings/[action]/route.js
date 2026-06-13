/**
 * Server-side proxy for the unified booking write endpoints:
 *   POST /api/rag/bookings/create
 *   POST /api/rag/bookings/update
 *   POST /api/rag/bookings/cancel
 *
 * Forwards to the RAG server (service-role writes to pending_bookings) while
 * keeping RAG_API_SECRET out of the browser bundle. Reads still happen
 * client-side directly from Supabase.
 */
import { NextResponse } from 'next/server'

const RAG_URL    = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'
const API_SECRET = process.env.RAG_API_SECRET || ''
const ALLOWED    = new Set(['create', 'update', 'cancel'])

export async function POST(request, { params }) {
  const { action } = await params
  if (!ALLOWED.has(action)) {
    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 404 })
  }
  try {
    const body = await request.json()
    const res = await fetch(`${RAG_URL}/bookings/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_SECRET },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
