/**
 * Demo short-circuit for /api/rag/* proxy routes.
 *
 * When NEXT_PUBLIC_DEMO_MODE is on, the RAG backend isn't reachable (and we don't
 * want it to be — showcase only). Each rag route calls demoGuard() first; if demo
 * mode is on it returns a seeded NextResponse and the route never touches the
 * backend or the auth layer. No-ops (returns null) in normal mode.
 */
import { NextResponse } from 'next/server'
import { ragDemoResponse } from './demoData'

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export function demoGuard(request) {
  if (!DEMO) return null
  const { pathname } = new URL(request.url)
  return NextResponse.json(ragDemoResponse(pathname), { status: 200 })
}

export const IS_DEMO = DEMO
