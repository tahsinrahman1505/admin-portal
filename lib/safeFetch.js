/**
 * SSRF-hardened fetch for clinic-supplied URLs.
 *
 * The Tier-1 roster sync fetches a URL that a clinic user typed into the portal.
 * That is a server-side request to an attacker-influencable destination — the
 * textbook SSRF setup. Without these guards a malicious (or merely careless)
 * value could make our server read cloud instance metadata (169.254.169.254),
 * reach internal services, or port-scan a private network, and hand the response
 * body back through the API.
 *
 * Defences here, in order:
 *   1. https only — no file:, no http:, no gopher:, no redirect to them.
 *   2. DNS resolution + IP checks, not hostname string matching. A hostname the
 *      attacker controls can simply resolve to 127.0.0.1, so we check the
 *      RESOLVED addresses (all of them) against blocked ranges.
 *   3. Redirects followed MANUALLY, re-validating every hop. `redirect: 'follow'`
 *      would let a public URL 302 straight to 169.254.169.254 after passing the
 *      initial check — the classic bypass.
 *   4. Byte cap enforced while streaming, so a huge/endless body cannot exhaust
 *      memory (Content-Length is advisory and can lie or be absent).
 *   5. Wall-clock timeout.
 */
import dns from 'node:dns/promises'
import net from 'node:net'

export const MAX_BYTES = 5 * 1024 * 1024 // 5 MB — a 50k-patient CSV is ~3 MB
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 15000

// ── IP range checks ───────────────────────────────────────────────────────────
function ipv4ToInt(ip) {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]
}

// CIDRs that must never be reachable from a user-supplied URL.
const BLOCKED_V4 = [
  ['0.0.0.0', 8],       // "this" network
  ['10.0.0.0', 8],      // RFC1918 private
  ['100.64.0.0', 10],   // CGNAT
  ['127.0.0.0', 8],     // loopback
  ['169.254.0.0', 16],  // link-local — includes cloud metadata 169.254.169.254
  ['172.16.0.0', 12],   // RFC1918 private
  ['192.0.0.0', 24],    // IETF protocol assignments
  ['192.168.0.0', 16],  // RFC1918 private
  ['198.18.0.0', 15],   // benchmarking
  ['224.0.0.0', 4],     // multicast
  ['240.0.0.0', 4],     // reserved
]

function isBlockedIpv4(ip) {
  const v = ipv4ToInt(ip)
  if (v === null) return true // unparseable → refuse
  return BLOCKED_V4.some(([base, bits]) => {
    const b = ipv4ToInt(base)
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return (v & mask) === (b & mask)
  })
}

function isBlockedIpv6(ip) {
  const a = ip.toLowerCase().split('%')[0] // strip zone id
  if (a === '::' || a === '::1') return true              // unspecified / loopback
  // IPv4-mapped (::ffff:127.0.0.1) — judge by the embedded IPv4.
  const m = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (m) return isBlockedIpv4(m[1])
  if (/^f[cd]/.test(a)) return true                        // fc00::/7 unique-local
  if (/^fe[89ab]/.test(a)) return true                     // fe80::/10 link-local
  if (a.startsWith('ff')) return true                      // multicast
  return false
}

export function isBlockedAddress(ip) {
  const kind = net.isIP(ip)
  if (kind === 4) return isBlockedIpv4(ip)
  if (kind === 6) return isBlockedIpv6(ip)
  return true // not an IP at all → refuse
}

/**
 * Validate a single URL: https scheme, and every address its hostname resolves
 * to must be publicly routable. Returns { ok } or { ok:false, error }.
 */
