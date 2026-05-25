'use client'

// Base pulse shimmer
export function Bone({ className = '' }) {
  return (
    <div
      className={`rounded-lg bg-white/[0.05] relative overflow-hidden ${className}`}
      style={{ animation: 'shimmer 1.6s infinite' }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
          animation: 'shimmerSlide 1.6s infinite',
        }}
      />
      <style>{`
        @keyframes shimmerSlide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="p-8 max-w-[1100px]">
      {/* Header */}
      <div className="mb-8 space-y-2">
        <Bone className="h-3.5 w-24" />
        <Bone className="h-8 w-56" />
        <Bone className="h-3 w-48 mt-3" />
      </div>
      {/* Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[0,1,2,3].map(i => (
          <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-3">
            <Bone className="h-5 w-5 rounded-lg" />
            <Bone className="h-10 w-20" />
            <Bone className="h-3 w-32" />
            <Bone className="h-5 w-24 rounded-full" />
          </div>
        ))}
      </div>
      {/* Bottom panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {[0,1].map(i => (
          <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
            <Bone className="h-4 w-36" />
            {[0,1,2,3].map(j => (
              <div key={j} className="flex items-center gap-3">
                <Bone className="h-2 w-2 rounded-full shrink-0" />
                <Bone className="h-3 flex-1" />
                <Bone className="h-3 w-12" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function TableSkeleton({ cols = 5, rows = 6 }) {
  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <Bone className="h-7 w-32" />
          <Bone className="h-3 w-20" />
        </div>
        <Bone className="h-9 w-28 rounded-xl" />
      </div>
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
        <div className="border-b border-white/[0.07] px-4 py-3 flex gap-6">
          {Array.from({ length: cols }).map((_, i) => (
            <Bone key={i} className="h-3 w-20" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 flex gap-6 border-b border-white/[0.04] last:border-0">
            {Array.from({ length: cols }).map((_, j) => (
              <Bone key={j} className="h-3" style={{ width: `${60 + Math.random() * 80}px` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ConversationsSkeleton() {
  return (
    <div className="flex h-full">
      <div className="w-72 border-r border-white/[0.06] p-4 space-y-3">
        <Bone className="h-8 rounded-lg mb-4" />
        {[0,1,2,3,4,5].map(i => (
          <div key={i} className="space-y-2 py-2 border-b border-white/[0.04]">
            <div className="flex justify-between">
              <Bone className="h-3 w-24" />
              <Bone className="h-4 w-16 rounded-full" />
            </div>
            <Bone className="h-3 w-48" />
            <Bone className="h-2.5 w-20" />
          </div>
        ))}
      </div>
      <div className="flex-1 p-6 space-y-4">
        <div className="flex justify-start"><Bone className="h-16 w-64 rounded-2xl" /></div>
        <div className="flex justify-end"><Bone className="h-12 w-48 rounded-2xl" /></div>
        <div className="flex justify-start"><Bone className="h-20 w-72 rounded-2xl" /></div>
        <div className="flex justify-end"><Bone className="h-10 w-40 rounded-2xl" /></div>
      </div>
    </div>
  )
}

export function AnalyticsSkeleton() {
  return (
    <div className="p-8 max-w-[1100px] space-y-6">
      <div className="space-y-2 mb-8">
        <Bone className="h-8 w-40" />
        <Bone className="h-3.5 w-64" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[0,1,2].map(i => (
          <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-3">
            <Bone className="h-3 w-28" />
            <Bone className="h-10 w-20" />
            <Bone className="h-3 w-16 rounded-full" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <Bone className="h-4 w-32 mb-6" />
          <Bone className="h-48 rounded-xl" />
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <Bone className="h-4 w-32 mb-6" />
          <Bone className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
