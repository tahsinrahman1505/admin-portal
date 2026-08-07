/**
 * Server-side proxy for:
 *   GET  /doctors?client_id=X  — list all doctors for a clinic
 *   POST /doctors              — add a new doctor
 * Keeps RAG_API_SECRET out of the browser bundle.
 */
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, enforceTenant, forbidden } from '@/lib/auth'
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
    // Server-authoritative: use the logged-in user's clinic, not the browser-sent param.
    const client_id = auth.botClientId || searchParams.get('client_id') || 'dental_demo'
    const denied = enforceTenant(auth, client_id)
    if (denied) return denied
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
  const _demo = demoGuard(request)
  if (_demo) return _demo
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  try {
    // Default-deny: a caller with no clinic mapping (self-registered account) must
    // not create doctors. Then force the doctor onto the logged-in user's clinic so
    // a stale/forged client_id in the body can't create one under another tenant.
    if (!auth.botClientId) return forbidden('No clinic associated with this account')
    const body = await request.json()
    body.client_id = auth.botClientId
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
