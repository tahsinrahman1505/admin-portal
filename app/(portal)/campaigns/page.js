'use client'

import ComingSoon from '@/components/ComingSoon'

export default function CampaignsPage() {
  return (
    <ComingSoon
      title="Campaigns"
      description="Send an approved WhatsApp template to a segment of your patients, then watch it convert — delivered, read, replied, booked — with the real Meta messaging cost attached."
      bullets={[
        'Build an audience from your contacts, leads and recall list',
        'Automatically exclude anyone who has opted out',
        'See the delivery funnel and cost per campaign, not just a send count',
        'Preview the exact message before it goes out, and dry-run it first',
      ]}
    />
  )
}
