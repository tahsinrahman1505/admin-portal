import { describe, it, expect } from 'vitest'
import {
  maskIdentity, pickIdentity, normalizeIdentity,
  reconcileMessage, parseMediaMessage,
  buildDeliveryMap, failureReason,
  buildThreads, filterThreads, channelCounts,
} from '../inbox'

/**
 * These lock the CURRENT behaviour of the inbox before Phase 1 moves the
 * components around. They are a regression net, not a spec: where the original
 * had a quirk, the quirk is asserted so a refactor can't silently change it.
 *
 * The two that matter most are reconcileMessage (decides whether a patient's
 * message renders once or twice) and buildDeliveryMap (decides which bubble a
 * "not delivered" warning attaches to). Both were unreachable by any test until
 * now, in a file that handles live patient conversations.
 */

describe('maskIdentity', () => {
  it('prefers a resolved Instagram username', () => {
    expect(maskIdentity('17841400000', 'instagram', 'marinasmile', null)).toBe('@marinasmile')
  })

  it('prefers a resolved Messenger display name', () => {
    expect(maskIdentity('9988776655', 'messenger', null, 'Sara M.')).toBe('Sara M.')
  })

  it('falls back to a masked handle when resolution has not happened yet', () => {
    // Brand-new conversation, or no page token — must still render something sane.
    expect(maskIdentity('17841400123456', 'instagram', null, null)).toBe('@ig_123456')
    expect(maskIdentity('9988776655', 'messenger', null, null)).toBe('msg_776655')
  })

  it('masks a WhatsApp phone number, keeping only the last two digits', () => {
    expect(maskIdentity('971558842013', 'whatsapp', null, null)).toBe('971558***-**13')
  })

  it('returns Unknown for a missing id', () => {
    expect(maskIdentity(null, 'whatsapp')).toBe('Unknown')
    expect(maskIdentity('', 'instagram')).toBe('Unknown')
  })

  it('ignores a username on a channel it does not apply to', () => {
    // A username on WhatsApp must not win — WhatsApp identity is the phone.
    expect(maskIdentity('971558842013', 'whatsapp', 'someone', null)).toBe('971558***-**13')
  })
})

describe('pickIdentity', () => {
  it('scans backwards so a resolved newer row beats an unresolved older one', () => {
    const messages = [
      { sender_username: null, sender_display_name: null },
      { sender_username: 'resolved_later', sender_display_name: null },
    ]
    expect(pickIdentity(messages)).toEqual({ username: 'resolved_later', displayName: null })
  })

  it('does not let a stale earlier row shadow the latest identity', () => {
    const messages = [
      { sender_username: 'old_handle', sender_display_name: null },
      { sender_username: 'new_handle', sender_display_name: null },
    ]
    expect(pickIdentity(messages).username).toBe('new_handle')
  })

  it('returns nulls when nothing is resolved', () => {
    expect(pickIdentity([{ message: 'hi' }])).toEqual({ username: null, displayName: null })
    expect(pickIdentity([])).toEqual({ username: null, displayName: null })
  })
})

describe('normalizeIdentity', () => {
  it('strips a leading + from a phone number', () => {
    expect(normalizeIdentity('+971558842013')).toBe('971558842013')
  })
  it('leaves IG/Messenger ids alone and handles empties', () => {
    expect(normalizeIdentity('17841400123456')).toBe('17841400123456')
    expect(normalizeIdentity(null)).toBe('')
  })
})

describe('reconcileMessage', () => {
  const optimistic = { id: 'opt_1700000000', role: 'owner', message: 'On our way!' }

  it('replaces the optimistic copy rather than appending a duplicate', () => {
    // The exact bug this guards: staff sends, sees it instantly, then the
    // realtime INSERT arrives and the message renders TWICE.
    const real = { id: 42, role: 'owner', message: 'On our way!' }
    const out = reconcileMessage([optimistic], real)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe(42)
  })

  it('replaces in place so the bubble does not jump position', () => {
    const before = { id: 1, role: 'customer', message: 'Hello?' }
    const after = { id: 3, role: 'bot', message: 'Anything else?' }
    const real = { id: 2, role: 'owner', message: 'On our way!' }
    const out = reconcileMessage([before, optimistic, after], real)
    expect(out.map(m => m.id)).toEqual([1, 2, 3])
  })

  it('appends when there is no optimistic match', () => {
    const incoming = { id: 7, role: 'customer', message: 'Thanks' }
    expect(reconcileMessage([], incoming)).toEqual([incoming])
  })

  it('does not match an optimistic message with a different body', () => {
    const real = { id: 42, role: 'owner', message: 'Something else entirely' }
    expect(reconcileMessage([optimistic], real)).toHaveLength(2)
  })

  it('does not match across roles', () => {
    // Same text from the bot must not consume the staff member's optimistic row.
    const real = { id: 42, role: 'bot', message: 'On our way!' }
    expect(reconcileMessage([optimistic], real)).toHaveLength(2)
  })

  it('never mutates the list it was given', () => {
    const list = [optimistic]
    reconcileMessage(list, { id: 42, role: 'owner', message: 'On our way!' })
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('opt_1700000000')
  })

  it('ignores non-string ids when looking for the optimistic entry', () => {
    // A real row's numeric id must never be probed with .startsWith().
    const real = { id: 42, role: 'owner', message: 'hi' }
    expect(() => reconcileMessage([{ id: 5, role: 'owner', message: 'hi' }], real)).not.toThrow()
  })
})

