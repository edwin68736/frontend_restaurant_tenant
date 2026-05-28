import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import type { ReactNode, MouseEvent } from 'react'
import { REST_PORTAL_MODAL_STACK_Z, REST_PORTAL_MODAL_Z } from '@/utils/restaurantUiLayers'

type Props = {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  overlayClassName?: string
  /** Capa superior (p. ej. sobre modal de cobro). */
  stacked?: boolean
}

/** Modal en document.body — evita recorte por overflow del layout restaurante. */
export function PortalModal({
  open,
  onClose,
  children,
  className = '',
  overlayClassName = '',
  stacked = false,
}: Props) {
  if (!open || typeof document === 'undefined') return null

  const zLayer = stacked ? REST_PORTAL_MODAL_STACK_Z : REST_PORTAL_MODAL_Z

  return createPortal(
    <div
      className={clsx(
        `fixed inset-0 ${zLayer} flex justify-center bg-black/50 p-3 sm:p-4`,
        overlayClassName?.includes('items-') ? null : 'items-center',
        overlayClassName,
      )}
      onMouseDown={(e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`w-full max-h-[min(92dvh,900px)] ${className}`}>{children}</div>
    </div>,
    document.body,
  )
}
