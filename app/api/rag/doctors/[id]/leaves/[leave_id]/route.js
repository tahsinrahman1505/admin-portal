/**
 * Server-side proxy for:
 *   DELETE /doctors/:id/leaves/:leave_id?client_id=X  — remove a leave (ownership verified)
 */
import { NextResponse } from 'next/server'

const RAG_URL    = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'
const API_SECRET = process.env.RAG_API_SECRET || ''
const CLIENT_ID  = process.env.NEXT_PUBLIC_CLIENT_ID || 'dental_demo'

export async function DELETE(request, { params }) {
  try {
    const { id, leave_id } = await params
    const { searchParams } = new URL(request.url)
    const client_id = searchParams.get('client_id') || CLIENT_ID
    const res = await fetch(
      `${RAG_URL}/doctors/${encodeURIComponent(id)}/leaves/${encodeURIComponent(leave_id)}?client_id=${encodeURIComponent(client_id)}`,
      { method: 'DELETE', headers: { 'x-api-key': API_SECRET } }
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Failed to delete leave' }, { status: 500 })
  }
}
