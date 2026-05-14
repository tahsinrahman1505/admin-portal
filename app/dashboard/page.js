'use client'

import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function DashboardPage() {
  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase.from('documents').select('*').limit(5)
      if (error) {
        console.error('Supabase error:', error.message)
      } else {
        console.log('Supabase data:', data)
      }
    }
    testConnection()
  }, [])

  const metrics = [
    { label: "Total Conversations", value: "0" },
    { label: "Leads Captured", value: "0" },
    { label: "Appointments Booked", value: "0" },
    { label: "Avg Rating", value: "0.0" },
  ]

  return (
    <main className="min-h-screen bg-gray-50 p-10">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">
        Client Dashboard
      </h1>
      <div className="grid grid-cols-2 gap-6 max-w-3xl">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
          >
            <p className="text-sm text-gray-500 mb-2">{metric.label}</p>
            <p className="text-4xl font-bold text-gray-900">{metric.value}</p>
          </div>
        ))}
      </div>
    </main>
  )
}