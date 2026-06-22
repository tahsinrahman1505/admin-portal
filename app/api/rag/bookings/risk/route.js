/**
 * Server-side proxy for the no-show risk scorer:
 *   GET /api/rag/bookings/risk?client_id=<bot_client_id>
 *
 * Forwards to the RAG server's read-only /bookings/risk, keeping RAG_API_SECRET
 * out of the browser bundle. Returns { ok, count, summary, bookings:[{...,risk}] }.
 */
import { NextResponse } from 'next/server'

const RAG_URL    = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'
const API_SECRET = process.env.RAG_API_SECRET || ''

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id') || 'dental_demo'
    const res = await fetch(
      `${RAG_URL}/bookings/risk?client_id=${encodeURIComponent(client_id)}`,
      { headers: { 'x-api-key': API_SECRET }, cache: 'no-store' },
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ ok: false, error: 'Internal error', bookings: [] }, { status: 500 })
  }
}