describe('parseMediaMessage', () => {
  it('splits an image url from its caption', () => {
    const out = parseMediaMessage('https://cdn.example.com/x-ray.jpg Here is the scan')
    expect(out.mediaType).toBe('image')
    expect(out.mediaUrl).toBe('https://cdn.example.com/x-ray.jpg')
    expect(out.caption).toBe('Here is the scan')
  })

  it('recognises video extensions', () => {
    expect(parseMediaMessage('https://cdn.example.com/clip.mp4').mediaType).toBe('video')
    expect(parseMediaMessage('https://cdn.example.com/clip.mov').mediaType).toBe('video')
  })

  it('tolerates a query string after the extension', () => {
    const out = parseMediaMessage('https://cdn.example.com/a.png?token=abc')
    expect(out.mediaType).toBe('image')
  })

  it('treats ordinary text as a plain message', () => {
    const out = parseMediaMessage('Can I move my appointment?')
    expect(out.mediaUrl).toBeNull()
    expect(out.caption).toBe('Can I move my appointment?')
  })

  it('does not treat a bare non-url word as media', () => {
    expect(parseMediaMessage('photo.jpg').mediaUrl).toBeNull()
  })

  it('handles empty and null input', () => {
    expect(parseMediaMessage('').caption).toBe('')
    expect(parseMediaMessage(null).caption).toBe('')
  })
})

describe('buildDeliveryMap', () => {
  const at = s => new Date(`2026-08-07T10:0${s}:00Z`).toISOString()

  it('matches an outbound message to its receipt by body prefix', () => {
    const messages = [{ id: 1, role: 'owner', message: 'Your appointment is confirmed', created_at: at(0) }]
    const deliveries = [{ wamid: 'w1', body_preview: 'Your appointment', status: 'read', created_at: at(0) }]
    expect(buildDeliveryMap(messages, deliveries).get(1).wamid).toBe('w1')
  })

  it('matches when the MESSAGE is the shorter side', () => {
    const messages = [{ id: 1, role: 'bot', message: 'Booked', created_at: at(0) }]
    const deliveries = [{ wamid: 'w1', body_preview: 'Booked for Saturday', status: 'sent', created_at: at(0) }]
    expect(buildDeliveryMap(messages, deliveries).get(1).wamid).toBe('w1')
  })

  it('never attaches a receipt to an inbound patient message', () => {
    const messages = [{ id: 1, role: 'customer', message: 'Hello', created_at: at(0) }]
    const deliveries = [{ wamid: 'w1', body_preview: 'Hello', status: 'read', created_at: at(0) }]
    expect(buildDeliveryMap(messages, deliveries).size).toBe(0)
  })

  it('consumes each receipt once, so identical messages get different receipts', () => {
    // Otherwise a stale "not delivered" warning lands on the wrong bubble and
    // the clinic re-sends something the patient already received.
    const messages = [
      { id: 1, role: 'owner', message: 'Reminder', created_at: at(0) },
      { id: 2, role: 'owner', message: 'Reminder', created_at: at(5) },
    ]
    const deliveries = [
      { wamid: 'w1', body_preview: 'Reminder', status: 'read', created_at: at(0) },
      { wamid: 'w2', body_preview: 'Reminder', status: 'failed', created_at: at(5) },
    ]
    const map = buildDeliveryMap(messages, deliveries)
    expect(map.get(1).wamid).toBe('w1')
    expect(map.get(2).wamid).toBe('w2')
  })

  it('picks the nearest receipt in time when several could match', () => {
    const messages = [{ id: 1, role: 'owner', message: 'Reminder', created_at: at(5) }]
    const deliveries = [
      { wamid: 'far', body_preview: 'Reminder', status: 'sent', created_at: at(0) },
      { wamid: 'near', body_preview: 'Reminder', status: 'read', created_at: at(6) },
    ]
    expect(buildDeliveryMap(messages, deliveries).get(1).wamid).toBe('near')
  })

  it('returns an empty map for no deliveries, and tolerates junk rows', () => {
    expect(buildDeliveryMap([{ id: 1, role: 'owner', message: 'x', created_at: at(0) }], []).size).toBe(0)
    expect(buildDeliveryMap([{ id: 1, role: 'owner', message: 'x', created_at: at(0) }], null).size).toBe(0)
    const map = buildDeliveryMap(
      [null, { id: 1, role: 'owner', message: '', created_at: at(0) }],
      [{ wamid: 'w', body_preview: '', created_at: at(0) }]
    )
    expect(map.size).toBe(0)
  })
})

