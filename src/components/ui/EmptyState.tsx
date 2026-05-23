import type { LucideIcon } from 'lucide-react'

type Props = {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center rounded-2xl border border-stone-200/80 bg-white shadow-sm px-6 py-14 sm:py-16 ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rest-50 to-stone-50 border border-rest-100 flex items-center justify-center text-rest-500 mb-5 shadow-inner">
        <Icon size={32} strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-stone-800">{title}</h3>
      <p className="text-sm text-stone-500 mt-2 max-w-md leading-relaxed">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
