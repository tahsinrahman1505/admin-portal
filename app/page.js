import { redirect } from 'next/navigation'
import DemoHub from '@/components/DemoHub'

export default function Home() {
  // Demo build (demo.tahsinai.com): land on the judge hub, not the login wall.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return <DemoHub />
  redirect('/login')
}