describe('failureReason', () => {
  it('explains the 24-hour window rule in plain language', () => {
    expect(failureReason({ lane: 'clinic', error_code: '131047' })).toMatch(/24-hour window/)
  })
  it('covers unreachable numbers and media failures', () => {
    expect(failureReason({ lane: 'clinic', error_code: '131026' })).toMatch(/can't receive/)
    expect(failureReason({ lane: 'clinic', error_code: '131053' })).toMatch(/Media/)
  })
  it('falls back to the Meta-provided title for unknown clinic-lane codes', () => {
    expect(failureReason({ lane: 'clinic', error_code: '999', error_title: 'Odd failure' })).toBe('Odd failure')
  })
  it('distinguishes transient from our-side failures', () => {
    expect(failureReason({ lane: 'transient' })).toMatch(/Temporary/)
    expect(failureReason({ lane: 'internal' })).toMatch(/our side/)
  })
})

describe('buildThreads', () => {
  const row = (o) => ({ session_id: 's1', role: 'customer', channel: 'whatsapp', created_at: '2026-08-07T10:00:00Z', ...o })

  it('groups rows by session and sorts newest-active first', () => {
    const threads = buildThreads([
      row({ session_id: 'a', created_at: '2026-08-01T10:00:00Z' }),
      row({ session_id: 'b', created_at: '2026-08-05T10:00:00Z' }),
    ])
    expect(threads.map(t => t.session_id)).toEqual(['b', 'a'])
  })

  it('takes channel from the LAST message — patients switch channels', () => {
    const threads = buildThreads([
      row({ channel: 'whatsapp', created_at: '2026-08-01T10:00:00Z' }),
      row({ channel: 'instagram', created_at: '2026-08-05T10:00:00Z' }),
    ])
    expect(threads[0].channel).toBe('instagram')
  })

  it('takes status from the LAST message so a resumed thread stops reading as handed off', () => {
    const threads = buildThreads([
      row({ session_status: 'Handed Off', created_at: '2026-08-01T10:00:00Z' }),
      row({ session_status: 'Handled by Bot', created_at: '2026-08-05T10:00:00Z' }),
    ])
    expect(threads[0].status).toBe('Handled by Bot')
  })

  it('uses the first CUSTOMER message as the preview, not a bot greeting', () => {
    const threads = buildThreads([
      row({ role: 'bot', message: 'Hi, I am Sara!', created_at: '2026-08-01T10:00:00Z' }),
      row({ role: 'customer', message: 'Do you do whitening?', created_at: '2026-08-01T10:01:00Z' }),
    ])
    expect(threads[0].firstMessage).toBe('Do you do whitening?')
  })

  it('gives each session-less row its own thread instead of merging them', () => {
    const threads = buildThreads([
      row({ session_id: null, id: 1 }),
      row({ session_id: null, id: 2 }),
    ])
    expect(threads).toHaveLength(2)
  })

  it('handles no rows', () => {
    expect(buildThreads([])).toEqual([])
    expect(buildThreads(null)).toEqual([])
  })
})

describe('filterThreads', () => {
  const threads = [
    { session_id: 'a', channel: 'whatsapp',  sender_id: '971500000001', messages: [{ message: 'whitening price?' }] },
    { session_id: 'b', channel: 'instagram', sender_id: '178414000001', messages: [{ message: 'do you open Sunday' }] },
  ]

  it('filters by channel', () => {
    expect(filterThreads(threads, { channel: 'instagram' }).map(t => t.session_id)).toEqual(['b'])
  })

  it('returns everything for the all channel', () => {
    expect(filterThreads(threads, { channel: 'all' })).toHaveLength(2)
  })

  it('searches message bodies', () => {
    expect(filterThreads(threads, { search: 'whitening' }).map(t => t.session_id)).toEqual(['a'])
  })

  it('searches the sender id too', () => {
    expect(filterThreads(threads, { search: '178414' }).map(t => t.session_id)).toEqual(['b'])
  })

  it('is case-insensitive and trims the query', () => {
    expect(filterThreads(threads, { search: '  WHITENING ' }).map(t => t.session_id)).toEqual(['a'])
  })

  it('composes channel AND search', () => {
    expect(filterThreads(threads, { channel: 'whatsapp', search: 'Sunday' })).toEqual([])
  })

  it('returns all threads with no criteria', () => {
    expect(filterThreads(threads)).toHaveLength(2)
  })
})

describe('channelCounts', () => {
  it('counts per channel plus an all total', () => {
    const counts = channelCounts([
      { channel: 'whatsapp' }, { channel: 'whatsapp' }, { channel: 'instagram' },
    ])
    expect(counts).toMatchObject({ whatsapp: 2, instagram: 1, all: 3 })
  })

  it('defaults a missing channel to whatsapp', () => {
    expect(channelCounts([{}]).whatsapp).toBe(1)
  })

  it('handles an empty list', () => {
    expect(channelCounts([])).toEqual({})
  })
})
