/**
 * Server-side proxy for POST /media/sign-upload
 * Mints a short-lived signed upload URL for the conversation-media bucket so the
 * portal browser can upload an attachment directly to Supabase Storage. The
 * service-role key stays server-side; RAG_API_SECRET is never shipped to the
 * browser.
 */
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized } from '@/lib/auth'

const RAG_URL    = process.env.NEXT_PUBLIC_API_URL || 'https://n8n.mdtahsinrahman.com/api'
const API_SECRET = process.env.RAG_API_SECRET || ''

export async function POST(request) {
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  try {
    const body = await request.json()
    const res = await fetch(`${RAG_URL}/media/sign-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_SECRET },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
