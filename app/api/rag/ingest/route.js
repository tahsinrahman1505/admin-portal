/**
 * Server-side proxy for:
 *   GET  /ingest/list  — list knowledge base documents
 *   POST /ingest       — upload a new document
 * Keeps RAG_API_SECRET out of the browser bundle.
 */
import { NextResponse } from 'next/server'

const RAG_URL    = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'
const API_SECRET = process.env.RAG_API_SECRET || ''

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id') || 'default'
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
