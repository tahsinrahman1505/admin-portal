/**
 * Server-side proxy for:
 *   DELETE /doctors/:id/leaves/:leave_id?client_id=X  — remove a leave (ownership verified)
 */
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, enforceTenant } from '@/lib/auth'

const RAG_URL    = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'
const API_SECRET = process.env.RAG_API_SECRET || ''

export async function DELETE(request, { params }) {
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  try {
    const { id, leave_id } = await params
    const { searchParams } = new URL(request.url)
    const denied = enforceTenant(auth, searchParams.get('client_id'))
    if (denied) return denied
    const client_id = auth.botClientId
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
