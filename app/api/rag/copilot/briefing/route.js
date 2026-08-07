/**
 * Server-side proxy for the Clinic Copilot briefing:
 *   GET /api/rag/copilot/briefing?client_id=<bot_client_id>
 *
 * Forwards to the RAG server's read-only /copilot/briefing, keeping RAG_API_SECRET
 * out of the browser bundle. enforceTenant() blocks a signed-in user from ever
 * requesting another clinic's briefing. Returns { ok, headline, summary, actions }.
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
    const client_id = searchParams.get('client_id') || 'dental_demo'
    const denied = enforceTenant(auth, client_id)
    if (denied) return denied
    const res = await fetch(
      `${RAG_URL}/copilot/briefing?client_id=${encodeURIComponent(client_id)}`,
      { headers: { 'x-api-key': API_SECRET }, cache: 'no-store' },
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ ok: false, error: 'Internal error', actions: [], summary: {} }, { status: 500 })
  }
}
