/**
 * Server-side proxy for DELETE /ingest/{id}
 * Keeps RAG_API_SECRET out of the browser bundle.
 */
import { NextResponse } from 'next/server'

const RAG_URL    = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'
const API_SECRET = process.env.RAG_API_SECRET || ''

export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const res = await fetch(`${RAG_URL}/ingest/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-api-key': API_SECRET },
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
