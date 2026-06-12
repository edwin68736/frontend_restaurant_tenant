import { BarChart3 } from 'lucide-react'

export function DashboardEmpty({ message = 'Sin datos en el periodo seleccionado' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-stone-400">
      <BarChart3 size={40} className="mb-3 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
