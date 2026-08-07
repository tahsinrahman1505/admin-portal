'use client'

import ComingSoon from '@/components/ComingSoon'

export default function TemplatesPage() {
  return (
    <ComingSoon
      title="Templates"
      description="Manage the WhatsApp message templates Meta has approved for your clinic, with a live preview of exactly how each one lands on a patient's phone."
      bullets={[
        'See every template with its Meta approval status',
        'Preview the message as the patient will see it',
        'Submit a new template for approval without leaving the portal',
      ]}
    />
  )
}
