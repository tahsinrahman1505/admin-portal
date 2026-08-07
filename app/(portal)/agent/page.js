'use client'

import ComingSoon from '@/components/ComingSoon'

export default function AgentPage() {
  return (
    <ComingSoon
      title="Agent"
      description="Decide how much of the conversation your AI receptionist handles on its own — and how it sounds while doing it."
      bullets={[
        'Co-pilot: the AI drafts every reply, your team approves before it sends',
        'After-hours: the AI covers nights and weekends, your team owns the day',
        'Always-on: the AI runs the whole conversation, you take only escalations',
        'Set the tone of voice, and keep emergency escalation on in every mode',
      ]}
    />
  )
}
