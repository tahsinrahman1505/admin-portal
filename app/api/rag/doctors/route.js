/**
 * Server-side proxy for:
 *   GET  /doctors?client_id=X  — list all doctors for a clinic
 *   POST /doctors              — add a new doctor
 * Keeps RAG_API_SECRET out of the browser bundle.
 */
import { NextResponse } from 'next/server'

const RAG_URL    = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'
const API_SECRET = process.env.RAG_API_SECRET || ''

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id') || 'dental_demo'
    const res = await fetch(`${RAG_URL}/doctors?client_id=${encodeURIComponent(client_id)}`, {
      headers: { 'x-api-key': API_SECRET },
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ doctors: [] }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const res = await fetch(`${RAG_URL}/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_SECRET },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Failed to create doctor' }, { status: 500 })
  }
}
