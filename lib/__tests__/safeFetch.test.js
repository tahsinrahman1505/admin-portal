import { describe, it, expect } from 'vitest'
import { isBlockedAddress, assertPublicHttpsUrl, normalizeShareLink } from '@/lib/safeFetch'

// These guards protect a genuine SSRF surface: /api/roster/sync fetches a URL a
// clinic user typed into the portal. A regression here would let that field
// reach cloud metadata, internal services, or a private network.

describe('isBlockedAddress — private/loopback/link-local must be refused', () => {
  const blocked = [
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', // cloud instance metadata — the highest-value SSRF target
    '0.0.0.0', '100.64.0.1', '224.0.0.1', '240.0.0.1',
    '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1',
    '::ffff:127.0.0.1', '::ffff:10.0.0.1', // IPv4-mapped IPv6 must judge the embedded v4
  ]
  it.each(blocked)('blocks %s', ip => expect(isBlockedAddress(ip)).toBe(true))
})

describe('isBlockedAddress — public addresses must be allowed', () => {
  const allowed = [
    '8.8.8.8', '1.1.1.1', '142.250.185.78', '93.184.216.34',
    '172.32.0.1', '172.15.255.255', // just outside the 172.16/12 private block
    '2606:4700:4700::1111',
  ]
  it.each(allowed)('allows %s', ip => expect(isBlockedAddress(ip)).toBe(false))
})

describe('isBlockedAddress — anything that is not an IP is refused', () => {
  it.each(['not-an-ip', '', '1.2.3', '999.1.1.1'])('refuses %j', v =>
    expect(isBlockedAddress(v)).toBe(true))
})

describe('assertPublicHttpsUrl', () => {
  const rejects = [
    ['http://example.com/f.csv', 'plain http'],
    ['file:///etc/passwd', 'file scheme'],
    ['ftp://example.com/f.csv', 'ftp scheme'],
    ['https://127.0.0.1/f.csv', 'loopback literal'],
    ['https://169.254.169.254/latest/meta-data/', 'cloud metadata'],
    ['https://192.168.1.10/export.csv', 'private literal'],
    ['https://[::1]/f.csv', 'ipv6 loopback literal'],
    ['https://user:pw@example.com/f.csv', 'embedded credentials'],
    ['not a url', 'unparseable'],
  ]
  it.each(rejects)('rejects %s (%s)', async url => {
    expect((await assertPublicHttpsUrl(url)).ok).toBe(false)
  })

  it('rejects a hostname that RESOLVES to loopback (DNS-based bypass)', async () => {
    expect((await assertPublicHttpsUrl('https://localhost/f.csv')).ok).toBe(false)
  })

  it('allows an ordinary public https URL', async () => {
    expect((await assertPublicHttpsUrl('https://example.com/export.csv')).ok).toBe(true)
  })
})

describe('normalizeShareLink — share pages become direct downloads', () => {
  it('Google Sheets → csv export, preserving the sheet gid', () => {
    expect(normalizeShareLink('https://docs.google.com/spreadsheets/d/ABC123/edit#gid=42'))
      .toBe('https://docs.google.com/spreadsheets/d/ABC123/export?format=csv&gid=42')
  })
  it('Google Sheets without a gid', () => {
    expect(normalizeShareLink('https://docs.google.com/spreadsheets/d/ABC123/edit'))
      .toBe('https://docs.google.com/spreadsheets/d/ABC123/export?format=csv')
  })
  it('Google Drive file share → direct download', () => {
    expect(normalizeShareLink('https://drive.google.com/file/d/FILEID9/view?usp=sharing'))
      .toBe('https://drive.google.com/uc?export=download&id=FILEID9')
  })
  it('Google Drive open?id= form', () => {
    expect(normalizeShareLink('https://drive.google.com/open?id=FILEID9'))
      .toBe('https://drive.google.com/uc?export=download&id=FILEID9')
  })
  it('Dropbox dl=0 → dl=1', () => {
    const out = normalizeShareLink('https://www.dropbox.com/s/xyz/patients.csv?dl=0')
    expect(out).toContain('dl=1')
    expect(out).not.toContain('dl=0')
  })
  it('leaves an already-direct link untouched', () => {
    expect(normalizeShareLink('https://example.com/already.csv')).toBe('https://example.com/already.csv')
  })
})
