export function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-stone-200/70" />
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="h-72 rounded-2xl bg-stone-200/70" />
        <div className="h-72 rounded-2xl bg-stone-200/70" />
      </div>
      <div className="h-80 rounded-2xl bg-stone-200/70" />
    </div>
  )
}
