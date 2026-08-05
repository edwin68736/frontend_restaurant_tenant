import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, Bell } from 'lucide-react'
import { AnchoredDropdown } from '@/components/ui/AnchoredDropdown'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import {
  buildPlanNotifications,
  planNotificationIconClass,
} from '@/pages/subscription/planNotifications'

/**
 * Campana del header de tukichef: avisos del plan (vencimiento, mora, cupo de documentos y
 * cuotas de usuarios/sucursales/productos). Si más adelante se suman otras fuentes, se agrupan
 * aquí bajo su propio encabezado igual que en el ERP.
 */
export default function NotificationsBell() {
  const { hub } = useSubscriptionStatus()
  const limits = usePlanLimits()
  const navigate = useNavigate()
  const [openId, setOpenId] = useState<string | null>(null)

  const notifications = buildPlanNotifications(hub, limits)
  const count = notifications.length

  return (
    <AnchoredDropdown
      menuId="notifications"
      openId={openId}
      onOpenChange={setOpenId}
      menuWidth={288}
      triggerClassName="relative inline-flex items-center justify-center rounded-lg p-2 text-stone-600 transition-colors hover:bg-rest-50 hover:text-rest-700"
      trigger={
        <>
          <Bell size={20} strokeWidth={2} />
          {count > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
              {count}
            </span>
          ) : null}
          <span className="sr-only">Notificaciones</span>
        </>
      }
    >
      {count > 0 ? (
        <>
          <div className="border-b border-stone-100 px-3 py-2 text-xs font-semibold uppercase text-stone-500">
            Mi plan
          </div>
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                setOpenId(null)
                navigate(n.to)
              }}
              className="flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm text-stone-700 hover:bg-stone-50"
            >
              <BadgeCheck
                size={18}
                className={`${planNotificationIconClass(n.tone)} mt-0.5 shrink-0`}
              />
              <span>{n.message}</span>
            </button>
          ))}
        </>
      ) : (
        <div className="px-4 py-3 text-center text-sm text-stone-500">Sin notificaciones</div>
      )}
    </AnchoredDropdown>
  )
}
