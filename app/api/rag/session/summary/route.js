/**
 * Server-side proxy for POST /session/summary
 * Keeps RAG_API_SECRET out of the browser bundle.
 */
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized } from '@/lib/auth'
import { demoGuard } from '@/lib/demoRoute'

const RAG_URL    = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'
const API_SECRET = process.env.RAG_API_SECRET || ''

export async function POST(request) {
  const _demo = demoGuard(request)
  if (_demo) return _demo
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  try {
    const body = await request.json()
    const res = await fetch(`${RAG_URL}/session/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_SECRET },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ summary: 'Summary unavailable.' }, { status: 500 })
  }
}