export async function assertPublicHttpsUrl(rawUrl) {
  let u
  try { u = new URL(rawUrl) } catch { return { ok: false, error: 'Not a valid URL.' } }

  if (u.protocol !== 'https:') {
    return { ok: false, error: 'URL must start with https:// (http and file links are not allowed).' }
  }
  if (u.username || u.password) {
    return { ok: false, error: 'URLs with embedded credentials are not allowed.' }
  }

  const host = u.hostname.replace(/^\[|\]$/g, '') // unwrap [::1]

  // Literal IP in the URL → check directly, no DNS needed.
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) return { ok: false, error: 'That address is not publicly reachable.' }
    return { ok: true, url: u }
  }

  let addrs
  try {
    addrs = await dns.lookup(host, { all: true })
  } catch {
    return { ok: false, error: `Could not resolve ${host}.` }
  }
  if (!addrs.length) return { ok: false, error: `Could not resolve ${host}.` }
  // ALL resolved addresses must be public — a host resolving to both a public
  // and a private address must not be usable to reach the private one.
  for (const { address } of addrs) {
    if (isBlockedAddress(address)) {
      return { ok: false, error: 'That hostname resolves to a private address and cannot be fetched.' }
    }
  }
  return { ok: true, url: u }
}

/**
 * Rewrite common "share link" forms into their direct-download equivalent.
 * Clinics paste what the share button gives them; that URL returns an HTML
 * viewer page, not the file, so without this the import sees markup and fails
 * with a confusing "could not find a phone column".
 */
export function normalizeShareLink(raw) {
  if (!raw) return raw
  let s = String(raw).trim()

  // Google Sheets → CSV export of the first sheet.
  let m = s.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/)
  if (m) {
    const gid = (s.match(/[#&?]gid=(\d+)/) || [])[1]
    return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ''}`
  }
  // Google Drive file share → direct download.
  m = s.match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)/)
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`
  m = s.match(/^https:\/\/drive\.google\.com\/open\?id=([\w-]+)/)
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`

  // Dropbox share → direct content.
  if (/^https:\/\/(www\.)?dropbox\.com\//.test(s)) {
    s = s.replace(/[?&]dl=0/, '').replace(/[?&]st=[\w]+/, '')
    return s + (s.includes('?') ? '&' : '?') + 'dl=1'
  }
  return s
}

/**
 * Fetch a clinic-supplied URL safely. Returns { ok, text } or { ok:false, error }.
 */
export async function safeFetchText(rawUrl) {
  let current = normalizeShareLink(rawUrl)

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = await assertPublicHttpsUrl(current)
    if (!check.ok) return check

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    let res
    try {
      res = await fetch(current, {
        redirect: 'manual', // we re-validate each hop ourselves
        signal: ctrl.signal,
        headers: { 'user-agent': 'TahsinAI-RosterSync/1.0', accept: 'text/csv,text/plain,*/*' },
      })
    } catch (e) {
      clearTimeout(timer)
      return { ok: false, error: e?.name === 'AbortError' ? 'The export URL timed out.' : 'Could not reach the export URL.' }
    }
    clearTimeout(timer)

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return { ok: false, error: 'The export URL redirected without a destination.' }
      current = new URL(loc, current).toString() // resolve relative redirects
      continue
    }

    if (!res.ok) {
      return { ok: false, error: `The export URL returned HTTP ${res.status}. Check the link is shared publicly.` }
    }

    // Stream with a hard byte cap — Content-Length may be absent or untruthful.
    const reader = res.body?.getReader()
    if (!reader) {
      const t = await res.text()
      if (t.length > MAX_BYTES) return { ok: false, error: 'Export file is too large (limit 5 MB).' }
      return { ok: true, text: t }
    }
    const chunks = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > MAX_BYTES) {
        try { await reader.cancel() } catch {}
        return { ok: false, error: 'Export file is too large (limit 5 MB).' }
      }
      chunks.push(value)
    }
    const buf = new Uint8Array(total)
    let off = 0
    for (const c of chunks) { buf.set(c, off); off += c.length }
    return { ok: true, text: new TextDecoder('utf-8').decode(buf) }
  }
  return { ok: false, error: 'Too many redirects from the export URL.' }
}
